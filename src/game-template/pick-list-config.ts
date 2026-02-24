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
 * 2026 filter group behavior.
 * Groups not listed default to multi-select.
 */
export const filterGroupSelectionModes: Record<string, PickListFilterGroupSelectionMode> = {
    "Shooting Style": "single",
    Accuracy: "single",
};

const CLIMB_SUCCESS_THRESHOLD = 50;
const ROLE_RATE_THRESHOLD = 30;
const ACCURACY_HIGH_THRESHOLD = 75;
const ACCURACY_SOLID_THRESHOLD = 60;
const ACCURACY_MIN_THRESHOLD = 40;

const getTeamNumber = (team: TeamStats, key: string): number => {
    const value = (team as Record<string, unknown>)[key];
    return typeof value === "number" ? value : 0;
};

const getEndgameNumber = (team: TeamStats, key: string): number => {
    const endgame = team.endgame as Record<string, unknown> | undefined;
    const value = endgame?.[key];
    return typeof value === "number" ? value : 0;
};

const getStartPositionRate = (team: TeamStats, positionKey: string): number => {
    const startPositions = team.startPositions as Record<string, unknown> | undefined;
    return typeof startPositions?.[positionKey] === "number" ? (startPositions[positionKey] as number) : 0;
};

const hasTrenchStartAuto = (team: TeamStats): boolean => {
    const leftTrenchRate = getStartPositionRate(team, "position0");
    const rightTrenchRate = getStartPositionRate(team, "position4");
    return leftTrenchRate + rightTrenchRate > 0;
};

const hasBumpStartAuto = (team: TeamStats): boolean => {
    const leftBumpRate = getStartPositionRate(team, "position1");
    const rightBumpRate = getStartPositionRate(team, "position3");
    return leftBumpRate + rightBumpRate > 0;
};

const hasHubStartAuto = (team: TeamStats): boolean => getStartPositionRate(team, "position2") > 0;

const hasPassingFromOpponent = (team: TeamStats): boolean => {
    const opponentToAllianceRate = getEndgameNumber(team, "passedToAllianceFromOpponentRate");
    const opponentToNeutralRate = getEndgameNumber(team, "passedToNeutralRate");
    return opponentToAllianceRate > 0 || opponentToNeutralRate > 0;
};

const hasRoleRate = (team: TeamStats, roleRateKey: string, threshold: number = ROLE_RATE_THRESHOLD): boolean => {
    return getTeamNumber(team, roleRateKey) >= threshold;
};

const isPrimarilyOnTheMoveShooter = (team: TeamStats): boolean => {
    const onMoveRate = getTeamNumber(team, "teleopShotOnTheMoveRate");
    const stationaryRate = getTeamNumber(team, "teleopShotStationaryRate");
    return onMoveRate > stationaryRate;
};

const isPrimarilyStationaryShooter = (team: TeamStats): boolean => {
    const onMoveRate = getTeamNumber(team, "teleopShotOnTheMoveRate");
    const stationaryRate = getTeamNumber(team, "teleopShotStationaryRate");
    return stationaryRate > onMoveRate;
};

const hasAccuracySelection = (team: TeamStats): boolean => {
    const totalSelectionRate =
        getTeamNumber(team, "accuracyAllRate")
        + getTeamNumber(team, "accuracyMostRate")
        + getTeamNumber(team, "accuracySomeRate")
        + getTeamNumber(team, "accuracyFewRate")
        + getTeamNumber(team, "accuracyLittleRate");
    return totalSelectionRate > 0;
};

/**
 * 2026 team filters for the Available Teams list.
 * Teams are shown only if they match ALL selected filters.
 */
export const filterOptions: PickListFilterOption[] = [
    {
        id: "has-climb",
        label: "Has any successful climb",
        description: "Includes only teams with at least one successful endgame climb.",
        group: "Climb",
        predicate: (team) => typeof team.endgame?.climbRate === "number" && team.endgame.climbRate > 0,
    },
    {
        id: "climb-success-50",
        label: `Climb success ≥ ${CLIMB_SUCCESS_THRESHOLD}%`,
        description: `Includes only teams at or above ${CLIMB_SUCCESS_THRESHOLD}% climb success.`,
        group: "Climb",
        predicate: (team) => typeof team.endgame?.climbRate === "number" && team.endgame.climbRate >= CLIMB_SUCCESS_THRESHOLD,
    },
    {
        id: "has-auto-climb",
        label: "Has auto climb",
        description: "Includes only teams with at least one successful auto climb.",
        group: "Climb",
        predicate: (team) => typeof team.autoClimbRate === "number" && team.autoClimbRate > 0,
    },
    {
        id: "auto-climb-from-side",
        label: "Auto climb from side",
        description: "Includes teams with non-zero auto climb-from-side rate.",
        group: "Climb",
        predicate: (team) => getTeamNumber(team, "autoClimbFromSideRate") > 0,
    },
    {
        id: "auto-climb-from-middle",
        label: "Auto climb from middle",
        description: "Includes teams with non-zero auto climb-from-middle rate.",
        group: "Climb",
        predicate: (team) => getTeamNumber(team, "autoClimbFromMiddleRate") > 0,
    },
    {
        id: "endgame-climb-from-side",
        label: "Endgame climb from side",
        description: "Includes teams with non-zero endgame climb-from-side rate.",
        group: "Climb",
        predicate: (team) => getEndgameNumber(team, "climbFromSideRate") > 0,
    },
    {
        id: "endgame-climb-from-middle",
        label: "Endgame climb from middle",
        description: "Includes teams with non-zero endgame climb-from-middle rate.",
        group: "Climb",
        predicate: (team) => getEndgameNumber(team, "climbFromMiddleRate") > 0,
    },

    {
        id: "has-trench-auto",
        label: "Has trench auto (either side)",
        description: "Includes teams that can start auto from left or right trench.",
        group: "Auto Start Positions",
        predicate: hasTrenchStartAuto,
    },
    {
        id: "trench-left-auto",
        label: "Left trench auto",
        description: "Includes teams with non-zero starts from left trench (Position 0).",
        group: "Auto Start Positions",
        predicate: (team) => getStartPositionRate(team, "position0") > 0,
    },
    {
        id: "trench-right-auto",
        label: "Right trench auto",
        description: "Includes teams with non-zero starts from right trench (Position 4).",
        group: "Auto Start Positions",
        predicate: (team) => getStartPositionRate(team, "position4") > 0,
    },
    {
        id: "has-bump-auto",
        label: "Has bump auto (either side)",
        description: "Includes teams that can start auto from left or right bump.",
        group: "Auto Start Positions",
        predicate: hasBumpStartAuto,
    },
    {
        id: "bump-left-auto",
        label: "Left bump auto",
        description: "Includes teams with non-zero starts from left bump (Position 1).",
        group: "Auto Start Positions",
        predicate: (team) => getStartPositionRate(team, "position1") > 0,
    },
    {
        id: "bump-right-auto",
        label: "Right bump auto",
        description: "Includes teams with non-zero starts from right bump (Position 3).",
        group: "Auto Start Positions",
        predicate: (team) => getStartPositionRate(team, "position3") > 0,
    },
    {
        id: "hub-auto",
        label: "Hub auto",
        description: "Includes teams with non-zero starts from hub (Position 2).",
        group: "Auto Start Positions",
        predicate: hasHubStartAuto,
    },

    {
        id: "passing-from-opponent",
        label: "Passing from opponent zone",
        description: "Includes teams that pass opponent → alliance or opponent → neutral.",
        group: "Passing",
        predicate: hasPassingFromOpponent,
    },
    {
        id: "passing-opponent-to-alliance",
        label: "Opponent → alliance passer",
        description: "Includes teams with non-zero opponent → alliance pass rate.",
        group: "Passing",
        predicate: (team) => getEndgameNumber(team, "passedToAllianceFromOpponentRate") > 0,
    },

    {
        id: "shooting-primary-on-move",
        label: "Primarily shoots on the move",
        description: "Teleop shot-on-the-move rate is higher than teleop stationary shot rate.",
        group: "Shooting Style",
        predicate: isPrimarilyOnTheMoveShooter,
    },
    {
        id: "shooting-primary-stationary",
        label: "Primarily shoots stationary",
        description: "Teleop stationary shot rate is higher than teleop shot-on-the-move rate.",
        group: "Shooting Style",
        predicate: isPrimarilyStationaryShooter,
    },
    {
        id: "shooting-balanced",
        label: "Balanced shooting style",
        description: "Teleop moving and stationary shot rates are both non-zero and within 15 points.",
        group: "Shooting Style",
        predicate: (team) => {
            const onMoveRate = getTeamNumber(team, "teleopShotOnTheMoveRate");
            const stationaryRate = getTeamNumber(team, "teleopShotStationaryRate");
            return onMoveRate > 0 && stationaryRate > 0 && Math.abs(onMoveRate - stationaryRate) <= 15;
        },
    },
    {
        id: "accuracy-high-rate",
        label: `Accuracy ≥ ${ACCURACY_HIGH_THRESHOLD}%`,
        description: "Includes teams with high overall scouting accuracy rate.",
        group: "Accuracy",
        predicate: (team) => hasAccuracySelection(team) && getTeamNumber(team, "accuracyScore") >= ACCURACY_HIGH_THRESHOLD,
    },
    {
        id: "accuracy-solid-rate",
        label: `Accuracy ≥ ${ACCURACY_SOLID_THRESHOLD}%`,
        description: "Includes teams with solid overall scouting accuracy rate.",
        group: "Accuracy",
        predicate: (team) => hasAccuracySelection(team) && getTeamNumber(team, "accuracyScore") >= ACCURACY_SOLID_THRESHOLD,
    },
    {
        id: "accuracy-min-rate",
        label: `Accuracy ≥ ${ACCURACY_MIN_THRESHOLD}%`,
        description: "Filters out teams below baseline scouting accuracy rate.",
        group: "Accuracy",
        predicate: (team) => hasAccuracySelection(team) && getTeamNumber(team, "accuracyScore") >= ACCURACY_MIN_THRESHOLD,
    },
    {
        id: "accuracy-has-data",
        label: "Has accuracy data",
        description: "Includes only teams with at least one match that has an accuracy selection.",
        group: "Accuracy",
        predicate: hasAccuracySelection,
    },

    {
        id: "role-cycler",
        label: `Cycler role (≥ ${ROLE_RATE_THRESHOLD}%)`,
        description: "Includes teams that frequently play cycler role.",
        group: "Roles",
        predicate: (team) => hasRoleRate(team, "roleActiveCyclerRate") || hasRoleRate(team, "roleInactiveCyclerRate"),
    },
    {
        id: "role-passer",
        label: `Passer role (≥ ${ROLE_RATE_THRESHOLD}%)`,
        description: "Includes teams that frequently play passer role.",
        group: "Roles",
        predicate: (team) => hasRoleRate(team, "roleActivePasserRate") || hasRoleRate(team, "roleInactivePasserRate"),
    },
    {
        id: "role-defense",
        label: `Defense role (≥ ${ROLE_RATE_THRESHOLD}%)`,
        description: "Includes teams that frequently play defense role.",
        group: "Roles",
        predicate: (team) => hasRoleRate(team, "roleActiveDefenseRate") || hasRoleRate(team, "roleInactiveDefenseRate"),
    },
    {
        id: "role-cleanup",
        label: `Clean-up role (≥ ${ROLE_RATE_THRESHOLD}%)`,
        description: "Includes teams that frequently play clean-up role.",
        group: "Roles",
        predicate: (team) => hasRoleRate(team, "roleActiveCleanUpRate") || hasRoleRate(team, "roleInactiveCleanUpRate"),
    },
    {
        id: "role-thief",
        label: `Thief role (≥ ${ROLE_RATE_THRESHOLD}%)`,
        description: "Includes teams that frequently play thief role.",
        group: "Roles",
        predicate: (team) => hasRoleRate(team, "roleActiveThiefRate") || hasRoleRate(team, "roleInactiveThiefRate"),
    },
];

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
