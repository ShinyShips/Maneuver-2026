import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { StatCard } from "@/core/components/team-stats/StatCard";
import type { TeamStats } from "@/core/types/team-stats";
import type { StatSectionDefinition } from "@/types/team-stats-display";
import { TeleopPathsVisualization } from "./TeleopPathsVisualization";
import { type TeamStatsTemplate } from "@/game-template/analysis";

interface ScoringAnalysisProps {
    teamStats: TeamStats;
    compareStats: TeamStats | null;
    statSections: StatSectionDefinition[];
}

export function ScoringAnalysis({
    teamStats,
    compareStats,
    statSections
}: ScoringAnalysisProps) {
    const teamStatsTemplate = teamStats as TeamStatsTemplate;
    
    if (teamStats.matchesPlayed === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">No scoring data available</p>
                </CardContent>
            </Card>
        );
    }

    const sections = statSections.filter(s => s.tab === 'scoring');

    const getStatValue = (stats: TeamStats, key: string): number => {
        const value = (stats as Record<string, unknown>)[key];
        return typeof value === 'number' ? value : 0;
    };

    return (
        <div className="space-y-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sections.map(section => (
                    <Card key={section.id}>
                        <CardHeader>
                            <CardTitle>{section.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`grid grid-cols-2 md:grid-cols-${section.columns || 2} gap-4`}>
                                {section.stats.map(stat => (
                                    <StatCard
                                        key={stat.key}
                                        title={stat.label}
                                        value={getStatValue(teamStats, stat.key)}
                                        subtitle={stat.subtitle}
                                        color={stat.color}
                                        type={stat.type}
                                        compareValue={compareStats ? getStatValue(compareStats, stat.key) : undefined}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Teleop Paths Visualization */}
            <Card>
                <CardContent>
                    <TeleopPathsVisualization 
                        matchResults={teamStatsTemplate.matchResults || []}
                        alliance="blue"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
