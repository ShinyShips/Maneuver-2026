import Dexie, { type Table } from 'dexie';
import type { ScoutingEntryBase } from '@/types/scouting-entry';
import type { PitScoutingEntryBase } from '@/types/database';

// Scout gamification types
export interface Scout {
  name: string; // Primary key - matches the name from nav-user sidebar
  stakes: number; // Total stakes including bonuses from achievements
  stakesFromPredictions: number; // Stakes earned only from predictions/matches
  totalPredictions: number;
  correctPredictions: number;
  currentStreak: number; // Current consecutive correct predictions
  longestStreak: number; // Best streak ever achieved
  createdAt: number;
  lastUpdated: number;
}

export interface MatchPrediction {
  id: string;
  scoutName: string;
  eventName: string;
  matchNumber: string;
  predictedWinner: 'red' | 'blue';
  actualWinner?: 'red' | 'blue' | 'tie';
  isCorrect?: boolean;
  pointsAwarded?: number;
  timestamp: number;
  verified: boolean;
}

export interface ScoutAchievement {
  scoutName: string;
  achievementId: string;
  unlockedAt: number;
  progress?: number;
}

/**
 * Database entry type - now uses ScoutingEntryBase directly
 * No more legacy 'data' wrapper
 */
export type ScoutingEntryDB = ScoutingEntryBase;

export class MatchScoutingDB extends Dexie {
  scoutingData!: Table<ScoutingEntryDB>;

  constructor() {
    super('MatchScoutingDB');
    
    // Version 1: Complete schema for maneuver-core template
    this.version(1).stores({
      scoutingData: 'id, teamNumber, matchNumber, allianceColor, scoutName, eventKey, timestamp, isCorrected'
    });
  }
}

export class PitScoutingDB extends Dexie {
  pitScoutingData!: Table<PitScoutingEntryBase>;

  constructor() {
    super('PitScoutingDB');
    
    // Version 1: Complete schema for maneuver-core template
    this.version(1).stores({
      pitScoutingData: 'id, teamNumber, eventKey, scoutName, timestamp, [teamNumber+eventKey]'
    });
  }
}

export class ScoutProfileDB extends Dexie {
  scouts!: Table<Scout>;
  predictions!: Table<MatchPrediction>;
  scoutAchievements!: Table<ScoutAchievement>;

  constructor() {
    super('ScoutProfileDB');
    
    this.version(1).stores({
      scouts: 'name, stakes, totalPredictions, correctPredictions, currentStreak, longestStreak, lastUpdated',
      predictions: 'id, scoutName, eventName, matchNumber, predictedWinner, timestamp, verified, [scoutName+eventName+matchNumber]',
      scoutAchievements: '[scoutName+achievementId], scoutName, achievementId, unlockedAt'
    });

    // Version 2: Add stakesFromPredictions field
    this.version(2).stores({
      scouts: 'name, stakes, stakesFromPredictions, totalPredictions, correctPredictions, currentStreak, longestStreak, lastUpdated',
      predictions: 'id, scoutName, eventName, matchNumber, predictedWinner, timestamp, verified, [scoutName+eventName+matchNumber]',
      scoutAchievements: '[scoutName+achievementId], scoutName, achievementId, unlockedAt'
    }).upgrade(tx => {
      // Add default stakesFromPredictions value for existing scouts
      return tx.table('scouts').toCollection().modify(scout => {
        scout.stakesFromPredictions = scout.stakes || 0; // Assume current stakes are all from predictions for existing users
      });
    });
  }
}

export const db = new MatchScoutingDB();
export const pitDB = new PitScoutingDB();
export const gameDB = new ScoutProfileDB();

/**
 * Save a scouting entry directly (ScoutingEntryBase format)
 * No longer wraps in legacy format - saves as-is
 */
export const saveScoutingEntry = async (entry: ScoutingEntryBase): Promise<void> => {
  await db.scoutingData.put(entry as never);
};

/**
 * Save multiple scouting entries (ScoutingEntryBase format)
 */
export const saveScoutingEntries = async (entries: ScoutingEntryBase[]): Promise<void> => {  
  await db.scoutingData.bulkPut(entries as never[]);
};

export const loadAllScoutingEntries = async (): Promise<ScoutingEntryDB[]> => {
  return await db.scoutingData.toArray();
};

export const loadScoutingEntriesByTeam = async (teamNumber: number): Promise<ScoutingEntryDB[]> => {
  return await db.scoutingData.where('teamNumber').equals(teamNumber).toArray();
};

export const loadScoutingEntriesByMatch = async (matchNumber: number): Promise<ScoutingEntryDB[]> => {
  return await db.scoutingData.where('matchNumber').equals(matchNumber).toArray();
};

export const loadScoutingEntriesByEvent = async (eventKey: string): Promise<ScoutingEntryDB[]> => {
  return await db.scoutingData.where('eventKey').equals(eventKey).toArray();
};

export const loadScoutingEntriesByTeamAndEvent = async (
  teamNumber: number, 
  eventKey: string
): Promise<ScoutingEntryDB[]> => {
  return await db.scoutingData
    .where('teamNumber').equals(teamNumber)
    .and(entry => entry.eventKey === eventKey)
    .toArray();
};

// Clean up duplicate entries (keep most recent version)
export const cleanupDuplicateEntries = async () => {
  console.log('[Cleanup] Starting duplicate entry cleanup...');
  
  try {
    const allEntries = await db.scoutingData.toArray();
    console.log(`[Cleanup] Found ${allEntries.length} total entries`);
    
    // Group by match-team-allianceColor-event (using core standard field names)
    const entriesByKey = new Map<string, ScoutingEntryDB[]>();
    
    allEntries.forEach(entry => {
      const key = `${entry.eventKey}-${entry.matchNumber}-${entry.allianceColor}-${entry.teamNumber}`;
      if (!entriesByKey.has(key)) {
        entriesByKey.set(key, []);
      }
      entriesByKey.get(key)!.push(entry);
    });
    
    // Find duplicates
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
        
        // Keep the first (most recent), delete the rest
        const [keep, ...remove] = entries;
        console.log(`[Cleanup] Keeping entry ${keep?.id}, removing ${remove.length} older entries`);
        idsToDelete.push(...remove.map(e => e.id));
      }
    });
    
    if (idsToDelete.length > 0) {
      console.log(`[Cleanup] Deleting ${idsToDelete.length} duplicate entries:`, idsToDelete);
      await db.scoutingData.bulkDelete(idsToDelete);
      console.log('[Cleanup] ✅ Cleanup complete!');
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

// Remove legacy alliance normalization function - not needed with core standard
// All data should already use 'red' or 'blue' format

export const findExistingScoutingEntry = async (
  matchNumber: number,
  teamNumber: number,
  allianceColor: 'red' | 'blue',
  eventKey: string
): Promise<ScoutingEntryDB | undefined> => {
  const entries = await db.scoutingData
    .where('matchNumber').equals(matchNumber)
    .and(entry => 
      entry.teamNumber === teamNumber && 
      entry.allianceColor === allianceColor && 
      entry.eventKey === eventKey
    )
    .toArray();
  
  // Log if there are duplicates
  if (entries.length > 1) {
    console.warn(`Found ${entries.length} duplicate entries for match ${matchNumber}, team ${teamNumber}, alliance ${allianceColor}`);
    console.warn('Entry IDs:', entries.map(e => e.id));
  }
  
  return entries[0];
};

export const updateScoutingEntryWithCorrection = async (
  id: string,
  newData: ScoutingEntryBase,
  correctionNotes: string,
  correctedBy: string
): Promise<void> => {
  const existing = await db.scoutingData.get(id);
  if (!existing) {
    throw new Error('Entry not found');
  }

  // Find and delete ALL other entries for the same match/team/alliance to prevent duplicates
  const matchNumber = newData.matchNumber;
  const teamNumber = newData.teamNumber;
  const allianceColor = newData.allianceColor;
  const eventKey = newData.eventKey;
  
  const duplicates = await db.scoutingData
    .where({ matchNumber, teamNumber, allianceColor, eventKey })
    .toArray();
  
  // Delete all duplicates except the one we're updating
  const duplicateIds = duplicates
    .filter(entry => entry.id !== id)
    .map(entry => entry.id!);
  
  if (duplicateIds.length > 0) {
    console.warn(`Deleting ${duplicateIds.length} duplicate entries:`, duplicateIds);
    await db.scoutingData.bulkDelete(duplicateIds);
  }
  
  // Completely replace the entry with new data, keeping only correction metadata
  await db.scoutingData.put({
    ...newData,
    id: id, // Keep the same ID to replace the existing entry
    lastCorrectedAt: Date.now(),
    lastCorrectedBy: correctedBy,
    correctionNotes: correctionNotes || undefined,
    isCorrected: true,
    correctionCount: (existing.correctionCount || 0) + 1,
  });
};

export const deleteScoutingEntry = async (id: string): Promise<void> => {
  await db.scoutingData.delete(id);
};

export const deleteScoutingEntries = async (ids: string[]): Promise<void> => {
  await db.scoutingData.bulkDelete(ids);
};

export const clearAllScoutingData = async (): Promise<void> => {
  await db.scoutingData.clear();
};

export const getDBStats = async (): Promise<{
  totalEntries: number;
  teams: number[];
  matches: number[];
  scouts: string[];
  events: string[];
  oldestEntry?: number;
  newestEntry?: number;
}> => {
  const entries = await db.scoutingData.toArray();
  
  const teams = new Set<number>();
  const matches = new Set<number>();
  const scouts = new Set<string>();
  const events = new Set<string>();
  let oldestEntry: number | undefined;
  let newestEntry: number | undefined;
  
  entries.forEach(entry => {
    if (entry.teamNumber) teams.add(entry.teamNumber);
    if (entry.matchNumber) matches.add(entry.matchNumber);
    if (entry.scoutName) scouts.add(entry.scoutName);
    if (entry.eventKey) events.add(entry.eventKey);
    
    if (!oldestEntry || entry.timestamp < oldestEntry) {
      oldestEntry = entry.timestamp;
    }
    if (!newestEntry || entry.timestamp > newestEntry) {
      newestEntry = entry.timestamp;
    }
  });
  
  return {
    totalEntries: entries.length,
    teams: Array.from(teams).sort((a, b) => a - b),
    matches: Array.from(matches).sort((a, b) => a - b),
    scouts: Array.from(scouts).sort(),
    events: Array.from(events).sort(),
    oldestEntry,
    newestEntry
  };
};

export const exportScoutingData = async (): Promise<{
  entries: ScoutingEntryDB[];
  exportedAt: number;
  version: string;
}> => {
  const entries = await loadAllScoutingEntries();
  
  return {
    entries,
    exportedAt: Date.now(),
    version: '2.0-dexie'
  };
};

export const importScoutingData = async (
  importData: { entries: ScoutingEntryDB[] },
  mode: 'append' | 'overwrite' = 'append'
): Promise<{
  success: boolean;
  importedCount: number;
  duplicatesSkipped?: number;
  error?: string;
}> => {
  try {
    if (mode === 'overwrite') {
      await clearAllScoutingData();
      await db.scoutingData.bulkPut(importData.entries);
      
      return {
        success: true,
        importedCount: importData.entries.length
      };
    } else {
      const existingIds = await db.scoutingData.orderBy('id').keys();
      const existingIdSet = new Set(existingIds);
      
      const newEntries = importData.entries.filter(entry => !existingIdSet.has(entry.id));
      await db.scoutingData.bulkPut(newEntries);
      
      return {
        success: true,
        importedCount: newEntries.length,
        duplicatesSkipped: importData.entries.length - newEntries.length
      };
    }
  } catch (error) {
    console.error('Import failed:', error);
    return {
      success: false,
      importedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const queryScoutingEntries = async (filters: {
  teamNumbers?: number[];
  matchNumbers?: number[];
  eventKeys?: string[];
  alliances?: ('red' | 'blue')[];
  scoutName?: string[];
  dateRange?: { start: number; end: number };
}): Promise<ScoutingEntryDB[]> => {
  let collection = db.scoutingData.toCollection();
  
  if (filters.dateRange) {
    collection = collection.filter(entry => 
      entry.timestamp >= filters.dateRange!.start && 
      entry.timestamp <= filters.dateRange!.end
    );
  }
  
  if (filters.teamNumbers && filters.teamNumbers.length > 0) {
    collection = collection.filter(entry => 
      Boolean(entry.teamNumber && filters.teamNumbers!.includes(entry.teamNumber))
    );
  }
  
  if (filters.matchNumbers && filters.matchNumbers.length > 0) {
    collection = collection.filter(entry => 
      Boolean(entry.matchNumber && filters.matchNumbers!.includes(entry.matchNumber))
    );
  }
  
  if (filters.eventKeys && filters.eventKeys.length > 0) {
    collection = collection.filter(entry => 
      Boolean(entry.eventKey && filters.eventKeys!.includes(entry.eventKey))
    );
  }
  
  if (filters.alliances && filters.alliances.length > 0) {
    collection = collection.filter(entry => 
      Boolean(entry.allianceColor && filters.alliances!.includes(entry.allianceColor))
    );
  }
  
  if (filters.scoutName && filters.scoutName.length > 0) {
    collection = collection.filter(entry => 
      Boolean(entry.scoutName && filters.scoutName!.includes(entry.scoutName))
    );
  }
  
  return await collection.toArray();
};

export const getFilterOptions = async (): Promise<{
  teams: number[];
  matches: number[];
  events: string[];
  alliances: ('red' | 'blue')[];
  scouts: string[];
}> => {
  const stats = await getDBStats();
  
  const entries = await db.scoutingData.toArray();
  const alliances = [...new Set(entries.map(e => e.allianceColor).filter(Boolean))].sort() as ('red' | 'blue')[];
  
  return {
    teams: stats.teams,
    matches: stats.matches,
    events: stats.events,
    alliances,
    scouts: stats.scouts
  };
};

db.open().catch(error => {
  console.error('Failed to open Dexie database:', error);
});

pitDB.open().catch(error => {
  console.error('Failed to open Pit Scouting database:', error);
});

// Pit Scouting Database Functions
export const savePitScoutingEntry = async (entry: PitScoutingEntryBase): Promise<void> => {
  try {
    await pitDB.pitScoutingData.put(entry);
  } catch (error) {
    console.error('Error saving pit scouting entry to database:', error);
    throw error;
  }
};

export const loadAllPitScoutingEntries = async (): Promise<PitScoutingEntryBase[]> => {
  try {
    return await pitDB.pitScoutingData.toArray();
  } catch (error) {
    console.error('Error loading all pit scouting entries:', error);
    return [];
  }
};

export const loadPitScoutingByTeam = async (teamNumber: number): Promise<PitScoutingEntryBase[]> => {
  try {
    return await pitDB.pitScoutingData.where('teamNumber').equals(teamNumber).toArray();
  } catch (error) {
    console.error('Error loading pit scouting entries by team:', error);
    return [];
  }
};

export const loadPitScoutingByEvent = async (eventKey: string): Promise<PitScoutingEntryBase[]> => {
  try {
    return await pitDB.pitScoutingData.where('eventKey').equals(eventKey).toArray();
  } catch (error) {
    console.error('Error loading pit scouting entries by event:', error);
    return [];
  }
};

export const loadPitScoutingByTeamAndEvent = async (
  teamNumber: number, 
  eventKey: string
): Promise<PitScoutingEntryBase | undefined> => {
  try {
    const results = await pitDB.pitScoutingData
      .where('[teamNumber+eventKey]')
      .equals([teamNumber, eventKey])
      .toArray();
    
    // Return the most recent entry if multiple exist
    return results.sort((a, b) => b.timestamp - a.timestamp)[0];
  } catch (error) {
    console.error('Error loading pit scouting entry by team and event:', error);
    // Fallback to manual filtering if compound index fails
    try {
      const allEntries = await pitDB.pitScoutingData.toArray();
      const filtered = allEntries.filter(entry => 
        entry.teamNumber === teamNumber && entry.eventKey === eventKey
      );
      return filtered.sort((a, b) => b.timestamp - a.timestamp)[0];
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return undefined;
    }
  }
};

export const deletePitScoutingEntry = async (id: string): Promise<void> => {
  await pitDB.pitScoutingData.delete(id);
};

export const clearAllPitScoutingData = async (): Promise<void> => {
  await pitDB.pitScoutingData.clear();
};

export const getPitScoutingStats = async (): Promise<{
  totalEntries: number;
  teams: number[];
  events: string[];
  scouts: string[];
}> => {
  const entries = await pitDB.pitScoutingData.toArray();
  
  const teams = [...new Set(entries.map(e => e.teamNumber))].sort((a, b) => a - b);
  const events = [...new Set(entries.map(e => e.eventKey))].sort();
  const scouts = [...new Set(entries.map(e => e.scoutName))].sort();
  
  return {
    totalEntries: entries.length,
    teams,
    events,
    scouts
  };
};

// Scout gamification functions
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
    lastUpdated: Date.now()
  };
  
  await gameDB.scouts.put(newScout);
  return newScout;
};

export const getScout = async (name: string): Promise<Scout | undefined> => {
  return await gameDB.scouts.get(name);
};

export const getAllScouts = async (): Promise<Scout[]> => {
  return await gameDB.scouts.orderBy('stakes').reverse().toArray();
};

export const updateScoutPoints = async (name: string, pointsToAdd: number): Promise<void> => {
  const scout = await gameDB.scouts.get(name);
  if (scout) {
    scout.stakes += pointsToAdd;
    scout.lastUpdated = Date.now();
    await gameDB.scouts.put(scout);
  }
};

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
    if (currentStreak !== undefined) scout.currentStreak = currentStreak;
    if (longestStreak !== undefined) scout.longestStreak = longestStreak;
    scout.lastUpdated = Date.now();
    await gameDB.scouts.put(scout);
  }
};

// New function to update scout with prediction result and handle streaks
export const updateScoutWithPredictionResult = async (
  name: string,
  isCorrect: boolean,
  basePoints: number,
  eventName: string,
  matchNumber: string
): Promise<number> => {
  const scout = await gameDB.scouts.get(name);
  if (!scout) return 0;

  let pointsAwarded = 0;
  let newCurrentStreak = scout.currentStreak;
  let newLongestStreak = scout.longestStreak;

  // Check if this match is sequential to the last verified prediction
  const isSequential = await isMatchSequential(name, eventName, matchNumber);

  if (isCorrect) {
    // Award base points for correct prediction
    pointsAwarded += basePoints;
    
    // Only increment streak if the match is sequential OR this is the first prediction
    if (isSequential || scout.totalPredictions === 0) {
      newCurrentStreak += 1;
    } else {
      // Reset streak if there's a gap in matches
      newCurrentStreak = 1; // Start new streak at 1
    }
    
    // Update longest streak if current streak is better
    if (newCurrentStreak > newLongestStreak) {
      newLongestStreak = newCurrentStreak;
    }
    
    // Award streak bonus if streak is 2 or more
    if (newCurrentStreak >= 2) {
      const streakBonus = 2 * (newCurrentStreak - 1); // 2 extra points for streak 2, 4 for streak 3, etc.
      pointsAwarded += streakBonus;
    }
  } else {
    // Reset streak on incorrect prediction
    newCurrentStreak = 0;
  }

  // Update scout stats
  await updateScoutStats(
    name,
    scout.stakes + pointsAwarded,
    scout.correctPredictions + (isCorrect ? 1 : 0),
    scout.totalPredictions + 1,
    newCurrentStreak,
    newLongestStreak,
    pointsAwarded // This tracks stakes earned from predictions
  );

  return pointsAwarded;
};

// Helper function to check if current match is sequential to last verified prediction
const isMatchSequential = async (
  scoutName: string,
  eventName: string,
  currentMatchNumber: string
): Promise<boolean> => {
  // Get the most recent verified prediction for this scout in this event
  const lastPrediction = await gameDB.predictions
    .where('scoutName')
    .equals(scoutName)
    .and(prediction => prediction.eventName === eventName && prediction.verified)
    .reverse()
    .sortBy('timestamp');

  if (!lastPrediction || lastPrediction.length === 0) {
    return true; // No previous predictions, so this is sequential (first prediction)
  }

  const lastMatchNumber = parseInt(lastPrediction[0]?.matchNumber || '0');
  const currentMatch = parseInt(currentMatchNumber);
  
  // Check if current match is exactly one more than the last match
  // Allow for some flexibility (e.g., within 3 matches) to account for missed matches
  const gap = currentMatch - lastMatchNumber;
  
  return gap <= 3 && gap > 0; // Sequential if gap is 1, 2, or 3 matches
};

export const createMatchPrediction = async (
  scoutName: string,
  eventName: string,
  matchNumber: string,
  predictedWinner: 'red' | 'blue'
): Promise<MatchPrediction> => {
  const existingPrediction = await gameDB.predictions
    .where('[scoutName+eventName+matchNumber]')
    .equals([scoutName, eventName, matchNumber])
    .first();

  if (existingPrediction) {
    existingPrediction.predictedWinner = predictedWinner;
    existingPrediction.timestamp = Date.now();
    await gameDB.predictions.put(existingPrediction);
    return existingPrediction;
  }

  const prediction: MatchPrediction = {
    id: `prediction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    scoutName,
    eventName,
    matchNumber,
    predictedWinner,
    timestamp: Date.now(),
    verified: false
  };

  await gameDB.predictions.put(prediction);

  // Ensure scout exists and update their stats
  const scout = await getOrCreateScout(scoutName);
  scout.totalPredictions += 1;
  scout.lastUpdated = Date.now();
  await gameDB.scouts.put(scout);
  
  const { checkForNewAchievements } = await import('./achievementUtils');
  const newAchievements = await checkForNewAchievements(scoutName);
  
  if (newAchievements.length > 0) {
    console.log('🏆 New achievements unlocked for', scoutName, ':', newAchievements.map(a => a.name));
  }

  return prediction;
};

export const getPredictionForMatch = async (
  scoutName: string,
  eventName: string,
  matchNumber: string
): Promise<MatchPrediction | undefined> => {
  return await gameDB.predictions
    .where('[scoutName+eventName+matchNumber]')
    .equals([scoutName, eventName, matchNumber])
    .first();
};

export const getAllPredictionsForScout = async (scoutName: string): Promise<MatchPrediction[]> => {
  return await gameDB.predictions
    .where('scoutName')
    .equals(scoutName)
    .reverse()
    .toArray();
};

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

export const markPredictionAsVerified = async (predictionId: string): Promise<void> => {
  await gameDB.predictions.update(predictionId, { verified: true });
};

export const deleteScout = async (name: string): Promise<void> => {
  await gameDB.scouts.delete(name);
};

export const clearGameData = async (): Promise<void> => {
  await gameDB.scouts.clear();
  await gameDB.predictions.clear();
};

