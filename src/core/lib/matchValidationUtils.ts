/**
 * Match Validation Utilities
 * 
 * Core utilities for aggregating scouting data and comparing against TBA data.
 * Uses game-schema for field mappings instead of hardcoded values.
 */

import type {
    MatchValidationResult,
    MatchListItem,
    ValidationSummary,
    MatchFilters,
    ScoutedAllianceData,
    TBAAllianceData,
    Discrepancy,
    DiscrepancySeverity,
    ValidationThresholds,
    ValidationConfig,
} from './matchValidationTypes';
import type { TBAMatchData } from './tbaMatchData';
import {
    getAllMappedActionKeys,
    getAllMappedToggleKeys,
    getActionMapping,
    getToggleMapping,
    actions,
    toggles,
    type TBAMappingType,
} from '@/game-template/game-schema';

// ============================================================================
// Match Key Parsing (with Elim Match Support)
// ============================================================================

/**
 * Parse match key to extract components
 * Handles qualification (qm), semifinal (sf), and final (f) formats
 * 
 * @example
 * parseMatchKey('2025mrcmp_qm15') → { eventKey: '2025mrcmp', compLevel: 'qm', matchNumber: 15, setNumber: 1 }
 * parseMatchKey('2025mrcmp_sf1m1') → { eventKey: '2025mrcmp', compLevel: 'sf', matchNumber: 1, setNumber: 1 }
 * parseMatchKey('2025mrcmp_f1m2') → { eventKey: '2025mrcmp', compLevel: 'f', matchNumber: 2, setNumber: 1 }
 */
export function parseMatchKey(matchKey: string): {
    eventKey: string;
    compLevel: string;
    matchNumber: number;
    setNumber: number;
    displayNumber: string;
} {
    const parts = matchKey.split('_');
    if (parts.length !== 2) {
        throw new Error(`Invalid match key format: ${matchKey}`);
    }

    const eventKey = parts[0] || '';
    const matchPart = parts[1];

    if (!matchPart) {
        throw new Error(`Invalid match key format: ${matchKey}`);
    }

    // Qualification matches: qm15
    if (matchPart.startsWith('qm')) {
        const matchNumber = parseInt(matchPart.substring(2), 10) || 0;
        return {
            eventKey,
            compLevel: 'qm',
            matchNumber,
            setNumber: 1,
            displayNumber: matchNumber.toString(),
        };
    }

    // Semifinal matches: sf1m1, sf2m1, etc.
    const sfMatch = matchPart.match(/^sf(\d+)m(\d+)$/);
    if (sfMatch && sfMatch[1] && sfMatch[2]) {
        return {
            eventKey,
            compLevel: 'sf',
            setNumber: parseInt(sfMatch[1], 10),
            matchNumber: parseInt(sfMatch[2], 10),
            displayNumber: `${sfMatch[1]}-${sfMatch[2]}`,
        };
    }

    // Final matches: f1m1, f1m2, etc.
    const fMatch = matchPart.match(/^f(\d+)m(\d+)$/);
    if (fMatch && fMatch[1] && fMatch[2]) {
        return {
            eventKey,
            compLevel: 'f',
            setNumber: parseInt(fMatch[1], 10),
            matchNumber: parseInt(fMatch[2], 10),
            displayNumber: fMatch[2],  // Just show match number for finals
        };
    }

    // Fallback for unknown formats
    return {
        eventKey,
        compLevel: matchPart.replace(/\d/g, ''),
        matchNumber: parseInt(matchPart.replace(/\D/g, ''), 10) || 0,
        setNumber: 1,
        displayNumber: matchPart.replace(/\D/g, '') || '0',
    };
}

/**
 * Format match key into human-readable label
 * 
 * @example
 * formatMatchLabel({ matchKey: '2025mrcmp_qm15', ... }) → 'Qual 15'
 * formatMatchLabel({ matchKey: '2025mrcmp_sf1m1', ... }) → 'SF 1-1'
 * formatMatchLabel({ matchKey: '2025mrcmp_f1m2', ... }) → 'Final 2'
 */
export function formatMatchLabel(matchKeyOrResult: string | MatchValidationResult | MatchListItem): string {
    const matchKey = typeof matchKeyOrResult === 'string'
        ? matchKeyOrResult
        : matchKeyOrResult.matchKey;

    try {
        const parsed = parseMatchKey(matchKey);

        switch (parsed.compLevel) {
            case 'qm':
                return `Qual ${parsed.matchNumber}`;
            case 'sf':
                return `SF ${parsed.setNumber}-${parsed.matchNumber}`;
            case 'f':
                return `Final ${parsed.matchNumber}`;
            default:
                return `Match ${parsed.displayNumber}`;
        }
    } catch {
        // Fallback if parsing fails
        return matchKey;
    }
}

// ============================================================================
// Sorting and Filtering
// ============================================================================

/**
 * Sort validation results by competition level and match number
 */
export function sortValidationResults(results: MatchValidationResult[]): MatchValidationResult[] {
    return [...results].sort((a, b) => compareMatchKeys(a.matchKey, b.matchKey));
}

/**
 * Sort match list items by competition level and match number
 */
export function sortMatchList(matches: MatchListItem[]): MatchListItem[] {
    return [...matches].sort((a, b) => compareMatchKeys(a.matchKey, b.matchKey));
}

/**
 * Compare two match keys for sorting
 * Order: qm < sf < f, then by set number, then by match number
 */
function compareMatchKeys(a: string, b: string): number {
    const parsedA = parseMatchKey(a);
    const parsedB = parseMatchKey(b);

    // Competition level order
    const compOrder: Record<string, number> = { qm: 1, sf: 2, f: 3 };
    const aOrder = compOrder[parsedA.compLevel] ?? 4;
    const bOrder = compOrder[parsedB.compLevel] ?? 4;

    if (aOrder !== bOrder) {
        return aOrder - bOrder;
    }

    // Same comp level - compare set numbers
    if (parsedA.setNumber !== parsedB.setNumber) {
        return parsedA.setNumber - parsedB.setNumber;
    }

    // Same set - compare match numbers
    return parsedA.matchNumber - parsedB.matchNumber;
}

/**
 * Apply filters and sorting to match list
 */
export function filterAndSortMatches(
    matches: MatchListItem[],
    filters: MatchFilters
): MatchListItem[] {
    let filtered = [...matches];

    // Status filter
    if (filters.status !== 'all') {
        filtered = filtered.filter(m => {
            if (!m.validationResult) {
                return filters.status === 'no-scouting' ? !m.hasScouting :
                    filters.status === 'pending' ? m.hasScouting : false;
            }
            return m.validationResult.status === filters.status;
        });
    }

    // Match type filter
    if (filters.matchType !== 'all') {
        filtered = filtered.filter(m => m.compLevel === filters.matchType);
    }

    // Scouting status filter
    if (filters.scoutingStatus !== 'all') {
        filtered = filtered.filter(m => {
            if (filters.scoutingStatus === 'complete') return m.scoutingComplete;
            if (filters.scoutingStatus === 'partial') return m.hasScouting && !m.scoutingComplete;
            if (filters.scoutingStatus === 'none') return !m.hasScouting;
            return true;
        });
    }

    // Search filter
    if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        filtered = filtered.filter(m => {
            // Search in match label
            if (m.displayName.toLowerCase().includes(query)) return true;
            // Search in team numbers
            const allTeams = [...m.redTeams, ...m.blueTeams];
            return allTeams.some(t => t.includes(query));
        });
    }

    // Sort
    filtered.sort((a, b) => {
        let compareValue = 0;

        switch (filters.sortBy) {
            case 'match':
                compareValue = compareMatchKeys(a.matchKey, b.matchKey);
                break;
            case 'status': {
                const statusOrder: Record<string, number> = {
                    'failed': 0,
                    'flagged': 1,
                    'passed': 2,
                    'pending': 3,
                    'no-tba-data': 4,
                    'no-scouting': 5,
                };
                const aStatus = a.validationResult?.status ?? (a.hasScouting ? 'pending' : 'no-scouting');
                const bStatus = b.validationResult?.status ?? (b.hasScouting ? 'pending' : 'no-scouting');
                compareValue = (statusOrder[aStatus] ?? 99) - (statusOrder[bStatus] ?? 99);
                break;
            }
            case 'discrepancies':
                compareValue = (a.validationResult?.totalDiscrepancies ?? 0) -
                    (b.validationResult?.totalDiscrepancies ?? 0);
                break;
            case 'confidence': {
                const confOrder: Record<string, number> = { high: 2, medium: 1, low: 0 };
                const aConf = a.validationResult?.confidence ?? 'low';
                const bConf = b.validationResult?.confidence ?? 'low';
                compareValue = (confOrder[aConf] ?? 0) - (confOrder[bConf] ?? 0);
                break;
            }
        }

        return filters.sortOrder === 'desc' ? -compareValue : compareValue;
    });

    return filtered;
}

// ============================================================================
// TBA Data Parsing
// ============================================================================

/**
 * Extract team numbers from TBA team keys
 * Converts ["frc1", "frc2"] to ["1", "2"]
 */
export function extractTeamNumbers(teamKeys: string[]): string[] {
    return teamKeys.map(key => key.replace('frc', ''));
}

/**
 * Create MatchListItem from TBA match data
 */
export function createMatchListItem(tbaMatch: TBAMatchData): MatchListItem {
    // Extract scores if available
    const hasScores = tbaMatch.score_breakdown !== null;
    const redScore = tbaMatch.alliances?.red?.score;
    const blueScore = tbaMatch.alliances?.blue?.score;

    // Extract auto/teleop scores if breakdown exists
    let redAutoScore: number | undefined;
    let blueAutoScore: number | undefined;
    let redTeleopScore: number | undefined;
    let blueTeleopScore: number | undefined;

    if (hasScores && tbaMatch.score_breakdown) {
        const redBreakdown = tbaMatch.score_breakdown.red as any;
        const blueBreakdown = tbaMatch.score_breakdown.blue as any;

        // Try common TBA field names for auto/teleop scores
        redAutoScore = redBreakdown?.autoPoints ?? redBreakdown?.auto_points;
        blueAutoScore = blueBreakdown?.autoPoints ?? blueBreakdown?.auto_points;
        redTeleopScore = redBreakdown?.teleopPoints ?? redBreakdown?.teleop_points;
        blueTeleopScore = blueBreakdown?.teleopPoints ?? blueBreakdown?.teleop_points;
    }

    return {
        matchKey: tbaMatch.key,
        matchNumber: tbaMatch.match_number,
        compLevel: tbaMatch.comp_level,
        setNumber: tbaMatch.set_number ?? 1,
        displayName: formatMatchLabel(tbaMatch.key),
        redTeams: extractTeamNumbers(tbaMatch.alliances.red.team_keys),
        blueTeams: extractTeamNumbers(tbaMatch.alliances.blue.team_keys),
        hasScouting: false,  // Will be updated when checking scouting data
        scoutingComplete: false,
        redTeamsScouted: 0,
        blueTeamsScouted: 0,
        hasTBAResults: hasScores,
        redScore,
        blueScore,
        redAutoScore,
        blueAutoScore,
        redTeleopScore,
        blueTeleopScore,
        scheduledTime: tbaMatch.time,
        actualTime: tbaMatch.actual_time,
    };
}

/**
 * Parse TBA score breakdown into generic TBAAllianceData
 * Uses mappings from game-schema
 */
export function parseTBABreakdown(
    alliance: 'red' | 'blue',
    teams: string[],
    breakdown: Record<string, unknown> | null,
    allianceScore: { score: number }
): TBAAllianceData {
    const result: TBAAllianceData = {
        alliance,
        teams,
        totalPoints: allianceScore.score ?? 0,
        autoPoints: 0,
        teleopPoints: 0,
        foulPoints: 0,
        breakdown: {},
        foulCount: 0,
        techFoulCount: 0,
    };

    if (!breakdown) {
        return result;
    }

    // Extract standard TBA fields
    result.autoPoints = (breakdown.autoPoints as number) ?? 0;
    result.teleopPoints = (breakdown.teleopPoints as number) ?? 0;
    result.foulPoints = (breakdown.foulPoints as number) ?? 0;
    result.foulCount = (breakdown.foulCount as number) ?? 0;
    result.techFoulCount = (breakdown.techFoulCount as number) ?? 0;

    // Parse action mappings from game-schema
    const actionKeys = getAllMappedActionKeys();
    for (const actionKey of actionKeys) {
        const mapping = getActionMapping(actionKey);
        const value = extractTBAValue(breakdown, mapping.tbaPath, mapping.type);
        result.breakdown[actionKey] = value;
    }

    // Parse toggle mappings from game-schema
    const toggleKeys = getAllMappedToggleKeys();
    for (const toggleKey of toggleKeys) {
        const mapping = getToggleMapping(toggleKey);
        const value = extractTBAValue(
            breakdown,
            mapping.tbaPath,
            mapping.type,
            'matchValue' in mapping ? mapping.matchValue : undefined
        );
        result.breakdown[toggleKey] = value;
    }

    return result;
}

/**
 * Extract value from TBA breakdown using mapping config
 */
function extractTBAValue(
    breakdown: Record<string, unknown>,
    tbaPath: string | readonly string[],
    type: TBAMappingType,
    matchValue?: string
): number {
    // Array of paths - count matching values
    if (Array.isArray(tbaPath)) {
        if (type === 'countMatching' && matchValue) {
            return tbaPath.filter(path => getNestedValue(breakdown, path) === matchValue).length;
        }
        // Sum all values for 'count' type with array
        return tbaPath.reduce((sum, path) => {
            const val = getNestedValue(breakdown, path);
            return sum + (typeof val === 'number' ? val : 0);
        }, 0);
    }

    // Single path
    const value = getNestedValue(breakdown, tbaPath as string);

    if (type === 'count') {
        return typeof value === 'number' ? value : 0;
    }

    if (type === 'boolean') {
        return value === true || value === 'Yes' ? 1 : 0;
    }

    return 0;
}

/**
 * Get nested value from object using dot notation
 * e.g., getNestedValue(obj, 'a.b.c') gets obj.a.b.c
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
        return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj as unknown);
}

// ============================================================================
// Validation Comparison
// ============================================================================

/**
 * Compare scouted data against TBA data and generate discrepancies
 */
export function compareAllianceData(
    scouted: ScoutedAllianceData,
    tba: TBAAllianceData,
    config: ValidationConfig
): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    // Compare each mapped action
    const actionKeys = getAllMappedActionKeys();
    for (const actionKey of actionKeys) {
        const mapping = getActionMapping(actionKey);
        const scoutedValue = scouted.actions[actionKey] ?? 0;
        const tbaValue = tba.breakdown[actionKey] ?? 0;

        if (scoutedValue !== tbaValue) {
            const category = mapping.category;
            const categoryConfig = config.categoryThresholds?.[category];
            const thresholds = categoryConfig ?? config.thresholds;

            const discrepancy = createDiscrepancy(
                category,
                actionKey,
                getActionLabel(actionKey),
                scoutedValue,
                tbaValue,
                thresholds
            );

            if (discrepancy) {
                discrepancies.push(discrepancy);
            }
        }
    }

    // Compare each mapped toggle
    const toggleKeys = getAllMappedToggleKeys();
    for (const toggleKey of toggleKeys) {
        const mapping = getToggleMapping(toggleKey);
        const scoutedValue = scouted.toggles[toggleKey] ?? 0;
        const tbaValue = tba.breakdown[toggleKey] ?? 0;

        if (scoutedValue !== tbaValue) {
            const category = mapping.category;
            const categoryConfig = config.categoryThresholds?.[category];
            const thresholds = categoryConfig ?? config.thresholds;

            const discrepancy = createDiscrepancy(
                category,
                toggleKey,
                getToggleLabel(toggleKey),
                scoutedValue,
                tbaValue,
                thresholds
            );

            if (discrepancy) {
                discrepancies.push(discrepancy);
            }
        }
    }

    return discrepancies;
}

/**
 * Create a discrepancy object with severity calculation
 */
function createDiscrepancy(
    category: string,
    field: string,
    fieldLabel: string,
    scoutedValue: number,
    tbaValue: number,
    thresholds: ValidationThresholds
): Discrepancy | null {
    const difference = Math.abs(scoutedValue - tbaValue);
    const percentDiff = tbaValue > 0 ? (difference / tbaValue) * 100 : (difference > 0 ? 100 : 0);

    const severity = calculateSeverity(difference, percentDiff, thresholds);

    if (severity === 'none') {
        return null;
    }

    const direction = scoutedValue > tbaValue ? 'over-counted' : 'under-counted';

    return {
        category,
        field,
        fieldLabel,
        scoutedValue,
        tbaValue,
        difference,
        percentDiff,
        severity,
        message: `${fieldLabel}: Scouted ${scoutedValue}, TBA ${tbaValue} (${direction} by ${difference})`,
    };
}

/**
 * Calculate severity based on thresholds
 */
function calculateSeverity(
    absoluteDiff: number,
    percentDiff: number,
    thresholds: ValidationThresholds
): DiscrepancySeverity {
    // Check absolute thresholds first (for low-count items)
    if (absoluteDiff >= thresholds.criticalAbsolute) return 'critical';
    if (absoluteDiff >= thresholds.warningAbsolute) return 'warning';
    if (absoluteDiff >= thresholds.minorAbsolute) return 'minor';

    // Check percentage thresholds
    if (percentDiff >= thresholds.critical) return 'critical';
    if (percentDiff >= thresholds.warning) return 'warning';
    if (percentDiff >= thresholds.minor) return 'minor';

    return 'none';
}

/**
 * Get human-readable label for action key
 */
function getActionLabel(actionKey: string): string {
    // Check if this action key exists in the actions object
    if (actionKey in actions) {
        return actions[actionKey as keyof typeof actions].label;
    }
    return actionKey;
}

/**
 * Get human-readable label for toggle key
 */
function getToggleLabel(toggleKey: string): string {
    // Check all toggle phases for the key
    for (const phase of ['auto', 'teleop', 'endgame'] as const) {
        const phaseToggles = toggles[phase];
        if (phaseToggles && toggleKey in phaseToggles) {
            const toggle = (phaseToggles as Record<string, { label: string }>)[toggleKey];
            if (toggle?.label) {
                return toggle.label;
            }
        }
    }
    return toggleKey;
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Calculate validation summary from match list
 */
export function calculateValidationSummary(
    matches: MatchListItem[],
    eventKey: string
): ValidationSummary {
    const results = matches.map(m => m.validationResult).filter(Boolean) as MatchValidationResult[];

    const summary: ValidationSummary = {
        eventKey,
        totalMatches: matches.length,
        scoutedMatches: matches.filter(m => m.hasScouting).length,
        validatedMatches: results.length,
        pendingMatches: matches.filter(m => m.hasScouting && !m.validationResult).length,
        passedMatches: results.filter(r => r.status === 'passed').length,
        flaggedMatches: results.filter(r => r.status === 'flagged').length,
        failedMatches: results.filter(r => r.status === 'failed').length,
        noTBADataMatches: results.filter(r => r.status === 'no-tba-data').length,
        noScoutingMatches: matches.filter(m => !m.hasScouting).length,
        totalDiscrepancies: results.reduce((sum, r) => sum + r.totalDiscrepancies, 0),
        criticalDiscrepancies: results.reduce((sum, r) => sum + r.criticalDiscrepancies, 0),
        warningDiscrepancies: results.reduce((sum, r) => sum + r.warningDiscrepancies, 0),
        minorDiscrepancies: results.reduce((sum, r) => sum + (r.totalDiscrepancies - r.criticalDiscrepancies - r.warningDiscrepancies), 0),
        averageConfidence: calculateAverageConfidence(results),
        matchesRequiringReScout: results.filter(r => r.requiresReScout).length,
        generatedAt: Date.now(),
    };

    return summary;
}

/**
 * Calculate average confidence level
 */
function calculateAverageConfidence(results: MatchValidationResult[]): 'high' | 'medium' | 'low' {
    if (results.length === 0) return 'low';

    const scores = results.map(r => {
        switch (r.confidence) {
            case 'high': return 3;
            case 'medium': return 2;
            case 'low': return 1;
            default: return 1;
        }
    });

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (avg >= 2.5) return 'high';
    if (avg >= 1.5) return 'medium';
    return 'low';
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Check for duplicate match entries
 */
export function checkForDuplicates(
    results: MatchValidationResult[],
    onDuplicatesFound?: (duplicates: Array<{ match: string; count: number }>) => void
): void {
    const matchNumbers = results.map(r => r.matchNumber);
    const counts: Record<string, number> = {};

    matchNumbers.forEach(num => {
        counts[num] = (counts[num] || 0) + 1;
    });

    const duplicates = Object.entries(counts)
        .filter(([, count]) => count > 1)
        .map(([match, count]) => ({ match, count }));

    if (duplicates.length > 0 && onDuplicatesFound) {
        onDuplicatesFound(duplicates);
    }
}
