import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { StatCard } from "@/core/components/team-stats/StatCard";
import type { TeamStats } from "@/core/types/team-stats";
import type { StatSectionDefinition, RateSectionDefinition } from "@/types/team-stats-display";

interface StatOverviewProps {
    teamStats: TeamStats;
    compareStats: TeamStats | null;
    statSections: StatSectionDefinition[];
    rateSections: RateSectionDefinition[];
    setActiveTab: (tab: string) => void;
}

export function StatOverview({
    teamStats,
    compareStats,
    statSections,
    rateSections: _rateSections,
    setActiveTab
}: StatOverviewProps) {
    if (teamStats.matchesPlayed === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                    <div className="text-center space-y-3">
                        <h3 className="text-lg font-semibold">No Match Scouting Data</h3>
                        <p className="text-muted-foreground">
                            This team doesn't have any match scouting data.
                        </p>
                        <Button onClick={() => setActiveTab("pit")} className="mt-4">
                            View Pit Data →
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const sections = statSections.filter(s => s.tab === 'overview');

    const getStatValue = (stats: TeamStats, key: string): string | number => {
        const value = (stats as Record<string, unknown>)[key];
        if (typeof value === 'string') return value;
        return typeof value === 'number' ? value : 0;
    };

    return (
        <div className="space-y-6 pb-6">
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
    );
}
