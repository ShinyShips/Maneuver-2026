/**
 * Centralized Team Statistics Hook
 * 
 * This hook computes team statistics ONCE and caches the results.
 * All pages should use this instead of calculating their own stats.
 * 
 * Benefits:
 * - Calculations run once per team, not per component/page
 * - Results are memoized - only recalculates when match data changes
 * - All pages show consistent data
 * - Adding new stats means editing one file (calculations.ts)
 */

import { useEffect, useMemo, useState } from "react";
import { calculateFuelOPR } from "@/game-template/fuelOpr";
import { calculateRollingFuelMoprRatings, type RollingFuelMoprRatings } from "@/game-template/rollingFuelOpr";
import { getCachedCOPREventKeys, getCachedEventCOPRs } from "@/core/lib/tba/coprUtils";
import { getCachedEventStatboticsEPA, getCachedStatboticsEventKeys } from "@/core/lib/statbotics/epaUtils";
import { getCacheMetadata, getCachedTBAEventKeys, getCachedTBAEventMatches } from "@/core/lib/tbaCache";
import {
    getCachedFuelOprByEvent,
    getCachedRollingRatingsByEvent,
    storeCachedFuelOprByEvent,
    storeCachedRollingRatingsByEvent,
    type FuelOprTeamEntry,
} from "@/core/lib/tbaDerivedCache";
import type { TeamStats } from "@/core/types/team-stats";
import { getStrategySnapshots } from "@/core/lib/strategySnapshotCache";

const FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY = 'fuelOprIncludePlayoffs';
const FIXED_FUEL_MOPR_LAMBDA = 0.3;

type RollingRatingsByMatch = Map<string, RollingFuelMoprRatings>;

type DerivedMetricEventSource = 'cache' | 'computed' | 'skipped';

export interface DerivedMetricEventDebugInfo {
    eventKey: string;
    source: DerivedMetricEventSource;
    matchCount: number;
}

export interface DerivedMetricLoadDebugInfo {
    requested: boolean;
    relevantEventKeys: string[];
    includePlayoffs: boolean;
    fixedLambda: number;
    eventSources: DerivedMetricEventDebugInfo[];
}

export interface UseAllTeamStatsDebugInfo {
    snapshotLoadMs: number;
    fuelOprLoadMs: number;
    rollingRatingsLoadMs: number;
    enrichmentMs: number;
    cachedOnlyLoadMs: number;
    combineMs: number;
    totalHookReadyMs: number;
    snapshotCount: number;
    enrichedCount: number;
    supplementalCount: number;
    finalCount: number;
    eventKey?: string;
    fuelOprDebug: DerivedMetricLoadDebugInfo;
    rollingRatingsDebug: DerivedMetricLoadDebugInfo;
}

function normalizeMatchKey(matchKey: string): string {
    if (!matchKey.includes('_')) {
        return matchKey;
    }

    return matchKey.split('_')[1] || matchKey;
}

function createEmptyDerivedMetricLoadDebugInfo(requested: boolean): DerivedMetricLoadDebugInfo {
    return {
        requested,
        relevantEventKeys: [],
        includePlayoffs: localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false',
        fixedLambda: FIXED_FUEL_MOPR_LAMBDA,
        eventSources: [],
    };
}

function getLatestRollingRatingForTeam(
    rollingRatingsByEventTeamMatch: RollingRatingsByMatch,
    eventKey: string,
    teamNumber: number,
    matchResults?: Array<{ matchKey?: string | null } | null | undefined>
): RollingFuelMoprRatings | undefined {
    let latest: RollingFuelMoprRatings | undefined;

    const consider = (candidate: RollingFuelMoprRatings | undefined) => {
        if (!candidate) {
            return;
        }

        if (!latest || candidate.matchesProcessed >= latest.matchesProcessed) {
            latest = candidate;
        }
    };

    if (Array.isArray(matchResults)) {
        for (const match of matchResults) {
            const matchKey = typeof match?.matchKey === "string" ? match.matchKey : null;
            if (!matchKey) {
                continue;
            }

            consider(rollingRatingsByEventTeamMatch.get(`${eventKey}::${teamNumber}::${matchKey}`));
            consider(rollingRatingsByEventTeamMatch.get(`${eventKey}::${teamNumber}::${normalizeMatchKey(matchKey)}`));
        }
    }

    if (latest) {
        return latest;
    }

    const prefix = `${eventKey}::${teamNumber}::`;
    for (const [key, value] of rollingRatingsByEventTeamMatch.entries()) {
        if (key.startsWith(prefix)) {
            consider(value);
        }
    }

    return latest;
}

export interface UseAllTeamStatsResult {
    teamStats: TeamStats[];
    isLoading: boolean;
    error: Error | null;
    debugInfo?: UseAllTeamStatsDebugInfo;
}

export interface UseAllTeamStatsOptions {
    includeFuelOpr?: boolean;
    includeRollingRatings?: boolean;
}

/**
 * Central hook for all team statistics.
 * Computes stats ONCE per team and caches results.
 * 
 * @param eventKey - Optional event filter
 * @returns Array of TeamStats objects with all computed metrics
 */
export const useAllTeamStats = (
    eventKey?: string,
    options: UseAllTeamStatsOptions = {}
): UseAllTeamStatsResult => {
    const {
        includeFuelOpr = true,
        includeRollingRatings = false,
    } = options;
    const [scoutedTeamStats, setScoutedTeamStats] = useState<TeamStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [cachedOnlyTeamStats, setCachedOnlyTeamStats] = useState<TeamStats[]>([]);
    const [fuelOprByEventTeam, setFuelOprByEventTeam] = useState<Map<string, FuelOprTeamEntry>>(new Map());
    const [rollingRatingsByEventTeamMatch, setRollingRatingsByEventTeamMatch] = useState<RollingRatingsByMatch>(new Map());
    const [snapshotLoadMs, setSnapshotLoadMs] = useState(0);
    const [fuelOprLoadMs, setFuelOprLoadMs] = useState(0);
    const [rollingRatingsLoadMs, setRollingRatingsLoadMs] = useState(0);
    const [cachedOnlyLoadMs, setCachedOnlyLoadMs] = useState(0);
    const [fuelOprDebug, setFuelOprDebug] = useState<DerivedMetricLoadDebugInfo>(() => createEmptyDerivedMetricLoadDebugInfo(false));
    const [rollingRatingsDebug, setRollingRatingsDebug] = useState<DerivedMetricLoadDebugInfo>(() => createEmptyDerivedMetricLoadDebugInfo(false));
    const hookStartedAt = useMemo(() => performance.now(), [eventKey]);

    useEffect(() => {
        let cancelled = false;

        const loadTeamStats = async () => {
            setIsLoading(true);
            setError(null);
            const startedAt = performance.now();

            try {
                const snapshots = await getStrategySnapshots(eventKey);
                const sortedSnapshots = [...snapshots].sort((a, b) => a.teamNumber - b.teamNumber || a.eventKey.localeCompare(b.eventKey));

                if (!cancelled) {
                    setScoutedTeamStats(sortedSnapshots);
                    setSnapshotLoadMs(performance.now() - startedAt);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err : new Error("Failed to load team statistics"));
                    setScoutedTeamStats([]);
                    setSnapshotLoadMs(performance.now() - startedAt);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void loadTeamStats();

        return () => {
            cancelled = true;
        };
    }, [eventKey]);

    useEffect(() => {
        let cancelled = false;

        const loadFuelOprMap = async () => {
            if (!includeFuelOpr) {
                setFuelOprByEventTeam(new Map());
                setFuelOprLoadMs(0);
                setFuelOprDebug(createEmptyDerivedMetricLoadDebugInfo(false));
                return;
            }

            const startedAt = performance.now();
            const includePlayoffs = localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false';
            const relevantEventKeys = eventKey
                ? [eventKey]
                : [...new Set(
                    scoutedTeamStats.map(team => team.eventKey).filter((key): key is string => !!key)
                )];

            if (relevantEventKeys.length === 0) {
                if (!cancelled) {
                    setFuelOprByEventTeam(new Map());
                    setFuelOprLoadMs(performance.now() - startedAt);
                    setFuelOprDebug({
                        requested: true,
                        relevantEventKeys,
                        includePlayoffs,
                        fixedLambda: FIXED_FUEL_MOPR_LAMBDA,
                        eventSources: [],
                    });
                }
                return;
            }

            const { oprMap, debug } = await buildFuelOprMapFromCachedTba(relevantEventKeys, includePlayoffs);

            if (!cancelled) {
                setFuelOprByEventTeam(oprMap);
                setFuelOprLoadMs(performance.now() - startedAt);
                setFuelOprDebug(debug);
            }
        };

        void loadFuelOprMap();

        return () => {
            cancelled = true;
        };
    }, [eventKey, scoutedTeamStats, includeFuelOpr]);

    useEffect(() => {
        let cancelled = false;

        const loadRollingRatings = async () => {
            if (!includeRollingRatings) {
                setRollingRatingsByEventTeamMatch(new Map());
                setRollingRatingsLoadMs(0);
                setRollingRatingsDebug(createEmptyDerivedMetricLoadDebugInfo(false));
                return;
            }

            const startedAt = performance.now();
            const includePlayoffs = localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false';
            const relevantEventKeys = eventKey
                ? [eventKey]
                : [...new Set(
                    scoutedTeamStats.map(team => team.eventKey).filter((key): key is string => !!key)
                )];

            if (relevantEventKeys.length === 0) {
                if (!cancelled) {
                    setRollingRatingsByEventTeamMatch(new Map());
                    setRollingRatingsLoadMs(performance.now() - startedAt);
                    setRollingRatingsDebug({
                        requested: true,
                        relevantEventKeys,
                        includePlayoffs,
                        fixedLambda: FIXED_FUEL_MOPR_LAMBDA,
                        eventSources: [],
                    });
                }
                return;
            }

            const { rollingMap, debug } = await buildRollingRatingsMapFromCachedTba(relevantEventKeys, includePlayoffs);
            if (!cancelled) {
                setRollingRatingsByEventTeamMatch(rollingMap);
                setRollingRatingsLoadMs(performance.now() - startedAt);
                setRollingRatingsDebug(debug);
            }
        };

        void loadRollingRatings();

        return () => {
            cancelled = true;
        };
    }, [eventKey, scoutedTeamStats, includeRollingRatings]);

    const { enrichedScoutedTeamStats, enrichmentMs } = useMemo(() => {
        const startedAt = performance.now();
        if (scoutedTeamStats.length === 0) {
            return {
                enrichedScoutedTeamStats: [] as TeamStats[],
                enrichmentMs: performance.now() - startedAt,
            };
        }

        const coprEventKeys = eventKey
            ? [eventKey]
            : [...new Set(getCachedCOPREventKeys())];

        const coprByEvent = new Map(
            coprEventKeys.map(key => [key, getCachedEventCOPRs(key)] as const)
        );

        const statboticsEventKeys = eventKey
            ? [eventKey]
            : [...new Set(getCachedStatboticsEventKeys())];

        const statboticsByEvent = new Map(
            statboticsEventKeys.map(key => [key, getCachedEventStatboticsEPA(key)] as const)
        );

        const enriched = scoutedTeamStats.map(baseStats => {
            const teamNumber = baseStats.teamNumber;
            const eventKeyForTeam = baseStats.eventKey;
            const fuelOpr = fuelOprByEventTeam.get(`${eventKeyForTeam}::${teamNumber}`);
            const copr = coprByEvent.get(eventKeyForTeam)?.get(teamNumber);
            const statbotics = statboticsByEvent.get(eventKeyForTeam)?.get(teamNumber);
            const latestRolling = getLatestRollingRatingForTeam(
                rollingRatingsByEventTeamMatch,
                eventKeyForTeam,
                teamNumber,
                baseStats.matchResults
            );

            const matchResults = Array.isArray(baseStats.matchResults)
                ? baseStats.matchResults.map(match => {
                    const matchKey = typeof match?.matchKey === 'string' ? match.matchKey : null;
                    const rolling = matchKey
                        ? rollingRatingsByEventTeamMatch.get(`${eventKeyForTeam}::${teamNumber}::${matchKey}`)
                            ?? rollingRatingsByEventTeamMatch.get(`${eventKeyForTeam}::${teamNumber}::${normalizeMatchKey(matchKey)}`)
                        : undefined;

                    return {
                        ...match,
                        rollingOprTotalPoints: rolling?.fixedTotalMopr ?? 0,
                        rollingCoprTotalPoints: rolling?.adaptiveTotalMopr ?? 0,
                        rollingRatingsMatchCount: rolling?.matchesProcessed ?? 0,
                    };
                })
                : baseStats.matchResults;

            return {
                ...baseStats,
                matchResults,
                fuelAutoOPR: fuelOpr?.autoFuelOPR ?? (baseStats.fuelAutoOPR ?? 0),
                fuelTeleopOPR: fuelOpr?.teleopFuelOPR ?? (baseStats.fuelTeleopOPR ?? 0),
                fuelTotalOPR: fuelOpr?.totalFuelOPR ?? (baseStats.fuelTotalOPR ?? 0),
                fuelOprLambda: fuelOpr?.lambda ?? 0,
                latestRollingFuelOPR: latestRolling?.fixedTotalMopr ?? 0,
                latestRollingFuelCOPR: latestRolling?.adaptiveTotalMopr ?? 0,
                latestRollingRatingsMatchCount: latestRolling?.matchesProcessed ?? 0,
                coprHubAutoPoints: copr?.hubAutoPoints,
                coprHubTeleopPoints: copr?.hubTeleopPoints,
                coprHubTotalPoints: copr?.hubTotalPoints,
                coprAutoTowerPoints: copr?.autoTowerPoints,
                coprEndgameTowerPoints: copr?.endgameTowerPoints,
                coprTotalPoints: copr?.totalPoints,
                coprTotalTeleopPoints: copr?.totalTeleopPoints,
                coprTotalAutoPoints: copr?.totalAutoPoints,
                coprTotalTowerPoints: copr?.totalTowerPoints,
                statboticsTotalPoints: statbotics?.totalPoints,
                statboticsAutoPoints: statbotics?.autoPoints,
                statboticsTeleopPoints: statbotics?.teleopPoints,
                statboticsEndgamePoints: statbotics?.endgamePoints,
                statboticsTotalFuel: statbotics?.totalFuel,
                statboticsAutoFuel: statbotics?.autoFuel,
                statboticsTeleopFuel: statbotics?.teleopFuel,
                statboticsEndgameFuel: statbotics?.endgameFuel,
                statboticsTeleopTotalFuel: statbotics
                    ? (statbotics.teleopFuel ?? 0) + (statbotics.endgameFuel ?? 0)
                    : undefined,
                statboticsTotalTower: statbotics?.totalTower,
                statboticsAutoTower: statbotics?.autoTower,
                statboticsEndgameTower: statbotics?.endgameTower,
            };
        }).sort((a, b) => a.teamNumber - b.teamNumber || a.eventKey.localeCompare(b.eventKey));

        return {
            enrichedScoutedTeamStats: enriched,
            enrichmentMs: performance.now() - startedAt,
        };
    }, [scoutedTeamStats, eventKey, fuelOprByEventTeam, rollingRatingsByEventTeamMatch]);

    useEffect(() => {
        let cancelled = false;

        const loadCachedOnlyStats = async () => {
            const startedAt = performance.now();
            try {
                const tbaEventKeys = await getCachedTBAEventKeys();
                const coprEventKeys = getCachedCOPREventKeys();
                const statboticsEventKeys = getCachedStatboticsEventKeys();
                const cachedSourceEventKeys = eventKey
                    ? [
                        ...(tbaEventKeys.includes(eventKey) ? [eventKey] : []),
                        ...(coprEventKeys.includes(eventKey) ? [eventKey] : []),
                        ...(statboticsEventKeys.includes(eventKey) ? [eventKey] : []),
                    ]
                    : [...new Set([
                        ...tbaEventKeys,
                        ...coprEventKeys,
                        ...statboticsEventKeys,
                    ])];
                const eventKeys = [...new Set(cachedSourceEventKeys)];

                if (eventKeys.length === 0) {
                    if (!cancelled) {
                        setCachedOnlyTeamStats([]);
                        setCachedOnlyLoadMs(performance.now() - startedAt);
                    }
                    return;
                }

                const existingTeamKeys = new Set(
                    enrichedScoutedTeamStats.map(team => `${team.eventKey}::${team.teamNumber}`)
                );

                const supplemental: TeamStats[] = [];

                for (const key of eventKeys) {
                    const [tbaMatches, coprByTeam, statboticsByTeam] = await Promise.all([
                        getCachedTBAEventMatches(key, true),
                        Promise.resolve(getCachedEventCOPRs(key)),
                        Promise.resolve(getCachedEventStatboticsEPA(key)),
                    ]);

                    const oprByTeam = includeFuelOpr
                        ? (await getFuelOprEntriesForEvent(
                            key,
                            tbaMatches,
                            localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false'
                        )).teamsByNumber
                        : new Map<number, FuelOprTeamEntry>();
                    const rollingByTeam = includeRollingRatings
                        ? await getLatestRollingRatingsByTeamForEvent(
                            key,
                            localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false'
                        )
                        : new Map<number, RollingFuelMoprRatings>();

                    const teamNumbers = new Set<number>([
                        ...oprByTeam.keys(),
                        ...coprByTeam.keys(),
                        ...statboticsByTeam.keys(),
                    ]);

                    for (const teamNumber of teamNumbers) {
                        const teamKey = `${key}::${teamNumber}`;
                        if (existingTeamKeys.has(teamKey)) {
                            continue;
                        }

                        const teamStats = createEmptyTeamStats(teamNumber, key);
                        const opr = oprByTeam.get(teamNumber);
                        const copr = coprByTeam.get(teamNumber);
                        const statbotics = statboticsByTeam.get(teamNumber);
                        const rolling = rollingByTeam.get(teamNumber);

                        teamStats.fuelAutoOPR = opr?.autoFuelOPR ?? 0;
                        teamStats.fuelTeleopOPR = opr?.teleopFuelOPR ?? 0;
                        teamStats.fuelTotalOPR = opr?.totalFuelOPR ?? 0;
                        teamStats.fuelOprLambda = opr?.lambda ?? 0;
                        teamStats.latestRollingFuelOPR = rolling?.fixedTotalMopr ?? 0;
                        teamStats.latestRollingFuelCOPR = rolling?.adaptiveTotalMopr ?? 0;
                        teamStats.latestRollingRatingsMatchCount = rolling?.matchesProcessed ?? 0;
                        teamStats.coprHubAutoPoints = copr?.hubAutoPoints;
                        teamStats.coprHubTeleopPoints = copr?.hubTeleopPoints;
                        teamStats.coprHubTotalPoints = copr?.hubTotalPoints;
                        teamStats.coprAutoTowerPoints = copr?.autoTowerPoints;
                        teamStats.coprEndgameTowerPoints = copr?.endgameTowerPoints;
                        teamStats.coprTotalPoints = copr?.totalPoints;
                        teamStats.coprTotalTeleopPoints = copr?.totalTeleopPoints;
                        teamStats.coprTotalAutoPoints = copr?.totalAutoPoints;
                        teamStats.coprTotalTowerPoints = copr?.totalTowerPoints;
                        teamStats.statboticsTotalPoints = statbotics?.totalPoints;
                        teamStats.statboticsAutoPoints = statbotics?.autoPoints;
                        teamStats.statboticsTeleopPoints = statbotics?.teleopPoints;
                        teamStats.statboticsEndgamePoints = statbotics?.endgamePoints;
                        teamStats.statboticsTotalFuel = statbotics?.totalFuel;
                        teamStats.statboticsAutoFuel = statbotics?.autoFuel;
                        teamStats.statboticsTeleopFuel = statbotics?.teleopFuel;
                        teamStats.statboticsEndgameFuel = statbotics?.endgameFuel;
                        teamStats.statboticsTeleopTotalFuel = statbotics
                            ? (statbotics.teleopFuel ?? 0) + (statbotics.endgameFuel ?? 0)
                            : undefined;
                        teamStats.statboticsTotalTower = statbotics?.totalTower;
                        teamStats.statboticsAutoTower = statbotics?.autoTower;
                        teamStats.statboticsEndgameTower = statbotics?.endgameTower;

                        supplemental.push(teamStats);
                    }
                }

                if (!cancelled) {
                    supplemental.sort((a, b) => a.teamNumber - b.teamNumber || a.eventKey.localeCompare(b.eventKey));
                    setCachedOnlyTeamStats(supplemental);
                    setCachedOnlyLoadMs(performance.now() - startedAt);
                }
            } catch (loadError) {
                console.error("Error loading cached-only team stats:", loadError);
                if (!cancelled) {
                    setCachedOnlyTeamStats([]);
                    setCachedOnlyLoadMs(performance.now() - startedAt);
                }
            }
        };

        void loadCachedOnlyStats();

        return () => {
            cancelled = true;
        };
    }, [eventKey, enrichedScoutedTeamStats, includeFuelOpr]);

    const { teamStats, combineMs } = useMemo(() => {
        const startedAt = performance.now();
        if (cachedOnlyTeamStats.length === 0) {
            return {
                teamStats: enrichedScoutedTeamStats,
                combineMs: performance.now() - startedAt,
            };
        }

        const byKey = new Map<string, TeamStats>();

        for (const team of enrichedScoutedTeamStats) {
            byKey.set(`${team.eventKey}::${team.teamNumber}`, team);
        }

        for (const team of cachedOnlyTeamStats) {
            const key = `${team.eventKey}::${team.teamNumber}`;
            if (!byKey.has(key)) {
                byKey.set(key, team);
            }
        }

        return {
            teamStats: [...byKey.values()].sort((a, b) => a.teamNumber - b.teamNumber || a.eventKey.localeCompare(b.eventKey)),
            combineMs: performance.now() - startedAt,
        };
    }, [enrichedScoutedTeamStats, cachedOnlyTeamStats]);

    const debugInfo = useMemo<UseAllTeamStatsDebugInfo>(() => ({
        snapshotLoadMs,
        fuelOprLoadMs,
        rollingRatingsLoadMs,
        enrichmentMs,
        cachedOnlyLoadMs,
        combineMs,
        totalHookReadyMs: isLoading ? 0 : performance.now() - hookStartedAt,
        snapshotCount: scoutedTeamStats.length,
        enrichedCount: enrichedScoutedTeamStats.length,
        supplementalCount: cachedOnlyTeamStats.length,
        finalCount: teamStats.length,
        eventKey,
        fuelOprDebug,
        rollingRatingsDebug,
    }), [
        snapshotLoadMs,
        fuelOprLoadMs,
        rollingRatingsLoadMs,
        enrichmentMs,
        cachedOnlyLoadMs,
        combineMs,
        isLoading,
        hookStartedAt,
        scoutedTeamStats.length,
        enrichedScoutedTeamStats.length,
        cachedOnlyTeamStats.length,
        teamStats.length,
        eventKey,
        fuelOprDebug,
        rollingRatingsDebug,
    ]);

    return { teamStats, isLoading, error, debugInfo };
};

function createEmptyTeamStats(teamNumber: number, eventKey: string): TeamStats {
    return {
        teamNumber,
        eventKey,
        matchCount: 0,
        totalPoints: 0,
        autoPoints: 0,
        teleopPoints: 0,
        endgamePoints: 0,
        overall: {
            avgTotalPoints: 0,
            totalPiecesScored: 0,
            avgGamePiece1: 0,
            avgGamePiece2: 0,
        },
        auto: {
            avgPoints: 0,
            avgGamePiece1: 0,
            avgGamePiece2: 0,
            mobilityRate: 0,
            startPositions: [],
        },
        teleop: {
            avgPoints: 0,
            avgGamePiece1: 0,
            avgGamePiece2: 0,
        },
        endgame: {
            avgPoints: 0,
            climbRate: 0,
            parkRate: 0,
        },
        rawValues: {
            totalPoints: [],
            autoPoints: [],
            teleopPoints: [],
            endgamePoints: [],
        },
    };
}

async function buildFuelOprMapFromCachedTba(
    eventKeys: string[],
    includePlayoffs: boolean
): Promise<{ oprMap: Map<string, FuelOprTeamEntry>; debug: DerivedMetricLoadDebugInfo }> {
    const result = new Map<string, FuelOprTeamEntry>();
    const eventSources: DerivedMetricEventDebugInfo[] = [];
    const uniqueEventKeys = [...new Set(eventKeys.filter(Boolean))];
    for (const event of uniqueEventKeys) {
        const { teamsByNumber, source, matchCount } = await getFuelOprEntriesForEvent(event, undefined, includePlayoffs);
        eventSources.push({ eventKey: event, source, matchCount });

        for (const [teamNumber, team] of teamsByNumber.entries()) {
            result.set(`${event}::${teamNumber}`, {
                autoFuelOPR: team.autoFuelOPR,
                teleopFuelOPR: team.teleopFuelOPR,
                totalFuelOPR: team.totalFuelOPR,
                lambda: team.lambda,
            });
        }
    }

    return {
        oprMap: result,
        debug: {
            requested: true,
            relevantEventKeys: uniqueEventKeys,
            includePlayoffs,
            fixedLambda: FIXED_FUEL_MOPR_LAMBDA,
            eventSources,
        },
    };
}

async function buildRollingRatingsMapFromCachedTba(
    eventKeys: string[],
    includePlayoffs: boolean
): Promise<{ rollingMap: RollingRatingsByMatch; debug: DerivedMetricLoadDebugInfo }> {
    const result: RollingRatingsByMatch = new Map();
    const eventSources: DerivedMetricEventDebugInfo[] = [];
    const uniqueEventKeys = [...new Set(eventKeys.filter(Boolean))];

    for (const event of uniqueEventKeys) {
        const { ratingsByMatchTeam, source, matchCount } = await getRollingRatingsEntriesForEvent(event, includePlayoffs);
        eventSources.push({ eventKey: event, source, matchCount });

        for (const [matchTeamKey, values] of ratingsByMatchTeam.entries()) {
            const [matchKey, teamNumber] = matchTeamKey.split('::');
            if (!matchKey || !teamNumber) {
                continue;
            }

            result.set(`${event}::${teamNumber}::${matchKey}`, values);
            result.set(`${event}::${teamNumber}::${normalizeMatchKey(matchKey)}`, values);
        }
    }

    return {
        rollingMap: result,
        debug: {
            requested: true,
            relevantEventKeys: uniqueEventKeys,
            includePlayoffs,
            fixedLambda: FIXED_FUEL_MOPR_LAMBDA,
            eventSources,
        },
    };
}

async function getFuelOprEntriesForEvent(
    eventKey: string,
    preloadedMatches?: Awaited<ReturnType<typeof getCachedTBAEventMatches>>,
    includePlayoffs: boolean = localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false'
): Promise<{ teamsByNumber: Map<number, FuelOprTeamEntry>; source: DerivedMetricEventSource; matchCount: number }> {
    const cached = await getCachedFuelOprByEvent(eventKey, includePlayoffs);
    if (cached) {
        const metadata = await getCacheMetadata(eventKey);
        return {
            teamsByNumber: cached,
            source: 'cache',
            matchCount: preloadedMatches?.length ?? metadata?.matchCount ?? 0,
        };
    }

    const matches = preloadedMatches ?? await getCachedTBAEventMatches(eventKey, true);
    if (matches.length < 2) {
        return {
            teamsByNumber: new Map(),
            source: 'skipped',
            matchCount: matches.length,
        };
    }

    const fixed = calculateFuelOPR(matches, {
        ridgeLambda: FIXED_FUEL_MOPR_LAMBDA,
        includePlayoffs,
        nonNegative: false,
    });

    const teamsByNumber = new Map(
        fixed.teams.map((team) => [
            team.teamNumber,
            {
                autoFuelOPR: team.autoFuelOPR,
                teleopFuelOPR: team.teleopFuelOPR,
                totalFuelOPR: team.totalFuelOPR,
                lambda: FIXED_FUEL_MOPR_LAMBDA,
            },
        ] as const)
    );

    await storeCachedFuelOprByEvent(eventKey, includePlayoffs, matches.length, teamsByNumber);
    return {
        teamsByNumber,
        source: 'computed',
        matchCount: matches.length,
    };
}

async function getRollingRatingsEntriesForEvent(
    eventKey: string,
    includePlayoffs: boolean = localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false'
): Promise<{ ratingsByMatchTeam: RollingRatingsByMatch; source: DerivedMetricEventSource; matchCount: number }> {
    const cached = await getCachedRollingRatingsByEvent(eventKey, includePlayoffs);
    if (cached) {
        const metadata = await getCacheMetadata(eventKey);
        return {
            ratingsByMatchTeam: cached,
            source: 'cache',
            matchCount: metadata?.matchCount ?? 0,
        };
    }

    const matches = await getCachedTBAEventMatches(eventKey, true);
    if (matches.length < 2) {
        return {
            ratingsByMatchTeam: new Map(),
            source: 'skipped',
            matchCount: matches.length,
        };
    }

    const rolling = calculateRollingFuelMoprRatings(matches, {
        includePlayoffs,
        fixedLambda: FIXED_FUEL_MOPR_LAMBDA,
    });

    await storeCachedRollingRatingsByEvent(eventKey, includePlayoffs, matches.length, rolling);
    return {
        ratingsByMatchTeam: rolling,
        source: 'computed',
        matchCount: matches.length,
    };
}

async function getLatestRollingRatingsByTeamForEvent(
    eventKey: string,
    includePlayoffs: boolean = localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false'
): Promise<Map<number, RollingFuelMoprRatings>> {
    const { ratingsByMatchTeam } = await getRollingRatingsEntriesForEvent(eventKey, includePlayoffs);
    const latestByTeam = new Map<number, RollingFuelMoprRatings>();

    for (const [matchTeamKey, values] of ratingsByMatchTeam.entries()) {
        const [, teamNumberText] = matchTeamKey.split('::');
        const teamNumber = Number(teamNumberText);
        if (!Number.isFinite(teamNumber)) {
            continue;
        }

        const existing = latestByTeam.get(teamNumber);
        if (!existing || values.matchesProcessed >= existing.matchesProcessed) {
            latestByTeam.set(teamNumber, values);
        }
    }

    return latestByTeam;
}
