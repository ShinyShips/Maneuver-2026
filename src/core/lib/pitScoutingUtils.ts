import type { PitScoutingEntryBase } from '@/core/types/pit-scouting';
import {
  savePitScoutingEntry as dbSavePitScoutingEntry,
  loadPitScoutingByTeamAndEvent,
  loadAllPitScoutingEntries,
  loadPitScoutingByTeam,
  loadPitScoutingByEvent,
  deletePitScoutingEntry as dbDeletePitScoutingEntry,
  clearAllPitScoutingData as dbClearAllPitScoutingData,
  getPitScoutingStats as dbGetPitScoutingStats
} from '../db/database';

// Type alias for convenience - uses the database schema type
export type PitScoutingEntry = PitScoutingEntryBase;

// Data wrapper for pit scouting entries
export interface PitScoutingData {
  entries: PitScoutingEntry[];
  lastUpdated: number;
}

// Generate unique ID for pit scouting entries
export const generatePitScoutingId = (entry: Omit<PitScoutingEntry, 'id' | 'timestamp'>): string => {
  const baseString = `${entry.teamNumber}-${entry.eventKey}-${entry.scoutName}`;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `pit-${baseString}-${timestamp}-${random}`;
};

// Save pit scouting entry
export const savePitScoutingEntry = async (entry: Omit<PitScoutingEntry, 'id' | 'timestamp'>): Promise<PitScoutingEntry> => {
  try {
    // Check if an entry for this team and event already exists
    const existing = await loadPitScoutingByTeamAndEvent(entry.teamNumber, entry.eventKey);

    const completeEntry: PitScoutingEntry = {
      ...entry,
      id: existing?.id || generatePitScoutingId(entry),
      timestamp: Date.now()
    };

    await dbSavePitScoutingEntry(completeEntry);
    return completeEntry;
  } catch (error) {
    console.error('Error saving pit scouting entry:', error);
    throw error;
  }
};

// Load all pit scouting data
export const loadPitScoutingData = async (): Promise<PitScoutingData> => {
  try {
    const entries = await loadAllPitScoutingEntries();
    return {
      entries,
      lastUpdated: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : 0
    };
  } catch (error) {
    console.error('Error loading pit scouting data:', error);
    return { entries: [], lastUpdated: 0 };
  }
};

// Load pit scouting entry by team and event
export const loadPitScoutingEntry = async (teamNumber: number, eventKey: string): Promise<PitScoutingEntry | null> => {
  try {
    const result = await loadPitScoutingByTeamAndEvent(teamNumber, eventKey);
    return result || null;
  } catch (error) {
    console.error('Error loading pit scouting entry:', error);
    return null;
  }
};

// Load pit scouting entries by team
export const loadPitScoutingEntriesByTeam = async (teamNumber: number): Promise<PitScoutingEntry[]> => {
  try {
    return await loadPitScoutingByTeam(teamNumber);
  } catch (error) {
    console.error('Error loading pit scouting entries by team:', error);
    return [];
  }
};

// Load pit scouting entries by event
export const loadPitScoutingEntriesByEvent = async (eventKey: string): Promise<PitScoutingEntry[]> => {
  try {
    return await loadPitScoutingByEvent(eventKey);
  } catch (error) {
    console.error('Error loading pit scouting entries by event:', error);
    return [];
  }
};

// Delete pit scouting entry
export const deletePitScoutingEntry = async (id: string): Promise<void> => {
  try {
    await dbDeletePitScoutingEntry(id);
  } catch (error) {
    console.error('Error deleting pit scouting entry:', error);
    throw error;
  }
};

// Clear all pit scouting data
export const clearAllPitScoutingData = async (): Promise<void> => {
  try {
    await dbClearAllPitScoutingData();
  } catch (error) {
    console.error('Error clearing pit scouting data:', error);
    throw error;
  }
};

// Get pit scouting statistics
export const getPitScoutingStats = async (): Promise<{
  totalEntries: number;
  teams: number[];  // Team numbers are numeric
  events: string[];
  scouts: string[];
}> => {
  try {
    return await dbGetPitScoutingStats();
  } catch (error) {
    console.error('Error getting pit scouting stats:', error);
    return {
      totalEntries: 0,
      teams: [],
      events: [],
      scouts: []
    };
  }
};

// Export pit scouting data
export const exportPitScoutingData = async (): Promise<PitScoutingData> => {
  return await loadPitScoutingData();
};

// Download pit scouting data with images as JSON file
export const downloadPitScoutingDataWithImages = async (): Promise<void> => {
  try {
    const pitScoutingData = await loadPitScoutingData();

    if (pitScoutingData.entries.length === 0) {
      throw new Error('No pit scouting data found');
    }

    const jsonString = JSON.stringify(pitScoutingData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `pit-scouting-with-images-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading pit scouting data:', error);
    throw error;
  }
};

// Download only images from pit scouting data
export const downloadPitScoutingImagesOnly = async (): Promise<void> => {
  try {
    const pitScoutingData = await loadPitScoutingData();

    if (pitScoutingData.entries.length === 0) {
      throw new Error('No pit scouting data found');
    }

    // Filter entries to only include those with images and minimal identifying data
    const imagesOnlyData = {
      type: 'pit-scouting-images-only',
      lastUpdated: pitScoutingData.lastUpdated,
      entries: pitScoutingData.entries
        .filter(entry => entry.robotPhoto) // Only entries with images
        .map(entry => ({
          teamNumber: entry.teamNumber,
          eventKey: entry.eventKey,
          robotPhoto: entry.robotPhoto,
          timestamp: entry.timestamp // For conflict resolution
        }))
    };

    if (imagesOnlyData.entries.length === 0) {
      throw new Error('No images found in pit scouting data');
    }

    const jsonString = JSON.stringify(imagesOnlyData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `pit-scouting-images-only-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading pit scouting images:', error);
    throw error;
  }
};

// Import pit scouting data
export const importPitScoutingData = async (
  importData: PitScoutingData,
  mode: 'append' | 'overwrite' = 'append'
): Promise<{ imported: number; duplicatesSkipped: number }> => {
  try {
    if (mode === 'overwrite') {
      await clearAllPitScoutingData();
      // Save all imported entries
      await Promise.all(importData.entries.map(entry => dbSavePitScoutingEntry(entry)));
      return { imported: importData.entries.length, duplicatesSkipped: 0 };
    } else {
      const existingEntries = await loadAllPitScoutingEntries();
      // Create a set of existing team-event combinations instead of IDs
      const existingTeamEvents = new Set(
        existingEntries.map(e => `${e.teamNumber}-${e.eventKey}`)
      );

      const newEntries = importData.entries.filter(entry =>
        !existingTeamEvents.has(`${entry.teamNumber}-${entry.eventKey}`)
      );

      // Save only new entries
      await Promise.all(newEntries.map(entry => dbSavePitScoutingEntry(entry)));

      return {
        imported: newEntries.length,
        duplicatesSkipped: importData.entries.length - newEntries.length
      };
    }
  } catch (error) {
    console.error('Error importing pit scouting data:', error);
    throw error;
  }
};

/**
 * Year-agnostic CSV export for pit scouting data
 * Dynamically creates columns for all gameData fields found across entries
 * Each unique gameData key becomes its own column
 */
export const exportPitScoutingToCSV = async (): Promise<string> => {
  const data = await loadPitScoutingData();

  if (data.entries.length === 0) {
    return '';
  }

  // Collect all unique gameData keys across all entries
  const gameDataKeys = new Set<string>();
  data.entries.forEach(entry => {
    if (entry.gameData && typeof entry.gameData === 'object') {
      // Recursively flatten nested objects with dot notation
      const flattenObject = (obj: Record<string, unknown>, prefix = ''): void => {
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          const fullKey = prefix ? `${prefix}.${key}` : key;

          if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively flatten nested objects
            flattenObject(value as Record<string, unknown>, fullKey);
          } else {
            // Add leaf node as a column
            gameDataKeys.add(fullKey);
          }
        });
      };

      flattenObject(entry.gameData as Record<string, unknown>);
    }
  });

  // Sort game data keys alphabetically for consistent column order
  const sortedGameDataKeys = Array.from(gameDataKeys).sort();

  // Universal headers + dynamic game data headers
  const headers = [
    'ID',
    'Team Number',
    'Event Key',
    'Scout',
    'Timestamp',
    'Weight (lbs)',
    'Drivetrain',
    'Programming Language',
    'Robot Photo',
    'Notes',
    ...sortedGameDataKeys // Add all game data fields as columns
  ];

  // Helper to get nested value using dot notation
  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  };

  // Helper to format value for CSV
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Map entries to rows with universal fields + dynamic game data fields
  const rows = data.entries.map(entry => {
    const universalFields = [
      entry.id,
      entry.teamNumber.toString(),
      entry.eventKey,
      entry.scoutName,
      new Date(entry.timestamp).toISOString(),
      entry.weight?.toString() || '',
      entry.drivetrain || '',
      entry.programmingLanguage || '',
      entry.robotPhoto ? 'Has Image' : 'No Image',
      entry.notes || ''
    ];

    // Add dynamic game data values in the same order as headers
    const gameDataValues = sortedGameDataKeys.map(key => {
      if (!entry.gameData) return '';
      const value = getNestedValue(entry.gameData as Record<string, unknown>, key);
      return formatValue(value);
    });

    return [...universalFields, ...gameDataValues];
  });

  // Convert to CSV format
  return [headers, ...rows].map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

// Import images-only data and merge with existing pit scouting entries
export const importPitScoutingImagesOnly = async (
  imagesData: {
    type: string;
    entries: Array<{
      teamNumber: number;
      eventKey: string;
      robotPhoto: string;
      timestamp: number;
    }>;
  }
): Promise<{ updated: number; notFound: number }> => {
  try {
    if (imagesData.type !== 'pit-scouting-images-only') {
      throw new Error('Invalid images-only data format');
    }

    const existingEntries = await loadAllPitScoutingEntries();
    let updated = 0;
    let notFound = 0;

    console.log('Images import debug:');
    console.log('Existing entries:', existingEntries.map(e => `${e.teamNumber}@${e.eventKey}`));
    console.log('Image entries to match:', imagesData.entries.map(e => `${e.teamNumber}@${e.eventKey}`));

    for (const imageEntry of imagesData.entries) {
      // Find existing entry by team and event
      const existingEntry = existingEntries.find(
        entry => entry.teamNumber === imageEntry.teamNumber &&
          entry.eventKey === imageEntry.eventKey
      );

      console.log(`Looking for ${imageEntry.teamNumber}@${imageEntry.eventKey}: ${existingEntry ? 'FOUND' : 'NOT FOUND'}`);

      if (existingEntry) {
        // Update existing entry with the image
        const updatedEntry = {
          ...existingEntry,
          robotPhoto: imageEntry.robotPhoto,
          timestamp: Math.max(existingEntry.timestamp, imageEntry.timestamp) // Keep latest timestamp
        };

        await dbSavePitScoutingEntry(updatedEntry);
        updated++;
      } else {
        notFound++;
      }
    }

    return { updated, notFound };
  } catch (error) {
    console.error('Error importing pit scouting images:', error);
    throw error;
  }
};
