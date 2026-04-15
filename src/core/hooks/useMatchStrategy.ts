/**
 * Match Strategy Hook
 * 
 * Manages state for the Match Strategy page including:
 * - Team selection (6 teams: 3 red, 3 blue)
 * - Match number lookup (auto-fills teams from match data)
 * - Alliance selection (for elimination matches)
 * - Team stats retrieval using centralized useAllTeamStats
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { loadScoutingData } from "@/core/lib/scoutingDataUtils";
import { loadAllPitScoutingEntries, loadPitScoutingByTeam, loadScoutingEntriesByMatch, savePitScoutingEntry } from "@/core/db/database";
import { useAllTeamStats } from "@/core/hooks/useAllTeamStats";
import { getCachedEventCOPRs } from "@/core/lib/tba/coprUtils";
import { getCachedEventStatboticsEPA } from "@/core/lib/statbotics/epaUtils";
import { getCachedTBAEventMatches } from "@/core/lib/tbaCache";
import { getAvailableMatchStrategyDisplayModes, type MatchStrategyDisplayMode } from "@/game-template/match-strategy-config";
import type { Alliance } from "../lib/allianceTypes";
import type { TeamStats } from "@/core/types/team-stats";
import type { PitScoutingEntryBase } from "@/core/types/pit-scouting";

const MATCH_STRATEGY_EVENT_FILTER_STORAGE_KEY = "matchStrategyEventFilter";
const MATCH_STRATEGY_AUTO_PATH_EVENTS_STORAGE_KEY = "matchStrategyAutoPathEvents";

export type StrategyStageId = 'autonomous' | 'teleop' | 'endgame';

export type AutoRoutineSource = 'scouted' | 'reported';

const START_POSITION_LABELS = ['Left Trench', 'Left Bump', 'Hub', 'Right Bump', 'Right Trench'] as const;
export type StartPositionLabel = (typeof START_POSITION_LABELS)[number];
type StartPositionIndex = 0 | 1 | 2 | 3 | 4;

const START_LABEL_TO_INDEX: Record<StartPositionLabel, StartPositionIndex> = {
    'Left Trench': 0,
    'Left Bump': 1,
    Hub: 2,
    'Right Bump': 3,
    'Right Trench': 4,
};

export interface AutoRoutineWaypoint {
    type?: string;
    action?: string;
    position: TeamSpotPoint;
    pathPoints?: TeamSpotPoint[];
}

export interface StrategyAutoRoutine {
    id: string;
    teamNumber: number;
    source: AutoRoutineSource;
    label: string;
    eventKey?: string;
    startPosition: StartPositionIndex;
    startLabel: StartPositionLabel;
    actions: AutoRoutineWaypoint[];
    matchNumber?: number;
    allianceColor?: 'red' | 'blue';
}

interface TeamAutoRoutines {
    scouted: StrategyAutoRoutine[];
    reported: StrategyAutoRoutine[];
}

interface ReportedAutoRecord {
    id: string;
    name: string;
    actions: AutoRoutineWaypoint[];
    createdAt: number;
    updatedAt: number;
}

type ReportedAutosByStart = Record<StartPositionLabel, ReportedAutoRecord[]>;

export interface AutoRoutineSelection {
    source: AutoRoutineSource;
    routineId: string;
}

const EMPTY_TEAM_AUTO_ROUTINES: TeamAutoRoutines = {
    scouted: [],
    reported: [],
};

export interface TeamSpotPoint {
    x: number;
    y: number;
    pathPoints?: Array<{ x: number; y: number }>;
}

export interface TeamStageSpots {
    shooting: TeamSpotPoint[];
    passing: TeamSpotPoint[];
}

interface TeamSpotsByStage {
    autonomous: TeamStageSpots;
    teleop: TeamStageSpots;
}

const EMPTY_SPOTS: TeamStageSpots = { shooting: [], passing: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function extractStageSpotsFromPath(path: unknown): TeamStageSpots {
    if (!Array.isArray(path)) return EMPTY_SPOTS;

    const shooting: TeamSpotPoint[] = [];
    const passing: TeamSpotPoint[] = [];

    path.forEach((waypoint) => {
        if (!isRecord(waypoint)) return;

        const type = typeof waypoint.type === 'string' ? waypoint.type : '';
        if (type !== 'score' && type !== 'pass') return;

        const position = isRecord(waypoint.position) ? waypoint.position : null;
        const x = position && typeof position.x === 'number' ? position.x : null;
        const y = position && typeof position.y === 'number' ? position.y : null;

        if (x === null || y === null) return;
        if (x < 0 || x > 1 || y < 0 || y > 1) return;

        let pathPoints: Array<{ x: number; y: number }> | undefined;
        if (Array.isArray(waypoint.pathPoints)) {
            const normalizedPathPoints = waypoint.pathPoints
                .filter((point): point is Record<string, unknown> => isRecord(point))
                .map((point) => {
                    const px = typeof point.x === 'number' ? point.x : null;
                    const py = typeof point.y === 'number' ? point.y : null;
                    if (px === null || py === null) return null;
                    if (px < 0 || px > 1 || py < 0 || py > 1) return null;
                    return { x: px, y: py };
                })
                .filter((point): point is { x: number; y: number } => point !== null);

            if (normalizedPathPoints.length >= 2) {
                pathPoints = normalizedPathPoints;
            }
        }

        const spotPoint: TeamSpotPoint = pathPoints ? { x, y, pathPoints } : { x, y };

        if (type === 'score') {
            shooting.push(spotPoint);
        } else {
            passing.push(spotPoint);
        }
    });

    return { shooting, passing };
}

function getStartLabel(position: unknown): StartPositionLabel {
    if (typeof position !== 'number' || position < 0 || position > 4) {
        return 'Hub';
    }

    return START_POSITION_LABELS[position] ?? 'Hub';
}

function extractRoutineActionsFromPath(path: unknown): AutoRoutineWaypoint[] {
    if (!Array.isArray(path)) return [];

    const actions: AutoRoutineWaypoint[] = [];

    path.forEach((waypoint) => {
        if (!isRecord(waypoint)) return;

        const position = isRecord(waypoint.position) ? waypoint.position : null;
        const x = position && typeof position.x === 'number' ? position.x : null;
        const y = position && typeof position.y === 'number' ? position.y : null;

        if (x === null || y === null) return;
        if (x < 0 || x > 1 || y < 0 || y > 1) return;

        let pathPoints: TeamSpotPoint[] | undefined;
        if (Array.isArray(waypoint.pathPoints)) {
            const normalizedPoints = waypoint.pathPoints
                .filter((point): point is Record<string, unknown> => isRecord(point))
                .map((point) => {
                    const px = typeof point.x === 'number' ? point.x : null;
                    const py = typeof point.y === 'number' ? point.y : null;
                    if (px === null || py === null) return null;
                    if (px < 0 || px > 1 || py < 0 || py > 1) return null;
                    return { x: px, y: py };
                })
                .filter((point): point is TeamSpotPoint => point !== null);

            if (normalizedPoints.length >= 2) {
                pathPoints = normalizedPoints;
            }
        }

        actions.push({
            type: typeof waypoint.type === 'string' ? waypoint.type : undefined,
            action: typeof waypoint.action === 'string' ? waypoint.action : undefined,
            position: { x, y },
            pathPoints,
        });
    });

    return actions;
}

function routineSelectionExists(routines: TeamAutoRoutines | undefined, selection: AutoRoutineSelection | null): boolean {
    if (!routines || !selection) return false;

    const sourceList = selection.source === 'reported' ? routines.reported : routines.scouted;
    return sourceList.some((routine) => routine.id === selection.routineId);
}

function getMostRecentPitEntriesByTeam(entries: PitScoutingEntryBase[]): Record<number, PitScoutingEntryBase> {
    return entries.reduce<Record<number, PitScoutingEntryBase>>((acc, entry) => {
        const current = acc[entry.teamNumber];
        if (!current || entry.timestamp > current.timestamp) {
            acc[entry.teamNumber] = entry;
        }
        return acc;
    }, {});
}

function getMostRecentPitEntriesByTeamAndEvent(entries: PitScoutingEntryBase[]): Record<string, PitScoutingEntryBase> {
    return entries.reduce<Record<string, PitScoutingEntryBase>>((acc, entry) => {
        const eventKey = typeof entry.eventKey === 'string' ? entry.eventKey.trim().toLowerCase() : '';
        if (!entry.teamNumber || !eventKey) {
            return acc;
        }

        const recordKey = `${entry.teamNumber}::${eventKey}`;
        const current = acc[recordKey];
        if (!current || entry.timestamp > current.timestamp) {
            acc[recordKey] = entry;
        }

        return acc;
    }, {});
}

function createEmptyReportedAutos(): ReportedAutosByStart {
    return {
        'Left Trench': [],
        'Left Bump': [],
        Hub: [],
        'Right Bump': [],
        'Right Trench': [],
    };
}

function coerceReportedAutosByStart(value: unknown): ReportedAutosByStart {
    const empty = createEmptyReportedAutos();
    if (!isRecord(value)) return empty;

    START_POSITION_LABELS.forEach((startLabel) => {
        const startAutosRaw = value[startLabel];
        if (!Array.isArray(startAutosRaw)) return;

        empty[startLabel] = startAutosRaw
            .filter((auto): auto is Record<string, unknown> => isRecord(auto))
            .map((auto, index) => {
                const now = Date.now();
                const id = typeof auto.id === 'string' && auto.id.trim()
                    ? auto.id
                    : `${startLabel}-${index}-${now}`;
                const name = typeof auto.name === 'string' && auto.name.trim()
                    ? auto.name.trim()
                    : `${startLabel} Auto ${index + 1}`;
                const actions = extractRoutineActionsFromPath(auto.actions);

                return {
                    id,
                    name,
                    actions,
                    createdAt: typeof auto.createdAt === 'number' ? auto.createdAt : now,
                    updatedAt: typeof auto.updatedAt === 'number' ? auto.updatedAt : now,
                };
            })
            .filter((auto) => auto.actions.length > 0);
    });

    return empty;
}

function buildReportedRoutinesFromPitEntry(pitEntry: PitScoutingEntryBase): StrategyAutoRoutine[] {
    const teamNumber = pitEntry.teamNumber;
    const eventKey = pitEntry.eventKey;
    const reportedAutosByStart = coerceReportedAutosByStart(isRecord(pitEntry.gameData) ? pitEntry.gameData.reportedAutosByStart : undefined);

    return START_POSITION_LABELS.flatMap((startLabel) => {
        const autos = reportedAutosByStart[startLabel] ?? [];

        return autos.map((auto) => ({
            id: `reported-${eventKey}-${auto.id}`,
            teamNumber,
            source: 'reported' as const,
            label: auto.name,
            eventKey,
            startPosition: START_LABEL_TO_INDEX[startLabel],
            startLabel,
            actions: auto.actions,
        }));
    }).sort((a, b) => a.label.localeCompare(b.label) || (a.eventKey ?? '').localeCompare(b.eventKey ?? ''));
}

function stripReportedPrefix(routineId: string): string {
    return routineId.startsWith('reported-') ? routineId.slice('reported-'.length) : routineId;
}

function parseReportedRoutineId(routineId: string): { eventKey: string; rawId: string } | null {
    const stripped = stripReportedPrefix(routineId);
    const separatorIndex = stripped.indexOf('-pit-auto-');

    if (separatorIndex === -1) {
        return null;
    }

    return {
        eventKey: stripped.slice(0, separatorIndex),
        rawId: stripped.slice(separatorIndex + 1),
    };
}

function createDefaultPitEntryForTeam(teamNumber: number, preferredEventKey?: string): PitScoutingEntryBase {
    const now = Date.now();
    const eventKey = (preferredEventKey || localStorage.getItem('eventKey') || 'unknown-event').trim() || 'unknown-event';
    const scoutName = (localStorage.getItem('scoutName') || 'Match Strategy').trim() || 'Match Strategy';
    const id = `pit-${teamNumber}-${eventKey}-${now}-${Math.random().toString(36).slice(2, 8)}`;

    return {
        id,
        teamNumber,
        eventKey,
        scoutName,
        timestamp: now,
        gameData: {
            reportedAutosByStart: createEmptyReportedAutos(),
        },
    };
}

function parseTeamNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.trunc(value);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        const normalized = trimmed.toLowerCase().startsWith('frc') ? trimmed.slice(3) : trimmed;
        const parsed = Number.parseInt(normalized, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return null;
}

function getMatchScheduleTeamNumbersFromStorage(): number[] {
    const raw = localStorage.getItem('matchData');
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        const teamNumbers = new Set<number>();

        parsed.forEach((match) => {
            if (!isRecord(match)) return;

            const redAlliance = Array.isArray(match.redAlliance) ? match.redAlliance : [];
            const blueAlliance = Array.isArray(match.blueAlliance) ? match.blueAlliance : [];

            [...redAlliance, ...blueAlliance].forEach((teamValue) => {
                const teamNumber = parseTeamNumber(teamValue);
                if (teamNumber) {
                    teamNumbers.add(teamNumber);
                }
            });
        });

        return [...teamNumbers];
    } catch {
        return [];
    }
}

function areNumberArraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]) return false;
    }
    return true;
}

function getCurrentEventKey(): string {
    if (typeof window === 'undefined') {
        return '';
    }

    return (localStorage.getItem('eventKey') || '').trim();
}

function getInitialSelectedEvent(): string {
    if (typeof window === 'undefined') {
        return '';
    }

    const savedEvent = (localStorage.getItem(MATCH_STRATEGY_EVENT_FILTER_STORAGE_KEY) || '').trim();
    if (savedEvent) {
        return savedEvent;
    }

    return getCurrentEventKey();
}

function getInitialSelectedAutoPathEvents(): string[] {
    if (typeof window === 'undefined') {
        return ['all'];
    }

    const storedValue = localStorage.getItem(MATCH_STRATEGY_AUTO_PATH_EVENTS_STORAGE_KEY);
    if (!storedValue) {
        return ['all'];
    }

    try {
        const parsed = JSON.parse(storedValue);
        if (!Array.isArray(parsed)) {
            return ['all'];
        }

        const values = parsed
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean);

        return values.length > 0 ? values : ['all'];
    } catch {
        return ['all'];
    }
}

function getCanonicalEventKey(eventKey: string, availableEvents: string[]): string {
    const normalizedEventKey = eventKey.trim().toLowerCase();
    if (!normalizedEventKey) {
        return '';
    }

    return availableEvents.find((candidate) => candidate.trim().toLowerCase() === normalizedEventKey) ?? '';
}

function getCanonicalEventKeys(eventKeys: string[], availableEvents: string[]): string[] {
    if (eventKeys.length === 0 || eventKeys.includes('all')) {
        return ['all'];
    }

    const canonicalKeys = eventKeys
        .map((eventKey) => getCanonicalEventKey(eventKey, availableEvents))
        .filter(Boolean);

    const uniqueCanonicalKeys = [...new Set(canonicalKeys)];
    return uniqueCanonicalKeys.length > 0 ? uniqueCanonicalKeys : ['all'];
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;

    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]) {
            return false;
        }
    }

    return true;
}

function filterEntriesByEvent<T extends { eventKey?: string | null }>(entries: T[], eventKey: string): T[] {
    const normalizedEventKey = eventKey.trim().toLowerCase();
    if (!normalizedEventKey) {
        return entries;
    }

    return entries.filter((entry) => entry.eventKey?.trim().toLowerCase() === normalizedEventKey);
}

function filterEntriesByEvents<T extends { eventKey?: string | null }>(entries: T[], eventKeys: string[]): T[] {
    if (eventKeys.length === 0 || eventKeys.includes('all')) {
        return entries;
    }

    const allowedEventKeys = new Set(eventKeys.map((eventKey) => eventKey.trim().toLowerCase()).filter(Boolean));
    if (allowedEventKeys.size === 0) {
        return entries;
    }

    return entries.filter((entry) => {
        const eventKey = entry.eventKey?.trim().toLowerCase();
        return !!eventKey && allowedEventKeys.has(eventKey);
    });
}

function buildAvailableTeams(
    scoutingEntries: Array<{ teamNumber?: number | null }>,
    pitEntries: PitScoutingEntryBase[],
    scheduleTeamNumbers: number[]
): number[] {
    const availableTeamSet = new Set<number>();

    scoutingEntries.forEach((entry) => {
        if (entry.teamNumber) {
            availableTeamSet.add(entry.teamNumber);
        }
    });

    pitEntries.forEach((entry) => {
        if (entry.teamNumber) {
            availableTeamSet.add(entry.teamNumber);
        }
    });

    scheduleTeamNumbers.forEach((teamNumber) => availableTeamSet.add(teamNumber));

    return [...availableTeamSet].sort((a, b) => a - b);
}

export const useMatchStrategy = () => {
    const [selectedTeams, setSelectedTeams] = useState<(number | null)[]>(Array(6).fill(null));
    const [availableTeams, setAvailableTeams] = useState<number[]>([]);
    const [availableEvents, setAvailableEvents] = useState<string[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<string>(getInitialSelectedEvent);
    const [selectedAutoPathEvents, setSelectedAutoPathEvents] = useState<string[]>(getInitialSelectedAutoPathEvents);
    const [matchNumber, setMatchNumber] = useState<string>("");
    const [isLookingUpMatch, setIsLookingUpMatch] = useState(false);
    const [confirmedAlliances, setConfirmedAlliances] = useState<Alliance[]>([]);
    const [selectedBlueAlliance, setSelectedBlueAlliance] = useState<string>("");
    const [selectedRedAlliance, setSelectedRedAlliance] = useState<string>("");
    const [teamSpotsByTeam, setTeamSpotsByTeam] = useState<Record<number, TeamSpotsByStage>>({});
    const [teamAutoRoutinesByTeam, setTeamAutoRoutinesByTeam] = useState<Record<number, TeamAutoRoutines>>({});
    const [latestPitEntryByTeam, setLatestPitEntryByTeam] = useState<Record<number, PitScoutingEntryBase>>({});
    const [latestPitEntryByTeamEvent, setLatestPitEntryByTeamEvent] = useState<Record<string, PitScoutingEntryBase>>({});
    const [selectedAutoRoutineBySlot, setSelectedAutoRoutineBySlot] = useState<(AutoRoutineSelection | null)[]>(Array(6).fill(null));
    const [hasScaledData, setHasScaledData] = useState(false);
    const [hasCoprData, setHasCoprData] = useState(false);
    const [hasEpaData, setHasEpaData] = useState(false);
    const [hasOprData, setHasOprData] = useState(false);
    const [isDisplayModeAvailabilityLoading, setIsDisplayModeAvailabilityLoading] = useState(true);
    const applySelectedTeams = useCallback((nextSelectedTeams: (number | null)[]) => {
        setSelectedTeams((prevSelectedTeams) => {
            setSelectedAutoRoutineBySlot((prevSelections) =>
                nextSelectedTeams.map((teamNumber, slotIndex) => {
                    if (!teamNumber) return null;

                    const routines = teamAutoRoutinesByTeam[teamNumber];
                    const previousTeam = prevSelectedTeams[slotIndex];
                    const previousSelection = prevSelections[slotIndex] ?? null;

                    if (previousTeam === teamNumber && routineSelectionExists(routines, previousSelection)) {
                        return previousSelection;
                    }

                    return null;
                })
            );

            return nextSelectedTeams;
        });
    }, [teamAutoRoutinesByTeam]);

    // Get all team stats using centralized hook
    const { teamStats: allTeamStats, isLoading: isTeamStatsLoading } = useAllTeamStats(selectedEvent || undefined);

    // Function to get stats for a specific team
    const getTeamStats = useCallback((teamNumber: number | null): TeamStats | null => {
        if (teamNumber === null) return null;
        const stats = allTeamStats.find(s => s.teamNumber === teamNumber);
        return stats || null;
    }, [allTeamStats]);

    const availableDisplayModes = useMemo<MatchStrategyDisplayMode[]>(() => getAvailableMatchStrategyDisplayModes({
        teamStats: allTeamStats,
        hasScaledData,
        hasCoprData,
        hasEpaData,
        hasOprData,
    }), [allTeamStats, hasScaledData, hasCoprData, hasEpaData, hasOprData]);

    // Debounced match number lookup
    const lookupMatchTeams = useCallback(async (matchNum: string) => {
        if (!matchNum.trim()) return;

        setIsLookingUpMatch(true);
        try {
            const matchNumberValue = parseInt(matchNum.trim());
            const currentEventKey = getCurrentEventKey();
            const shouldUseStoredMatchData = !!selectedEvent
                && !!currentEventKey
                && selectedEvent.trim().toLowerCase() === currentEventKey.trim().toLowerCase();

            // First check localStorage match data (from TBA API)
            const matchDataStr = shouldUseStoredMatchData ? localStorage.getItem("matchData") : null;
            if (matchDataStr) {
                try {
                    const matchData = JSON.parse(matchDataStr);
                    const match = matchData.find((m: any) => m.matchNum === matchNumberValue);

                    if (match && match.redAlliance && match.blueAlliance) {
                        const redTeams = match.redAlliance.slice(0, 3);
                        const blueTeams = match.blueAlliance.slice(0, 3);

                        const newSelectedTeams = Array(6).fill(null);

                        for (let i = 0; i < redTeams.length && i < 3; i++) {
                            newSelectedTeams[i] = Number(redTeams[i]);
                        }

                        for (let i = 0; i < blueTeams.length && i < 3; i++) {
                            newSelectedTeams[i + 3] = Number(blueTeams[i]);
                        }

                        applySelectedTeams(newSelectedTeams);
                        setIsLookingUpMatch(false);
                        return;
                    }
                } catch (error) {
                    console.error("Error parsing match data:", error);
                }
            }

            // Fallback: Try scouting database
            const matchEntries = filterEntriesByEvent(await loadScoutingEntriesByMatch(matchNumberValue), selectedEvent);

            const redTeams: number[] = [];
            const blueTeams: number[] = [];

            matchEntries.forEach(entry => {
                if (entry.teamNumber) {
                    if (entry.allianceColor === "red") {
                        if (!redTeams.includes(entry.teamNumber)) {
                            redTeams.push(entry.teamNumber);
                        }
                    } else if (entry.allianceColor === "blue") {
                        if (!blueTeams.includes(entry.teamNumber)) {
                            blueTeams.push(entry.teamNumber);
                        }
                    }
                }
            });

            if (redTeams.length > 0 || blueTeams.length > 0) {
                redTeams.sort((a, b) => a - b);
                blueTeams.sort((a, b) => a - b);

                const newSelectedTeams = Array(6).fill(null);

                for (let i = 0; i < 3; i++) {
                    newSelectedTeams[i] = redTeams[i] || null;
                }

                for (let i = 0; i < 3; i++) {
                    newSelectedTeams[i + 3] = blueTeams[i] || null;
                }

                applySelectedTeams(newSelectedTeams);
            } else {
                console.log("No match entries found for match number:", matchNum);
            }
        } catch (error) {
            console.error("Error looking up match teams:", error);
        } finally {
            setIsLookingUpMatch(false);
        }
    }, [applySelectedTeams, selectedEvent]);
    const loadStrategyData = useCallback(async () => {
        setIsDisplayModeAvailabilityLoading(true);

        try {
            const [data, pitEntries] = await Promise.all([
                loadScoutingData(),
                loadAllPitScoutingEntries(),
            ]);

            const currentEventKey = getCurrentEventKey();
            const nextAvailableEvents = Array.from(new Set(
                data
                    .map((entry) => entry.eventKey)
                    .filter((eventKey): eventKey is string => typeof eventKey === "string" && eventKey.trim().length > 0)
                    .concat(
                        pitEntries
                            .map((entry) => entry.eventKey)
                            .filter((eventKey): eventKey is string => typeof eventKey === "string" && eventKey.trim().length > 0)
                    )
                    .concat(currentEventKey ? [currentEventKey] : [])
            )).sort((a, b) => a.localeCompare(b));

            setAvailableEvents(nextAvailableEvents);

            const effectiveSelectedEvent = getCanonicalEventKey(selectedEvent, nextAvailableEvents)
                || getCanonicalEventKey(currentEventKey, nextAvailableEvents)
                || nextAvailableEvents[0]
                || "";

            if (effectiveSelectedEvent !== selectedEvent) {
                setSelectedEvent(effectiveSelectedEvent);
            }

            const effectiveSelectedAutoPathEvents = getCanonicalEventKeys(selectedAutoPathEvents, nextAvailableEvents);
            if (!areStringArraysEqual(effectiveSelectedAutoPathEvents, selectedAutoPathEvents)) {
                setSelectedAutoPathEvents(effectiveSelectedAutoPathEvents);
            }

            const filteredScoutingEntries = filterEntriesByEvent(data, effectiveSelectedEvent);
            const filteredPitEntries = filterEntriesByEvent(pitEntries, effectiveSelectedEvent);
            const autoPathScoutingEntries = filterEntriesByEvents(data, effectiveSelectedAutoPathEvents);
            const autoPathPitEntries = filterEntriesByEvents(pitEntries, effectiveSelectedAutoPathEvents);
            const hasScaledMetricsInEvent = filteredScoutingEntries.some((entry) => {
                const scaledMetrics = isRecord(entry.gameData?.scaledMetrics) ? entry.gameData.scaledMetrics : null;
                return typeof scaledMetrics?.scaledAutoFuel === 'number'
                    || typeof scaledMetrics?.scaledTeleopFuel === 'number';
            });
            const hasCachedCoprData = effectiveSelectedEvent
                ? getCachedEventCOPRs(effectiveSelectedEvent).size > 0
                : false;
            const hasCachedEpaData = effectiveSelectedEvent
                ? getCachedEventStatboticsEPA(effectiveSelectedEvent).size > 0
                : false;
            const cachedTbaMatches = effectiveSelectedEvent
                ? await getCachedTBAEventMatches(effectiveSelectedEvent, true)
                : [];
            const hasCachedOprData = cachedTbaMatches.length >= 2;
            const shouldUseScheduleTeams = !!effectiveSelectedEvent
                && !!currentEventKey
                && effectiveSelectedEvent.trim().toLowerCase() === currentEventKey.trim().toLowerCase();
            const scheduleTeamNumbers = shouldUseScheduleTeams ? getMatchScheduleTeamNumbersFromStorage() : [];
            const nextTeams = buildAvailableTeams(filteredScoutingEntries, filteredPitEntries, scheduleTeamNumbers);

            setAvailableTeams((prevTeams) => (areNumberArraysEqual(prevTeams, nextTeams) ? prevTeams : nextTeams));
            setHasScaledData(hasScaledMetricsInEvent);
            setHasCoprData(hasCachedCoprData);
            setHasEpaData(hasCachedEpaData);
            setHasOprData(hasCachedOprData);

            const spotsByTeam: Record<number, TeamSpotsByStage> = {};
            const routinesByTeam: Record<number, TeamAutoRoutines> = {};

            filteredScoutingEntries.forEach((entry) => {
                const teamNumber = entry.teamNumber;
                if (!teamNumber || !isRecord(entry.gameData)) return;

                const teleopPath = isRecord(entry.gameData.teleop)
                    ? entry.gameData.teleop.teleopPath
                    : undefined;

                const teleopSpots = extractStageSpotsFromPath(teleopPath);

                if (!spotsByTeam[teamNumber]) {
                    spotsByTeam[teamNumber] = {
                        autonomous: { shooting: [], passing: [] },
                        teleop: { shooting: [], passing: [] },
                    };
                }

                if (!routinesByTeam[teamNumber]) {
                    routinesByTeam[teamNumber] = { scouted: [], reported: [] };
                }

                const teamRoutines = routinesByTeam[teamNumber];
                if (!teamRoutines) return;

                spotsByTeam[teamNumber].teleop.shooting.push(...teleopSpots.shooting);
                spotsByTeam[teamNumber].teleop.passing.push(...teleopSpots.passing);
            });

            autoPathScoutingEntries.forEach((entry) => {
                const teamNumber = entry.teamNumber;
                if (!teamNumber || !isRecord(entry.gameData)) return;

                const autoPath = isRecord(entry.gameData.auto)
                    ? entry.gameData.auto.autoPath
                    : undefined;
                const autoSpots = extractStageSpotsFromPath(autoPath);

                if (!spotsByTeam[teamNumber]) {
                    spotsByTeam[teamNumber] = {
                        autonomous: { shooting: [], passing: [] },
                        teleop: { shooting: [], passing: [] },
                    };
                }

                if (!routinesByTeam[teamNumber]) {
                    routinesByTeam[teamNumber] = { scouted: [], reported: [] };
                }

                spotsByTeam[teamNumber].autonomous.shooting.push(...autoSpots.shooting);
                spotsByTeam[teamNumber].autonomous.passing.push(...autoSpots.passing);

                const scoutedActions = extractRoutineActionsFromPath(autoPath);
                if (scoutedActions.length === 0) {
                    return;
                }

                const startPositionRaw = isRecord(entry.gameData.auto)
                    ? entry.gameData.auto.startPosition
                    : undefined;
                const startLabel = getStartLabel(startPositionRaw);

                routinesByTeam[teamNumber].scouted.push({
                    id: `scouted-${entry.id}`,
                    teamNumber,
                    source: 'scouted',
                    label: `Match ${entry.matchNumber}`,
                    eventKey: entry.eventKey,
                    startPosition: START_LABEL_TO_INDEX[startLabel],
                    startLabel,
                    actions: scoutedActions,
                    matchNumber: entry.matchNumber,
                    allianceColor: entry.allianceColor,
                });
            });

            const latestPitByTeam = getMostRecentPitEntriesByTeam(filteredPitEntries);
            const latestPitByTeamEvent = getMostRecentPitEntriesByTeamAndEvent(autoPathPitEntries);
            setLatestPitEntryByTeam(latestPitByTeam);
            setLatestPitEntryByTeamEvent(latestPitByTeamEvent);

            Object.values(latestPitByTeamEvent).forEach((pitEntry) => {
                const teamNumber = pitEntry.teamNumber;
                if (!teamNumber || !isRecord(pitEntry.gameData)) return;

                if (!routinesByTeam[teamNumber]) {
                    routinesByTeam[teamNumber] = { scouted: [], reported: [] };
                }

                routinesByTeam[teamNumber].reported.push(...buildReportedRoutinesFromPitEntry(pitEntry));
            });

            Object.values(routinesByTeam).forEach((teamRoutines) => {
                teamRoutines.scouted.sort((a, b) => {
                    if ((a.eventKey ?? '') !== (b.eventKey ?? '')) {
                        return (a.eventKey ?? '').localeCompare(b.eventKey ?? '');
                    }

                    return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
                });
                teamRoutines.reported.sort((a, b) => a.label.localeCompare(b.label) || (a.eventKey ?? '').localeCompare(b.eventKey ?? ''));
            });

            setTeamSpotsByTeam(spotsByTeam);
            setTeamAutoRoutinesByTeam(routinesByTeam);
        } catch (error) {
            console.error("Error loading scouting data:", error);
        } finally {
            setIsDisplayModeAvailabilityLoading(false);
        }
    }, [selectedAutoPathEvents, selectedEvent]);

    const isDisplayModeLoading = isDisplayModeAvailabilityLoading || isTeamStatsLoading;

    // Load initial data
    useEffect(() => {
        const loadConfirmedAlliances = () => {
            try {
                const savedAlliances = localStorage.getItem("confirmedAlliances");
                if (savedAlliances) {
                    setConfirmedAlliances(JSON.parse(savedAlliances));
                }
            } catch (error) {
                console.error("Error loading confirmed alliances:", error);
            }
        };

        void loadStrategyData();
        loadConfirmedAlliances();
    }, [loadStrategyData]);

    useEffect(() => {
        if (!selectedEvent) {
            localStorage.removeItem(MATCH_STRATEGY_EVENT_FILTER_STORAGE_KEY);
            return;
        }

        localStorage.setItem(MATCH_STRATEGY_EVENT_FILTER_STORAGE_KEY, selectedEvent);
    }, [selectedEvent]);

    useEffect(() => {
        localStorage.setItem(
            MATCH_STRATEGY_AUTO_PATH_EVENTS_STORAGE_KEY,
            JSON.stringify(selectedAutoPathEvents.length > 0 ? selectedAutoPathEvents : ['all'])
        );
    }, [selectedAutoPathEvents]);

    useEffect(() => {
        setSelectedAutoRoutineBySlot((prevSelections) =>
            selectedTeams.map((teamNumber, slotIndex) => {
                if (!teamNumber) return null;

                const routines = teamAutoRoutinesByTeam[teamNumber];
                const previousSelection = prevSelections[slotIndex] ?? null;

                if (routineSelectionExists(routines, previousSelection)) {
                    return previousSelection;
                }

                return null;
            })
        );
    }, [selectedTeams, teamAutoRoutinesByTeam]);

    // Debounced match lookup
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (matchNumber.trim()) {
                lookupMatchTeams(matchNumber);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [matchNumber, lookupMatchTeams]);

    useEffect(() => {
        const handlePotentialDataChange = () => {
            void loadStrategyData();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void loadStrategyData();
            }
        };

        window.addEventListener("storage", handlePotentialDataChange);
        window.addEventListener("focus", handlePotentialDataChange);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        const intervalId = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void loadStrategyData();
            }
        }, 5000);

        return () => {
            window.removeEventListener("storage", handlePotentialDataChange);
            window.removeEventListener("focus", handlePotentialDataChange);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.clearInterval(intervalId);
        };
    }, [loadStrategyData]);

    const handleTeamChange = (index: number, teamNumber: number | null) => {
        const newSelectedTeams = [...selectedTeams];
        newSelectedTeams[index] = teamNumber;
        applySelectedTeams(newSelectedTeams);
    };

    const getTeamAutoRoutines = useCallback((teamNumber: number | null, source?: AutoRoutineSource): StrategyAutoRoutine[] => {
        if (!teamNumber) return [];

        const teamRoutines = teamAutoRoutinesByTeam[teamNumber] ?? EMPTY_TEAM_AUTO_ROUTINES;
        if (source === 'scouted') {
            return teamRoutines.scouted;
        }

        if (source === 'reported') {
            return teamRoutines.reported;
        }

        return [...teamRoutines.scouted, ...teamRoutines.reported];
    }, [teamAutoRoutinesByTeam]);

    const getSelectedAutoRoutineForSlot = useCallback((slotIndex: number): StrategyAutoRoutine | null => {
        const selection = selectedAutoRoutineBySlot[slotIndex] ?? null;
        const teamNumber = selectedTeams[slotIndex] ?? null;
        if (!teamNumber) return null;
        if (!selection) return null;

        const teamRoutines = teamAutoRoutinesByTeam[teamNumber] ?? EMPTY_TEAM_AUTO_ROUTINES;
        const sourceList = selection.source === 'reported' ? teamRoutines.reported : teamRoutines.scouted;
        return sourceList.find((routine) => routine.id === selection.routineId) ?? null;
    }, [selectedAutoRoutineBySlot, selectedTeams, teamAutoRoutinesByTeam]);

    const getSelectedAutoRoutineSelectionForSlot = useCallback((slotIndex: number): AutoRoutineSelection | null => {
        return selectedAutoRoutineBySlot[slotIndex] ?? null;
    }, [selectedAutoRoutineBySlot]);

    const setSelectedAutoRoutineForSlot = useCallback((slotIndex: number, selection: AutoRoutineSelection | null) => {
        setSelectedAutoRoutineBySlot((prev) => {
            const next = [...prev];
            next[slotIndex] = selection;
            return next;
        });
    }, []);

    const getTeamSpots = useCallback((teamNumber: number | null, stageId: StrategyStageId): TeamStageSpots => {
        if (!teamNumber) return EMPTY_SPOTS;

        const teamSpots = teamSpotsByTeam[teamNumber];
        if (!teamSpots) return EMPTY_SPOTS;

        if (stageId === 'autonomous') {
            return teamSpots.autonomous;
        }

        if (stageId === 'teleop' || stageId === 'endgame') {
            return teamSpots.teleop;
        }

        return EMPTY_SPOTS;
    }, [teamSpotsByTeam]);

    const addReportedAutoForTeam = useCallback(async (
        teamNumber: number,
        startLabel: StartPositionLabel,
        name: string,
        actions: AutoRoutineWaypoint[]
    ): Promise<AutoRoutineSelection | null> => {
        if (!teamNumber || actions.length === 0) return null;

        const currentEventKey = selectedEvent || getCurrentEventKey() || 'unknown-event';
        let latestEntry = latestPitEntryByTeam[teamNumber];
        if (!latestEntry) {
            const allTeamPitEntries = await loadPitScoutingByTeam(teamNumber);
            latestEntry = allTeamPitEntries
                .filter((entry) => entry.eventKey?.trim().toLowerCase() === currentEventKey.trim().toLowerCase())
                .sort((a, b) => b.timestamp - a.timestamp)[0];
        }
        if (!latestEntry) {
            latestEntry = createDefaultPitEntryForTeam(teamNumber, currentEventKey);
        }

        const reportedAutosByStart = coerceReportedAutosByStart(isRecord(latestEntry.gameData) ? latestEntry.gameData.reportedAutosByStart : undefined);
        const now = Date.now();
        const rawId = `pit-auto-${startLabel}-${now}-${Math.random().toString(36).slice(2, 8)}`;

        const nextStartAutos = [
            ...(reportedAutosByStart[startLabel] ?? []),
            {
                id: rawId,
                name: name.trim() || `${startLabel} Auto ${(reportedAutosByStart[startLabel] ?? []).length + 1}`,
                actions,
                createdAt: now,
                updatedAt: now,
            },
        ];

        const nextReportedAutosByStart: ReportedAutosByStart = {
            ...reportedAutosByStart,
            [startLabel]: nextStartAutos,
        };

        const updatedEntry: PitScoutingEntryBase = {
            ...latestEntry,
            timestamp: now,
            gameData: {
                ...(isRecord(latestEntry.gameData) ? latestEntry.gameData : {}),
                reportedAutosByStart: nextReportedAutosByStart,
            },
        };

        await savePitScoutingEntry(updatedEntry);

        setLatestPitEntryByTeam((prev) => ({
            ...prev,
            [teamNumber]: updatedEntry,
        }));

        setLatestPitEntryByTeamEvent((prev) => ({
            ...prev,
            [`${teamNumber}::${currentEventKey.trim().toLowerCase()}`]: updatedEntry,
        }));

        setTeamAutoRoutinesByTeam((prev) => {
            const previousTeamRoutines = prev[teamNumber] ?? EMPTY_TEAM_AUTO_ROUTINES;
            const remainingReportedRoutines = previousTeamRoutines.reported.filter(
                (routine) => routine.eventKey?.trim().toLowerCase() !== currentEventKey.trim().toLowerCase()
            );

            return {
                ...prev,
                [teamNumber]: {
                    ...previousTeamRoutines,
                    reported: [
                        ...remainingReportedRoutines,
                        ...buildReportedRoutinesFromPitEntry(updatedEntry),
                    ].sort((a, b) => a.label.localeCompare(b.label) || (a.eventKey ?? '').localeCompare(b.eventKey ?? '')),
                },
            };
        });

        return { source: 'reported', routineId: `reported-${currentEventKey}-${rawId}` };
    }, [latestPitEntryByTeam, selectedEvent]);

    const updateReportedAutoForTeam = useCallback(async (
        teamNumber: number,
        routineId: string,
        name: string,
        actions: AutoRoutineWaypoint[]
    ): Promise<boolean> => {
        if (!teamNumber || actions.length === 0) return false;

        const parsedRoutineId = parseReportedRoutineId(routineId);
        if (!parsedRoutineId) return false;

        const latestEntryKey = `${teamNumber}::${parsedRoutineId.eventKey.trim().toLowerCase()}`;
        let latestEntry = latestPitEntryByTeamEvent[latestEntryKey];
        if (!latestEntry) {
            const allTeamPitEntries = await loadPitScoutingByTeam(teamNumber);
            latestEntry = allTeamPitEntries
                .filter((entry) => entry.eventKey?.trim().toLowerCase() === parsedRoutineId.eventKey.trim().toLowerCase())
                .sort((a, b) => b.timestamp - a.timestamp)[0];
            if (!latestEntry) return false;
        }

        const rawId = parsedRoutineId.rawId;
        const reportedAutosByStart = coerceReportedAutosByStart(isRecord(latestEntry.gameData) ? latestEntry.gameData.reportedAutosByStart : undefined);
        const now = Date.now();
        let didUpdate = false;

        const nextReportedAutosByStart: ReportedAutosByStart = START_POSITION_LABELS.reduce((acc, startLabel) => {
            const autos = reportedAutosByStart[startLabel] ?? [];
            acc[startLabel] = autos.map((auto) => {
                if (auto.id !== rawId) return auto;
                didUpdate = true;
                return {
                    ...auto,
                    name: name.trim() || auto.name,
                    actions,
                    updatedAt: now,
                };
            });
            return acc;
        }, createEmptyReportedAutos());

        if (!didUpdate) return false;

        const updatedEntry: PitScoutingEntryBase = {
            ...latestEntry,
            timestamp: now,
            gameData: {
                ...(isRecord(latestEntry.gameData) ? latestEntry.gameData : {}),
                reportedAutosByStart: nextReportedAutosByStart,
            },
        };

        await savePitScoutingEntry(updatedEntry);

        setLatestPitEntryByTeam((prev) => ({
            ...prev,
            ...(selectedEvent.trim().toLowerCase() === parsedRoutineId.eventKey.trim().toLowerCase() ? { [teamNumber]: updatedEntry } : {}),
        }));

        setLatestPitEntryByTeamEvent((prev) => ({
            ...prev,
            [latestEntryKey]: updatedEntry,
        }));

        setTeamAutoRoutinesByTeam((prev) => {
            const previousTeamRoutines = prev[teamNumber] ?? EMPTY_TEAM_AUTO_ROUTINES;
            const remainingReportedRoutines = previousTeamRoutines.reported.filter(
                (routine) => routine.eventKey?.trim().toLowerCase() !== parsedRoutineId.eventKey.trim().toLowerCase()
            );

            return {
                ...prev,
                [teamNumber]: {
                    ...previousTeamRoutines,
                    reported: [
                        ...remainingReportedRoutines,
                        ...buildReportedRoutinesFromPitEntry(updatedEntry),
                    ].sort((a, b) => a.label.localeCompare(b.label) || (a.eventKey ?? '').localeCompare(b.eventKey ?? '')),
                },
            };
        });

        return true;
    }, [latestPitEntryByTeamEvent, selectedEvent]);

    const deleteReportedAutoForTeam = useCallback(async (
        teamNumber: number,
        routineId: string
    ): Promise<boolean> => {
        if (!teamNumber) return false;

        const parsedRoutineId = parseReportedRoutineId(routineId);
        if (!parsedRoutineId) return false;

        const latestEntryKey = `${teamNumber}::${parsedRoutineId.eventKey.trim().toLowerCase()}`;
        let latestEntry = latestPitEntryByTeamEvent[latestEntryKey];
        if (!latestEntry) {
            const allTeamPitEntries = await loadPitScoutingByTeam(teamNumber);
            latestEntry = allTeamPitEntries
                .filter((entry) => entry.eventKey?.trim().toLowerCase() === parsedRoutineId.eventKey.trim().toLowerCase())
                .sort((a, b) => b.timestamp - a.timestamp)[0];
            if (!latestEntry) return false;
        }

        const rawId = parsedRoutineId.rawId;
        const reportedAutosByStart = coerceReportedAutosByStart(isRecord(latestEntry.gameData) ? latestEntry.gameData.reportedAutosByStart : undefined);
        const now = Date.now();
        let didDelete = false;

        const nextReportedAutosByStart: ReportedAutosByStart = START_POSITION_LABELS.reduce((acc, startLabel) => {
            const autos = reportedAutosByStart[startLabel] ?? [];
            const nextAutos = autos.filter((auto) => auto.id !== rawId);
            if (nextAutos.length !== autos.length) {
                didDelete = true;
            }
            acc[startLabel] = nextAutos;
            return acc;
        }, createEmptyReportedAutos());

        if (!didDelete) return false;

        const updatedEntry: PitScoutingEntryBase = {
            ...latestEntry,
            timestamp: now,
            gameData: {
                ...(isRecord(latestEntry.gameData) ? latestEntry.gameData : {}),
                reportedAutosByStart: nextReportedAutosByStart,
            },
        };

        await savePitScoutingEntry(updatedEntry);

        setLatestPitEntryByTeam((prev) => ({
            ...prev,
            ...(selectedEvent.trim().toLowerCase() === parsedRoutineId.eventKey.trim().toLowerCase() ? { [teamNumber]: updatedEntry } : {}),
        }));

        setLatestPitEntryByTeamEvent((prev) => ({
            ...prev,
            [latestEntryKey]: updatedEntry,
        }));

        setTeamAutoRoutinesByTeam((prev) => {
            const previousTeamRoutines = prev[teamNumber] ?? EMPTY_TEAM_AUTO_ROUTINES;
            const remainingReportedRoutines = previousTeamRoutines.reported.filter(
                (routine) => routine.eventKey?.trim().toLowerCase() !== parsedRoutineId.eventKey.trim().toLowerCase()
            );

            return {
                ...prev,
                [teamNumber]: {
                    ...previousTeamRoutines,
                    reported: [
                        ...remainingReportedRoutines,
                        ...buildReportedRoutinesFromPitEntry(updatedEntry),
                    ].sort((a, b) => a.label.localeCompare(b.label) || (a.eventKey ?? '').localeCompare(b.eventKey ?? '')),
                },
            };
        });

        setSelectedAutoRoutineBySlot((prevSelections) =>
            prevSelections.map((selection) => (selection?.routineId === routineId ? null : selection))
        );

        return true;
    }, [latestPitEntryByTeamEvent, selectedEvent]);

    const applyAllianceToRed = (allianceId: string) => {
        setSelectedRedAlliance(allianceId === "none" ? "" : allianceId);
        if (allianceId === "none") return;

        const alliance = confirmedAlliances.find(a => a.id.toString() === allianceId);
        if (!alliance) return;

        const newSelectedTeams = [...selectedTeams];
        newSelectedTeams[0] = alliance.captain || null;
        newSelectedTeams[1] = alliance.pick1 || null;
        newSelectedTeams[2] = alliance.pick2 || null;
        applySelectedTeams(newSelectedTeams);
    };

    const applyAllianceToBlue = (allianceId: string) => {
        setSelectedBlueAlliance(allianceId === "none" ? "" : allianceId);
        if (allianceId === "none") return;

        const alliance = confirmedAlliances.find(a => a.id.toString() === allianceId);
        if (!alliance) return;

        const newSelectedTeams = [...selectedTeams];
        newSelectedTeams[3] = alliance.captain || null;
        newSelectedTeams[4] = alliance.pick1 || null;
        newSelectedTeams[5] = alliance.pick2 || null;
        applySelectedTeams(newSelectedTeams);
    };

    return {
        // State
        selectedTeams,
        availableTeams,
        availableEvents,
        selectedEvent,
        selectedAutoPathEvents,
        matchNumber,
        isLookingUpMatch,
        confirmedAlliances,
        selectedBlueAlliance,
        selectedRedAlliance,
        availableDisplayModes,
        isDisplayModeLoading,

        // Functions
        getTeamStats,
        getTeamSpots,
        getTeamAutoRoutines,
        getSelectedAutoRoutineForSlot,
        getSelectedAutoRoutineSelectionForSlot,
        setSelectedAutoRoutineForSlot,
        addReportedAutoForTeam,
        updateReportedAutoForTeam,
        deleteReportedAutoForTeam,
        handleTeamChange,
        applyAllianceToRed,
        applyAllianceToBlue,
        setSelectedEvent,
        setSelectedAutoPathEvents,
        setMatchNumber
    };
};
