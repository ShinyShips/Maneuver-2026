import type { MatchPrediction } from '@/game-template/gamification';

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

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return null;
};

/**
 * Normalizes transferred match predictions from external payloads.
 * Returns null if required identity fields or core values are invalid.
 */
export const normalizeTransferredMatchPrediction = (value: unknown): MatchPrediction | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const scoutName = typeof candidate.scoutName === 'string' ? candidate.scoutName.trim() : '';
  const eventKey = typeof candidate.eventKey === 'string' ? candidate.eventKey.trim() : '';
  const predictedWinner = typeof candidate.predictedWinner === 'string'
    ? candidate.predictedWinner.trim().toLowerCase()
    : '';
  const matchNumber = asFiniteNumber(candidate.matchNumber);
  const timestamp = asFiniteNumber(candidate.timestamp);
  const verified = asBoolean(candidate.verified);

  if (!id || !scoutName || !eventKey) {
    return null;
  }

  if (predictedWinner !== 'red' && predictedWinner !== 'blue') {
    return null;
  }

  if (matchNumber === null || timestamp === null || verified === null) {
    return null;
  }

  const prediction: MatchPrediction = {
    id,
    scoutName,
    eventKey,
    matchNumber,
    predictedWinner,
    timestamp,
    verified,
  };

  const actualWinner = typeof candidate.actualWinner === 'string'
    ? candidate.actualWinner.trim().toLowerCase()
    : null;
  if (actualWinner === 'red' || actualWinner === 'blue' || actualWinner === 'tie') {
    prediction.actualWinner = actualWinner;
  }

  const isCorrect = asBoolean(candidate.isCorrect);
  if (isCorrect !== null) {
    prediction.isCorrect = isCorrect;
  }

  const pointsAwarded = asFiniteNumber(candidate.pointsAwarded);
  if (pointsAwarded !== null) {
    prediction.pointsAwarded = pointsAwarded;
  }

  return prediction;
};
