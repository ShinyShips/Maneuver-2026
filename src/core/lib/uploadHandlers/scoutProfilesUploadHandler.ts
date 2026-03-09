import { toast } from "sonner";
import { gamificationDB as gameDB, type Scout, type MatchPrediction } from "@/game-template/gamification";
import { normalizeTransferredScoutProfile } from "@/core/lib/normalizeTransferredScoutProfile";
import type { UploadMode } from "./scoutingDataUploadHandler";

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
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

const normalizePrediction = (prediction: unknown): MatchPrediction | null => {
  if (!prediction || typeof prediction !== 'object') {
    return null;
  }

  const value = prediction as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const scoutName = typeof value.scoutName === 'string' ? value.scoutName.trim() : '';
  const eventKey = typeof value.eventKey === 'string' ? value.eventKey.trim() : '';
  const predictedWinnerRaw = typeof value.predictedWinner === 'string' ? value.predictedWinner.trim().toLowerCase() : '';
  const matchNumber = asFiniteNumber(value.matchNumber);
  const timestamp = asFiniteNumber(value.timestamp);
  const verified = asBoolean(value.verified);
  const actualWinnerRaw = typeof value.actualWinner === 'string' ? value.actualWinner.trim().toLowerCase() : null;
  const isCorrect = asBoolean(value.isCorrect);
  const pointsAwarded = asFiniteNumber(value.pointsAwarded);

  if (!id || !scoutName || !eventKey) {
    return null;
  }

  if (predictedWinnerRaw !== 'red' && predictedWinnerRaw !== 'blue') {
    return null;
  }

  if (matchNumber === null || timestamp === null || verified === null) {
    return null;
  }

  const normalized: MatchPrediction = {
    id,
    scoutName,
    eventKey,
    matchNumber,
    predictedWinner: predictedWinnerRaw,
    timestamp,
    verified,
  };

  if (actualWinnerRaw === 'red' || actualWinnerRaw === 'blue' || actualWinnerRaw === 'tie') {
    normalized.actualWinner = actualWinnerRaw;
  }

  if (isCorrect !== null) {
    normalized.isCorrect = isCorrect;
  }

  if (pointsAwarded !== null) {
    normalized.pointsAwarded = pointsAwarded;
  }

  return normalized;
};

export const handleScoutProfilesUpload = async (jsonData: unknown, mode: UploadMode): Promise<void> => {
  if (!jsonData || typeof jsonData !== 'object') {
    toast.error("Invalid scout profiles format");
    return;
  }

  const data = jsonData as { scouts?: unknown; predictions?: unknown };

  if (!Array.isArray(data.scouts) || !Array.isArray(data.predictions)) {
    toast.error("Invalid scout profiles format");
    return;
  }

  const scoutsToImport = data.scouts
    .map((scout) => normalizeTransferredScoutProfile(scout))
    .filter((scout): scout is Scout => !!scout);
  const skippedScoutCount = data.scouts.length - scoutsToImport.length;

  const predictionsToImport = data.predictions
    .map((prediction) => normalizePrediction(prediction))
    .filter((prediction): prediction is MatchPrediction => !!prediction);
  const skippedPredictionCount = data.predictions.length - predictionsToImport.length;

  try {
    let scoutsAdded = 0;
    let scoutsUpdated = 0;
    let predictionsAdded = 0;

    if (mode === 'overwrite') {
      // Clear existing data
      await gameDB.scouts.clear();
      await gameDB.predictions.clear();

      // Add all new data
      await gameDB.scouts.bulkAdd(scoutsToImport);
      await gameDB.predictions.bulkAdd(predictionsToImport);

      scoutsAdded = scoutsToImport.length;
      predictionsAdded = predictionsToImport.length;
    } else {
      // Get existing data for smart merge/append
      const existingScouts = await gameDB.scouts.toArray();
      const existingPredictions = await gameDB.predictions.toArray();

      // Process scouts
      for (const scout of scoutsToImport) {
        const existing = existingScouts.find(s => s.name === scout.name);

        if (existing) {
          if (mode === 'smart-merge') {
            const existingLastUpdated = typeof existing.lastUpdated === 'number' ? existing.lastUpdated : 0;
            const existingStakes = typeof existing.stakes === 'number' ? existing.stakes : 0;
            const existingTotalPredictions = typeof existing.totalPredictions === 'number' ? existing.totalPredictions : 0;
            const existingStakesFromPredictions = typeof existing.stakesFromPredictions === 'number' ? existing.stakesFromPredictions : 0;
            const existingDetailedCommentsCount = typeof existing.detailedCommentsCount === 'number' ? existing.detailedCommentsCount : 0;

            // Only update if new data is newer or has higher values
            const shouldUpdate =
              scout.lastUpdated > existingLastUpdated ||
              scout.stakes > existingStakes ||
              scout.totalPredictions > existingTotalPredictions ||
              scout.stakesFromPredictions > existingStakesFromPredictions ||
              scout.detailedCommentsCount > existingDetailedCommentsCount;

            if (shouldUpdate) {
              await gameDB.scouts.update(scout.name, {
                stakes: Math.max(scout.stakes, existingStakes),
                stakesFromPredictions: Math.max(
                  typeof scout.stakesFromPredictions === 'number' ? scout.stakesFromPredictions : 0,
                  existingStakesFromPredictions
                ),
                totalPredictions: Math.max(scout.totalPredictions, existingTotalPredictions),
                correctPredictions: Math.max(scout.correctPredictions, typeof existing.correctPredictions === 'number' ? existing.correctPredictions : 0),
                currentStreak: scout.lastUpdated > existingLastUpdated ? scout.currentStreak : existing.currentStreak,
                longestStreak: Math.max(scout.longestStreak, typeof existing.longestStreak === 'number' ? existing.longestStreak : 0),
                detailedCommentsCount: Math.max(
                  typeof scout.detailedCommentsCount === 'number' ? scout.detailedCommentsCount : 0,
                  existingDetailedCommentsCount
                ),
                lastUpdated: Math.max(scout.lastUpdated, existingLastUpdated)
              });
              scoutsUpdated++;
            }
          } else if (mode === 'append') {
            // Force update in append mode
            await gameDB.scouts.put(scout);
            scoutsUpdated++;
          }
        } else {
          // Add new scout
          await gameDB.scouts.add(scout);
          scoutsAdded++;
        }
      }

      // Process predictions
      for (const prediction of predictionsToImport) {
        const exists = existingPredictions.some(p => p.id === prediction.id);

        if (!exists) {
          try {
            await gameDB.predictions.add(prediction);
            predictionsAdded++;
          } catch {
            // Duplicate constraint, skip in smart merge
            if (mode === 'append') {
              console.warn(`Skipping duplicate prediction: ${prediction.id}`);
            }
          }
        }
      }
    }

    const message = mode === 'overwrite'
      ? `Overwritten with ${scoutsAdded} scouts and ${predictionsAdded} predictions`
      : `Profiles: ${scoutsAdded} new scouts, ${scoutsUpdated} updated scouts, ${predictionsAdded} predictions imported`;

    if (skippedScoutCount > 0 || skippedPredictionCount > 0) {
      toast.success(message, {
        description: `Skipped ${skippedScoutCount} invalid scouts and ${skippedPredictionCount} invalid predictions.`
      });
      return;
    }

    toast.success(message);
  } catch (error) {
    console.error('Error importing scout profiles:', error);
    toast.error("Failed to import scout profiles");
  }
};
