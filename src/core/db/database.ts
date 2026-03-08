/**
 * Generic Dexie database layer for maneuver-core
 * 
 * This is the year-agnostic database infrastructure.
 * Game-specific data goes in the `gameData` field as JSON.
 * 
 * Two separate databases:
 * 1. MatchScoutingDB - Match scouting entries
 * 2. PitScoutingDB - Pit scouting/robot capabilities
 */

import Dexie, { type Table } from 'dexie';
import type {
  ScoutingEntryBase,
  ScoutingDataExport,
  ImportResult,
  DBStats,
  FilterOptions,
  QueryFilters,
  PitScoutingEntryBase,
  PitScoutingStats,
} from '../types';

// ============================================================================
// DATABASE CLASSES
// ============================================================================

/**
 * Main scouting database - stores match scouting entries
 */
export class MatchScoutingDB extends Dexie {
  scoutingData!: Table<ScoutingEntryBase, string>;

  constructor() {
    super('MatchScoutingDB');

    this.version(1).stores({
      scoutingData: 'id, teamNumber, matchNumber, allianceColor, scoutName, eventKey, matchKey, timestamp, isCorrected, [teamNumber+eventKey], [scoutName+eventKey+matchNumber]'
    });
  }
}

/**
 * Pit scouting database - stores robot capabilities and measurements
 */
export class PitScoutingDB extends Dexie {
  pitScoutingData!: Table<PitScoutingEntryBase, string>;

  constructor() {
    super('PitScoutingDB');

    this.version(1).stores({
      pitScoutingData: 'id, teamNumber, eventKey, scoutName, timestamp, [teamNumber+eventKey]'
    });
  }
}

// ============================================================================
// DATABASE INSTANCES
// ============================================================================

export const db = new MatchScoutingDB();
export const pitDB = new PitScoutingDB();

// Open databases and log any errors
db.open().catch(error => {
  console.error('Failed to open MatchScoutingDB:', error);
});

pitDB.open().catch(error => {
  console.error('Failed to open PitScoutingDB:', error);
});

// ============================================================================
// SCOUTING DATA CRUD OPERATIONS
// ============================================================================

/**
 * Save a single scouting entry
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
  teamNumber: number
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
  matchNumber: number
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
  eventKey: string
): Promise<ScoutingEntryBase<TGameData>[]> => {
  return (await db.scoutingData
    .where('eventKey')
    .equals(eventKey.toLowerCase())
    .toArray()) as ScoutingEntryBase<TGameData>[];
};

/**
 * Load scouting entries for a team at a specific event
 */
export const loadScoutingEntriesByTeamAndEvent = async <TGameData = Record<string, unknown>>(
  teamNumber: number,
  eventKey: string
): Promise<ScoutingEntryBase<TGameData>[]> => {
  return (await db.scoutingData
    .where('[teamNumber+eventKey]')
    .equals([teamNumber, eventKey.toLowerCase()])
    .toArray()) as ScoutingEntryBase<TGameData>[];
};

/**
 * Find existing entry by match/team/alliance/event
 */
export const findExistingScoutingEntry = async <TGameData = Record<string, unknown>>(
  matchNumber: number,
  teamNumber: number,
  allianceColor: 'red' | 'blue',
  eventKey: string
): Promise<ScoutingEntryBase<TGameData> | undefined> => {
  const entries = (await db.scoutingData
    .where({ matchNumber, teamNumber, allianceColor, eventKey: eventKey.toLowerCase() })
    .toArray()) as ScoutingEntryBase<TGameData>[];

  return entries[0];
};

/**
 * Update entry with correction metadata
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
 * Clear all scouting data
 */
export const clearAllScoutingData = async (): Promise<void> => {
  await db.scoutingData.clear();
};

// ============================================================================
// STATISTICS AND UTILITIES
// ============================================================================

/**
 * Get database statistics
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
    if (entry.teamNumber) teams.add(String(entry.teamNumber));
    if (entry.matchNumber) matches.add(String(entry.matchNumber));
    if (entry.scoutName) scouts.add(entry.scoutName);
    if (entry.eventKey) events.add(entry.eventKey);

    if (!oldestEntry || entry.timestamp < oldestEntry) oldestEntry = entry.timestamp;
    if (!newestEntry || entry.timestamp > newestEntry) newestEntry = entry.timestamp;
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

  const alliances = [...new Set(entries.map(e => e.allianceColor).filter(Boolean))].sort() as string[];

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

  if (filters.dateRange) {
    collection = collection.filter(
      entry =>
        entry.timestamp >= filters.dateRange!.start && entry.timestamp <= filters.dateRange!.end
    );
  }

  const results = await collection.toArray();

  return results.filter(entry => {
    if (filters.teamNumbers && entry.teamNumber && !filters.teamNumbers.includes(entry.teamNumber)) return false;
    if (filters.matchNumbers && entry.matchNumber && !filters.matchNumbers.includes(entry.matchNumber)) return false;
    if (filters.eventKeys && entry.eventKey && !filters.eventKeys.includes(entry.eventKey)) return false;
    if (filters.alliances && entry.allianceColor && !filters.alliances.includes(entry.allianceColor)) return false;
    if (filters.scoutNames && entry.scoutName && !filters.scoutNames.includes(entry.scoutName)) return false;
    return true;
  }) as ScoutingEntryBase<TGameData>[];
};

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

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

export const importScoutingData = async <TGameData = Record<string, unknown>>(
  importData: { entries: ScoutingEntryBase<TGameData>[] },
  mode: 'append' | 'overwrite' = 'append'
): Promise<ImportResult> => {
  try {
    if (mode === 'overwrite') {
      await clearAllScoutingData();
      await db.scoutingData.bulkPut(importData.entries as ScoutingEntryBase<Record<string, unknown>>[]);
      return { success: true, importedCount: importData.entries.length };
    } else {
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

export const savePitScoutingEntry = async (
  entry: PitScoutingEntryBase
): Promise<void> => {
  await pitDB.pitScoutingData.put(entry);
};

export const loadAllPitScoutingEntries = async (): Promise<
  PitScoutingEntryBase[]
> => {
  return (await pitDB.pitScoutingData.toArray());
};

export const loadPitScoutingByTeam = async (
  teamNumber: number
): Promise<PitScoutingEntryBase[]> => {
  return (await pitDB.pitScoutingData
    .where('teamNumber')
    .equals(teamNumber)
    .toArray());
};

export const loadPitScoutingByTeamAndEvent = async (
  teamNumber: number,
  eventKey: string
): Promise<PitScoutingEntryBase | undefined> => {
  const results = (await pitDB.pitScoutingData
    .where('[teamNumber+eventKey]')
    .equals([teamNumber, eventKey])
    .toArray());
  return results.sort((a, b) => b.timestamp - a.timestamp)[0];
};

export const loadPitScoutingByEvent = async (
  eventKey: string
): Promise<PitScoutingEntryBase[]> => {
  return (await pitDB.pitScoutingData
    .where('eventKey')
    .equals(eventKey)
    .toArray());
};

export const deletePitScoutingEntry = async (id: string): Promise<void> => {
  await pitDB.pitScoutingData.delete(id);
};

export const clearAllPitScoutingData = async (): Promise<void> => {
  await pitDB.pitScoutingData.clear();
};

export const getPitScoutingStats = async (): Promise<PitScoutingStats> => {
  const entries = await pitDB.pitScoutingData.toArray();
  const teams = [...new Set(entries.map(e => e.teamNumber))].sort((a, b) => a - b);
  const events = [...new Set(entries.map(e => e.eventKey))].sort();
  const scouts = [...new Set(entries.map(e => e.scoutName))].sort();

  return {
    totalEntries: entries.length,
    teams,
    events,
    scouts,
  };
};
