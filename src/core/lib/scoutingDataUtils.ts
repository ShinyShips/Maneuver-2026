/**
 * Year-agnostic scouting data utilities
 * Works directly with ScoutingEntryBase - the core database format
 */

import type { ScoutingEntryBase } from '@/types/scouting-entry';

/**
 * Normalize event key for consistent storage and comparison
 */
export const normalizeEventKey = (eventKey: string): string => {
  return String(eventKey).toLowerCase().trim();
};

/**
 * Generate a deterministic ID
 */
export const generateDeterministicEntryId = (
  eventKey: string,
  matchKey: string,
  teamNumber: number,
  allianceColor: 'red' | 'blue'
): string => {
  const event = normalizeEventKey(eventKey);
  const match = String(matchKey).toLowerCase().trim();
  const team = String(teamNumber).trim();
  const alliance = allianceColor.toLowerCase().trim();
  
  return `${event}::${match}::${team}::${alliance}`;
};

export const generateDataFingerprint = (entry: ScoutingEntryBase): string => {
  const sortedEntries = Object.entries(entry.gameData || {})
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  
  const dataString = sortedEntries
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .join('|');
  
  let hash = 2166136261;
  for (let i = 0; i < dataString.length; i++) {
    hash ^= dataString.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  
  return (hash >>> 0).toString(36);
};

export const loadScoutingData = async (): Promise<ScoutingEntryBase[]> => {
  try {
    const { db } = await import('@/core/db/database');
    const entries = await db.scoutingData.toArray();
    // Cast to ScoutingEntryBase since database returns generic version
    return entries as unknown as ScoutingEntryBase[];
  } catch (error) {
    console.error('Error loading scouting data:', error);
    return [];
  }
};

export const saveScoutingData = async (entries: ScoutingEntryBase[]): Promise<void> => {
  try {
    const { db } = await import('@/core/db/database');
    // Cast to match database generic type
    await db.scoutingData.bulkPut(entries as any);
  } catch (error) {
    console.error('Error saving scouting data:', error);
    throw error;
  }
};

/**
 * Get display summary for UI
 */
export const getDataSummary = async (): Promise<{
  totalEntries: number;
  teams: number[];
  matches: string[];
  scouts: string[];
  events: string[];
}> => {
  const entries = await loadScoutingData();
  
  const teams = new Set<number>();
  const matches = new Set<string>();
  const scouts = new Set<string>();
  const events = new Set<string>();
  
  entries.forEach(entry => {
    if (entry.teamNumber) teams.add(entry.teamNumber);
    if (entry.matchKey) matches.add(entry.matchKey);
    if (entry.scoutName) scouts.add(entry.scoutName);
    if (entry.eventKey) events.add(entry.eventKey);
  });
  
  return {
    totalEntries: entries.length,
    teams: Array.from(teams).sort((a, b) => a - b),
    matches: Array.from(matches).sort(),
    scouts: Array.from(scouts).sort(),
    events: Array.from(events).sort()
  };
};

// ==============================================================================
// CONFLICT DETECTION FOR DATA IMPORTS
// ==============================================================================

export interface ConflictInfo {
  incoming: ScoutingEntryBase;
  local: ScoutingEntryBase;
  conflictType: 'corrected-vs-uncorrected' | 'corrected-vs-corrected';
  isNewerIncoming: boolean;
  changedFields?: Array<{ field: string; localValue: unknown; incomingValue: unknown }>;
}

export interface ConflictDetectionResult {
  autoImport: ScoutingEntryBase[];
  autoReplace: ScoutingEntryBase[];
  batchReview: ScoutingEntryBase[];
  conflicts: ConflictInfo[];
}

/**
 * Compare two entries and return list of gameData fields that differ
 * Flattens nested objects (auto, teleop, endgame) for detailed field-by-field comparison
 */
export const computeChangedFields = (
  localEntry: ScoutingEntryBase, 
  incomingEntry: ScoutingEntryBase
): Array<{ field: string; localValue: unknown; incomingValue: unknown }> => {
  const changes: Array<{ field: string; localValue: unknown; incomingValue: unknown }> = [];
  
  const localData = localEntry.gameData || {};
  const incomingData = incomingEntry.gameData || {};
  
  /**
   * Recursively flatten nested objects into dot notation
   * e.g., { auto: { startPosition: 'Left' } } → { 'auto.startPosition': 'Left' }
   */
  const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
    const flattened: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(flattened, flattenObject(value as Record<string, unknown>, fullKey));
      } else {
        // Primitive value or array - store as-is
        flattened[fullKey] = value;
      }
    }
    
    return flattened;
  };
  
  const flattenedLocal = flattenObject(localData);
  const flattenedIncoming = flattenObject(incomingData);
  
  const allFields = new Set([
    ...Object.keys(flattenedLocal),
    ...Object.keys(flattenedIncoming)
  ]);
  
  for (const field of allFields) {
    const localValue = flattenedLocal[field];
    const incomingValue = flattenedIncoming[field];
    
    // Skip if either value is null/undefined
    if (incomingValue === null || incomingValue === undefined) continue;
    if (localValue === null || localValue === undefined) continue;
    
    // Compare values
    if (JSON.stringify(localValue) !== JSON.stringify(incomingValue)) {
      changes.push({ field, localValue, incomingValue });
    }
  }
  
  return changes;
};

/**
 * Detects conflicts between incoming data and existing local data
 * Returns categorized results for UI handling
 */
export const detectConflicts = async (
  incomingData: ScoutingEntryBase[]
): Promise<ConflictDetectionResult> => {
  const { db } = await import('@/core/db/database');
  
  const autoImport: ScoutingEntryBase[] = [];
  const autoReplace: ScoutingEntryBase[] = [];
  const batchReview: ScoutingEntryBase[] = [];
  const conflicts: ConflictInfo[] = [];
  
  const allLocalEntries = await db.scoutingData.toArray();
  const localEntriesById = new Map(
    allLocalEntries.map(entry => [entry.id, entry as unknown as ScoutingEntryBase])
  );
  
  const localEntriesByFields = new Map(
    allLocalEntries.map(entry => {
      const typedEntry = entry as unknown as ScoutingEntryBase;
      const key = generateDeterministicEntryId(
        typedEntry.eventKey,
        typedEntry.matchKey,
        typedEntry.teamNumber,
        typedEntry.allianceColor
      );
      return [key, typedEntry];
    })
  );
  
  for (const incomingEntry of incomingData) {
    let matchingLocal = localEntriesById.get(incomingEntry.id);
    
    if (!matchingLocal) {
      const fieldBasedKey = generateDeterministicEntryId(
        incomingEntry.eventKey,
        incomingEntry.matchKey,
        incomingEntry.teamNumber,
        incomingEntry.allianceColor
      );
      matchingLocal = localEntriesByFields.get(fieldBasedKey);
    }
    
    if (!matchingLocal) {
      autoImport.push(incomingEntry);
      continue;
    }
    
    const localIsCorrected = matchingLocal.isCorrected || false;
    const incomingIsCorrected = Boolean(incomingEntry.isCorrected);
    
    const localFingerprint = generateDataFingerprint(matchingLocal);
    const incomingFingerprint = generateDataFingerprint(incomingEntry);
    
    if (localIsCorrected && incomingIsCorrected) {
      const localCorrectionTime = Number(matchingLocal.lastCorrectedAt || matchingLocal.timestamp || 0);
      const incomingCorrectionTime = Number(incomingEntry.lastCorrectedAt || incomingEntry.timestamp || 0);
      
      if (localFingerprint === incomingFingerprint && Math.abs(localCorrectionTime - incomingCorrectionTime) <= 1000) {
        continue;
      }
    } else if (localFingerprint === incomingFingerprint && localIsCorrected === incomingIsCorrected) {
      continue;
    }
    
    if (!localIsCorrected && !incomingIsCorrected) {
      batchReview.push(incomingEntry);
      continue;
    }
    
    if (!localIsCorrected && incomingIsCorrected) {
      autoReplace.push(incomingEntry);
      continue;
    }
    
    if (localIsCorrected && !incomingIsCorrected) {
      const changedFields = computeChangedFields(matchingLocal, incomingEntry);
      conflicts.push({
        incoming: incomingEntry,
        local: matchingLocal,
        conflictType: 'corrected-vs-uncorrected',
        isNewerIncoming: false,
        changedFields
      });
      continue;
    }
    
    if (localIsCorrected && incomingIsCorrected) {
      const localCorrectionTime = matchingLocal.lastCorrectedAt || matchingLocal.timestamp;
      const incomingCorrectionTime = Number(incomingEntry.lastCorrectedAt || incomingEntry.timestamp || 0);
      
      if (Math.abs(localCorrectionTime - incomingCorrectionTime) <= 1000) {
        autoReplace.push(incomingEntry);
        continue;
      }
      
      const changedFields = computeChangedFields(matchingLocal, incomingEntry);
      conflicts.push({
        incoming: incomingEntry,
        local: matchingLocal,
        conflictType: 'corrected-vs-corrected',
        isNewerIncoming: incomingCorrectionTime > localCorrectionTime,
        changedFields
      });
    }
  }
  
  return {
    autoImport,
    autoReplace,
    batchReview,
    conflicts
  };
};
