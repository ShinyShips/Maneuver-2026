import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { ProgressCard } from "@/core/components/team-stats/ProgressCard";
import type { TeamStats } from "@/core/types/team-stats";
import type { RateSectionDefinition, StatSectionDefinition } from "@/types/team-stats-display";

interface ConfiguredStatsSectionsProps {
    teamStats: TeamStats;
    statSections?: StatSectionDefinition[];
    rateSections?: RateSectionDefinition[];
    emptyMessage?: string;
}

const getNestedValue = (obj: unknown, keyPath: string): unknown => {
    const keys = keyPath.split('.');
    let value: unknown = obj;

    for (const key of keys) {
        if (!value || typeof value !== 'object' || !(key in value)) {
            return undefined;
        }
        value = (value as Record<string, unknown>)[key];
    }

    return value;
};

const formatValue = (value: unknown, type: 'number' | 'percentage' | 'text'): string => {
    if (value === undefined || value === null) return '-';
    if (type === 'text') return String(value);
    if (typeof value !== 'number') return '-';
    if (type === 'percentage') return `${Math.round(value)}%`;
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const getColorClass = (color?: string): string => {
    switch (color) {
        case 'green': return 'text-green-600';
        case 'blue': return 'text-blue-600';
        case 'purple': return 'text-purple-600';
        case 'orange': return 'text-orange-600';
        case 'red': return 'text-red-600';
        case 'yellow': return 'text-yellow-600';
        case 'slate': return 'text-slate-600';
        default: return 'text-foreground';
    }
};

export function ConfiguredStatsSections({
    teamStats,
    statSections = [],
    rateSections = [],
    emptyMessage = "No detailed stats available for this section.",
}: ConfiguredStatsSectionsProps) {
    if (statSections.length === 0 && rateSections.length === 0) {
        return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
    }

    return (
        <div className="space-y-4">
            {statSections.map((section) => (
                <Card key={section.id}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`grid grid-cols-1 sm:grid-cols-2 ${section.columns === 4 ? 'lg:grid-cols-4' : ''} gap-3`}>
                            {section.stats.map((stat) => {
                                const rawValue = getNestedValue(teamStats, stat.key);
                                const displayValue = formatValue(rawValue, stat.type);

                                return (
                                    <div key={stat.key} className="rounded border p-3">
                                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</div>
                                        <div className={`mt-1 text-lg font-semibold ${getColorClass(stat.color)}`}>{displayValue}</div>
                                        {stat.subtitle ? (
                                            <div className="mt-1 text-xs text-muted-foreground">{stat.subtitle}</div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {rateSections.map((section) => (
                <Card key={section.id}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {section.rates.map((rate) => {
                                const value = getNestedValue(teamStats, rate.key);
                                const numericValue = typeof value === 'number' ? value : 0;

                                return (
                                    <ProgressCard
                                        key={rate.key}
                                        title={rate.label}
                                        value={numericValue}
                                    />
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
