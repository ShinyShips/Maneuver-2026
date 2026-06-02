import { useMemo, useCallback } from "react";
import { StrategyConfig, TeamData } from "@/core/types/strategy";

export const useChartData = (
    filteredTeamStats: TeamData[],
    chartType: "bar" | "scatter" | "box" | "stacked",
    chartMetric: string,
    scatterXMetric: string,
    scatterYMetric: string,
    config: StrategyConfig
) => {

    // Helper to get column definition
    const getCol = useCallback((key: string) =>
        config.columns.find(c => c.key === key),
        [config.columns]);

    const chartData = useMemo(() => {
        if (chartType === "scatter") {
            return filteredTeamStats.map(team => ({
                team: String(team.teamNumber),
                x: typeof team[scatterXMetric] === 'number' ? team[scatterXMetric] : 0,
                y: typeof team[scatterYMetric] === 'number' ? team[scatterYMetric] : 0,
                eventKey: team.eventKey
            }));
        }
        else if (chartType === "box") {
            const boxData: Array<{ team: string; value: number; eventKey: string }> = [];

            filteredTeamStats.forEach(team => {
                const baseVal = typeof team[chartMetric] === 'number' ? team[chartMetric] as number : 0;
                const rawMetricValues = team.rawValues?.[chartMetric];
                const values = rawMetricValues && rawMetricValues.length > 0
                    ? rawMetricValues
                    : [baseVal];

                values.forEach(value => {
                    boxData.push({
                        team: String(team.teamNumber),
                        value,
                        eventKey: team.eventKey
                    });
                });
            });
            return boxData;
        }
        else if (chartType === "stacked") {
            // Stacked bar logic for phase breakdown
            // Access the rawValues arrays that have already been aggregated by useTeamStatistics
            
            return filteredTeamStats.map(team => {
                // Try to get the already-aggregated values first, or fall back to direct access
                const auto = (team['rawValues.autoPoints'] as number) || (team['autoPoints'] as number) || 0;
                const teleop = (team['rawValues.teleopPoints'] as number) || (team['teleopPoints'] as number) || 0;
                const endgame = (team['rawValues.endgamePoints'] as number) || (team['endgamePoints'] as number) || 0;

                return {
                    team: String(team.teamNumber),
                    autoPoints: auto,
                    teleopPoints: teleop,
                    endgamePoints: endgame,
                    totalPoints: auto + teleop + endgame,
                    eventKey: team.eventKey
                };
            })
                .sort((a, b) => b.totalPoints - a.totalPoints)
                .slice(0, 12);
        }
        else {
            // Bar chart
            return filteredTeamStats.map(team => ({
                team: String(team.teamNumber),
                value: (team[chartMetric] as number) || 0,
                eventKey: team.eventKey
            }))
                .sort((a, b) => (b.value as number) - (a.value as number))
                .slice(0, 12); // Top 12
        }

    }, [filteredTeamStats, chartType, chartMetric, scatterXMetric, scatterYMetric]);

    const chartConfig = useMemo(() => {
        const xCol = getCol(scatterXMetric);
        const yCol = getCol(scatterYMetric);
        const mainCol = getCol(chartMetric);

        if (chartType === "stacked") {
            return {
                autoPoints: { label: "Auto Points", color: "hsl(var(--chart-1))" },
                teleopPoints: { label: "Teleop Points", color: "hsl(var(--chart-2))" },
                endgamePoints: { label: "Endgame Points", color: "hsl(var(--chart-3))" },
            };
        }

        return {
            value: { label: mainCol?.label || "Value", color: "hsl(var(--chart-1))" },
            x: { label: xCol?.label || "X", color: "hsl(var(--chart-1))" },
            y: { label: yCol?.label || "Y", color: "hsl(var(--chart-2))" },
        };
    }, [chartType, chartMetric, scatterXMetric, scatterYMetric, getCol]);

    return { chartData, chartConfig };
}
