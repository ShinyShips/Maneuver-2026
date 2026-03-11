import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/core/components/ui/card";
import { GenericSelector } from "@/core/components/ui/generic-selector";
import { ChartContainer } from "@/core/components/ui/chart";
import { getDistributedColor } from "@/core/lib/chartColors";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

export interface MatchProgressionMatchResult {
    matchNumber: string;
    eventKey?: string;
    totalPoints: number;
    autoPoints: number;
    teleopPoints: number;
    endgamePoints: number;
    autoFuel?: number;
    teleopFuel?: number;
    fuelPassed?: number;
    climbLevel?: number;
    [key: string]: unknown;
}

interface MatchProgressionChartProps {
    matchResults: MatchProgressionMatchResult[];
    compareMatchResults?: MatchProgressionMatchResult[];
    teamNumber: number;
    compareTeamNumber?: number;
}

const metricOptions = [
    { key: 'totalPoints', label: 'Total Points' },
    { key: 'autoPoints', label: 'Auto Points' },
    { key: 'teleopPoints', label: 'Teleop Points' },
    { key: 'endgamePoints', label: 'Endgame Points' },
    { key: 'autoFuel', label: 'Auto Fuel' },
    { key: 'teleopFuel', label: 'Teleop Fuel' },
    { key: 'fuelPassed', label: 'Fuel Passed' },
    { key: 'climbLevel', label: 'Climb Level' },
];

function getSeriesColor(index: number, dashed: boolean): string {
    return getDistributedColor(index, {
        baseHue: dashed ? 280 : 210,
        saturation: dashed ? 68 : 82,
        lightness: dashed ? 64 : 54,
    });
}

interface ChartSeries {
    eventKey: string;
    key: string;
    label: string;
    color: string;
    dashed: boolean;
}

function getEventKey(match: MatchProgressionMatchResult): string {
    if (typeof match.eventKey === 'string' && match.eventKey.trim() !== '') {
        return match.eventKey;
    }
    return 'unknown-event';
}

function getMatchNumber(match: MatchProgressionMatchResult): number {
    const parsed = Number.parseInt(String(match.matchNumber), 10);
    if (Number.isFinite(parsed)) {
        return parsed;
    }
    return 0;
}

function getMetricValue(match: MatchProgressionMatchResult, metricKey: string): number {
    const raw = match[metricKey as keyof MatchProgressionMatchResult];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw;
    }
    return 0;
}

function buildSeries(
    matches: MatchProgressionMatchResult[],
    teamNumber: number,
    source: 'primary' | 'compare',
    dashed: boolean
): ChartSeries[] {
    const events = [...new Set(matches.map(getEventKey))].sort();
    return events.map((eventKey, index) => ({
        eventKey,
        key: `team_${teamNumber}_${source}_${index}`,
        label: `Team ${teamNumber} (${eventKey})`,
        color: getSeriesColor(index, dashed),
        dashed,
    }));
}

export function MatchProgressionChart({
    matchResults,
    compareMatchResults,
    teamNumber,
    compareTeamNumber
}: MatchProgressionChartProps) {
    const [selectedMetric, setSelectedMetric] = useState('totalPoints');

    const primarySeries = buildSeries(matchResults, teamNumber, 'primary', false);
    const compareSeries = compareTeamNumber
        ? buildSeries(compareMatchResults ?? [], compareTeamNumber, 'compare', true)
        : [];
    const allSeries = [...primarySeries, ...compareSeries];

    const primarySeriesKeyByEvent = new Map(primarySeries.map(series => [series.eventKey, series.key]));
    const compareSeriesKeyByEvent = new Map(compareSeries.map(series => [series.eventKey, series.key]));

    // Prepare chart data: one row per match number so events share the same x-axis for comparison.
    const chartRows = new Map<number, Record<string, number | string>>();

    for (const match of matchResults) {
        const matchNumber = getMatchNumber(match);
        const eventKey = getEventKey(match);
        const seriesKey = primarySeriesKeyByEvent.get(eventKey);
        if (!seriesKey) continue;

        const row = chartRows.get(matchNumber) ?? { match: matchNumber };
        row[seriesKey] = getMetricValue(match, selectedMetric);
        chartRows.set(matchNumber, row);
    }

    if (compareTeamNumber && compareMatchResults) {
        for (const match of compareMatchResults) {
            const matchNumber = getMatchNumber(match);
            const eventKey = getEventKey(match);
            const seriesKey = compareSeriesKeyByEvent.get(eventKey);
            if (!seriesKey) continue;

            const row = chartRows.get(matchNumber) ?? { match: matchNumber };
            row[seriesKey] = getMetricValue(match, selectedMetric);
            chartRows.set(matchNumber, row);
        }
    }

    const chartData = [...chartRows.values()].sort((a, b) => {
        const matchA = typeof a.match === 'number' ? a.match : Number(a.match) || 0;
        const matchB = typeof b.match === 'number' ? b.match : Number(b.match) || 0;
        return matchA - matchB;
    });

    const chartConfig = allSeries.reduce<Record<string, { label: string; color: string }>>((config, series) => {
        config[series.key] = {
            label: series.label,
            color: series.color,
        };
        return config;
    }, {});

    const metricLabel = metricOptions.find(m => m.key === selectedMetric)?.label || selectedMetric;
    const eventCount = primarySeries.length;
    const description = eventCount > 1
        ? `Performance trends across matches (${eventCount} events shown separately)`
        : 'Performance trends across matches';

    return (
        <Card>
            <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Match Progression
                        </CardTitle>
                        <CardDescription>
                            {description}
                        </CardDescription>
                    </div>

                    <div className="flex items-center gap-2 lg:pt-0.5">
                        <label className="text-sm font-medium whitespace-nowrap">Metric:</label>
                        <GenericSelector
                            label="Select Metric"
                            value={selectedMetric}
                            availableOptions={metricOptions.map(m => m.key)}
                            onValueChange={setSelectedMetric}
                            placeholder="Select metric"
                            displayFormat={(key: string) => metricOptions.find(m => m.key === key)?.label || key}
                            className="w-48"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {allSeries.map(series => (
                        <div key={series.key} className="flex items-center gap-2">
                            <div
                                className="h-3 w-3 rounded-full"
                                style={{
                                    backgroundColor: series.color,
                                    opacity: series.dashed ? 0.8 : 1,
                                }}
                            />
                            <span className="text-sm font-medium">{series.label}</span>
                        </div>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-87.5 w-full">
                    <ChartContainer config={chartConfig} className="h-full w-full aspect-auto!">
                        <div className="h-full w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={chartData}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis
                                        dataKey="match"
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                        tick={{ fontSize: 12 }}
                                        label={{ value: 'Match Number', position: 'insideBottom', offset: -15 }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        label={{ value: metricLabel, angle: -90, position: 'insideLeft' }}
                                    />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (!active || !payload || payload.length === 0) return null;
                                            return (
                                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                    <div className="grid gap-2">
                                                        <div className="font-medium">Match {payload[0].payload.match}</div>
                                                        {payload.map((entry: any, index: number) => (
                                                            <div key={index} className="flex items-center gap-2">
                                                                <div
                                                                    className="h-2 w-2 rounded-full"
                                                                    style={{ backgroundColor: entry.color }}
                                                                />
                                                                <span className="text-sm text-muted-foreground">
                                                                    {entry.name}:
                                                                </span>
                                                                <span className="font-bold">{entry.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
                                    {allSeries.map(series => (
                                        <Line
                                            key={series.key}
                                            type="monotone"
                                            dataKey={series.key}
                                            name={series.label}
                                            stroke={series.color}
                                            strokeDasharray={series.dashed ? '6 4' : undefined}
                                            strokeWidth={2}
                                            dot={{ r: 4, fill: series.color, stroke: series.color, strokeWidth: 2 }}
                                            activeDot={{ r: 6, fill: series.color, stroke: series.color, strokeWidth: 2 }}
                                            connectNulls={false}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
    );
}
