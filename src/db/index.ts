/**
 * Database layer exports
 * Generic Dexie-based IndexedDB implementation for offline-first scouting
 */

// Database instances and classes
export {
  db,
  pitDB,
  MatchScoutingDB,
  PitScoutingDB,
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
  clearAllScoutingData,
} from '../core/db/database';

// Database statistics
export {
  getDBStats,
  queryScoutingEntries,
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
  loadPitScoutingByTeamAndEvent,
  loadPitScoutingByEvent,
  deletePitScoutingEntry,
  clearAllPitScoutingData,
  getPitScoutingStats,
} from '../core/db/database';

// ============================================================================
// GAMIFICATION EXPORTS (re-exported from template for convenience)
// ============================================================================

export {
  gamificationDB as gameDB,
  getOrCreateScout,
  getScout,
  getAllScouts,
  updateScoutPoints,
  updateScoutStats,
  deleteScout,
  clearGamificationData as clearGameData,
  createMatchPrediction as savePrediction,
  getPredictionForMatch as getPrediction,
  getAllPredictionsForScout,
  getAllPredictionsForMatch,
  markPredictionAsVerified,
  unlockAchievement,
  getScoutAchievements,
  hasAchievement,
  STAKE_VALUES,
  calculateStreakBonus,
  calculateAccuracy,
  updateScoutWithPredictionResult,
} from '@/game-template/gamification';

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
