import { proxyGetJson } from '@/core/lib/apiProxy';
import type { TBAMatchData } from '@/core/lib/tbaMatchData';

export interface StatboticsEPAMetrics {
  totalPoints: number;
  autoPoints: number;
  teleopPoints: number;
  endgamePoints: number;
  totalFuel: number;
  autoFuel: number;
  teleopFuel: number;
  endgameFuel: number;
  totalTower: number;
  autoTower: number;
  endgameTower: number;
}

interface CachedStatboticsEventPayload {
  schemaVersion?: number;
  eventKey: string;
  fetchedAt: number;
  metricsByTeam: Record<string, StatboticsEPAMetrics>;
}

interface StatboticsTeamEventResponse {
  team?: number;
  event?: string;
  epa?: {
    breakdown?: Record<string, unknown>;
  };
}

const STATBOTICS_STORAGE_PREFIX = 'statbotics_event_epa_';
const STATBOTICS_SCHEMA_VERSION = 2;
const FETCH_CONCURRENCY = 6;

const getStorageKey = (eventKey: string): string => `${STATBOTICS_STORAGE_PREFIX}${eventKey}`;

const parseTeamNumber = (teamKey: string | number): number | null => {
  const parsed = Number.parseInt(String(teamKey), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseTbaTeamKey = (teamKey: string): number | null => {
  return parseTeamNumber(teamKey.replace(/^frc/i, ''));
};

const numberOrZero = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseBreakdownMetrics = (breakdown: Record<string, unknown> | undefined): StatboticsEPAMetrics => {
  const totalTower = numberOrZero(breakdown?.total_tower);
  const autoTower = numberOrZero(breakdown?.auto_tower);
  const endgameTower = numberOrZero(breakdown?.endgame_tower);
  const rawTeleopFuel = numberOrZero(breakdown?.teleop_fuel);
  const rawEndgameFuel = numberOrZero(breakdown?.endgame_fuel);

  return {
    totalPoints: numberOrZero(breakdown?.total_points),
    autoPoints: numberOrZero(breakdown?.auto_points),
    teleopPoints: numberOrZero(breakdown?.teleop_points),
    endgamePoints: numberOrZero(breakdown?.endgame_points),
    totalFuel: numberOrZero(breakdown?.total_fuel),
    autoFuel: numberOrZero(breakdown?.auto_fuel),
    teleopFuel: rawTeleopFuel + rawEndgameFuel,
    endgameFuel: rawEndgameFuel,
    totalTower,
    autoTower,
    endgameTower,
  };
};

const normalizeMetrics = (
  metrics: StatboticsEPAMetrics,
  schemaVersion?: number
): StatboticsEPAMetrics => {
  if (schemaVersion && schemaVersion >= STATBOTICS_SCHEMA_VERSION) {
    return metrics;
  }

  return {
    ...metrics,
    teleopFuel: numberOrZero(metrics.teleopFuel) + numberOrZero(metrics.endgameFuel),
  };
};

const fetchTeamEventEPA = async (teamNumber: number, eventKey: string): Promise<StatboticsEPAMetrics | null> => {
  try {
    const response = await proxyGetJson<StatboticsTeamEventResponse>(
      'statbotics',
      `/team_event/${teamNumber}/${eventKey}`
    );

    return parseBreakdownMetrics(response.epa?.breakdown);
  } catch (error) {
    console.warn(`[Statbotics] Failed to fetch team ${teamNumber} for ${eventKey}:`, error);
    return null;
  }
};

export const getCachedStatboticsEventKeys = (): string[] => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STATBOTICS_STORAGE_PREFIX)) {
        const eventKey = key.replace(STATBOTICS_STORAGE_PREFIX, '');
        if (eventKey) keys.push(eventKey);
      }
    }

    return [...new Set(keys)].sort();
  } catch {
    return [];
  }
};

export const clearCachedEventStatboticsEPA = (eventKey: string): void => {
  try {
    localStorage.removeItem(getStorageKey(eventKey));
  } catch (error) {
    console.warn(`[Statbotics] Failed to clear cached data for ${eventKey}:`, error);
  }
};

export const getCachedEventStatboticsEPA = (eventKey: string): Map<number, StatboticsEPAMetrics> => {
  try {
    const raw = localStorage.getItem(getStorageKey(eventKey));
    if (!raw) return new Map();

    const parsed = JSON.parse(raw) as CachedStatboticsEventPayload;
    if (!parsed || !parsed.metricsByTeam || typeof parsed.metricsByTeam !== 'object') {
      return new Map();
    }

    return new Map(
      Object.entries(parsed.metricsByTeam)
        .map(([teamNumber, metrics]) => {
          const parsedTeam = parseTeamNumber(teamNumber);
          return parsedTeam ? [parsedTeam, normalizeMetrics(metrics, parsed.schemaVersion)] as const : null;
        })
        .filter((entry): entry is readonly [number, StatboticsEPAMetrics] => entry !== null)
    );
  } catch (error) {
    console.warn('[Statbotics] Failed to parse cached EPA data:', error);
    return new Map();
  }
};

export const getCachedStatboticsFetchedAt = (eventKey: string): number | null => {
  try {
    const raw = localStorage.getItem(getStorageKey(eventKey));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedStatboticsEventPayload;
    return Number.isFinite(parsed?.fetchedAt) ? parsed.fetchedAt : null;
  } catch {
    return null;
  }
};

export const extractTeamsFromMatches = (matches: TBAMatchData[]): number[] => {
  const teams = new Set<number>();

  for (const match of matches) {
    for (const teamKey of match.alliances.red.team_keys) {
      const teamNumber = parseTeamNumber(String(teamKey).replace(/^frc/i, ''));
      if (teamNumber) teams.add(teamNumber);
    }

    for (const teamKey of match.alliances.blue.team_keys) {
      const teamNumber = parseTeamNumber(String(teamKey).replace(/^frc/i, ''));
      if (teamNumber) teams.add(teamNumber);
    }
  }

  return [...teams].sort((a, b) => a - b);
};

export const fetchEventTeamNumbersFromTBA = async (
  eventKey: string,
  apiKey: string = ''
): Promise<number[]> => {
  const teamKeys = await proxyGetJson<string[]>(
    'tba',
    `/event/${eventKey}/teams/keys`,
    { apiKeyOverride: apiKey || undefined }
  );

  const teams = teamKeys
    .map(parseTbaTeamKey)
    .filter((team): team is number => team !== null);

  return [...new Set(teams)].sort((a, b) => a - b);
};

export const fetchAndCacheEventStatboticsEPA = async (
  eventKey: string,
  teamNumbers: number[]
): Promise<Map<number, StatboticsEPAMetrics>> => {
  const uniqueTeams = [...new Set(teamNumbers.filter((team) => Number.isFinite(team) && team > 0))];
  const metricsByTeam = new Map<number, StatboticsEPAMetrics>();

  if (uniqueTeams.length === 0) {
    localStorage.setItem(
      getStorageKey(eventKey),
      JSON.stringify({
        schemaVersion: STATBOTICS_SCHEMA_VERSION,
        eventKey,
        fetchedAt: Date.now(),
        metricsByTeam: {}
      } satisfies CachedStatboticsEventPayload)
    );
    return metricsByTeam;
  }

  const queue = [...uniqueTeams];

  const workers = Array.from({ length: Math.min(FETCH_CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const teamNumber = queue.shift();
      if (!teamNumber) continue;

      const metrics = await fetchTeamEventEPA(teamNumber, eventKey);
      if (metrics) {
        metricsByTeam.set(teamNumber, metrics);
      }
    }
  });

  await Promise.all(workers);

  const payload: CachedStatboticsEventPayload = {
    schemaVersion: STATBOTICS_SCHEMA_VERSION,
    eventKey,
    fetchedAt: Date.now(),
    metricsByTeam: Object.fromEntries(metricsByTeam.entries()),
  };

  localStorage.setItem(getStorageKey(eventKey), JSON.stringify(payload));
  return metricsByTeam;
};
