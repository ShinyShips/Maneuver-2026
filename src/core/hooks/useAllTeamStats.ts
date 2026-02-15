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

import { useMemo } from "react";
import { useAllMatches } from "./useAllMatches";
import { calculateTeamStats } from "@/game-template/calculations";
import { calculateFuelOPRHybrid } from "@/game-template/fuelOpr";
import type { TeamStats } from "@/core/types/team-stats";
import type { ScoutingEntry } from "@/game-template/scoring";
import type { TBAMatchData } from "@/core/lib/tbaMatchData";

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

    const teamStats = useMemo(() => {
        if (!matches || matches.length === 0) return [];

        const fuelOprByEventTeam = buildFuelOprMap(matches);

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

            const baseStats = {
                teamNumber,
                eventKey,
                ...calculated,
            } as TeamStats;

            return {
                ...baseStats,
                fuelAutoOPR: fuelOpr?.autoFuelOPR ?? (calculated.fuelAutoOPR ?? 0),
                fuelTeleopOPR: fuelOpr?.teleopFuelOPR ?? (calculated.fuelTeleopOPR ?? 0),
                fuelTotalOPR: fuelOpr?.totalFuelOPR ?? (calculated.fuelTotalOPR ?? 0),
                fuelOprLambda: fuelOpr?.lambda ?? 0,
            };
        });

        // Sort by team number
        return stats.sort((a, b) => a.teamNumber - b.teamNumber);
    }, [matches]);

    return { teamStats, isLoading, error };
};

function buildFuelOprMap(matches: ScoutingEntry[]): Map<string, {
    autoFuelOPR: number;
    teleopFuelOPR: number;
    totalFuelOPR: number;
    lambda: number;
}> {
    const entriesByEventMatch = new Map<string, Map<string, ScoutingEntry>>();

    for (const entry of matches) {
        const event = entry.eventKey || "Unknown";
        const matchKey = `${event}::${entry.matchNumber}`;
        const teamKey = `${entry.allianceColor}::${entry.teamNumber}`;

        if (!entriesByEventMatch.has(matchKey)) {
            entriesByEventMatch.set(matchKey, new Map<string, ScoutingEntry>());
        }

        const perMatch = entriesByEventMatch.get(matchKey)!;
        const existing = perMatch.get(teamKey);
        if (!existing || (entry.timestamp ?? 0) >= (existing.timestamp ?? 0)) {
            perMatch.set(teamKey, entry);
        }
    }

    const matchesByEvent = new Map<string, TBAMatchData[]>();

    for (const [eventMatchKey, teamEntries] of entriesByEventMatch.entries()) {
        const event = eventMatchKey.split("::")[0] ?? "Unknown";
        const redEntries = [...teamEntries.values()].filter(entry => entry.allianceColor === 'red');
        const blueEntries = [...teamEntries.values()].filter(entry => entry.allianceColor === 'blue');

        if (redEntries.length !== 3 || blueEntries.length !== 3) {
            continue;
        }

        const toScaledFuel = (entry: ScoutingEntry) => {
            const scaledMetrics = entry.gameData?.scaledMetrics as {
                scaledAutoFuel?: number;
                scaledTeleopFuel?: number;
            } | undefined;

            const rawAuto = typeof entry.gameData?.auto?.fuelScoredCount === 'number'
                ? entry.gameData.auto.fuelScoredCount
                : 0;
            const rawTeleop = typeof entry.gameData?.teleop?.fuelScoredCount === 'number'
                ? entry.gameData.teleop.fuelScoredCount
                : 0;

            return {
                auto: typeof scaledMetrics?.scaledAutoFuel === 'number' ? scaledMetrics.scaledAutoFuel : rawAuto,
                teleop: typeof scaledMetrics?.scaledTeleopFuel === 'number' ? scaledMetrics.scaledTeleopFuel : rawTeleop,
            };
        };

        const redTotals = redEntries.reduce((acc, entry) => {
            const scaled = toScaledFuel(entry);
            acc.auto += scaled.auto;
            acc.teleop += scaled.teleop;
            return acc;
        }, { auto: 0, teleop: 0 });

        const blueTotals = blueEntries.reduce((acc, entry) => {
            const scaled = toScaledFuel(entry);
            acc.auto += scaled.auto;
            acc.teleop += scaled.teleop;
            return acc;
        }, { auto: 0, teleop: 0 });

        const matchNumber = parseInt((eventMatchKey.split("::")[1] ?? '0'), 10) || 0;

        const tbaLikeMatch: TBAMatchData = {
            key: `${event}_qm${matchNumber}`,
            event_key: event,
            comp_level: 'qm',
            match_number: matchNumber,
            set_number: 1,
            alliances: {
                red: {
                    score: redTotals.auto + redTotals.teleop,
                    team_keys: redEntries.map(entry => `frc${entry.teamNumber}`),
                    dq_team_keys: [],
                    surrogate_team_keys: [],
                },
                blue: {
                    score: blueTotals.auto + blueTotals.teleop,
                    team_keys: blueEntries.map(entry => `frc${entry.teamNumber}`),
                    dq_team_keys: [],
                    surrogate_team_keys: [],
                },
            },
            score_breakdown: {
                red: {
                    hubScore: {
                        autoCount: redTotals.auto,
                        teleopCount: redTotals.teleop,
                        totalCount: redTotals.auto + redTotals.teleop,
                    },
                },
                blue: {
                    hubScore: {
                        autoCount: blueTotals.auto,
                        teleopCount: blueTotals.teleop,
                        totalCount: blueTotals.auto + blueTotals.teleop,
                    },
                },
            },
            winning_alliance: (redTotals.auto + redTotals.teleop) > (blueTotals.auto + blueTotals.teleop)
                ? 'red'
                : (blueTotals.auto + blueTotals.teleop) > (redTotals.auto + redTotals.teleop)
                    ? 'blue'
                    : '',
            time: 0,
            actual_time: 0,
            predicted_time: 0,
            post_result_time: 0,
        };

        if (!matchesByEvent.has(event)) {
            matchesByEvent.set(event, []);
        }
        matchesByEvent.get(event)!.push(tbaLikeMatch);
    }

    const result = new Map<string, {
        autoFuelOPR: number;
        teleopFuelOPR: number;
        totalFuelOPR: number;
        lambda: number;
    }>();

    for (const [event, eventMatches] of matchesByEvent.entries()) {
        if (eventMatches.length < 2) {
            continue;
        }

        const hybrid = calculateFuelOPRHybrid(eventMatches, {
            includePlayoffs: false,
        });

        for (const team of hybrid.opr.teams) {
            result.set(`${event}::${team.teamNumber}`, {
                autoFuelOPR: team.autoFuelOPR,
                teleopFuelOPR: team.teleopFuelOPR,
                totalFuelOPR: team.totalFuelOPR,
                lambda: hybrid.selectedLambda,
            });
        }
    }

    return result;
}
