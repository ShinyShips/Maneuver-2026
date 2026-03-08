import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { StatCard } from "@/core/components/team-stats/StatCard";
import type { TeamStats } from "@/core/types/team-stats";
import type { StartPositionConfig } from "@/types/team-stats-display";
import type { MatchResult } from "@/game-template/analysis";
import { AutoStartPositionMap } from "./AutoStartPositionMap";
import { AutoPathsByPosition } from "./AutoPathsByPosition";

interface AutoAnalysisProps {
    teamStats: TeamStats;
    compareStats: TeamStats | null;
    startPositionConfig: StartPositionConfig;
}

export function AutoAnalysis({
    teamStats,
    compareStats,
    startPositionConfig
}: AutoAnalysisProps) {
    if (teamStats.matchesPlayed === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">No autonomous data available</p>
                </CardContent>
            </Card>
        );
    }

    // Extract start positions and match results from teamStats
    const startPositions = (teamStats as TeamStats & { startPositions?: Record<string, number> })?.startPositions ?? {};
    const matchResults = (teamStats as TeamStats & { matchResults?: MatchResult[] })?.matchResults ?? [];

    const renderStartPositions = () => {
        if (!startPositions || Object.keys(startPositions).length === 0) {
            return <p className="text-muted-foreground text-center py-4">No position data available</p>;
        }

        return (
            <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: startPositionConfig.positionCount }).map((_, index) => {
                    const label = startPositionConfig.positionLabels?.[index] || `Position ${index}`;
                    const color = startPositionConfig.positionColors?.[index] || 'blue';
                    const value = startPositions[`position${index}`] || 0;
                    const compareValue = (compareStats as TeamStats & { startPositions?: Record<string, number> })?.startPositions?.[`position${index}`];

                    return (
                        <StatCard
                            key={index}
                            title={label}
                            value={value}
                            subtitle="% of matches"
                            color={color as 'default' | 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'yellow'}
                            compareValue={compareValue}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Field visualization with position overlays */}
                <Card>
                    <CardHeader>
                        <CardTitle>Starting Position Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AutoStartPositionMap
                            startPositions={startPositions}
                            matchResults={matchResults}
                            config={startPositionConfig}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Position Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {renderStartPositions()}
                    </CardContent>
                </Card>
            </div>

            {/* Auto Paths by Starting Position */}
            <Card>
                <CardHeader>
                    <CardTitle>Auto Paths by Starting Position</CardTitle>
                </CardHeader>
                <CardContent>
                    <AutoPathsByPosition
                        matchResults={matchResults}
                        alliance="blue"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
