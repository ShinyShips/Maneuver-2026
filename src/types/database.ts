/**
 * Maneuver Core - Database Schema Types
 * 
 * Defines the structure for IndexedDB storage using Dexie.
 * 
 * STORAGE ARCHITECTURE:
 * - Separate Dexie databases for different concerns:
 *   1. MatchScoutingDB: Match scouting entries
 *   2. PitScoutingDB: Pit scouting entries
 *   3. TBACacheDB: TBA match validation data cache
 *   4. ScoutProfileDB: Gamification (scouts, predictions, achievements)
 * 
 * Framework provides base interfaces; game implementations extend with game-specific fields.
 */

import type { ScoutingEntryBase } from './scouting-entry';

// ============================================================================
// Match Scouting Database
// ============================================================================

/**
 * Match scouting database schema
 */
export interface ScoutingDatabaseSchema {
  scoutingData: ScoutingEntryBase;
}

// ============================================================================
// Pit Scouting Database
// ============================================================================

// Entry types are in: src/core/types/pit-scouting.ts
import type { PitScoutingEntryBase, DrivetrainType, ProgrammingLanguage } from '../core/types/pit-scouting';
export type { PitScoutingEntryBase, DrivetrainType, ProgrammingLanguage };

/**
 * Pit scouting database schema
 */
export interface PitScoutingDatabaseSchema {
  pitScoutingData: PitScoutingEntryBase;
}

// ============================================================================
// TBA Cache Database (Match Validation)
// ============================================================================

/**
 * Cached TBA match data with expiration metadata
 * Used for match validation and offline-first functionality
 */
export interface CachedTBAMatch {
  matchKey: string;         // Primary key: "2025mrcmp_qm1"
  eventKey: string;         // For querying by event: "2025mrcmp"
  matchNumber: number;      // Match number for sorting
  compLevel: string;        // Competition level: "qm", "ef", "qf", "sf", "f"
  data: Record<string, unknown>;  // Complete TBA match data (game-agnostic)
  cachedAt: number;         // Timestamp when cached
  expiresAt: number;        // Timestamp when cache expires (offline-first: return even if expired)
}

/**
 * Metadata for TBA event cache
 * Tracks cache freshness and statistics
 */
export interface TBACacheMetadata {
  eventKey: string;         // Primary key: "2025mrcmp"
  lastFetchedAt: number;    // Timestamp of last TBA fetch
  matchCount: number;       // Total matches cached
  qualMatchCount: number;   // Qualification matches cached
  playoffMatchCount: number; // Playoff matches cached
}

/**
 * Validation result stored in database
 * Links match validation results to TBA cache
 * 
 * NOTE: Full interface definition in src/types/validation.ts
 * This is referenced here for database schema documentation only.
 * Import from validation.ts when using this type.
 */
export interface ValidationResultDB {
  id: string;               // Primary key: "{eventKey}_{matchKey}"
  eventKey: string;         // Event key for querying
  matchKey: string;         // TBA match key
  matchNumber: string;      // Match number for display
  result: Record<string, unknown>; // Complete MatchValidationResult (see validation.ts)
  timestamp: number;        // When validation was performed
}

/**
 * TBA cache database schema
 * Used for match validation and offline-first functionality
 */
export interface TBACacheDatabaseSchema {
  matches: CachedTBAMatch;
  metadata: TBACacheMetadata;
  validationResults: ValidationResultDB;
}

// ============================================================================
// Scout Profile Database (Gamification) - Re-exported from gamification module
// ============================================================================

// Re-export gamification types from the optional gamification module
export type { Scout, MatchPrediction, ScoutAchievement } from '@/game-template/gamification';

/**
 * Scout profile database schema
 * Used for gamification features
 */
export interface ScoutProfileDatabaseSchema {
  scouts: import('@/game-template/gamification').Scout;
  predictions: import('@/game-template/gamification').MatchPrediction;
  scoutAchievements: import('@/game-template/gamification').ScoutAchievement;
}
