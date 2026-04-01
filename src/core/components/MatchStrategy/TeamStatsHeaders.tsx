/**
 * Team Stats Headers Component
 * 
 * Displays aggregate stats summary for an alliance (sum of all 3 teams).
 * Used in the AllianceCard header.
 */

import type { TeamStats } from "@/core/types/team-stats";
import { formatStatValue, getMatchStrategySummary, getStatValue, type MatchStrategyDisplayMode } from "@/game-template/match-strategy-config";

interface TeamStatsHeadersProps {
    alliance: 'red' | 'blue';
    activeStatsTab: string;
    displayMode: MatchStrategyDisplayMode;
    selectedTeams: (number | null)[];
    getTeamStats: (teamNumber: number | null) => TeamStats | null;
}

export const TeamStatsHeaders = ({
    alliance,
    activeStatsTab,
    displayMode,
    selectedTeams,
    getTeamStats
}: TeamStatsHeadersProps) => {
    const isBlue = alliance === 'blue';
    const startIndex = isBlue ? 3 : 0;

    // Get stats for all 3 teams in this alliance
    const team1Stats = getTeamStats(selectedTeams[startIndex] ?? null);
    const team2Stats = getTeamStats(selectedTeams[startIndex + 1] ?? null);
    const team3Stats = getTeamStats(selectedTeams[startIndex + 2] ?? null);
    const summaryConfig = getMatchStrategySummary(activeStatsTab, displayMode);

    if (!summaryConfig) {
        return null;
    }

    const totalValue = [team1Stats, team2Stats, team3Stats].reduce((sum, stats) => {
        const value = stats ? getStatValue(stats, summaryConfig.key, summaryConfig.aggregation) : undefined;
        return sum + (typeof value === 'number' ? value : 0);
    }, 0);

    const formattedValue = formatStatValue(totalValue, summaryConfig.format, summaryConfig.decimals);

    return (
        <div className="text-sm text-muted-foreground">
            <span className="font-medium">{summaryConfig.label}:</span> {formattedValue}
        </div>
    );
};
