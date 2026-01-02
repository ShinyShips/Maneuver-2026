/**
 * Generic Dexie database layer for maneuver-core
 * 
 * This is the year-agnostic database infrastructure.
 * Game-specific data goes in the `data` field as JSON.
 * 
 * Three separate databases:
 * 1. MatchScoutingDB - Match scouting entries
 * 2. PitScoutingDB - Pit scouting/robot capabilities
 * 3. ScoutProfileDB - Scout gamification (stakes, predictions, achievements)
 */

import Dexie, { type Table } from 'dexie';
import type {
  ScoutingEntryBase,
  ScoutingDataExport,
  ImportResult,
  DBStats,
  FilterOptions,
  QueryFilters,
  PitScoutingEntry,
  PitScoutingStats,
} from '../types/scouting-entry';
import type {
  Scout,
  MatchPrediction,
  ScoutAchievement,
} from '../types/strategy';

// ============================================================================
// DATABASE CLASSES
// ============================================================================

/**
 * Main scouting database - stores match scouting entries
 * 
 * Version 1: Basic indexes
 * Version 2: Added correction tracking fields
 */
export class MatchScoutingDB extends Dexie {
  scoutingData!: Table<ScoutingEntryBase, string>;

  constructor() {
    super('MatchScoutingDB');
    
    // Version 1: Complete schema for maneuver-core template
    this.version(1).stores({
      scoutingData: 'id, teamNumber, matchNumber, allianceColor, scoutName, eventKey, matchKey, timestamp, isCorrected, [teamNumber+eventKey], [scoutName+eventKey+matchNumber]'
    });
  }
}

/**
 * Pit scouting database - stores robot capabilities and measurements
 */
export class PitScoutingDB extends Dexie {
  pitScoutingData!: Table<PitScoutingEntry<Record<string, unknown>>, string>;

  constructor() {
    super('PitScoutingDB');
    
    this.version(1).stores({
      pitScoutingData: 'id, teamNumber, eventName, scoutName, timestamp, [teamNumber+eventName]'
    });
  }
}

/**
 * Scout profile database - gamification, predictions, achievements
 */
export class ScoutProfileDB extends Dexie {
  scouts!: Table<Scout, string>;
  predictions!: Table<MatchPrediction, string>;
  scoutAchievements!: Table<ScoutAchievement, string>;

  constructor() {
    super('ScoutProfileDB');
    
    // Version 1: Initial schema
    this.version(1).stores({
      scouts: 'name, stakes, totalPredictions, correctPredictions, currentStreak, longestStreak, lastUpdated',
      predictions: 'id, scoutName, eventName, matchNumber, predictedWinner, timestamp, verified, [scoutName+eventName+matchNumber]',
      scoutAchievements: '[scoutName+achievementId], scoutName, achievementId, unlockedAt'
    });

    // Version 2: Add stakesFromPredictions field (separate prediction stakes from achievement bonuses)
    this.version(2).stores({
      scouts: 'name, stakes, stakesFromPredictions, totalPredictions, correctPredictions, currentStreak, longestStreak, lastUpdated',
      predictions: 'id, scoutName, eventName, matchNumber, predictedWinner, timestamp, verified, [scoutName+eventName+matchNumber]',
      scoutAchievements: '[scoutName+achievementId], scoutName, achievementId, unlockedAt'
    }).upgrade(tx => {
      // Assume existing stakes are all from predictions for existing users
      return tx.table('scouts').toCollection().modify(scout => {
        scout.stakesFromPredictions = scout.stakes || 0;
      });
    });
  }
}

// ============================================================================
// DATABASE INSTANCES
// ============================================================================

export const db = new MatchScoutingDB();
export const pitDB = new PitScoutingDB();
export const gameDB = new ScoutProfileDB();

// Open databases and log any errors
db.open().catch(error => {
  console.error('Failed to open MatchScoutingDB:', error);
});

pitDB.open().catch(error => {
  console.error('Failed to open PitScoutingDB:', error);
});

gameDB.open().catch(error => {
  console.error('Failed to open ScoutProfileDB:', error);
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// ============================================================================
// SCOUTING DATA CRUD OPERATIONS
// ============================================================================

/**
 * Save a single scouting entry (ScoutingEntryBase format)
 */
export const saveScoutingEntry = async <TGameData = Record<string, unknown>>(
  entry: ScoutingEntryBase<TGameData>
): Promise<void> => {
  await db.scoutingData.put(entry as ScoutingEntryBase<Record<string, unknown>>);
};

/**
 * Save multiple scouting entries (bulk operation)
 */
export const saveScoutingEntries = async <TGameData = Record<string, unknown>>(
  entries: ScoutingEntryBase<TGameData>[]
): Promise<void> => {
  await db.scoutingData.bulkPut(entries as ScoutingEntryBase<Record<string, unknown>>[]);
};

/**
 * Load all scouting entries
 */
export const loadAllScoutingEntries = async <TGameData = Record<string, unknown>>(): Promise<
  ScoutingEntryBase<TGameData>[]
> => {
  return (await db.scoutingData.toArray()) as ScoutingEntryBase<TGameData>[];
};

/**
 * Load scouting entries for a specific team
 */
export const loadScoutingEntriesByTeam = async <TGameData = Record<string, unknown>>(
  teamNumber: string
): Promise<ScoutingEntryBase<TGameData>[]> => {
  return (await db.scoutingData
    .where('teamNumber')
    .equals(teamNumber)
    .toArray()) as ScoutingEntryBase<TGameData>[];
};

/**
 * Load scouting entries for a specific match
 */
export const loadScoutingEntriesByMatch = async <TGameData = Record<string, unknown>>(
  matchNumber: string
): Promise<ScoutingEntryBase<TGameData>[]> => {
  return (await db.scoutingData
    .where('matchNumber')
    .equals(matchNumber)
    .toArray()) as ScoutingEntryBase<TGameData>[];
};

/**
 * Load scouting entries for a specific event
 */
export const loadScoutingEntriesByEvent = async <TGameData = Record<string, unknown>>(
  eventName: string
): Promise<ScoutingEntryBase<TGameData>[]> => {
  return (await db.scoutingData
    .where('eventName')
    .equals(eventName.toLowerCase())
    .toArray()) as ScoutingEntryBase<TGameData>[];
};

/**
 * Load scouting entries for a team at a specific event (compound index)
 */
export const loadScoutingEntriesByTeamAndEvent = async <TGameData = Record<string, unknown>>(
  teamNumber: string,
  eventName: string
): Promise<ScoutingEntryBase<TGameData>[]> => {
  return (await db.scoutingData
    .where('[teamNumber+eventName]')
    .equals([teamNumber, eventName.toLowerCase()])
    .toArray()) as ScoutingEntryBase<TGameData>[];
};

/**
 * Find existing entry by match/team/alliance/event
 */
export const findExistingScoutingEntry = async <TGameData = Record<string, unknown>>(
  matchNumber: string,
  teamNumber: string,
  alliance: string,
  eventName: string
): Promise<ScoutingEntryBase<TGameData> | undefined> => {
  const entries = (await db.scoutingData
    .where({ matchNumber, teamNumber, alliance, eventName: eventName.toLowerCase() })
    .toArray()) as ScoutingEntryBase<TGameData>[];
  
  if (entries.length > 1) {
    console.warn(
      `Found ${entries.length} duplicate entries for match ${matchNumber}, team ${teamNumber}, alliance ${alliance}`
    );
  }
  
  return entries[0];
};

/**
 * Update entry with correction metadata
 * Used when re-scouting a match to fix errors
 */
export const updateScoutingEntryWithCorrection = async <TGameData = Record<string, unknown>>(
  id: string,
  newData: ScoutingEntryBase<TGameData>,
  correctionNotes: string,
  correctedBy: string
): Promise<void> => {
  const existing = await db.scoutingData.get(id);
  if (!existing) {
    throw new Error('Entry not found');
  }

  // Extract match info from new data
  const matchNumber = newData.matchNumber;
  const teamNumber = newData.teamNumber;
  const alliance = newData.alliance;
  const eventName = newData.eventName;

  // Delete ALL other entries for same match/team/alliance to prevent duplicates
  const duplicates = await db.scoutingData
    .where({ matchNumber, teamNumber, alliance, eventName })
    .toArray();
  
  const otherDuplicates = duplicates.filter(e => e.id !== id);
  if (otherDuplicates.length > 0) {
    await db.scoutingData.bulkDelete(otherDuplicates.map(e => e.id));
  }

  // Update entry with correction metadata
  const updatedEntry: Partial<ScoutingEntryBase<Record<string, unknown>>> = {
    ...newData as ScoutingEntryBase<Record<string, unknown>>,
    timestamp: Date.now(),
    isCorrected: true,
    correctionCount: (existing.correctionCount || 0) + 1,
    lastCorrectedAt: Date.now(),
    lastCorrectedBy: correctedBy,
    correctionNotes: correctionNotes,
  };
  
  await db.scoutingData.put(updatedEntry as ScoutingEntryBase<Record<string, unknown>>);
};

/**
 * Delete a single scouting entry
 */
export const deleteScoutingEntry = async (id: string): Promise<void> => {
  await db.scoutingData.delete(id);
};

/**
 * Delete multiple scouting entries (bulk operation)
 */
export const deleteScoutingEntries = async (ids: string[]): Promise<void> => {
  await db.scoutingData.bulkDelete(ids);
};

/**
 * Clear all scouting data (dangerous - ask for confirmation)
 */
export const clearAllScoutingData = async (): Promise<void> => {
  await db.scoutingData.clear();
};

// ============================================================================
// DATABASE STATISTICS AND METADATA
// ============================================================================

/**
 * Get database statistics for dashboard/admin views
 */
export const getDBStats = async (): Promise<DBStats> => {
  const entries = await db.scoutingData.toArray();
  
  const teams = new Set<string>();
  const matches = new Set<string>();
  const scouts = new Set<string>();
  const events = new Set<string>();
  let oldestEntry: number | undefined;
  let newestEntry: number | undefined;
  
  entries.forEach(entry => {
    if (entry.teamNumber) teams.add(entry.teamNumber);
    if (entry.matchNumber) matches.add(entry.matchNumber);
    if (entry.scoutName) scouts.add(entry.scoutName);
    if (entry.eventName) events.add(entry.eventName);
    
    if (!oldestEntry || entry.timestamp < oldestEntry) {
      oldestEntry = entry.timestamp;
    }
    if (!newestEntry || entry.timestamp > newestEntry) {
      newestEntry = entry.timestamp;
    }
  });
  
  return {
    totalEntries: entries.length,
    teams: Array.from(teams).sort((a, b) => Number(a) - Number(b)),
    matches: Array.from(matches).sort((a, b) => Number(a) - Number(b)),
    scouts: Array.from(scouts).sort(),
    events: Array.from(events).sort(),
    oldestEntry,
    newestEntry,
  };
};

/**
 * Get filter options for UI dropdowns
 */
export const getFilterOptions = async (): Promise<FilterOptions> => {
  const stats = await getDBStats();
  const entries = await db.scoutingData.toArray();
  
  const alliances = [...new Set(entries.map(e => e.alliance).filter(Boolean))].sort() as string[];
  
  return {
    teams: stats.teams,
    matches: stats.matches,
    events: stats.events,
    alliances,
    scouts: stats.scouts,
  };
};

/**
 * Advanced query with multiple filters
 */
export const queryScoutingEntries = async <TGameData = Record<string, unknown>>(
  filters: QueryFilters
): Promise<ScoutingEntryBase<TGameData>[]> => {
  let collection = db.scoutingData.toCollection();
  
  // Apply date range filter first (if provided)
  if (filters.dateRange) {
    collection = collection.filter(
      entry =>
        entry.timestamp >= filters.dateRange!.start && entry.timestamp <= filters.dateRange!.end
    );
  }
  
  const results = await collection.toArray();
  
  // Apply other filters in memory
  return results.filter(entry => {
    if (filters.teamNumbers && entry.teamNumber && !filters.teamNumbers.includes(entry.teamNumber)) {
      return false;
    }
    if (filters.matchNumbers && entry.matchNumber && !filters.matchNumbers.includes(entry.matchNumber)) {
      return false;
    }
    if (filters.eventNames && entry.eventName && !filters.eventNames.includes(entry.eventName)) {
      return false;
    }
    if (filters.alliances && entry.alliance && !filters.alliances.includes(entry.alliance)) {
      return false;
    }
    if (filters.scoutNames && entry.scoutName && !filters.scoutNames.includes(entry.scoutName)) {
      return false;
    }
    return true;
  }) as ScoutingEntryBase<TGameData>[];
};

// ============================================================================
// DATA CLEANUP UTILITIES
// ============================================================================

/**
 * Clean up duplicate entries (keep most recent version)
 */
export const cleanupDuplicateEntries = async (): Promise<{ deleted: number; total: number }> => {
  console.log('[Cleanup] Starting duplicate entry cleanup...');
  
  try {
    const allEntries = await db.scoutingData.toArray();
    console.log(`[Cleanup] Found ${allEntries.length} total entries`);
    
    // Group by match-team-alliance-event
    const entriesByKey = new Map<string, ScoutingEntryBase[]>();
    
    allEntries.forEach(entry => {
      const key = `${entry.eventName}-${entry.matchNumber}-${entry.alliance}-${entry.teamNumber}`;
      if (!entriesByKey.has(key)) {
        entriesByKey.set(key, []);
      }
      entriesByKey.get(key)!.push(entry);
    });
    
    // Find and delete duplicates
    const idsToDelete: string[] = [];
    
    entriesByKey.forEach((entries, key) => {
      if (entries.length > 1) {
        console.log(`[Cleanup] Found ${entries.length} duplicates for ${key}`);
        
        // Sort by timestamp (most recent first)
        entries.sort((a, b) => {
          const timeA = a.lastCorrectedAt || a.timestamp || 0;
          const timeB = b.lastCorrectedAt || b.timestamp || 0;
          return timeB - timeA;
        });
        
        // Keep first (most recent), delete rest
        const [keep, ...remove] = entries;
        if (keep) {
          console.log(`[Cleanup] Keeping entry ${keep.id}, removing ${remove.length} older entries`);
          idsToDelete.push(...remove.map(e => e.id));
        }
      }
    });
    
    if (idsToDelete.length > 0) {
      console.log(`[Cleanup] Deleting ${idsToDelete.length} duplicate entries`);
      await db.scoutingData.bulkDelete(idsToDelete);
      console.log('[Cleanup] ✅ Complete!');
      return { deleted: idsToDelete.length, total: allEntries.length };
    } else {
      console.log('[Cleanup] No duplicates found');
      return { deleted: 0, total: allEntries.length };
    }
  } catch (error) {
    console.error('[Cleanup] Error during cleanup:', error);
    throw error;
  }
};

/**
 * Normalize alliance values in existing data
 * Fixes "redAlliance" -> "red", "blueAlliance" -> "blue"
 */
export const normalizeAllianceValues = async (): Promise<{ fixed: number; total: number }> => {
  console.log('[Normalize] Fixing alliance values...');
  
  try {
    const allEntries = await db.scoutingData.toArray();
    let fixedCount = 0;
    
    for (const entry of allEntries) {
      if (entry.alliance && entry.alliance.toLowerCase().includes('alliance')) {
        const normalizedAlliance = entry.alliance.toLowerCase().replace('alliance', '').trim();
        await db.scoutingData.update(entry.id, { alliance: normalizedAlliance });
        fixedCount++;
      }
    }
    
    console.log(`[Normalize] Fixed ${fixedCount} entries out of ${allEntries.length} total`);
    return { fixed: fixedCount, total: allEntries.length };
  } catch (error) {
    console.error('[Normalize] Error during normalization:', error);
    throw error;
  }
};

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

/**
 * Export all scouting data with metadata
 */
export const exportScoutingData = async <TGameData = Record<string, unknown>>(): Promise<
  ScoutingDataExport<TGameData>
> => {
  const entries = (await loadAllScoutingEntries()) as ScoutingEntryBase<TGameData>[];
  
  return {
    entries,
    exportedAt: Date.now(),
    version: '3.0-maneuver-core',
  };
};

/**
 * Import scouting data with duplicate detection
 * @param mode 'append' adds new entries, 'overwrite' replaces all data
 */
export const importScoutingData = async <TGameData = Record<string, unknown>>(
  importData: { entries: ScoutingEntryBase<TGameData>[] },
  mode: 'append' | 'overwrite' = 'append'
): Promise<ImportResult> => {
  try {
    if (mode === 'overwrite') {
      await clearAllScoutingData();
      await db.scoutingData.bulkPut(importData.entries as ScoutingEntryBase<Record<string, unknown>>[]);
      
      return {
        success: true,
        importedCount: importData.entries.length,
      };
    } else {
      // Append mode: skip duplicates
      const existingIds = await db.scoutingData.orderBy('id').keys();
      const existingIdSet = new Set(existingIds);
      const newEntries = importData.entries.filter(entry => !existingIdSet.has(entry.id));
      
      await db.scoutingData.bulkPut(newEntries as ScoutingEntryBase<Record<string, unknown>>[]);
      
      return {
        success: true,
        importedCount: newEntries.length,
        duplicatesSkipped: importData.entries.length - newEntries.length,
      };
    }
  } catch (error) {
    console.error('Import failed:', error);
    return {
      success: false,
      importedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// ============================================================================
// PIT SCOUTING OPERATIONS
// ============================================================================

/**
 * Save pit scouting entry
 */
export const savePitScoutingEntry = async <TPitData = Record<string, unknown>>(
  entry: PitScoutingEntry<TPitData>
): Promise<void> => {
  await pitDB.pitScoutingData.put(entry as PitScoutingEntry<Record<string, unknown>>);
};

/**
 * Load all pit scouting entries
 */
export const loadAllPitScoutingEntries = async <TPitData = Record<string, unknown>>(): Promise<
  PitScoutingEntry<TPitData>[]
> => {
  return (await pitDB.pitScoutingData.toArray()) as PitScoutingEntry<TPitData>[];
};

/**
 * Load pit scouting entries for a team
 */
export const loadPitScoutingByTeam = async <TPitData = Record<string, unknown>>(
  teamNumber: string
): Promise<PitScoutingEntry<TPitData>[]> => {
  return (await pitDB.pitScoutingData
    .where('teamNumber')
    .equals(teamNumber)
    .toArray()) as PitScoutingEntry<TPitData>[];
};

/**
 * Load pit scouting entries for an event
 */
export const loadPitScoutingByEvent = async <TPitData = Record<string, unknown>>(
  eventName: string
): Promise<PitScoutingEntry<TPitData>[]> => {
  return (await pitDB.pitScoutingData
    .where('eventName')
    .equals(eventName)
    .toArray()) as PitScoutingEntry<TPitData>[];
};

/**
 * Load pit scouting entry for team at specific event (compound index)
 */
export const loadPitScoutingByTeamAndEvent = async <TPitData = Record<string, unknown>>(
  teamNumber: string,
  eventName: string
): Promise<PitScoutingEntry<TPitData> | undefined> => {
  try {
    const results = (await pitDB.pitScoutingData
      .where('[teamNumber+eventName]')
      .equals([teamNumber, eventName])
      .toArray()) as PitScoutingEntry<TPitData>[];
    
    // Return most recent if multiple exist
    return results.sort((a, b) => b.timestamp - a.timestamp)[0];
  } catch (error) {
    console.error('Error loading pit scouting by team and event:', error);
    // Fallback to manual filtering
    const allEntries = (await pitDB.pitScoutingData.toArray()) as PitScoutingEntry<TPitData>[];
    const filtered = allEntries.filter(
      entry => entry.teamNumber === teamNumber && entry.eventName === eventName
    );
    return filtered.sort((a, b) => b.timestamp - a.timestamp)[0];
  }
};

/**
 * Delete pit scouting entry
 */
export const deletePitScoutingEntry = async (id: string): Promise<void> => {
  await pitDB.pitScoutingData.delete(id);
};

/**
 * Clear all pit scouting data
 */
export const clearAllPitScoutingData = async (): Promise<void> => {
  await pitDB.pitScoutingData.clear();
};

/**
 * Get pit scouting statistics
 */
export const getPitScoutingStats = async (): Promise<PitScoutingStats> => {
  const entries = await pitDB.pitScoutingData.toArray();
  
  const teams = [...new Set(entries.map(e => e.teamNumber))].sort((a, b) => Number(a) - Number(b));
  const events = [...new Set(entries.map(e => e.eventName))].sort();
  const scouts = [...new Set(entries.map(e => e.scoutName))].sort();
  
  return {
    totalEntries: entries.length,
    teams,
    events,
    scouts,
  };
};

// ============================================================================
// SCOUT PROFILE OPERATIONS (Gamification)
// ============================================================================

/**
 * Get or create scout profile
 */
export const getOrCreateScout = async (name: string): Promise<Scout> => {
  const existingScout = await gameDB.scouts.get(name);
  
  if (existingScout) {
    // Update last updated time
    existingScout.lastUpdated = Date.now();
    await gameDB.scouts.put(existingScout);
    return existingScout;
  }
  
  // Create new scout
  const newScout: Scout = {
    name: name.trim(),
    stakes: 0,
    stakesFromPredictions: 0,
    totalPredictions: 0,
    correctPredictions: 0,
    currentStreak: 0,
    longestStreak: 0,
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };
  
  await gameDB.scouts.put(newScout);
  return newScout;
};

/**
 * Get scout profile
 */
export const getScout = async (name: string): Promise<Scout | undefined> => {
  return await gameDB.scouts.get(name);
};

/**
 * Get all scouts (ordered by stakes descending)
 */
export const getAllScouts = async (): Promise<Scout[]> => {
  return await gameDB.scouts.orderBy('stakes').reverse().toArray();
};

/**
 * Update scout stakes (add points)
 */
export const updateScoutPoints = async (name: string, pointsToAdd: number): Promise<void> => {
  const scout = await gameDB.scouts.get(name);
  if (scout) {
    scout.stakes += pointsToAdd;
    scout.lastUpdated = Date.now();
    await gameDB.scouts.put(scout);
  }
};

/**
 * Update scout statistics (used after verifying predictions)
 */
export const updateScoutStats = async (
  name: string,
  newStakes: number,
  correctPredictions: number,
  totalPredictions: number,
  currentStreak?: number,
  longestStreak?: number,
  additionalStakesFromPredictions: number = 0
): Promise<void> => {
  const scout = await gameDB.scouts.get(name);
  if (scout) {
    scout.stakes = newStakes;
    scout.stakesFromPredictions += additionalStakesFromPredictions;
    scout.correctPredictions = correctPredictions;
    scout.totalPredictions = totalPredictions;
    
    if (currentStreak !== undefined) {
      scout.currentStreak = currentStreak;
    }
    if (longestStreak !== undefined) {
      scout.longestStreak = Math.max(scout.longestStreak, longestStreak);
    }
    
    scout.lastUpdated = Date.now();
    await gameDB.scouts.put(scout);
  }
};

/**
 * Delete scout profile
 */
export const deleteScout = async (name: string): Promise<void> => {
  await gameDB.scouts.delete(name);
};

/**
 * Clear all gamification data
 */
export const clearGameData = async (): Promise<void> => {
  await gameDB.scouts.clear();
  await gameDB.predictions.clear();
  await gameDB.scoutAchievements.clear();
};

// ============================================================================
// MATCH PREDICTION OPERATIONS
// ============================================================================

/**
 * Save match prediction
 */
export const savePrediction = async (prediction: MatchPrediction): Promise<void> => {
  await gameDB.predictions.put(prediction);
};

/**
 * Get prediction by scout/event/match
 */
export const getPrediction = async (
  scoutName: string,
  eventName: string,
  matchNumber: string
): Promise<MatchPrediction | undefined> => {
  return await gameDB.predictions
    .where('[scoutName+eventName+matchNumber]')
    .equals([scoutName, eventName, matchNumber])
    .first();
};

/**
 * Get all predictions for a scout
 */
export const getAllPredictionsForScout = async (scoutName: string): Promise<MatchPrediction[]> => {
  return await gameDB.predictions.where('scoutName').equals(scoutName).reverse().toArray();
};

/**
 * Get all predictions for a match
 */
export const getAllPredictionsForMatch = async (
  eventName: string,
  matchNumber: string
): Promise<MatchPrediction[]> => {
  return await gameDB.predictions
    .where('eventName')
    .equals(eventName)
    .and(prediction => prediction.matchNumber === matchNumber)
    .toArray();
};

/**
 * Mark prediction as verified (after match completes)
 */
export const markPredictionAsVerified = async (predictionId: string): Promise<void> => {
  await gameDB.predictions.update(predictionId, { verified: true });
};

// ============================================================================
// ACHIEVEMENT OPERATIONS
// ============================================================================

/**
 * Unlock achievement for scout
 */
export const unlockAchievement = async (
  scoutName: string,
  achievementId: string
): Promise<void> => {
  const existing = await gameDB.scoutAchievements
    .where('[scoutName+achievementId]')
    .equals([scoutName, achievementId])
    .first();
  
  if (!existing) {
    await gameDB.scoutAchievements.put({
      scoutName,
      achievementId,
      unlockedAt: Date.now(),
    });
  }
};

/**
 * Get all achievements for scout
 */
export const getScoutAchievements = async (scoutName: string): Promise<ScoutAchievement[]> => {
  return await gameDB.scoutAchievements.where('scoutName').equals(scoutName).toArray();
};

/**
 * Check if scout has achievement
 */
export const hasAchievement = async (
  scoutName: string,
  achievementId: string
): Promise<boolean> => {
  const achievement = await gameDB.scoutAchievements
    .where('[scoutName+achievementId]')
    .equals([scoutName, achievementId])
    .first();
  return !!achievement;
};
