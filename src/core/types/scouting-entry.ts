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
  teamNumber?: string;
  
  /** Match number (e.g., "qm1", "sf2m1") */
  matchNumber?: string;
  
  /** Alliance color ("red" or "blue") */
  alliance?: string;
  
  /** Name of the scout who collected this data */
  scoutName?: string;
  
  /** Event key (e.g., "2025mrcmp") */
  eventName?: string;
  
  /** Game-specific scouting data - teams define their own structure */
  data: TGameData;
  
  /** Unix timestamp when entry was created */
  timestamp: number;
  
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
  teamNumbers?: string[];
  matchNumbers?: string[];
  eventNames?: string[];
  alliances?: string[];
  scoutNames?: string[];
  dateRange?: {
    start: number;
    end: number;
  };
}

/**
 * Pit scouting entry (team capabilities, not match performance)
 */
export interface PitScoutingEntry<TPitData = Record<string, unknown>> {
  id: string;
  teamNumber: string;
  eventName: string;
  scoutName: string;
  timestamp: number;
  
  /** Game-specific pit scouting data (robot capabilities, measurements, etc.) */
  data: TPitData;
  
  /** Optional photos of the robot */
  photos?: string[]; // Base64 encoded images
  
  /** Additional notes from pit crew */
  notes?: string;
}

/**
 * Pit scouting data collection
 */
export interface PitScoutingData<TPitData = Record<string, unknown>> {
  entries: PitScoutingEntry<TPitData>[];
  lastUpdated: number;
}

/**
 * Pit scouting statistics
 */
export interface PitScoutingStats {
  totalEntries: number;
  teams: string[];
  events: string[];
  scouts: string[];
}
