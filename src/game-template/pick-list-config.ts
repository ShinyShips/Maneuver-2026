/**
 * Pick List Configuration
 * 
 * Year-specific configuration for the Pick Lists page.
 * Sort options are derived from the strategy config columns for consistency.
 */

import type { TeamStats } from "@/core/types/team-stats";
import { strategyConfig } from "./strategy-config";

/**
 * Get sort options from strategy config columns.
 * Only includes numeric columns that can be sorted.
 */
export const sortOptions = [
    // Team number is always first
    { value: "teamNumber", label: "Team Number" },
    // Derive from strategy config - only numeric columns
    ...strategyConfig.columns
        .filter(col => col.numeric && col.key !== "matchCount")
        .map(col => ({
            value: col.key,
            label: col.label
        })),
    // Match count always at the end
    { value: "matchCount", label: "Matches Played" },
];

/**
 * Sort option type - derived from sortOptions values
 */
export type PickListSortOption = string;

/**
 * Team filter option configuration.
 * Each game year can define its own predicates and labels.
 */
export interface PickListFilterOption {
    id: string;
    label: string;
    description?: string;
    group?: string;
    predicate: (team: TeamStats) => boolean;
}

export type PickListFilterGroupSelectionMode = "single" | "multi";

/**
 * Optional group behavior overrides for filter selection mode.
 * Groups default to multi-select unless marked as single-select.
 */
export const filterGroupSelectionModes: Record<string, PickListFilterGroupSelectionMode> = {};

/**
 * Year-specific team filters for the Available Teams list.
 * Default is empty in core template; implement in yearly repo.
 */
export const filterOptions: PickListFilterOption[] = [];

/**
 * Gets the sort value for a team based on the selected sort option.
 * Uses nested path access to get values from TeamStats.
 * 
 * @param team - The team stats object
 * @param sortOption - The column key to sort by
 * @returns The numeric value to sort by
 */
export function getSortValue(team: TeamStats, sortOption: PickListSortOption): number {
    if (sortOption === "teamNumber") {
        return team.teamNumber;
    }

    // Handle nested paths like "auto.action1Count" or "endgame.option1"
    const parts = sortOption.split(".");
    let value: unknown = team;

    for (const part of parts) {
        if (value && typeof value === "object" && part in value) {
            value = (value as Record<string, unknown>)[part];
        } else {
            value = undefined;
            break;
        }
    }

    if (Array.isArray(value)) {
        const numericValues = value.filter((item): item is number => typeof item === "number");
        if (numericValues.length === 0) return 0;
        const total = numericValues.reduce((sum, item) => sum + item, 0);
        return total / numericValues.length;
    }

    // Return numeric value or 0
    return typeof value === "number" ? value : 0;
}

/**
 * Returns true if the sort option should be in ascending order (low to high).
 * By default, "teamNumber" is ascending, all others are descending (high is better).
 */
export function isAscendingSort(sortOption: PickListSortOption): boolean {
    return sortOption === "teamNumber";
}

// Export year-specific components
export { TeamCardStats } from './components/pick-list/TeamCardStats';
export { TeamStatsDialog } from './components/pick-list/TeamStatsDialog';
