/**
 * Database layer exports
 * Generic Dexie-based IndexedDB implementation for offline-first scouting
 */

// Database instances and classes
export {
  db,
  pitDB,
  gameDB,
  MatchScoutingDB,
  PitScoutingDB,
  ScoutProfileDB,
} from '../core/db/database';

// Scouting data operations
export {
  saveScoutingEntry,
  saveScoutingEntries,
  loadAllScoutingEntries,
  loadScoutingEntriesByTeam,
  loadScoutingEntriesByMatch,
  loadScoutingEntriesByEvent,
  loadScoutingEntriesByTeamAndEvent,
  findExistingScoutingEntry,
  updateScoutingEntryWithCorrection,
  deleteScoutingEntry,
  deleteScoutingEntries,
  clearAllScoutingData,
} from '../core/db/database';

// Database statistics
export {
  getDBStats,
  getFilterOptions,
  queryScoutingEntries,
} from '../core/db/database';

// Data cleanup
export {
  cleanupDuplicateEntries,
  normalizeAllianceValues,
} from '../core/db/database';

// Import/export
export {
  exportScoutingData,
  importScoutingData,
} from '../core/db/database';

// Pit scouting operations
export {
  savePitScoutingEntry,
  loadAllPitScoutingEntries,
  loadPitScoutingByTeam,
  loadPitScoutingByEvent,
  loadPitScoutingByTeamAndEvent,
  deletePitScoutingEntry,
  clearAllPitScoutingData,
  getPitScoutingStats,
} from '../core/db/database';

// Scout profile operations (gamification)
export {
  getOrCreateScout,
  getScout,
  getAllScouts,
  updateScoutPoints,
  updateScoutStats,
  deleteScout,
  clearGameData,
} from '../core/db/database';

// Match prediction operations
export {
  savePrediction,
  getPrediction,
  getAllPredictionsForScout,
  getAllPredictionsForMatch,
  markPredictionAsVerified,
} from '../core/db/database';

// Achievement operations
export {
  unlockAchievement,
  getScoutAchievements,
  hasAchievement,
} from '../core/db/database';

// Data utilities
export {
  generateDeterministicEntryId,
  generateEntryId,
  detectConflicts,
  mergeScoutingData,
  findExistingEntry,
  loadScoutingData,
  saveScoutingData,
} from '../core/db/dataUtils';

export type {
  ConflictResolution,
  ConflictResult,
} from '../core/db/dataUtils';

// Scout gamification utilities
export {
  STAKE_VALUES,
  calculateStreakBonus,
  updateScoutWithPredictionResult,
  calculateAccuracy,
} from '../core/db/scoutGameUtils';
