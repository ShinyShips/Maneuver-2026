/**
 * Generic TBA (The Blue Alliance) Types
 * 
 * Year-agnostic types for working with TBA API data.
 * Game-specific implementations should extend these base types.
 * 
 * See: src/game-template/tba/tbaMatchData2025.ts for a complete example
 */

/**
 * Generic TBA Match Data
 * Contains basic match information that exists across all years
 * 
 * @example
 * // For 2025 REEFSCAPE, extend with:
 * interface TBAMatchData2025 extends TBAMatchData {
 *   score_breakdown: {
 *     red: TBAScoreBreakdown2025;
 *     blue: TBAScoreBreakdown2025;
 *   } | null;
 * }
 */
export interface TBAMatchData {
  key: string;  // Match key (e.g., "2025mrcmp_qm1")
  event_key: string;  // Event key (e.g., "2025mrcmp")
  comp_level: string;  // Competition level: "qm", "sf", "f"
  match_number: number;  // Match number within comp level
  set_number: number;  // Set number (for playoffs)
  
  // Alliance data (always present)
  alliances: {
    red: {
      score: number;
      team_keys: string[];  // e.g., ["frc1", "frc2", "frc3"]
      dq_team_keys: string[];
      surrogate_team_keys: string[];
    };
    blue: {
      score: number;
      team_keys: string[];
      dq_team_keys: string[];
      surrogate_team_keys: string[];
    };
  };
  
  // Score breakdown (game-specific, may be null if not available)
  score_breakdown: Record<string, unknown> | null;
  
  // Match result
  winning_alliance: "red" | "blue" | "";
  
  // Timing
  time: number;  // Scheduled time (Unix timestamp)
  actual_time: number;  // Actual start time
  predicted_time: number;  // Predicted time
  post_result_time: number;  // Time results were posted
  
  // Optional fields
  videos?: Array<{ key: string; type: string }>;
}

/**
 * Simplified match list item (used when fetching match lists)
 */
export interface TBAMatchSimple {
  key: string;
  comp_level: string;
  match_number: number;
  alliances: {
    red: { team_keys: string[] };
    blue: { team_keys: string[] };
  };
}

/**
 * Helper function to check if match has score breakdown data
 * Works for any game year
 */
export function hasScoreBreakdown(match: TBAMatchData): boolean {
  return match.score_breakdown !== null && match.score_breakdown !== undefined;
}

/**
 * Extract team numbers from team keys
 * Converts ["frc1", "frc2"] to [1, 2]
 */
export function extractTeamNumbers(teamKeys: string[]): number[] {
  return teamKeys.map(key => parseInt(key.replace('frc', ''), 10));
}

/**
 * Get match display name
 * Formats match key into human-readable string
 * 
 * @example
 * "2025mrcmp_qm1" → "Qualification 1"
 * "2025mrcmp_sf1m1" → "Semifinal 1-1"
 */
export function formatMatchName(match: TBAMatchData): string {
  const levelNames: Record<string, string> = {
    'qm': 'Qualification',
    'ef': 'Octofinal',
    'qf': 'Quarterfinal',
    'sf': 'Semifinal',
    'f': 'Final'
  };
  
  const level = levelNames[match.comp_level] || match.comp_level;
  
  if (match.comp_level === 'qm') {
    return `${level} ${match.match_number}`;
  } else {
    return `${level} ${match.set_number}-${match.match_number}`;
  }
}

// ============================================================================
// TBA API Functions
// ============================================================================

const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';

/**
 * Fetch detailed match data for a specific match from TBA
 * 
 * @param matchKey - TBA match key (e.g., '2025mrcmp_qm1')
 * @param apiKey - TBA API key
 * @returns Detailed match data with score breakdown
 */
export async function fetchTBAMatchDetail(
  matchKey: string,
  apiKey: string
): Promise<TBAMatchData> {
  const url = `${TBA_BASE_URL}/match/${matchKey}`;
  
  const response = await fetch(url, {
    headers: {
      'X-TBA-Auth-Key': apiKey,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid TBA API key');
    } else if (response.status === 404) {
      throw new Error(`Match ${matchKey} not found`);
    } else {
      throw new Error(`TBA API request failed: ${response.status}`);
    }
  }
  
  const data = await response.json();
  return data as TBAMatchData;
}

/**
 * Fetch all matches for an event (simple format, no score breakdowns)
 * 
 * @param eventKey - TBA event key (e.g., '2025mrcmp')
 * @param apiKey - TBA API key
 * @returns Array of simplified match data
 */
export async function fetchTBAEventMatches(
  eventKey: string,
  apiKey: string
): Promise<TBAMatchSimple[]> {
  const url = `${TBA_BASE_URL}/event/${eventKey}/matches/simple`;
  
  const response = await fetch(url, {
    headers: {
      'X-TBA-Auth-Key': apiKey,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid TBA API key');
    } else if (response.status === 404) {
      throw new Error(`Event ${eventKey} not found`);
    } else {
      throw new Error(`TBA API request failed: ${response.status}`);
    }
  }
  
  const data = await response.json();
  return data as TBAMatchSimple[];
}

/**
 * Fetch all detailed matches for an event (with score breakdowns)
 * Note: This makes one API call and gets all data at once
 * 
 * @param eventKey - TBA event key (e.g., '2025mrcmp')
 * @param apiKey - TBA API key
 * @returns Array of detailed match data
 */
export async function fetchTBAEventMatchesDetailed(
  eventKey: string,
  apiKey: string
): Promise<TBAMatchData[]> {
  const url = `${TBA_BASE_URL}/event/${eventKey}/matches`;
  
  const response = await fetch(url, {
    headers: {
      'X-TBA-Auth-Key': apiKey,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid TBA API key');
    } else if (response.status === 404) {
      throw new Error(`Event ${eventKey} not found`);
    } else {
      throw new Error(`TBA API request failed: ${response.status}`);
    }
  }
  
  const data = await response.json();
  return data as TBAMatchData[];
}
