/**
 * Team Stats Detail Component
 * 
 * Config-driven stats display for Match Strategy page.
 * Uses match-strategy-config.ts to determine which stats to show and how to format them.
 */

import { Badge } from "@/core/components/ui/badge";
import { getMatchStrategyPhaseConfig, getStatValue, formatStatValue, getVisibleMatchStrategyStats, type MatchStrategyDisplayMode } from "@/game-template/match-strategy-config";
import type { TeamStats } from "@/core/types/team-stats";

interface TeamStatsDetailProps {
    stats: TeamStats | null;
    activeStatsTab: string;
    displayMode: MatchStrategyDisplayMode;
}

export const TeamStatsDetail = ({ stats, activeStatsTab, displayMode }: TeamStatsDetailProps) => {
    if (!stats) return null;

    // Find the phase configuration
    const phaseConfig = getMatchStrategyPhaseConfig(activeStatsTab);
    if (!phaseConfig) return null;

    const gridCols = phaseConfig.gridCols || 3;
    const visibleStats = getVisibleMatchStrategyStats(activeStatsTab, displayMode);
    const visibleColumnCount = Math.max(1, Math.min(gridCols, visibleStats.length || 1));

    return (
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="min-h-24 flex flex-col justify-start py-1">
                <div
                    className="grid gap-x-2 gap-y-3 text-sm mb-1"
                    style={{ gridTemplateColumns: `repeat(${visibleColumnCount}, minmax(0, 1fr))` }}
                >
                    {visibleStats.map((statConfig, idx) => {
                        const value = getStatValue(stats, statConfig.key, statConfig.aggregation);
                        const formattedValue = formatStatValue(value, statConfig.format, statConfig.decimals);

                        return (
                            <div key={idx} className="text-center">
                                <p className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                    {statConfig.label}
                                </p>
                                <p className={`text-lg font-bold ${statConfig.color || 'text-foreground'}`}>
                                    {formattedValue}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Special handling for starting positions in auto phase */}
                {(displayMode === 'scouted' || displayMode === 'scaled') && activeStatsTab === 'auto' && stats.auto.startPositions && stats.auto.startPositions.length > 0 && (
                    <div className="flex flex-col items-center mt-3 pt-3 border-t border-gray-50 dark:border-gray-800/50">
                        <p className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Starting Positions:</p>
                        <div className="flex flex-wrap gap-1.5 justify-center">
                            {stats.auto.startPositions.slice(0, 4).map((pos, idx) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                    {pos.position}: {pos.percentage}%
                                </Badge>
                            ))}
                            {stats.auto.startPositions.length > 4 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                    +{stats.auto.startPositions.length - 4}
                                </Badge>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="text-center text-xs text-muted-foreground mt-2">
                {stats.matchCount} matches played
            </div>
        </div>
    );
};
