/**
 * Pick List Types
 * 
 * Core types for pick list management during alliance selection.
 * These types are year-agnostic - alliance structure is the same every year.
 */

// Re-export Alliance from existing location
export type { Alliance } from '@/core/lib/allianceTypes';

/**
 * A single item in a pick list
 */
export interface PickListItem {
    id: number;
    text: string;           // Display text (e.g., "Team 1234")
    teamNumber: number;     // Team number for lookups
    checked: boolean;       // Whether team has been picked
    description?: string;   // Optional description for SortableList compatibility
}

/**
 * A named pick list containing ordered teams
 */
export interface PickList {
    id: number;
    name: string;           // e.g., "Primary Pick List"
    description: string;    // Optional description
    teams: PickListItem[];  // Ordered list of teams
}

/**
 * Saved pick-list placement for restoring a team after alliance removal.
 */
export interface PickListMembershipSnapshot {
    listId: number;
    index: number;
    item: PickListItem;
}

export type TeamMembershipSnapshots = Record<string, PickListMembershipSnapshot[]>;

/**
 * A backup team in the backup pool
 */
export interface BackupTeam {
    teamNumber: number;
    rank: number;           // Order in backup pool
}

/**
 * Sort option for ordering teams
 */
export type PickListSortOption =
    | "number"
    | "totalPoints"
    | "gamePiece1"
    | "gamePiece2"
    | "climbRate"
    | "matches";

/**
 * Sort option configuration with label
 */
export interface SortOptionConfig {
    value: PickListSortOption;
    label: string;
}
