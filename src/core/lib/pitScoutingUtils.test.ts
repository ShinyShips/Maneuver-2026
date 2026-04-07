import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PitScoutingEntryBase } from '@/core/types/pit-scouting';

const {
  mockDbSavePitScoutingEntry,
  mockLoadPitScoutingByTeamAndEvent,
  mockLoadAllPitScoutingEntries,
  mockLoadPitScoutingByTeam,
  mockLoadPitScoutingByEvent,
  mockDeletePitScoutingEntry,
  mockClearAllPitScoutingData,
  mockGetPitScoutingStats,
} = vi.hoisted(() => ({
  mockDbSavePitScoutingEntry: vi.fn(),
  mockLoadPitScoutingByTeamAndEvent: vi.fn(),
  mockLoadAllPitScoutingEntries: vi.fn(),
  mockLoadPitScoutingByTeam: vi.fn(),
  mockLoadPitScoutingByEvent: vi.fn(),
  mockDeletePitScoutingEntry: vi.fn(),
  mockClearAllPitScoutingData: vi.fn(),
  mockGetPitScoutingStats: vi.fn(),
}));

vi.mock('../db/database', () => ({
  savePitScoutingEntry: mockDbSavePitScoutingEntry,
  loadPitScoutingByTeamAndEvent: mockLoadPitScoutingByTeamAndEvent,
  loadAllPitScoutingEntries: mockLoadAllPitScoutingEntries,
  loadPitScoutingByTeam: mockLoadPitScoutingByTeam,
  loadPitScoutingByEvent: mockLoadPitScoutingByEvent,
  deletePitScoutingEntry: mockDeletePitScoutingEntry,
  clearAllPitScoutingData: mockClearAllPitScoutingData,
  getPitScoutingStats: mockGetPitScoutingStats,
}));

import { importPitScoutingData, importPitScoutingImagesOnly } from './pitScoutingUtils';

const createPitEntry = (overrides: Partial<PitScoutingEntryBase>): PitScoutingEntryBase => ({
  id: 'pit-default',
  teamNumber: 3314,
  eventKey: '2026miket',
  scoutName: 'Alex',
  timestamp: 1000,
  robotPhoto: undefined,
  weight: undefined,
  drivetrain: undefined,
  programmingLanguage: undefined,
  notes: undefined,
  gameData: {},
  ...overrides,
});

describe('pitScoutingUtils imports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(5000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    mockLoadPitScoutingByTeamAndEvent.mockResolvedValue(undefined);
    mockLoadAllPitScoutingEntries.mockResolvedValue([]);
    mockLoadPitScoutingByTeam.mockResolvedValue([]);
    mockLoadPitScoutingByEvent.mockResolvedValue([]);
    mockDeletePitScoutingEntry.mockResolvedValue(undefined);
    mockClearAllPitScoutingData.mockResolvedValue(undefined);
    mockGetPitScoutingStats.mockResolvedValue({
      totalEntries: 0,
      teams: [],
      events: [],
      scouts: [],
    });
    mockDbSavePitScoutingEntry.mockResolvedValue(undefined);
  });

  it('seeds a new event import from the latest prior team entry', async () => {
    const priorEntry = createPitEntry({
      id: 'pit-prior',
      eventKey: '2026week1',
      timestamp: 2000,
      robotPhoto: 'prior-photo',
      weight: 120,
      drivetrain: 'swerve',
      programmingLanguage: 'Java',
      notes: 'prior notes',
      gameData: {
        intake: { floor: true, humanPlayer: false },
        climb: 'deep',
      },
    });

    mockLoadAllPitScoutingEntries.mockResolvedValue([priorEntry]);

    const importEntry = createPitEntry({
      id: 'pit-imported',
      eventKey: '2026dcmp',
      timestamp: 4500,
      robotPhoto: undefined,
      weight: undefined,
      drivetrain: undefined,
      notes: 'dcmp notes',
      gameData: {
        intake: { humanPlayer: true },
        auto: { canScore: true },
      },
    });

    const result = await importPitScoutingData({
      entries: [importEntry],
      lastUpdated: 4500,
    });

    expect(result).toEqual({
      imported: 1,
      updated: 0,
      seededFromPrevious: 1,
      duplicatesSkipped: 0,
    });

    expect(mockDbSavePitScoutingEntry).toHaveBeenCalledTimes(1);
    expect(mockDbSavePitScoutingEntry).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pit-imported',
      teamNumber: 3314,
      eventKey: '2026dcmp',
      robotPhoto: 'prior-photo',
      weight: 120,
      drivetrain: 'swerve',
      programmingLanguage: 'Java',
      notes: 'dcmp notes',
      timestamp: 4500,
      gameData: {
        intake: { floor: true, humanPlayer: true },
        climb: 'deep',
        auto: { canScore: true },
      },
    }));
  });

  it('updates an existing same-event import in place', async () => {
    const existingEntry = createPitEntry({
      id: 'pit-existing',
      eventKey: '2026dcmp',
      timestamp: 2000,
      robotPhoto: 'old-photo',
      weight: 118,
      gameData: { climb: 'shallow', intake: { floor: true } },
    });

    mockLoadAllPitScoutingEntries.mockResolvedValue([existingEntry]);

    const importEntry = createPitEntry({
      id: 'pit-new-upload',
      eventKey: '2026dcmp',
      timestamp: 6000,
      robotPhoto: 'new-photo',
      weight: undefined,
      gameData: { intake: { station: true } },
    });

    const result = await importPitScoutingData({
      entries: [importEntry],
      lastUpdated: 6000,
    });

    expect(result).toEqual({
      imported: 0,
      updated: 1,
      seededFromPrevious: 0,
      duplicatesSkipped: 0,
    });

    expect(mockDbSavePitScoutingEntry).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pit-existing',
      eventKey: '2026dcmp',
      robotPhoto: 'new-photo',
      weight: 118,
      gameData: {
        climb: 'shallow',
        intake: { floor: true, station: true },
      },
    }));
  });

  it('seeds image-only imports from the latest prior event when needed', async () => {
    const priorEntry = createPitEntry({
      id: 'pit-prior',
      eventKey: '2026week2',
      timestamp: 3000,
      scoutName: 'Taylor',
      weight: 125,
      drivetrain: 'tank',
      programmingLanguage: 'C++',
      notes: 'carry forward',
      gameData: { dimensions: { length: 32 } },
    });

    mockLoadAllPitScoutingEntries.mockResolvedValue([priorEntry]);

    const result = await importPitScoutingImagesOnly({
      type: 'pit-scouting-images-only',
      entries: [
        {
          teamNumber: 3314,
          eventKey: '2026dcmp',
          robotPhoto: 'dcmp-photo',
          timestamp: 7000,
        },
      ],
    });

    expect(result).toEqual({
      updated: 1,
      seededFromPrevious: 1,
      notFound: 0,
    });

    expect(mockDbSavePitScoutingEntry).toHaveBeenCalledWith(expect.objectContaining({
      teamNumber: 3314,
      eventKey: '2026dcmp',
      scoutName: 'Taylor',
      robotPhoto: 'dcmp-photo',
      weight: 125,
      drivetrain: 'tank',
      programmingLanguage: 'C++',
      notes: 'carry forward',
      timestamp: 7000,
      gameData: { dimensions: { length: 32 } },
    }));
  });
});