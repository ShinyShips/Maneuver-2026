import type { Scout } from "@/core/types/gamification";

const asNumber = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
};

/**
 * Normalizes transferred scout profile data from external payloads.
 * Returns null if required identity fields are missing.
 */
export const normalizeTransferredScoutProfile = (value: unknown): Scout | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  if (!name) {
    return null;
  }

  const now = Date.now();
  const createdAt = asNumber(candidate.createdAt, now);
  const parsedLastUpdated = asNumber(candidate.lastUpdated, createdAt);
  const lastUpdated = Math.max(parsedLastUpdated, createdAt);

  return {
    name,
    stakes: asNumber(candidate.stakes, 0),
    stakesFromPredictions: asNumber(candidate.stakesFromPredictions, 0),
    totalPredictions: asNumber(candidate.totalPredictions, 0),
    correctPredictions: asNumber(candidate.correctPredictions, 0),
    currentStreak: asNumber(candidate.currentStreak, 0),
    longestStreak: asNumber(candidate.longestStreak, 0),
    detailedCommentsCount: asNumber(candidate.detailedCommentsCount, 0),
    createdAt,
    lastUpdated,
  };
};
