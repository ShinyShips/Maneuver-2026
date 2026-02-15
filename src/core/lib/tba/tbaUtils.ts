// The Blue Alliance API utilities
// This file contains TBA-specific storage utilities and types
// Full TBA API integration

import { proxyGetJson } from '@/core/lib/apiProxy';

// ============================================================================
// Type Definitions
// ============================================================================

export interface TBAMatch {
  key: string;
  comp_level: string;
  set_number: number;
  match_number: number;
  alliances: {
    red: {
      score: number;
      team_keys: string[];
      surrogate_team_keys?: string[];
      dq_team_keys?: string[];
    };
    blue: {
      score: number;
      team_keys: string[];
      surrogate_team_keys?: string[];
      dq_team_keys?: string[];
    };
  };
  score_breakdown: Record<string, unknown> | null;
  winning_alliance: 'red' | 'blue' | '';
  event_key: string;
  time: number;
  actual_time: number;
  predicted_time: number;
  post_result_time: number;
}

export interface TBATeam {
  key: string;
  team_number: number;
  nickname: string;
  name: string;
  school_name?: string;
  city?: string;
  state_prov?: string;
  country?: string;
}

interface LocalScheduleMatch {
  redAlliance?: number[];
  blueAlliance?: number[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get match result with winner determination
 */
export const getMatchResult = (match: TBAMatch): {
  redScore: number;
  blueScore: number;
  winner: 'red' | 'blue' | 'tie';
  winningAlliance: 'red' | 'blue' | '';
} => {
  const redScore = match.alliances.red.score;
  const blueScore = match.alliances.blue.score;
  
  let winner: 'red' | 'blue' | 'tie';
  let winningAlliance: 'red' | 'blue' | '';
  
  if (redScore > blueScore) {
    winner = 'red';
    winningAlliance = 'red';
  } else if (blueScore > redScore) {
    winner = 'blue';
    winningAlliance = 'blue';
  } else {
    winner = 'tie';
    winningAlliance = '';
  }
  
  return {
    redScore,
    blueScore,
    winner,
    winningAlliance,
  };
};

/**
 * Get teams for an event
 */
export const getEventTeams = async (eventKey: string, apiKey: string): Promise<TBATeam[]> => {
  if (isDemoEventKey(eventKey)) {
    const localTeams = getLocalScheduleTeams();
    if (localTeams.length > 0) {
      return localTeams;
    }
  }

  const teamKeys = await proxyGetJson<string[]>(
    'tba',
    `/event/${eventKey}/teams/keys`,
    { apiKeyOverride: apiKey || undefined }
  );

  return teamKeys
    .map(key => {
      const teamNumber = parseInt(key.replace('frc', ''), 10);
      return {
        key,
        team_number: teamNumber,
        nickname: `Team ${teamNumber}`,
        name: `Team ${teamNumber}`,
      };
    })
    .sort((a, b) => a.team_number - b.team_number);
};

function isDemoEventKey(eventKey: string): boolean {
  return /^demo/i.test(eventKey);
}

function getLocalScheduleTeams(): TBATeam[] {
  try {
    const raw = localStorage.getItem('matchData');
    if (!raw) {
      return [];
    }

    const schedule = JSON.parse(raw) as LocalScheduleMatch[];
    if (!Array.isArray(schedule)) {
      return [];
    }

    const teamSet = new Set<number>();
    for (const match of schedule) {
      for (const team of match.redAlliance ?? []) {
        if (Number.isFinite(team)) {
          teamSet.add(team);
        }
      }
      for (const team of match.blueAlliance ?? []) {
        if (Number.isFinite(team)) {
          teamSet.add(team);
        }
      }
    }

    return [...teamSet]
      .sort((a, b) => a - b)
      .map(teamNumber => ({
        key: `frc${teamNumber}`,
        team_number: teamNumber,
        nickname: `Team ${teamNumber}`,
        name: `Team ${teamNumber}`,
      }));
  } catch (error) {
    console.warn('Failed to derive teams from local demo schedule:', error);
    return [];
  }
}

// ============================================================================
// Local Storage Utilities
// ============================================================================

const TEAMS_STORAGE_PREFIX = 'tba_event_teams_';

/**
 * Store event teams in localStorage
 */
export const storeEventTeams = (eventKey: string, teams: TBATeam[]): void => {
  const storageKey = `${TEAMS_STORAGE_PREFIX}${eventKey}`;
  // Extract just the team numbers for more efficient storage
  const teamNumbers = teams.map(team => team.team_number).sort((a, b) => a - b);
  const data = {
    teamNumbers,
    timestamp: Date.now(),
    eventKey
  };
  
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    console.log(`Stored ${teamNumbers.length} team numbers for event ${eventKey}`);
  } catch (error) {
    console.error('Failed to store teams in localStorage:', error);
    throw new Error('Failed to store teams data');
  }
};

/**
 * Get stored event teams from localStorage
 */
export const getStoredEventTeams = (eventKey: string): number[] | null => {
  const storageKey = `${TEAMS_STORAGE_PREFIX}${eventKey}`;
  
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    // Check for both old format (teams) and new format (teamNumbers) for backward compatibility
    if (data.teamNumbers) {
      return data.teamNumbers;
    } else if (data.teams) {
      // Legacy format - extract team numbers from full team objects
      return data.teams.map((team: TBATeam) => team.team_number).sort((a: number, b: number) => a - b);
    }
    return null;
  } catch (error) {
    console.error('Failed to retrieve teams from localStorage:', error);
    return null;
  }
};

/**
 * Clear stored event teams from localStorage
 * Used when switching events or clearing event data
 */
export const clearStoredEventTeams = (eventKey: string): void => {
  const storageKey = `${TEAMS_STORAGE_PREFIX}${eventKey}`;
  localStorage.removeItem(storageKey);
  console.log(`Cleared TBA teams for event ${eventKey}`);
};

/**
 * Get all stored event teams
 */
export const getAllStoredEventTeams = (): { [eventKey: string]: number[] } => {
  const result: { [eventKey: string]: number[] } = {};
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(TEAMS_STORAGE_PREFIX)) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored);
          const eventKey = key.replace(TEAMS_STORAGE_PREFIX, '');
          
          // Handle both new format (teamNumbers) and legacy format (teams)
          if (data.teamNumbers) {
            result[eventKey] = data.teamNumbers;
          } else if (data.teams) {
            // Legacy format - extract team numbers
            result[eventKey] = data.teams.map((team: TBATeam) => team.team_number).sort((a: number, b: number) => a - b);
          }
        }
      } catch (error) {
        console.error(`Failed to parse stored teams for key ${key}:`, error);
      }
    }
  }
  
  return result;
};
