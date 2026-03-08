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
import type { TeamStats } from "@/core/types/team-stats";
import type { ScoutingEntry } from "@/game-template/scoring";

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
            return {
                teamNumber,
                eventKey,
                ...calculated,
            } as TeamStats;
        });

        // Sort by team number
        return stats.sort((a, b) => a.teamNumber - b.teamNumber);
    }, [matches]);

    return { teamStats, isLoading, error };
};
