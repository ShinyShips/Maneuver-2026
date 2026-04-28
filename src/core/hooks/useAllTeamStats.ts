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
import { useAllMatches } from "./useAllMatches";
import { calculateTeamStats } from "@/game-template/calculations";
import { calculateFuelOPR } from "@/game-template/fuelOpr";
import { calculateRollingFuelMoprRatings, type RollingFuelMoprRatings } from "@/game-template/rollingFuelOpr";
import type { ScoutingEntry } from "@/game-template/scoring";
import { getCachedCOPREventKeys, getCachedEventCOPRs } from "@/core/lib/tba/coprUtils";
import { getCachedEventStatboticsEPA, getCachedStatboticsEventKeys } from "@/core/lib/statbotics/epaUtils";
import { getCachedTBAEventKeys, getCachedTBAEventMatches } from "@/core/lib/tbaCache";
import type { TeamStats } from "@/core/types/team-stats";

const FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY = 'fuelOprIncludePlayoffs';
const FIXED_FUEL_MOPR_LAMBDA = 0.3;

type FuelOprTeamEntry = {
    autoFuelOPR: number;
    teleopFuelOPR: number;
    totalFuelOPR: number;
    lambda: number;
};

type RollingRatingsByMatch = Map<string, RollingFuelMoprRatings>;

function normalizeMatchKey(matchKey: string): string {
    if (!matchKey.includes('_')) {
        return matchKey;
    }

    return matchKey.split('_')[1] || matchKey;
}

export interface UseAllTeamStatsResult {
    teamStats: TeamStats[];
    isLoading: boolean;
    error: Error | null;
}

/**
 * Central hook for all team statistics.
 * Computes stats ONCE per team and caches results.
 * 
 * @param eventKey - Optional event filter
 * @returns Array of TeamStats objects with all computed metrics
 */
export const useAllTeamStats = (eventKey?: string): UseAllTeamStatsResult => {
    const { matches, isLoading, error } = useAllMatches(eventKey);
    const [cachedOnlyTeamStats, setCachedOnlyTeamStats] = useState<TeamStats[]>([]);
    const [isCacheLoading, setIsCacheLoading] = useState(false);
    const [fuelOprByEventTeam, setFuelOprByEventTeam] = useState<Map<string, FuelOprTeamEntry>>(new Map());
    const [rollingRatingsByEventTeamMatch, setRollingRatingsByEventTeamMatch] = useState<RollingRatingsByMatch>(new Map());

    useEffect(() => {
        let cancelled = false;

        const loadFuelOprMap = async () => {
            const cachedTbaEventKeys = await getCachedTBAEventKeys();
            const relevantEventKeys = eventKey
                ? [eventKey]
                : [...new Set([
                    ...matches.map(match => match.eventKey).filter((key): key is string => !!key),
                    ...cachedTbaEventKeys,
                ])];

            if (relevantEventKeys.length === 0) {
                if (!cancelled) {
                    setFuelOprByEventTeam(new Map());
                }
                return;
            }

            const oprMap = await buildFuelOprMapFromCachedTba(relevantEventKeys);

            if (!cancelled) {
                setFuelOprByEventTeam(oprMap);
            }
        };

        void loadFuelOprMap();

        return () => {
            cancelled = true;
        };
    }, [eventKey, matches]);

    useEffect(() => {
        let cancelled = false;

        const loadRollingRatings = async () => {
            const cachedTbaEventKeys = await getCachedTBAEventKeys();
            const relevantEventKeys = eventKey
                ? [eventKey]
                : [...new Set([
                    ...matches.map(match => match.eventKey).filter((key): key is string => !!key),
                    ...cachedTbaEventKeys,
                ])];

            if (relevantEventKeys.length === 0) {
                if (!cancelled) {
                    setRollingRatingsByEventTeamMatch(new Map());
                }
                return;
            }

            const rollingMap = await buildRollingRatingsMapFromCachedTba(relevantEventKeys);
            if (!cancelled) {
                setRollingRatingsByEventTeamMatch(rollingMap);
            }
        };

        void loadRollingRatings();

        return () => {
            cancelled = true;
        };
    }, [eventKey, matches]);

    const scoutedTeamStats = useMemo(() => {
        if (!matches || matches.length === 0) return [];

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

        // Group matches by team + event
        const matchesByTeam = matches.reduce((acc, match) => {
            const teamNumber = match.teamNumber;
            const event = match.eventKey || "Unknown";

            if (!teamNumber) return acc;

            const key = `${teamNumber}_${event}`;
            if (!acc[key]) {
                acc[key] = {
                    teamNumber,
                    eventKey: event,
                    matches: [],
                };
            }
            acc[key].matches.push(match);
            return acc;
        }, {} as Record<string, { teamNumber: number; eventKey: string; matches: ScoutingEntry[] }>);

        // Calculate stats for each team (ONCE)
        const stats: TeamStats[] = Object.values(matchesByTeam).map(({ teamNumber, eventKey, matches: teamMatches }) => {
            const calculated = calculateTeamStats(teamMatches);
            const fuelOpr = fuelOprByEventTeam.get(`${eventKey}::${teamNumber}`);
            const copr = coprByEvent.get(eventKey)?.get(teamNumber);
            const statbotics = statboticsByEvent.get(eventKey)?.get(teamNumber);

            const baseStats = {
                teamNumber,
                eventKey,
                ...calculated,
            } as TeamStats;

            const matchResults = Array.isArray(baseStats.matchResults)
                ? baseStats.matchResults.map(match => {
                    const matchKey = typeof match?.matchKey === 'string' ? match.matchKey : null;
                    const rolling = matchKey
                        ? rollingRatingsByEventTeamMatch.get(`${eventKey}::${teamNumber}::${matchKey}`)
                            ?? rollingRatingsByEventTeamMatch.get(`${eventKey}::${teamNumber}::${normalizeMatchKey(matchKey)}`)
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
                fuelAutoOPR: fuelOpr?.autoFuelOPR ?? (calculated.fuelAutoOPR ?? 0),
                fuelTeleopOPR: fuelOpr?.teleopFuelOPR ?? (calculated.fuelTeleopOPR ?? 0),
                fuelTotalOPR: fuelOpr?.totalFuelOPR ?? (calculated.fuelTotalOPR ?? 0),
                fuelOprLambda: fuelOpr?.lambda ?? 0,
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
        });

        // Sort by team number
        return stats.sort((a, b) => a.teamNumber - b.teamNumber);
    }, [matches, eventKey, fuelOprByEventTeam, rollingRatingsByEventTeamMatch]);

    useEffect(() => {
        let cancelled = false;

        const loadCachedOnlyStats = async () => {
            setIsCacheLoading(true);
            try {
                const tbaEventKeys = await getCachedTBAEventKeys();
                const coprEventKeys = getCachedCOPREventKeys();
                const statboticsEventKeys = getCachedStatboticsEventKeys();
                const eventKeys = eventKey
                    ? [eventKey]
                    : [...new Set([
                        ...tbaEventKeys,
                        ...coprEventKeys,
                        ...statboticsEventKeys,
                        ...scoutedTeamStats.map(team => team.eventKey).filter(Boolean),
                    ])];

                const existingTeamKeys = new Set(
                    scoutedTeamStats.map(team => `${team.eventKey}::${team.teamNumber}`)
                );

                const supplemental: TeamStats[] = [];

                for (const key of eventKeys) {
                    const [tbaMatches, coprByTeam, statboticsByTeam] = await Promise.all([
                        getCachedTBAEventMatches(key, true),
                        Promise.resolve(getCachedEventCOPRs(key)),
                        Promise.resolve(getCachedEventStatboticsEPA(key)),
                    ]);

                    const includePlayoffs = localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false';
                    const fixed = tbaMatches.length >= 2
                        ? calculateFuelOPR(tbaMatches, {
                            ridgeLambda: FIXED_FUEL_MOPR_LAMBDA,
                            includePlayoffs,
                            nonNegative: false,
                        })
                        : null;

                    const oprByTeam = new Map(
                        (fixed?.teams ?? []).map(team => [team.teamNumber, team] as const)
                    );

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

                        teamStats.fuelAutoOPR = opr?.autoFuelOPR ?? 0;
                        teamStats.fuelTeleopOPR = opr?.teleopFuelOPR ?? 0;
                        teamStats.fuelTotalOPR = opr?.totalFuelOPR ?? 0;
                        teamStats.fuelOprLambda = FIXED_FUEL_MOPR_LAMBDA;
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
                }
            } catch (loadError) {
                console.error("Error loading cached-only team stats:", loadError);
                if (!cancelled) {
                    setCachedOnlyTeamStats([]);
                }
            } finally {
                if (!cancelled) {
                    setIsCacheLoading(false);
                }
            }
        };

        void loadCachedOnlyStats();

        return () => {
            cancelled = true;
        };
    }, [eventKey, scoutedTeamStats]);

    const teamStats = useMemo(() => {
        if (cachedOnlyTeamStats.length === 0) {
            return scoutedTeamStats;
        }

        const byKey = new Map<string, TeamStats>();

        for (const team of scoutedTeamStats) {
            byKey.set(`${team.eventKey}::${team.teamNumber}`, team);
        }

        for (const team of cachedOnlyTeamStats) {
            const key = `${team.eventKey}::${team.teamNumber}`;
            if (!byKey.has(key)) {
                byKey.set(key, team);
            }
        }

        return [...byKey.values()].sort((a, b) => a.teamNumber - b.teamNumber || a.eventKey.localeCompare(b.eventKey));
    }, [scoutedTeamStats, cachedOnlyTeamStats]);

    return { teamStats, isLoading: isLoading || isCacheLoading, error };
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

async function buildFuelOprMapFromCachedTba(eventKeys: string[]): Promise<Map<string, FuelOprTeamEntry>> {
    const result = new Map<string, FuelOprTeamEntry>();
    const includePlayoffs = localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false';

    const uniqueEventKeys = [...new Set(eventKeys.filter(Boolean))];
    const eventMatches = await Promise.all(
        uniqueEventKeys.map(async (event) => ({
            event,
            matches: await getCachedTBAEventMatches(event, true),
        }))
    );

    for (const { event, matches } of eventMatches) {
        if (matches.length < 2) {
            continue;
        }

        const fixed = calculateFuelOPR(matches, {
            ridgeLambda: FIXED_FUEL_MOPR_LAMBDA,
            includePlayoffs,
            nonNegative: false,
        });

        for (const team of fixed.teams) {
            result.set(`${event}::${team.teamNumber}`, {
                autoFuelOPR: team.autoFuelOPR,
                teleopFuelOPR: team.teleopFuelOPR,
                totalFuelOPR: team.totalFuelOPR,
                lambda: FIXED_FUEL_MOPR_LAMBDA,
            });
        }
    }

    return result;
}

async function buildRollingRatingsMapFromCachedTba(eventKeys: string[]): Promise<RollingRatingsByMatch> {
    const result: RollingRatingsByMatch = new Map();
    const includePlayoffs = localStorage.getItem(FUEL_MOPR_INCLUDE_PLAYOFFS_STORAGE_KEY) !== 'false';
    const uniqueEventKeys = [...new Set(eventKeys.filter(Boolean))];
    const eventMatches = await Promise.all(
        uniqueEventKeys.map(async (event) => ({
            event,
            matches: await getCachedTBAEventMatches(event, true),
        }))
    );

    for (const { event, matches } of eventMatches) {
        if (matches.length < 2) {
            continue;
        }

        const rolling = calculateRollingFuelMoprRatings(matches, {
            includePlayoffs,
            fixedLambda: FIXED_FUEL_MOPR_LAMBDA,
        });

        for (const [matchTeamKey, values] of rolling.entries()) {
            const [matchKey, teamNumber] = matchTeamKey.split('::');
            if (!matchKey || !teamNumber) {
                continue;
            }

            result.set(`${event}::${teamNumber}::${matchKey}`, values);
            result.set(`${event}::${teamNumber}::${normalizeMatchKey(matchKey)}`, values);
        }
    }

    return result;
}
