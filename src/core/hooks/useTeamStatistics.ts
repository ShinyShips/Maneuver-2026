/**
 * Team Statistics Hook for Strategy Overview Page
 * 
 * This hook wraps useAllTeamStats and applies Strategy Overview-specific
 * filtering and column visibility logic.
 * 
 * NOTE: This hook NO LONGER calculates stats directly. All calculations
 * are done in game-template/calculations.ts via useAllTeamStats.
 */

import { useMemo } from "react";
import { useAllTeamStats } from "./useAllTeamStats";
import { StrategyConfig, ColumnFilter, TeamData, AggregationType } from "@/core/types/strategy";

export interface UseTeamStatisticsResult {
    teamStats: TeamData[];
    filteredTeamStats: TeamData[];
    availableEvents: string[];
    isLoading: boolean;
    error: Error | null;
}

function normalizeEventFilter(eventFilter: string | string[] | undefined): string[] {
    if (!eventFilter) {
        return [];
    }

    if (Array.isArray(eventFilter)) {
        return [...new Set(eventFilter.filter((eventKey): eventKey is string => !!eventKey && eventKey !== 'all'))];
    }

    if (eventFilter === 'all') {
        return [];
    }

    return [eventFilter];
}

export const useTeamStatistics = (
    eventFilter: string | string[] | undefined,
    config: StrategyConfig,
    columnFilters: Record<string, ColumnFilter>,
    aggregationType: AggregationType = 'average'
): UseTeamStatisticsResult => {
    const selectedEventKeys = useMemo(() => normalizeEventFilter(eventFilter), [eventFilter]);

    // Load once and apply event filtering in this hook to avoid duplicate IndexedDB reads.
    const { teamStats: allTeamStats, isLoading, error } = useAllTeamStats();

    const availableEvents = useMemo(() => {
        return Array.from(new Set(allTeamStats.map((team) => team.eventKey).filter(Boolean))).sort();
    }, [allTeamStats]);

    const filteredSourceTeamStats = useMemo(() => {
        if (selectedEventKeys.length === 0) {
            return allTeamStats;
        }

        const selectedSet = new Set(selectedEventKeys);
        return allTeamStats.filter((team) => selectedSet.has(team.eventKey));
    }, [allTeamStats, selectedEventKeys]);

    // Convert TeamStats to TeamData format (for backwards compatibility)
    const mappedTeamStats = useMemo(() => {
        return filteredSourceTeamStats.map(stats => {
            const teamData: TeamData = {
                teamNumber: stats.teamNumber,
                eventKey: stats.eventKey,
                matchCount: stats.matchCount,
            };

            // Map all stats to the TeamData object
            // This allows the existing table/chart code to work without changes
            config.columns.forEach(col => {
                if (["teamNumber", "eventKey", "matchCount"].includes(col.key)) return;

                // Get value from stats using dot notation
                const value = getValueByPath(stats, col.key, aggregationType);
                if (value !== undefined) {
                    teamData[col.key] = value;
                }
            });

            return teamData;
        });
    }, [filteredSourceTeamStats, config.columns, aggregationType]);

    const teamStats = useMemo(() => {
        if (selectedEventKeys.length === 1) {
            return mappedTeamStats;
        }

        // "All events" should show one row per team, aggregated across events.
        const byTeam = new Map<number, TeamData[]>();
        for (const row of mappedTeamStats) {
            const rows = byTeam.get(row.teamNumber) ?? [];
            rows.push(row);
            byTeam.set(row.teamNumber, rows);
        }

        const consolidated: TeamData[] = [];

        for (const [teamNumber, rows] of byTeam.entries()) {
            const consolidatedEventKey = selectedEventKeys.length === 0 ? 'all' : 'multiple';
            const merged: TeamData = {
                teamNumber,
                eventKey: consolidatedEventKey,
                matchCount: rows.reduce((sum, row) => {
                    const count = typeof row.matchCount === 'number' ? row.matchCount : 0;
                    return sum + count;
                }, 0),
            };

            const allKeys = new Set<string>();
            rows.forEach(row => {
                Object.keys(row).forEach(key => allKeys.add(key));
            });

            for (const key of allKeys) {
                if (key === 'teamNumber' || key === 'eventKey' || key === 'matchCount') {
                    continue;
                }

                const numericValues = rows
                    .map(row => row[key])
                    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

                if (numericValues.length > 0) {
                    if (aggregationType === 'average') {
                        const weighted = rows
                            .map(row => {
                                const value = row[key];
                                const weight = typeof row.matchCount === 'number' ? row.matchCount : 0;
                                return { value, weight };
                            })
                            .filter(
                                (pair): pair is { value: number; weight: number } =>
                                    typeof pair.value === 'number' &&
                                    Number.isFinite(pair.value) &&
                                    pair.weight > 0
                            );

                        const totalWeight = weighted.reduce((sum, pair) => sum + pair.weight, 0);
                        if (totalWeight > 0) {
                            const weightedSum = weighted.reduce((sum, pair) => sum + pair.value * pair.weight, 0);
                            merged[key] = weightedSum / totalWeight;
                            continue;
                        }
                    }

                    merged[key] = aggregateArray(numericValues, aggregationType);
                    continue;
                }

                const firstDefined = rows.find(row => row[key] !== undefined)?.[key];
                if (firstDefined !== undefined) {
                    merged[key] = firstDefined;
                }
            }

            consolidated.push(merged);
        }

        return consolidated.sort((a, b) => a.teamNumber - b.teamNumber);
    }, [selectedEventKeys, mappedTeamStats, aggregationType]);

    // Apply column filters
    const filteredTeamStats = useMemo(() => {
        if (Object.keys(columnFilters).length === 0) return teamStats;

        return teamStats.filter(team => {
            return Object.entries(columnFilters).every(([key, filter]) => {
                const val = team[key];
                if (typeof val !== 'number') return true;

                switch (filter.operator) {
                    case ">": return val > filter.value;
                    case ">=": return val >= filter.value;
                    case "<": return val < filter.value;
                    case "<=": return val <= filter.value;
                    case "=": return Math.abs(val - filter.value) < 0.001;
                    case "!=": return Math.abs(val - filter.value) >= 0.001;
                    case "between":
                        return filter.value2 !== undefined
                            ? val >= filter.value && val <= filter.value2
                            : true;
                    default: return true;
                }
            });
        });
    }, [teamStats, columnFilters]);

    return { teamStats, filteredTeamStats, availableEvents, isLoading, error };
};

/**
 * Helper to get nested value from object using dot notation
 * If the value is an array (like rawValues), aggregate it based on the aggregationType
 */
function getValueByPath(obj: any, path: string, aggregationType: AggregationType = 'average'): any {
    if (!obj) return undefined;

    // Direct match
    if (obj[path] !== undefined) {
        const value = obj[path];
        return Array.isArray(value) ? aggregateArray(value, aggregationType) : value;
    }

    // Dot notation
    if (path.includes('.')) {
        const value = path.split('.').reduce((o, key) => o?.[key], obj);
        return Array.isArray(value) ? aggregateArray(value, aggregationType) : value;
    }

    return undefined;
}

/**
 * Aggregate an array of numbers based on aggregation type
 */
function aggregateArray(values: number[], type: AggregationType): number {
    if (values.length === 0) return 0;

    switch (type) {
        case 'average': {
            const sum = values.reduce((acc, val) => acc + val, 0);
            return sum / values.length;
        }
        case 'max': {
            return Math.max(...values);
        }
        case 'min': {
            return Math.min(...values);
        }
        case 'p75': {
            const sorted = [...values].sort((a, b) => a - b);
            const index = Math.ceil(sorted.length * 0.75) - 1;
            return sorted[index] ?? 0;
        }
        case 'p25': {
            const sorted = [...values].sort((a, b) => a - b);
            const index = Math.ceil(sorted.length * 0.25) - 1;
            return sorted[index] ?? 0;
        }
        case 'median': {
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0
                ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
                : sorted[mid] ?? 0;
        }
        case 'sum': {
            return values.reduce((acc, val) => acc + val, 0);
        }
        default:
            return 0;
    }
}
