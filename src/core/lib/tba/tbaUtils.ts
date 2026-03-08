// The Blue Alliance API utilities
// This file contains TBA-specific storage utilities and types
// Full TBA API integration

const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';

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
  const endpoint = `/event/${eventKey}/teams/keys`;
  
  const response = await fetch(`${TBA_BASE_URL}${endpoint}`, {
    headers: {
      'X-TBA-Auth-Key': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`TBA API Error: ${response.status} ${response.statusText}`);
  }

  const teamKeys = await response.json() as string[];
  // Convert team keys (e.g., "frc1234") to team objects
  return teamKeys.map(key => {
    const teamNumber = parseInt(key.replace('frc', ''));
    return {
      key,
      team_number: teamNumber,
      nickname: `Team ${teamNumber}`,
      name: `Team ${teamNumber}`,
    };
  }).sort((a, b) => a.team_number - b.team_number);
};

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
