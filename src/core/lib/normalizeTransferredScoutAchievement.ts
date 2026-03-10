import type { ScoutAchievement } from '@/game-template/gamification';

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

/**
 * Normalizes transferred scout achievement records from external payloads.
 * Returns null if required key fields are missing.
 */
export const normalizeTransferredScoutAchievement = (value: unknown): ScoutAchievement | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const scoutName = typeof candidate.scoutName === 'string' ? candidate.scoutName.trim() : '';
  const achievementId = typeof candidate.achievementId === 'string' ? candidate.achievementId.trim() : '';
  const unlockedAt = asFiniteNumber(candidate.unlockedAt);

  if (!scoutName || !achievementId || unlockedAt === null) {
    return null;
  }

  const id = typeof candidate.id === 'string' && candidate.id.trim().length > 0
    ? candidate.id.trim()
    : `${scoutName}_${achievementId}_${unlockedAt}`;

  return {
    id,
    scoutName,
    achievementId,
    unlockedAt,
  };
};
