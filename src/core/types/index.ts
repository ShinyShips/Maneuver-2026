/**
 * Core Types Barrel Export
 * 
 * SINGLE SOURCE OF TRUTH for all core framework types.
 * Import from '@/core/types' instead of individual files.
 * 
 * Organization:
 * - scouting-entry.ts: ScoutingEntryBase and match scouting types
 * - team-stats.ts: TeamStats calculated statistics
 * - pit-scouting.ts: PitScoutingEntryBase and pit scouting types
 */

// Match scouting types
export * from './scouting-entry';

// Team statistics types
export * from './team-stats';
export * from './strategy-snapshot';

// Pit scouting types
export * from './pit-scouting';
