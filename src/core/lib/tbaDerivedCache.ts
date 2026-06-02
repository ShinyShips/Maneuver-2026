import { getCacheMetadata } from "@/core/lib/tbaCache";
import type { RollingFuelMoprRatings } from "@/game-template/rollingFuelOpr";
import type { FuelOPRHybridMode } from "@/game-template/fuelOpr";
import type { TBAMatchData } from "@/core/lib/tbaMatchData";
import { calculateFuelOPR } from "@/game-template/fuelOpr";
import { calculateRollingFuelMoprRatings } from "@/game-template/rollingFuelOpr";

export type FuelOprTeamEntry = {
  autoFuelOPR: number;
  teleopFuelOPR: number;
  totalFuelOPR: number;
  lambda: number;
};

type FuelOprCachePayload = {
  eventKey: string;
  sourceLastFetchedAt: number;
  matchCount: number;
  includePlayoffs: boolean;
  teams: Array<{
    teamNumber: number;
    autoFuelOPR: number;
    teleopFuelOPR: number;
    totalFuelOPR: number;
    lambda: number;
  }>;
};

type RollingRatingsCachePayload = {
  eventKey: string;
  sourceLastFetchedAt: number;
  matchCount: number;
  includePlayoffs: boolean;
  entries: Array<{
    matchTeamKey: string;
    fixedTotalMopr: number;
    adaptiveTotalMopr: number;
    matchesProcessed: number;
    adaptiveLambda: number;
    adaptiveMode: FuelOPRHybridMode;
  }>;
};

const FUEL_OPR_CACHE_PREFIX = "tba_derived_fuel_opr_";
const ROLLING_RATINGS_CACHE_PREFIX = "tba_derived_rolling_mopr_";

function getFuelOprCacheKey(eventKey: string, includePlayoffs: boolean): string {
  return `${FUEL_OPR_CACHE_PREFIX}${eventKey}_${includePlayoffs ? "with_playoffs" : "quals_only"}`;
}

function getRollingRatingsCacheKey(eventKey: string, includePlayoffs: boolean): string {
  return `${ROLLING_RATINGS_CACHE_PREFIX}${eventKey}_${includePlayoffs ? "with_playoffs" : "quals_only"}`;
}

async function isPayloadFresh(
  eventKey: string,
  sourceLastFetchedAt: number,
  matchCount: number
): Promise<boolean> {
  const metadata = await getCacheMetadata(eventKey);
  if (!metadata) {
    return false;
  }

  return metadata.lastFetchedAt === sourceLastFetchedAt && metadata.matchCount === matchCount;
}

export async function getCachedFuelOprByEvent(
  eventKey: string,
  includePlayoffs: boolean
): Promise<Map<number, FuelOprTeamEntry> | null> {
  const raw = localStorage.getItem(getFuelOprCacheKey(eventKey, includePlayoffs));
  if (!raw) {
    return null;
  }

  try {
    const payload = JSON.parse(raw) as FuelOprCachePayload;
    const fresh = await isPayloadFresh(eventKey, payload.sourceLastFetchedAt, payload.matchCount);
    if (!fresh) {
      localStorage.removeItem(getFuelOprCacheKey(eventKey, includePlayoffs));
      return null;
    }

    return new Map(
      payload.teams.map((team) => [
        team.teamNumber,
        {
          autoFuelOPR: team.autoFuelOPR,
          teleopFuelOPR: team.teleopFuelOPR,
          totalFuelOPR: team.totalFuelOPR,
          lambda: team.lambda,
        },
      ])
    );
  } catch (error) {
    console.warn("Failed to parse cached fuel OPR payload:", error);
    localStorage.removeItem(getFuelOprCacheKey(eventKey, includePlayoffs));
    return null;
  }
}

export async function storeCachedFuelOprByEvent(
  eventKey: string,
  includePlayoffs: boolean,
  matchCount: number,
  teamsByNumber: Map<number, FuelOprTeamEntry>
): Promise<void> {
  const metadata = await getCacheMetadata(eventKey);
  if (!metadata) {
    return;
  }

  const payload: FuelOprCachePayload = {
    eventKey,
    sourceLastFetchedAt: metadata.lastFetchedAt,
    matchCount,
    includePlayoffs,
    teams: Array.from(teamsByNumber.entries()).map(([teamNumber, team]) => ({
      teamNumber,
      autoFuelOPR: team.autoFuelOPR,
      teleopFuelOPR: team.teleopFuelOPR,
      totalFuelOPR: team.totalFuelOPR,
      lambda: team.lambda,
    })),
  };

  localStorage.setItem(getFuelOprCacheKey(eventKey, includePlayoffs), JSON.stringify(payload));
}

export async function getCachedRollingRatingsByEvent(
  eventKey: string,
  includePlayoffs: boolean
): Promise<Map<string, RollingFuelMoprRatings> | null> {
  const raw = localStorage.getItem(getRollingRatingsCacheKey(eventKey, includePlayoffs));
  if (!raw) {
    return null;
  }

  try {
    const payload = JSON.parse(raw) as RollingRatingsCachePayload;
    const fresh = await isPayloadFresh(eventKey, payload.sourceLastFetchedAt, payload.matchCount);
    if (!fresh) {
      localStorage.removeItem(getRollingRatingsCacheKey(eventKey, includePlayoffs));
      return null;
    }

    return new Map(
      payload.entries.map((entry) => [
        entry.matchTeamKey,
        {
          fixedTotalMopr: entry.fixedTotalMopr,
          adaptiveTotalMopr: entry.adaptiveTotalMopr,
          matchesProcessed: entry.matchesProcessed,
          adaptiveLambda: entry.adaptiveLambda,
          adaptiveMode: entry.adaptiveMode,
        },
      ])
    );
  } catch (error) {
    console.warn("Failed to parse cached rolling ratings payload:", error);
    localStorage.removeItem(getRollingRatingsCacheKey(eventKey, includePlayoffs));
    return null;
  }
}

export async function storeCachedRollingRatingsByEvent(
  eventKey: string,
  includePlayoffs: boolean,
  matchCount: number,
  ratingsByMatchTeam: Map<string, RollingFuelMoprRatings>
): Promise<void> {
  const metadata = await getCacheMetadata(eventKey);
  if (!metadata) {
    return;
  }

  const payload: RollingRatingsCachePayload = {
    eventKey,
    sourceLastFetchedAt: metadata.lastFetchedAt,
    matchCount,
    includePlayoffs,
    entries: Array.from(ratingsByMatchTeam.entries()).map(([matchTeamKey, values]) => ({
      matchTeamKey,
      fixedTotalMopr: values.fixedTotalMopr,
      adaptiveTotalMopr: values.adaptiveTotalMopr,
      matchesProcessed: values.matchesProcessed,
      adaptiveLambda: values.adaptiveLambda,
      adaptiveMode: values.adaptiveMode,
    })),
  };

  localStorage.setItem(getRollingRatingsCacheKey(eventKey, includePlayoffs), JSON.stringify(payload));
}

export function clearDerivedTbaCache(eventKey?: string): void {
  const prefixes = [FUEL_OPR_CACHE_PREFIX, ROLLING_RATINGS_CACHE_PREFIX];

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (!key) {
      continue;
    }

    const matchesPrefix = prefixes.some((prefix) => key.startsWith(prefix));
    const matchesEvent = !eventKey || key.includes(`${eventKey}_`);
    if (matchesPrefix && matchesEvent) {
      localStorage.removeItem(key);
    }
  }
}

export async function primeDerivedTbaCacheForEvent(
  eventKey: string,
  matches: TBAMatchData[]
): Promise<void> {
  if (!eventKey || matches.length < 2) {
    return;
  }

  for (const includePlayoffs of [false, true]) {
    const fuelCached = await getCachedFuelOprByEvent(eventKey, includePlayoffs);
    if (!fuelCached) {
      const fixed = calculateFuelOPR(matches, {
        ridgeLambda: 0.3,
        includePlayoffs,
        nonNegative: false,
      });

      const teamsByNumber = new Map(
        fixed.teams.map((team) => [
          team.teamNumber,
          {
            autoFuelOPR: team.autoFuelOPR,
            teleopFuelOPR: team.teleopFuelOPR,
            totalFuelOPR: team.totalFuelOPR,
            lambda: 0.3,
          },
        ] as const)
      );

      await storeCachedFuelOprByEvent(eventKey, includePlayoffs, matches.length, teamsByNumber);
    }

    const rollingCached = await getCachedRollingRatingsByEvent(eventKey, includePlayoffs);
    if (!rollingCached) {
      const rolling = calculateRollingFuelMoprRatings(matches, {
        includePlayoffs,
        fixedLambda: 0.3,
      });

      await storeCachedRollingRatingsByEvent(eventKey, includePlayoffs, matches.length, rolling);
    }
  }
}
