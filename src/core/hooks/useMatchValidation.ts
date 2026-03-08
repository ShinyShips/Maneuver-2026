/**
 * useMatchValidation Hook
 * 
 * Orchestrates the validation workflow:
 * - Fetches all matches from TBA for an event (TBA-first approach)
 * - Loads scouted data from IndexedDB
 * - Runs validation comparisons
 * - Stores and retrieves validation results
 * 
 * Uses generic field mappings from game-schema.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
    MatchValidationResult,
    MatchListItem,
    ValidationSummary,
    ValidationConfig,
    ScoutedAllianceData,
    AllianceValidation,
    TeamValidation,
    MatchFilters,
} from '@/core/lib/matchValidationTypes';
import { DEFAULT_VALIDATION_CONFIG } from '@/core/lib/matchValidationTypes';
import {
    createMatchListItem,
    parseTBABreakdown,
    compareAllianceData,
    calculateValidationSummary,
    filterAndSortMatches,
    sortMatchList,
    extractTeamNumbers,
    parseMatchKey,
} from '@/core/lib/matchValidationUtils';
import { useTBAMatchData } from '@/core/hooks/useTBAMatchData';
import {
    storeValidationResult,
    getEventValidationResults,
    clearEventValidationResults,
} from '@/core/lib/tbaCache';
import { getAllMappedActionKeys, getAllMappedToggleKeys } from '@/game-template/game-schema';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface ValidationProgress {
    current: number;
    total: number;
    currentMatch: string;
    phase: 'fetching-tba' | 'loading-scouting' | 'validating' | 'storing';
}

interface UseMatchValidationOptions {
    eventKey: string;
    config?: ValidationConfig;
    autoLoad?: boolean;
}

interface UseMatchValidationReturn {
    // State
    isLoading: boolean;
    isValidating: boolean;
    error: string | null;
    progress: ValidationProgress | null;

    // Data
    matchList: MatchListItem[];
    filteredMatchList: MatchListItem[];
    summary: ValidationSummary | null;

    // Filters
    filters: MatchFilters;
    setFilters: (filters: MatchFilters) => void;

    // Actions
    loadMatches: () => Promise<void>;
    validateEvent: () => Promise<void>;
    validateMatch: (matchKey: string) => Promise<MatchValidationResult | null>;
    refreshResults: () => Promise<void>;
    clearResults: () => Promise<void>;

    // Helpers
    getMatchResult: (matchKey: string) => MatchValidationResult | null;
}

// Default filters
const DEFAULT_FILTERS: MatchFilters = {
    status: 'all',
    matchType: 'all',
    scoutingStatus: 'all',
    searchQuery: '',
    sortBy: 'match',
    sortOrder: 'asc',
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMatchValidation({
    eventKey,
    config = DEFAULT_VALIDATION_CONFIG,
    autoLoad = true,
}: UseMatchValidationOptions): UseMatchValidationReturn {
    // State
    const [isLoading, setIsLoading] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<ValidationProgress | null>(null);
    const [matchList, setMatchList] = useState<MatchListItem[]>([]);
    const [filters, setFilters] = useState<MatchFilters>(DEFAULT_FILTERS);
    const [validationResults, setValidationResults] = useState<Map<string, MatchValidationResult>>(new Map());

    // TBA data hook
    const { fetchEventMatches, matches: tbaMatches, loading: tbaLoading } = useTBAMatchData();

    // ============================================================================
    // Load Matches from TBA
    // ============================================================================

    const loadMatches = useCallback(async () => {
        if (!eventKey) return;

        setIsLoading(true);
        setError(null);

        try {
            // Get TBA API key from environment variable
            const apiKey = import.meta.env.VITE_TBA_API_KEY;
            if (!apiKey) {
                throw new Error('TBA API key not configured. Please set VITE_TBA_API_KEY in your .env file.');
            }

            // Fetch matches from TBA
            setProgress({ current: 0, total: 1, currentMatch: '', phase: 'fetching-tba' });
            await fetchEventMatches(eventKey, apiKey);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load matches';
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
            setProgress(null);
        }
    }, [eventKey, fetchEventMatches]);

    // ============================================================================
    // Update Match List when TBA data changes
    // ============================================================================

    useEffect(() => {
        if (!tbaMatches || tbaMatches.length === 0) return;

        const updateMatchList = async () => {
            // Create match list items from TBA data
            const items = tbaMatches.map(createMatchListItem);

            // Load scouting data to check which matches have been scouted
            await updateScoutingStatus(items);

            // Load existing validation results
            await loadValidationResults(items);

            // Sort by match number
            const sorted = sortMatchList(items);
            setMatchList(sorted);
        };

        updateMatchList();
    }, [tbaMatches]);

    // ============================================================================
    // Update Scouting Status
    // ============================================================================

    const updateScoutingStatus = async (items: MatchListItem[]) => {
        try {
            // Get all scouting entries for the event from IndexedDB
            const scoutingEntries = await getScoutingEntriesForEvent(eventKey);

            for (const item of items) {
                // Find scouting entries for this match
                const matchEntries = scoutingEntries.filter(
                    entry => entry.matchKey === item.matchKey ||
                        entry.matchNumber === item.matchNumber
                );

                // Count scouted teams per alliance
                const redScouted = new Set(
                    matchEntries
                        .filter(e => e.allianceColor === 'red')
                        .map(e => e.teamNumber.toString())
                );
                const blueScouted = new Set(
                    matchEntries
                        .filter(e => e.allianceColor === 'blue')
                        .map(e => e.teamNumber.toString())
                );

                item.redTeamsScouted = Math.min(redScouted.size, 3);
                item.blueTeamsScouted = Math.min(blueScouted.size, 3);
                item.hasScouting = matchEntries.length > 0;
                item.scoutingComplete = item.redTeamsScouted === 3 && item.blueTeamsScouted === 3;
            }
        } catch (err) {
            console.error('Failed to update scouting status:', err);
        }
    };

    // ============================================================================
    // Load Validation Results
    // ============================================================================

    const loadValidationResults = async (items: MatchListItem[]) => {
        try {
            const dbResults = await getEventValidationResults(eventKey);
            const resultsMap = new Map<string, MatchValidationResult>();

            for (const dbResult of dbResults) {
                // Extract the actual MatchValidationResult from the DB wrapper
                const result = dbResult.result;
                resultsMap.set(result.matchKey, result);

                // Attach to match list item
                const item = items.find(i => i.matchKey === result.matchKey);
                if (item) {
                    item.validationResult = result;
                }
            }

            setValidationResults(resultsMap);
        } catch (err) {
            console.error('Failed to load validation results:', err);
        }
    };

    // ============================================================================
    // Validate Event
    // ============================================================================

    const validateEvent = useCallback(async () => {
        if (!eventKey) return;

        // Load matches first if not already loaded
        if (matchList.length === 0) {
            await loadMatches();
            // After loading, the effect will update matchList, so we return and let user click again
            toast.info('Matches loaded. Click "Validate Event" again to run validation.');
            return;
        }

        setIsValidating(true);
        setError(null);

        const matchesToValidate = matchList.filter(m => m.hasScouting && m.hasTBAResults);

        try {
            let validated = 0;
            const newResults = new Map(validationResults);

            for (const match of matchesToValidate) {
                setProgress({
                    current: validated,
                    total: matchesToValidate.length,
                    currentMatch: match.displayName,
                    phase: 'validating',
                });

                const result = await validateSingleMatch(match);
                if (result) {
                    newResults.set(match.matchKey, result);
                    match.validationResult = result;
                }

                validated++;
            }

            setValidationResults(newResults);
            setMatchList([...matchList]);  // Trigger re-render

            toast.success(`Validated ${validated} matches`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Validation failed';
            setError(message);
            toast.error(message);
        } finally {
            setIsValidating(false);
            setProgress(null);
        }
    }, [eventKey, matchList, validationResults, loadMatches]);

    // ============================================================================
    // Validate Single Match
    // ============================================================================

    const validateSingleMatch = async (match: MatchListItem): Promise<MatchValidationResult | null> => {
        try {
            console.log('[Validation] Starting validation for:', match.matchKey, 'matchNumber:', match.matchNumber);

            // Find TBA match data
            const tbaMatch = tbaMatches.find(m => m.key === match.matchKey);
            if (!tbaMatch || !tbaMatch.score_breakdown) {
                console.log('[Validation] No TBA data for:', match.matchKey);
                return createNoTBADataResult(match);
            }

            // Get scouting entries for this match
            const entries = await getScoutingEntriesForMatch(eventKey, match.matchKey, match.matchNumber);
            console.log('[Validation] Found', entries.length, 'scouting entries for:', match.matchKey);

            if (entries.length === 0) {
                console.log('[Validation] No scouting entries - returning no-scouting result');
                return createNoScoutingResult(match);
            }

            // Aggregate scouting data by alliance
            const redEntries = entries.filter(e => e.allianceColor === 'red');
            const blueEntries = entries.filter(e => e.allianceColor === 'blue');

            const redScouted = aggregateScoutingData('red', match, redEntries);
            const blueScouted = aggregateScoutingData('blue', match, blueEntries);

            // Parse TBA breakdown
            const redTBA = parseTBABreakdown(
                'red',
                extractTeamNumbers(tbaMatch.alliances.red.team_keys),
                tbaMatch.score_breakdown.red as Record<string, unknown>,
                tbaMatch.alliances.red
            );
            const blueTBA = parseTBABreakdown(
                'blue',
                extractTeamNumbers(tbaMatch.alliances.blue.team_keys),
                tbaMatch.score_breakdown.blue as Record<string, unknown>,
                tbaMatch.alliances.blue
            );

            // Compare and generate discrepancies
            const redDiscrepancies = compareAllianceData(redScouted, redTBA, config);
            const blueDiscrepancies = compareAllianceData(blueScouted, blueTBA, config);

            // Build alliance validation results
            const redAlliance = buildAllianceValidation('red', redScouted, redTBA, redDiscrepancies, config);
            const blueAlliance = buildAllianceValidation('blue', blueScouted, blueTBA, blueDiscrepancies, config);

            // Build team validation results
            const teams = buildTeamValidations(redEntries, blueEntries, redDiscrepancies, blueDiscrepancies);

            // Determine overall status
            const totalDiscrepancies = redDiscrepancies.length + blueDiscrepancies.length;
            const criticalDiscrepancies = [...redDiscrepancies, ...blueDiscrepancies]
                .filter(d => d.severity === 'critical').length;
            const warningDiscrepancies = [...redDiscrepancies, ...blueDiscrepancies]
                .filter(d => d.severity === 'warning').length;

            const status = determineOverallStatus(criticalDiscrepancies, warningDiscrepancies, config);
            const confidence = determineConfidence(redScouted, blueScouted, totalDiscrepancies, config);

            const parsed = parseMatchKey(match.matchKey);

            const result: MatchValidationResult = {
                id: `${eventKey}_${match.matchKey}`,
                eventKey,
                matchKey: match.matchKey,
                matchNumber: match.matchNumber.toString(),
                compLevel: parsed.compLevel,
                setNumber: parsed.setNumber,
                status,
                confidence,
                redAlliance,
                blueAlliance,
                teams,
                totalDiscrepancies,
                criticalDiscrepancies,
                warningDiscrepancies,
                flaggedForReview: criticalDiscrepancies >= config.autoFlagThreshold,
                requiresReScout: criticalDiscrepancies >= config.requireReScoutThreshold,
                validatedAt: Date.now(),
            };

            console.log('[Validation] Created result with status:', result.status, 'for:', match.matchKey);

            // Store result in DB format
            await storeValidationResult({
                id: result.id,
                eventKey: result.eventKey,
                matchKey: result.matchKey,
                matchNumber: result.matchNumber,
                result: result,
                timestamp: Date.now(),
            });

            console.log('[Validation] Stored result successfully for:', match.matchKey);
            return result;
        } catch (err) {
            console.error(`[Validation] CAUGHT ERROR for ${match.matchKey}:`, err);
            return null;
        }
    };

    const validateMatch = useCallback(async (matchKey: string): Promise<MatchValidationResult | null> => {
        const match = matchList.find(m => m.matchKey === matchKey);
        if (!match) return null;

        setIsValidating(true);
        try {
            const result = await validateSingleMatch(match);
            if (result) {
                const newResults = new Map(validationResults);
                newResults.set(matchKey, result);
                setValidationResults(newResults);

                match.validationResult = result;
                setMatchList([...matchList]);
            }
            return result;
        } finally {
            setIsValidating(false);
        }
    }, [matchList, validationResults]);

    // ============================================================================
    // Refresh and Clear
    // ============================================================================

    const refreshResults = useCallback(async () => {
        if (matchList.length > 0) {
            await loadValidationResults([...matchList]);
            setMatchList([...matchList]);
        }
    }, [matchList]);

    const clearResults = useCallback(async () => {
        if (!eventKey) return;

        try {
            await clearEventValidationResults(eventKey);

            // Clear from state
            setValidationResults(new Map());

            // Clear from match list items
            for (const match of matchList) {
                match.validationResult = undefined;
            }
            setMatchList([...matchList]);

            toast.success('Validation results cleared');
        } catch {
            toast.error('Failed to clear results');
        }
    }, [eventKey, matchList]);

    // ============================================================================
    // Helpers
    // ============================================================================

    const getMatchResult = useCallback((matchKey: string): MatchValidationResult | null => {
        return validationResults.get(matchKey) ?? null;
    }, [validationResults]);

    // ============================================================================
    // Computed Values
    // ============================================================================

    const filteredMatchList = useMemo(() => {
        return filterAndSortMatches(matchList, filters);
    }, [matchList, filters]);

    const summary = useMemo(() => {
        if (matchList.length === 0) return null;
        return calculateValidationSummary(matchList, eventKey);
    }, [matchList, eventKey]);

    // ============================================================================
    // Auto-load on mount
    // ============================================================================

    useEffect(() => {
        if (autoLoad && eventKey) {
            loadMatches();
        }
    }, [eventKey, autoLoad]);

    return {
        isLoading: isLoading || tbaLoading,
        isValidating,
        error,
        progress,
        matchList,
        filteredMatchList,
        summary,
        filters,
        setFilters,
        loadMatches,
        validateEvent,
        validateMatch,
        refreshResults,
        clearResults,
        getMatchResult,
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get scouting entries for an event from IndexedDB
 */
async function getScoutingEntriesForEvent(eventKey: string): Promise<Array<{
    matchKey: string;
    matchNumber: number;
    teamNumber: number;
    allianceColor: 'red' | 'blue';
    scoutName: string;
    gameData: Record<string, unknown>;
}>> {
    // This would query your scouting database
    // For now, return empty array - implement based on your DB schema
    try {
        const { getEntriesByEvent } = await import('@/core/db/scoutingDatabase');
        const entries = await getEntriesByEvent(eventKey);
        return entries.map(e => ({
            matchKey: e.matchKey,
            matchNumber: e.matchNumber,
            teamNumber: e.teamNumber,
            allianceColor: e.allianceColor,
            scoutName: e.scoutName,
            gameData: e.gameData as Record<string, unknown>,
        }));
    } catch {
        return [];
    }
}

/**
 * Get scouting entries for a specific match
 */
async function getScoutingEntriesForMatch(
    eventKey: string,
    matchKey: string,
    matchNumber: number
): Promise<Array<{
    teamNumber: number;
    allianceColor: 'red' | 'blue';
    scoutName: string;
    gameData: Record<string, unknown>;
}>> {
    const entries = await getScoutingEntriesForEvent(eventKey);
    return entries.filter(e => e.matchKey === matchKey || e.matchNumber === matchNumber);
}

/**
 * Aggregate scouting entries into alliance data
 */
function aggregateScoutingData(
    alliance: 'red' | 'blue',
    match: MatchListItem,
    entries: Array<{ teamNumber: number; scoutName: string; gameData: Record<string, unknown> }>
): ScoutedAllianceData {

    const data: ScoutedAllianceData = {
        alliance,
        matchKey: match.matchKey,
        matchNumber: match.matchNumber.toString(),
        eventKey: match.matchKey.split('_')[0] || '',
        teams: entries.map(e => e.teamNumber.toString()),
        scoutNames: entries.map(e => e.scoutName),
        actions: {},
        toggles: {},
        missingTeams: [],
        scoutedTeamsCount: entries.length,
    };

    // Initialize action counts
    const actionKeys = getAllMappedActionKeys();
    for (const key of actionKeys) {
        data.actions[key] = 0;
    }

    // Initialize toggle counts
    const toggleKeys = getAllMappedToggleKeys();
    for (const key of toggleKeys) {
        data.toggles[key] = 0;
    }

    // Aggregate from entries
    for (const entry of entries) {
        const gameData = entry.gameData;
        console.log('[Aggregate] Processing entry for team', entry.teamNumber, 'gameData:', gameData);

        // Get flattened values from nested gameData structure
        // gameData can be { auto: {...}, teleop: {...}, endgame: {...} } or flat
        const flatGameData: Record<string, unknown> = {};

        // Check if gameData is nested (has auto/teleop/endgame phases)
        const phases = ['auto', 'teleop', 'endgame'];
        for (const phase of phases) {
            const phaseData = gameData[phase] as Record<string, unknown> | undefined;
            if (phaseData && typeof phaseData === 'object') {
                // Flatten phase data - extract values from nested structure
                for (const [key, value] of Object.entries(phaseData)) {
                    flatGameData[key] = value;
                }
            }
        }

        // Also include any top-level flat values
        for (const [key, value] of Object.entries(gameData)) {
            if (!phases.includes(key)) {
                flatGameData[key] = value;
            }
        }

        console.log('[Aggregate] Flattened gameData:', flatGameData);

        // Sum actions
        for (const key of actionKeys) {
            // Try both flat key and phase-prefixed keys
            let value = flatGameData[key];
            if (value === undefined) {
                // Try with phase prefixes (e.g., action1Count might be stored as is)
                value = flatGameData[`${key}Count`];
            }
            if (typeof value === 'number') {
                data.actions[key] = (data.actions[key] ?? 0) + value;
            }
        }

        // Count toggles
        for (const key of toggleKeys) {
            const value = flatGameData[key];
            console.log('[Aggregate] Toggle', key, '=', value, 'type:', typeof value);
            if (value === true || value === 1) {
                data.toggles[key] = (data.toggles[key] ?? 0) + 1;
            }
        }
    }

    // Track missing teams
    const expectedTeams = alliance === 'red' ? match.redTeams : match.blueTeams;
    const scoutedTeams = new Set(entries.map(e => e.teamNumber.toString()));
    data.missingTeams = expectedTeams.filter(t => !scoutedTeams.has(t));

    return data;
}

/**
 * Build alliance validation result
 */
function buildAllianceValidation(
    alliance: 'red' | 'blue',
    scouted: ScoutedAllianceData,
    tba: import('@/core/lib/matchValidationTypes').TBAAllianceData,
    discrepancies: import('@/core/lib/matchValidationTypes').Discrepancy[],
    config: ValidationConfig
): AllianceValidation {
    const criticalCount = discrepancies.filter(d => d.severity === 'critical').length;
    const warningCount = discrepancies.filter(d => d.severity === 'warning').length;

    const status = determineOverallStatus(criticalCount, warningCount, config);

    // Calculate total scouted points (simplified - would need game-specific logic)
    const totalScoutedPoints = Object.values(scouted.actions).reduce((a, b) => a + b, 0);

    return {
        alliance,
        status,
        confidence: scouted.scoutedTeamsCount === 3 ? 'high' : scouted.scoutedTeamsCount >= 1 ? 'medium' : 'low',
        discrepancies,
        totalScoutedPoints,
        totalTBAPoints: tba.totalPoints,
        scoreDifference: tba.totalPoints - totalScoutedPoints,
        scorePercentDiff: tba.totalPoints > 0
            ? Math.abs(tba.totalPoints - totalScoutedPoints) / tba.totalPoints * 100
            : 0,
        scoutedData: scouted,
        tbaData: tba,
    };
}

/**
 * Build team validation results
 */
function buildTeamValidations(
    redEntries: Array<{ teamNumber: number; scoutName: string; gameData: Record<string, unknown> }>,
    blueEntries: Array<{ teamNumber: number; scoutName: string; gameData: Record<string, unknown> }>,
    redDiscrepancies: import('@/core/lib/matchValidationTypes').Discrepancy[],
    blueDiscrepancies: import('@/core/lib/matchValidationTypes').Discrepancy[]
): TeamValidation[] {
    const teams: TeamValidation[] = [];

    for (const entry of redEntries) {
        teams.push({
            teamNumber: entry.teamNumber.toString(),
            alliance: 'red',
            scoutName: entry.scoutName,
            hasScoutedData: true,
            discrepancies: [],  // Per-team discrepancies would need more complex logic
            confidence: 'medium',
            flagForReview: redDiscrepancies.some(d => d.severity === 'critical'),
            notes: [],
        });
    }

    for (const entry of blueEntries) {
        teams.push({
            teamNumber: entry.teamNumber.toString(),
            alliance: 'blue',
            scoutName: entry.scoutName,
            hasScoutedData: true,
            discrepancies: [],
            confidence: 'medium',
            flagForReview: blueDiscrepancies.some(d => d.severity === 'critical'),
            notes: [],
        });
    }

    return teams;
}

/**
 * Determine overall validation status
 */
function determineOverallStatus(
    criticalCount: number,
    warningCount: number,
    config: ValidationConfig
): import('@/core/lib/matchValidationTypes').ValidationStatus {
    if (criticalCount >= config.requireReScoutThreshold) return 'failed';
    if (criticalCount >= config.autoFlagThreshold) return 'flagged';
    if (warningCount > 0) return 'flagged';
    return 'passed';
}

/**
 * Determine confidence level
 */
function determineConfidence(
    redScouted: ScoutedAllianceData,
    blueScouted: ScoutedAllianceData,
    totalDiscrepancies: number,
    config: ValidationConfig
): import('@/core/lib/matchValidationTypes').ConfidenceLevel {
    const totalScouted = redScouted.scoutedTeamsCount + blueScouted.scoutedTeamsCount;

    if (totalScouted < 4) return 'low';
    if (totalDiscrepancies > config.maxDiscrepanciesForHighConfidence) return 'medium';
    if (totalScouted === 6) return 'high';
    return 'medium';
}

/**
 * Create result for matches without TBA data
 */
function createNoTBADataResult(match: MatchListItem): MatchValidationResult {
    const parsed = parseMatchKey(match.matchKey);

    return {
        id: `${match.matchKey.split('_')[0]}_${match.matchKey}`,
        eventKey: match.matchKey.split('_')[0] || '',
        matchKey: match.matchKey,
        matchNumber: match.matchNumber.toString(),
        compLevel: parsed.compLevel ?? 'qm',
        setNumber: parsed.setNumber,
        status: 'no-tba-data',
        confidence: 'low',
        redAlliance: createEmptyAllianceValidation('red'),
        blueAlliance: createEmptyAllianceValidation('blue'),
        teams: [],
        totalDiscrepancies: 0,
        criticalDiscrepancies: 0,
        warningDiscrepancies: 0,
        flaggedForReview: false,
        requiresReScout: false,
        validatedAt: Date.now(),
    };
}

/**
 * Create result for matches without scouting data
 */
function createNoScoutingResult(match: MatchListItem): MatchValidationResult {
    const parsed = parseMatchKey(match.matchKey);

    return {
        id: `${match.matchKey.split('_')[0]}_${match.matchKey}`,
        eventKey: match.matchKey.split('_')[0] || '',
        matchKey: match.matchKey,
        matchNumber: match.matchNumber.toString(),
        compLevel: parsed.compLevel ?? 'qm',
        setNumber: parsed.setNumber,
        status: 'no-scouting',
        confidence: 'low',
        redAlliance: createEmptyAllianceValidation('red'),
        blueAlliance: createEmptyAllianceValidation('blue'),
        teams: [],
        totalDiscrepancies: 0,
        criticalDiscrepancies: 0,
        warningDiscrepancies: 0,
        flaggedForReview: false,
        requiresReScout: false,
        validatedAt: Date.now(),
    };
}

/**
 * Create empty alliance validation
 */
function createEmptyAllianceValidation(alliance: 'red' | 'blue'): AllianceValidation {
    return {
        alliance,
        status: 'pending',
        confidence: 'low',
        discrepancies: [],
        totalScoutedPoints: 0,
        totalTBAPoints: 0,
        scoreDifference: 0,
        scorePercentDiff: 0,
    };
}
