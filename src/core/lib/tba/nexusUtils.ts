// Nexus API utilities for FRC scouting integration
// Documentation: https://frc.nexus/api/v1/docs

const NEXUS_BASE_URL = 'https://frc.nexus/api/v1';

// Types based on Nexus API documentation
export interface NexusPitAddresses {
  [teamNumber: string]: string; // e.g., {"100": "A1", "200": "A2"}
}

export interface NexusPitMapSize {
  width: number;
  height: number;
}

export interface NexusPitMapPit {
  [pitId: string]: {
    x: number;
    y: number;
    width: number;
    height: number;
    teamNumber?: number;
  };
}

export interface NexusPitMapArea {
  [areaId: string]: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  };
}

export interface NexusPitMapLabel {
  [labelId: string]: {
    x: number;
    y: number;
    text: string;
  };
}

export interface NexusPitMapArrow {
  [arrowId: string]: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface NexusPitMapWall {
  [wallId: string]: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface NexusPitMap {
  size: NexusPitMapSize;
  pits: NexusPitMapPit;
  areas: NexusPitMapArea | null;
  labels: NexusPitMapLabel | null;
  arrows: NexusPitMapArrow | null;
  walls: NexusPitMapWall | null;
}

export interface NexusEventStatus {
  eventKey: string;
  dataAsOfTime: number;
  nowQueuing: string | null;
  matches: unknown[]; // Match objects - complex structure, using unknown for now
  announcements: unknown[]; // Announcement objects - complex structure, using unknown for now
  partsRequests: unknown[]; // PartsRequest objects - complex structure, using unknown for now
}

/**
 * Make a request to the Nexus API
 */
const makeNexusRequest = async (endpoint: string, apiKey: string): Promise<unknown> => {
  const response = await fetch(`${NEXUS_BASE_URL}${endpoint}`, {
    headers: {
      'Nexus-Api-Key': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid Nexus API key. Get your key from frc.nexus/api');
    } else if (response.status === 403) {
      throw new Error('Nexus API key access denied. Check your key at frc.nexus/api');
    } else if (response.status === 404) {
      throw new Error('Event not found or does not have this data type');
    } else {
      throw new Error(`Nexus API Error: ${response.status} ${response.statusText}`);
    }
  }

  return response.json();
};

/**
 * Get complete pit data for an event (addresses + map)
 * Returns both pit addresses and map data together
 */
export const getNexusPitData = async (eventKey: string, apiKey: string): Promise<{
  addresses: NexusPitAddresses | null;
  map: NexusPitMap | null;
}> => {
  try {
    // Fetch both pit addresses and map data in parallel
    const [addresses, map] = await Promise.allSettled([
      makeNexusRequest(`/event/${eventKey}/pits`, apiKey) as Promise<NexusPitAddresses>,
      makeNexusRequest(`/event/${eventKey}/map`, apiKey) as Promise<NexusPitMap>
    ]);

    // Debug logging
    console.log('Nexus API Results:', {
      addresses: {
        status: addresses.status,
        value: addresses.status === 'fulfilled' ? addresses.value : null,
        reason: addresses.status === 'rejected' ? addresses.reason : null
      },
      map: {
        status: map.status,
        value: map.status === 'fulfilled' ? map.value : null,
        reason: map.status === 'rejected' ? map.reason : null
      }
    });

    return {
      addresses: addresses.status === 'fulfilled' ? addresses.value : null,
      map: map.status === 'fulfilled' ? map.value : null,
    };
  } catch (error) {
    // If there's a general error, still try to return what we can
    console.warn('Error fetching pit data:', error);
    throw error;
  }
};

/**
 * Get pit addresses for an event
 * Returns mapping of team number to pit address (e.g., "A1", "B12")
 */
export const getNexusPitAddresses = async (eventKey: string, apiKey: string): Promise<NexusPitAddresses> => {
  return makeNexusRequest(`/event/${eventKey}/pits`, apiKey) as Promise<NexusPitAddresses>;
};

/**
 * Get pit map data for an event
 * Returns detailed pit layout information for rendering visual maps
 */
export const getNexusPitMap = async (eventKey: string, apiKey: string): Promise<NexusPitMap> => {
  return makeNexusRequest(`/event/${eventKey}/map`, apiKey) as Promise<NexusPitMap>;
};

/**
 * Get live event status
 * Returns current event status including match timing and queuing info
 */
export const getNexusEventStatus = async (eventKey: string, apiKey: string): Promise<NexusEventStatus> => {
  return makeNexusRequest(`/event/${eventKey}`, apiKey) as Promise<NexusEventStatus>;
};

/**
 * Get available events
 * Returns list of events that are registered with Nexus
 */
export const getNexusEvents = async (apiKey: string): Promise<Record<string, unknown>> => {
  return makeNexusRequest('/events', apiKey) as Promise<Record<string, unknown>>;
};

// Local storage utilities for Nexus data
const NEXUS_STORAGE_PREFIX = 'nexus_';

export const storePitData = (eventKey: string, addresses: NexusPitAddresses | null, pitMap: NexusPitMap | null): void => {
  const addressesKey = `${NEXUS_STORAGE_PREFIX}pit_addresses_${eventKey}`;
  const mapKey = `${NEXUS_STORAGE_PREFIX}pit_map_${eventKey}`;
  
  try {
    if (addresses) {
      const addressData = {
        addresses,
        timestamp: Date.now(),
        eventKey
      };
      localStorage.setItem(addressesKey, JSON.stringify(addressData));
    }
    
    if (pitMap) {
      const mapData = {
        pitMap,
        timestamp: Date.now(),
        eventKey
      };
      localStorage.setItem(mapKey, JSON.stringify(mapData));
    }
    
    console.log(`Stored pit data for event ${eventKey}`);
  } catch (error) {
    console.error('Failed to store pit data in localStorage:', error);
    throw new Error('Failed to store pit data');
  }
};

export const getStoredPitData = (eventKey: string): {
  addresses: NexusPitAddresses | null;
  map: NexusPitMap | null;
} => {
  return {
    addresses: getStoredPitAddresses(eventKey),
    map: getStoredPitMap(eventKey)
  };
};

export const storePitAddresses = (eventKey: string, addresses: NexusPitAddresses): void => {
  const storageKey = `${NEXUS_STORAGE_PREFIX}pit_addresses_${eventKey}`;
  const data = {
    addresses,
    timestamp: Date.now(),
    eventKey
  };
  
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    console.log(`Stored pit addresses for event ${eventKey}`);
  } catch (error) {
    console.error('Failed to store pit addresses in localStorage:', error);
    throw new Error('Failed to store pit addresses');
  }
};

export const getStoredPitAddresses = (eventKey: string): NexusPitAddresses | null => {
  const storageKey = `${NEXUS_STORAGE_PREFIX}pit_addresses_${eventKey}`;
  
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    return data.addresses;
  } catch (error) {
    console.error('Failed to retrieve stored pit addresses:', error);
    return null;
  }
};

export const storePitMap = (eventKey: string, pitMap: NexusPitMap): void => {
  const storageKey = `${NEXUS_STORAGE_PREFIX}pit_map_${eventKey}`;
  const data = {
    pitMap,
    timestamp: Date.now(),
    eventKey
  };
  
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    console.log(`Stored pit map for event ${eventKey}`);
  } catch (error) {
    console.error('Failed to store pit map in localStorage:', error);
    throw new Error('Failed to store pit map');
  }
};

export const getStoredPitMap = (eventKey: string): NexusPitMap | null => {
  const storageKey = `${NEXUS_STORAGE_PREFIX}pit_map_${eventKey}`;
  
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    return data.pitMap;
  } catch (error) {
    console.error('Failed to retrieve stored pit map:', error);
    return null;
  }
};

export const clearStoredNexusData = (eventKey: string): void => {
  const addressesKey = `${NEXUS_STORAGE_PREFIX}pit_addresses_${eventKey}`;
  const mapKey = `${NEXUS_STORAGE_PREFIX}pit_map_${eventKey}`;
  const teamsKey = `nexus_event_teams_${eventKey}`;
  
  localStorage.removeItem(addressesKey);
  localStorage.removeItem(mapKey);
  localStorage.removeItem(teamsKey);
  
  console.log(`Cleared Nexus data for event ${eventKey}`);
};

/**
 * Extract team numbers from Nexus pit addresses and store them in the same format as TBA teams
 * This allows using Nexus data for pit assignments without needing a separate TBA API call
 */
export const extractAndStoreTeamsFromPitAddresses = (eventKey: string, addresses: NexusPitAddresses): string[] => {
  // Extract team numbers from pit addresses keys
  const teamNumbers = Object.keys(addresses).map(teamNum => `frc${teamNum}`);
  
  // Store in the same format as TBA teams for compatibility with existing pit assignment system
  const storageKey = `nexus_event_teams_${eventKey}`;
  const teamData = {
    teams: teamNumbers,
    timestamp: Date.now(),
    eventKey,
    source: 'nexus_pit_addresses'
  };
  
  try {
    localStorage.setItem(storageKey, JSON.stringify(teamData));
    console.log(`Stored ${teamNumbers.length} teams from Nexus pit addresses for event ${eventKey}`);
    return teamNumbers;
  } catch (error) {
    console.error('Failed to store Nexus teams in localStorage:', error);
    throw new Error('Failed to store Nexus teams');
  }
};

/**
 * Get teams that were extracted from Nexus pit addresses
 */
export const getStoredNexusTeams = (eventKey: string): string[] | null => {
  const storageKey = `nexus_event_teams_${eventKey}`;
  
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    return data.teams || null;
  } catch (error) {
    console.error('Failed to retrieve stored Nexus teams:', error);
    return null;
  }
};

/**
 * Check if Nexus teams are stored for an event
 */
export const hasStoredNexusTeams = (eventKey: string): boolean => {
  const teams = getStoredNexusTeams(eventKey);
  return teams !== null && teams.length > 0;
};
