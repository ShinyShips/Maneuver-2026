/**
 * Data manipulation utilities for scouting entries
 * Provides ID generation, conflict detection, and data transformation
 */

import type {
  ScoutingEntryBase,
} from '../types/scouting-entry';
import { db } from './database';

/**
 * Generate deterministic composite ID from entry fields
 * Format: event::match::team::alliance
 * 
 * This creates natural collision detection - duplicate entries
 * for the same match will have the same ID.
 * 
 * @example
 * generateDeterministicEntryId("2025mrcmp", "qm42", "3314", "red")
 * // Returns: "2025mrcmp::qm42::3314::red"
 */
export const generateDeterministicEntryId = (
  eventKey: string,
  matchNumber: string | number,
  teamNumber: string | number,
  allianceColor: string
): string => {
  // Normalize values
  const normalizedEvent = eventKey.toLowerCase().trim();
  const normalizedMatch = String(matchNumber).trim();
  const normalizedTeam = String(teamNumber).trim();
  const normalizedAlliance = allianceColor.toLowerCase().replace('alliance', '').trim();

  return `${normalizedEvent}::${normalizedMatch}::${normalizedTeam}::${normalizedAlliance}`;
};

/**
 * Generate entry ID from ScoutingEntryBase object
 */
export const generateEntryId = (entry: Partial<ScoutingEntryBase>): string => {
  const eventKey = String(entry.eventKey || '');
  const matchNumber = String(entry.matchNumber || '');
  const teamNumber = String(entry.teamNumber || '');
  const alliance = String(entry.allianceColor || '');

  if (!eventKey || !matchNumber || !teamNumber || !alliance) {
    // Fallback to hash-based ID if missing required fields
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  return generateDeterministicEntryId(eventKey, matchNumber, teamNumber, alliance);
};

/**
 * Conflict resolution strategies for data imports
 */
export type ConflictResolution =
  | 'autoImport'    // No conflict, safe to import
  | 'autoReplace'   // Incoming is newer, auto-replace
  | 'manualReview'; // User must decide

export interface ConflictResult<TGameData = Record<string, unknown>> {
  autoImport: ScoutingEntryBase<TGameData>[];
  autoReplace: ScoutingEntryBase<TGameData>[];
  manualReview: Array<{
    existing: ScoutingEntryBase<TGameData>;
    incoming: ScoutingEntryBase<TGameData>;
  }>;
}

/**
 * Detect conflicts between incoming and existing data
 * 
 * Logic:
 * - No existing entry → autoImport
 * - Incoming is correction (has correction metadata) → autoReplace
 * - Incoming is newer by >30 seconds → autoReplace  
 * - Otherwise → manualReview
 */
export const detectConflicts = async <TGameData = Record<string, unknown>>(
  incomingEntries: ScoutingEntryBase<TGameData>[]
): Promise<ConflictResult<TGameData>> => {
  const result: ConflictResult<TGameData> = {
    autoImport: [],
    autoReplace: [],
    manualReview: [],
  };

  for (const incoming of incomingEntries) {
    const existing = await db.scoutingData.get(incoming.id);

    if (!existing) {
      // No conflict - new entry
      result.autoImport.push(incoming);
      continue;
    }

    // Check if incoming is a correction
    if (incoming.isCorrected) {
      result.autoReplace.push(incoming);
      continue;
    }

    // Check timestamps (auto-replace if incoming is significantly newer)
    const timeDiff = incoming.timestamp - existing.timestamp;
    const THIRTY_SECONDS = 30 * 1000;

    if (timeDiff > THIRTY_SECONDS) {
      result.autoReplace.push(incoming);
    } else if (timeDiff < -THIRTY_SECONDS) {
      // Existing is newer - don't import
      continue;
    } else {
      // Similar timestamps - manual review needed
      result.manualReview.push({
        existing: existing as ScoutingEntryBase<TGameData>,
        incoming,
      });
    }
  }

  return result;
};

/**
 * Merge scouting data collections with deduplication
 */
export const mergeScoutingData = <TGameData = Record<string, unknown>>(
  existingData: ScoutingEntryBase<TGameData>[],
  newData: ScoutingEntryBase<TGameData>[]
): {
  merged: ScoutingEntryBase<TGameData>[];
  stats: {
    existing: number;
    new: number;
    duplicates: number;
    final: number;
  };
} => {
  if (existingData.length === 0) {
    return {
      merged: newData,
      stats: {
        existing: 0,
        new: newData.length,
        duplicates: 0,
        final: newData.length,
      },
    };
  }

  const existingIds = new Set(existingData.map(entry => entry.id));
  const uniqueNewData = newData.filter(entry => !existingIds.has(entry.id));
  const duplicateCount = newData.length - uniqueNewData.length;

  const merged = [...existingData, ...uniqueNewData];

  return {
    merged,
    stats: {
      existing: existingData.length,
      new: uniqueNewData.length,
      duplicates: duplicateCount,
      final: merged.length,
    },
  };
};

/**
 * Find existing entry in database that matches match/team/alliance
 * Supports fallback matching when eventName is missing
 */
export const findExistingEntry = async (
  matchNumber: number,
  teamNumber: number,
  allianceColor: 'red' | 'blue',
  eventKey?: string
): Promise<ScoutingEntryBase | undefined> => {
  if (!matchNumber || !teamNumber || !allianceColor) {
    return undefined;
  }

  // Try with event name first (fastest)
  if (eventKey) {
    const entry = await db.scoutingData
      .where({ matchNumber, teamNumber, allianceColor, eventKey })
      .first();

    if (entry) {
      return entry;
    }
  }

  // Fallback: search without event name
  const entries = await db.scoutingData
    .where({ matchNumber, teamNumber, allianceColor })
    .toArray();

  return entries[0];
};

/**
 * Load all scouting data from database
 */
export const loadScoutingData = async <TGameData = Record<string, unknown>>(): Promise<
  ScoutingEntryBase<TGameData>[]
> => {
  try {
    const { loadAllScoutingEntries } = await import('./database');
    return await loadAllScoutingEntries<TGameData>();
  } catch (error) {
    console.error('Error loading scouting data:', error);
    return [];
  }
};

/**
 * Save scouting data to database
 */
export const saveScoutingData = async <TGameData = Record<string, unknown>>(
  entries: ScoutingEntryBase<TGameData>[]
): Promise<void> => {
  try {
    const { saveScoutingEntries } = await import('./database');
    await saveScoutingEntries(entries);
  } catch (error) {
    console.error('Error saving scouting data:', error);
    throw error;
  }
};
