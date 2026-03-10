/**
 * Generic scouting entry types for maneuver-core template
 * Teams extend these base types with their game-specific data structures
 */

/**
 * Base scouting entry structure
 * TGameData is the game-specific data (e.g., 2025 game piece tracking)
 * 
 * @example
 * // In your game implementation:
 * interface MyGameData {
 *   autoCoralCount: number;
 *   teleopAlgaeCount: number;
 *   // ... other game-specific fields
 * }
 * 
 * type MyScoutingEntry = ScoutingEntryBase<MyGameData>;
 */
export interface ScoutingEntryBase<TGameData = Record<string, unknown>> {
  /** Unique entry identifier (auto-generated composite key) */
  id: string;

  /** Team number being scouted */
  teamNumber: number;

  /** Match number (numeric) */
  matchNumber: number;

  /** TBA match key (e.g., "qm1") */
  matchKey: string;

  /** Alliance color ("red" or "blue") */
  allianceColor: 'red' | 'blue';

  /** Name of the scout who collected this data */
  scoutName: string;

  /** Event key (e.g., "2025mrcmp") */
  eventKey: string;

  /** Game-specific scouting data - teams define their own structure */
  gameData: TGameData;

  /** Unix timestamp when entry was created */
  timestamp: number;

  /** Optional notes from scout */
  comments?: string;

  /** Robot did not show up for this match */
  noShow?: boolean;

  /** Exclude this match from aggregate team statistics while keeping the raw entry */
  ignoreForStats?: boolean;

  // === Correction Tracking ===
  // These fields support re-scouting workflows for data quality

  /** Has this entry been corrected/re-scouted? */
  isCorrected?: boolean;

  /** Number of times this match has been corrected */
  correctionCount?: number;

  /** Unix timestamp of last correction */
  lastCorrectedAt?: number;

  /** Name of scout who made the last correction */
  lastCorrectedBy?: string;

  /** Notes explaining why correction was made */
  correctionNotes?: string;

  /** Original scout's name (preserved when corrections are made) */
  originalScoutName?: string;
}

/**
 * Database export format with metadata
 */
export interface ScoutingDataExport<TGameData = Record<string, unknown>> {
  entries: ScoutingEntryBase<TGameData>[];
  exportedAt: number;
  version: string;
}

/**
 * Import/export operation result
 */
export interface ImportResult {
  success: boolean;
  importedCount: number;
  duplicatesSkipped?: number;
  error?: string;
}

/**
 * Database statistics for dashboard/admin views
 */
export interface DBStats {
  totalEntries: number;
  teams: string[];
  matches: string[];
  scouts: string[];
  events: string[];
  oldestEntry?: number;
  newestEntry?: number;
}

/**
 * Filter options for UI dropdowns
 */
export interface FilterOptions {
  teams: string[];
  matches: string[];
  events: string[];
  alliances: string[];
  scouts: string[];
}

/**
 * Query filters for advanced searches
 */
export interface QueryFilters {
  teamNumbers?: number[];
  matchNumbers?: number[];
  eventKeys?: string[];
  alliances?: ('red' | 'blue')[];
  scoutNames?: string[];
  dateRange?: {
    start: number;
    end: number;
  };
}

// =============================================================================
// PIT SCOUTING TYPES
// =============================================================================
// SINGLE SOURCE OF TRUTH: src/types/database.ts
// - PitScoutingEntryBase (with robotPhoto, weight, drivetrain, etc.)
// - PitScoutingDatabaseSchema
// 
// Do NOT add pit scouting types here - import from @/types/database instead.
// =============================================================================
