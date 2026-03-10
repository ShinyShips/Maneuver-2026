/**
 * Scout Gamification Database
 * 
 * OPTIONAL FEATURE: Provides Dexie database for gamification features.
 * To disable gamification, don't import this module.
 */

import Dexie, { type Table } from 'dexie';
import type { Scout, MatchPrediction, ScoutAchievement } from './types';

/**
 * Scout profile database - gamification, predictions, achievements
 */
export class ScoutGamificationDB extends Dexie {
    scouts!: Table<Scout, string>;
    predictions!: Table<MatchPrediction, string>;
    scoutAchievements!: Table<ScoutAchievement, [string, string]>;

    constructor() {
        super('ScoutGamificationDB');

        // Version 1: Initial schema
        this.version(1).stores({
            scouts: 'name, stakes, totalPredictions, correctPredictions, currentStreak, longestStreak, lastUpdated',
            predictions: 'id, scoutName, eventKey, matchNumber, predictedWinner, timestamp, verified, [scoutName+eventKey+matchNumber]',
            scoutAchievements: '[scoutName+achievementId], scoutName, achievementId, unlockedAt'
        });

        // Version 2: Add stakesFromPredictions field
        this.version(2).stores({
            scouts: 'name, stakes, stakesFromPredictions, totalPredictions, correctPredictions, currentStreak, longestStreak, lastUpdated',
            predictions: 'id, scoutName, eventKey, matchNumber, predictedWinner, timestamp, verified, [scoutName+eventKey+matchNumber]',
            scoutAchievements: '[scoutName+achievementId], scoutName, achievementId, unlockedAt'
        }).upgrade(tx => {
            return tx.table('scouts').toCollection().modify(scout => {
                scout.stakesFromPredictions = scout.stakes || 0;
            });
        });

        // Version 3: Add detailedCommentsCount field
        this.version(3).stores({
            scouts: 'name, stakes, stakesFromPredictions, totalPredictions, correctPredictions, currentStreak, longestStreak, lastUpdated',
            predictions: 'id, scoutName, eventKey, matchNumber, predictedWinner, timestamp, verified, [scoutName+eventKey+matchNumber]',
            scoutAchievements: '[scoutName+achievementId], scoutName, achievementId, unlockedAt'
        }).upgrade(tx => {
            return tx.table('scouts').toCollection().modify(scout => {
                scout.detailedCommentsCount = typeof scout.detailedCommentsCount === 'number'
                    ? scout.detailedCommentsCount
                    : 0;
            });
        });

        // Version 4: Normalize scoutName keys in predictions/achievements to preserve lookups.
        this.version(4).stores({
            scouts: 'name, stakes, stakesFromPredictions, totalPredictions, correctPredictions, currentStreak, longestStreak, lastUpdated',
            predictions: 'id, scoutName, eventKey, matchNumber, predictedWinner, timestamp, verified, [scoutName+eventKey+matchNumber]',
            scoutAchievements: '[scoutName+achievementId], scoutName, achievementId, unlockedAt'
        }).upgrade(async tx => {
            const scoutTable = tx.table('scouts');
            const predictionTable = tx.table('predictions');
            const achievementTable = tx.table('scoutAchievements');

            const asNonNegativeNumber = (value: unknown): number => {
                if (typeof value === 'number' && Number.isFinite(value)) {
                    return Math.max(0, value);
                }
                return 0;
            };

            const asTimestampOrZero = (value: unknown): number => {
                if (typeof value === 'number' && Number.isFinite(value)) {
                    return value;
                }
                return 0;
            };

            // Normalize and merge scout primary keys so historical whitespace variants collapse into one profile.
            const scouts = (await scoutTable.toArray()) as Scout[];
            const mergedScoutsByName = new Map<string, Scout>();

            for (const scout of scouts) {
                const normalizedScoutName = typeof scout.name === 'string' ? scout.name.trim() : '';
                if (!normalizedScoutName) {
                    continue;
                }

                const normalizedScout: Scout = {
                    ...scout,
                    name: normalizedScoutName,
                    stakes: asNonNegativeNumber(scout.stakes),
                    stakesFromPredictions: asNonNegativeNumber(scout.stakesFromPredictions),
                    totalPredictions: asNonNegativeNumber(scout.totalPredictions),
                    correctPredictions: asNonNegativeNumber(scout.correctPredictions),
                    currentStreak: asNonNegativeNumber(scout.currentStreak),
                    longestStreak: asNonNegativeNumber(scout.longestStreak),
                    detailedCommentsCount: asNonNegativeNumber(scout.detailedCommentsCount),
                    createdAt: asTimestampOrZero(scout.createdAt),
                    lastUpdated: asTimestampOrZero(scout.lastUpdated),
                };

                const existing = mergedScoutsByName.get(normalizedScoutName);
                if (!existing) {
                    mergedScoutsByName.set(normalizedScoutName, normalizedScout);
                    continue;
                }

                mergedScoutsByName.set(normalizedScoutName, {
                    ...existing,
                    name: normalizedScoutName,
                    stakes: existing.stakes + normalizedScout.stakes,
                    stakesFromPredictions: existing.stakesFromPredictions + normalizedScout.stakesFromPredictions,
                    totalPredictions: existing.totalPredictions + normalizedScout.totalPredictions,
                    correctPredictions: existing.correctPredictions + normalizedScout.correctPredictions,
                    currentStreak: Math.max(existing.currentStreak, normalizedScout.currentStreak),
                    longestStreak: Math.max(existing.longestStreak, normalizedScout.longestStreak),
                    detailedCommentsCount: existing.detailedCommentsCount + normalizedScout.detailedCommentsCount,
                    createdAt: Math.min(existing.createdAt, normalizedScout.createdAt),
                    lastUpdated: Math.max(existing.lastUpdated, normalizedScout.lastUpdated),
                });
            }

            await scoutTable.clear();
            if (mergedScoutsByName.size > 0) {
                await scoutTable.bulkPut(Array.from(mergedScoutsByName.values()) as never[]);
            }

            const getAchievementPrimaryKey = (achievement: ScoutAchievement): [string, string] => [
                achievement.scoutName,
                achievement.achievementId,
            ];
            const serializeAchievementPrimaryKey = (primaryKey: [string, string]): string =>
                `${primaryKey[0]}\u0000${primaryKey[1]}`;

            const predictions = (await predictionTable.toArray()) as MatchPrediction[];
            const winningPredictionByKey = new Map<string, MatchPrediction>();

            for (const prediction of predictions) {
                const normalizedScoutName = typeof prediction.scoutName === 'string' ? prediction.scoutName.trim() : '';
                const normalizedEventKey = typeof prediction.eventKey === 'string' ? prediction.eventKey.trim() : '';

                if (!normalizedScoutName || !normalizedEventKey) {
                    continue;
                }

                const compositeKey = `${normalizedScoutName}\u0000${normalizedEventKey}\u0000${prediction.matchNumber}`;
                const candidate: MatchPrediction = {
                    ...prediction,
                    scoutName: normalizedScoutName,
                    eventKey: normalizedEventKey,
                };

                const existing = winningPredictionByKey.get(compositeKey);
                const candidateTimestamp = typeof candidate.timestamp === 'number' ? candidate.timestamp : 0;
                const existingTimestamp = typeof existing?.timestamp === 'number' ? existing.timestamp : 0;

                if (!existing || candidateTimestamp >= existingTimestamp) {
                    winningPredictionByKey.set(compositeKey, candidate);
                }
            }

            for (const prediction of predictions) {
                const normalizedScoutName = typeof prediction.scoutName === 'string' ? prediction.scoutName.trim() : '';
                const normalizedEventKey = typeof prediction.eventKey === 'string' ? prediction.eventKey.trim() : '';

                if (!normalizedScoutName || !normalizedEventKey) {
                    await predictionTable.delete(prediction.id);
                    continue;
                }

                const compositeKey = `${normalizedScoutName}\u0000${normalizedEventKey}\u0000${prediction.matchNumber}`;
                const winner = winningPredictionByKey.get(compositeKey);

                if (!winner || winner.id !== prediction.id) {
                    await predictionTable.delete(prediction.id);
                    continue;
                }

                if (prediction.scoutName !== normalizedScoutName || prediction.eventKey !== normalizedEventKey) {
                    await predictionTable.put({
                        ...prediction,
                        scoutName: normalizedScoutName,
                        eventKey: normalizedEventKey,
                    });
                }
            }

            const achievements = (await achievementTable.toArray()) as ScoutAchievement[];
            const winningAchievementByKey = new Map<string, {
                row: ScoutAchievement;
                sourcePrimaryKey: [string, string];
            }>();

            for (const achievement of achievements) {
                const normalizedScoutName = typeof achievement.scoutName === 'string' ? achievement.scoutName.trim() : '';
                if (!normalizedScoutName) {
                    continue;
                }

                const compositeKey = `${normalizedScoutName}\u0000${achievement.achievementId}`;
                const candidate: ScoutAchievement = {
                    ...achievement,
                    scoutName: normalizedScoutName,
                };
                const existing = winningAchievementByKey.get(compositeKey)?.row;
                const candidateUnlockedAt = typeof candidate.unlockedAt === 'number' ? candidate.unlockedAt : Number.MAX_SAFE_INTEGER;
                const existingUnlockedAt = typeof existing?.unlockedAt === 'number' ? existing.unlockedAt : Number.MAX_SAFE_INTEGER;

                if (!existing || candidateUnlockedAt <= existingUnlockedAt) {
                    winningAchievementByKey.set(compositeKey, {
                        row: candidate,
                        sourcePrimaryKey: getAchievementPrimaryKey(achievement),
                    });
                }
            }

            for (const achievement of achievements) {
                const sourcePrimaryKey = getAchievementPrimaryKey(achievement);
                const normalizedScoutName = typeof achievement.scoutName === 'string' ? achievement.scoutName.trim() : '';
                if (!normalizedScoutName) {
                    await achievementTable.delete(sourcePrimaryKey);
                    continue;
                }

                const compositeKey = `${normalizedScoutName}\u0000${achievement.achievementId}`;
                const winner = winningAchievementByKey.get(compositeKey);
                const isWinner = winner
                    ? serializeAchievementPrimaryKey(winner.sourcePrimaryKey) === serializeAchievementPrimaryKey(sourcePrimaryKey)
                    : false;

                if (!winner || !isWinner) {
                    await achievementTable.delete(sourcePrimaryKey);
                    continue;
                }

                if (achievement.scoutName !== normalizedScoutName) {
                    // Compound primary key changes when scoutName changes, so delete old key first.
                    await achievementTable.delete(sourcePrimaryKey);
                    await achievementTable.put({
                        ...achievement,
                        scoutName: normalizedScoutName,
                    });
                }
            }
        });
    }
}

// Singleton database instance
export const gamificationDB = new ScoutGamificationDB();

// Open database
gamificationDB.open().catch(error => {
    console.error('Failed to open ScoutGamificationDB:', error);
});

// ============================================================================
// SCOUT PROFILE OPERATIONS
// ============================================================================

const normalizeScoutKey = (name: string): string => name.trim();
const normalizeEventKey = (eventKey: string): string => eventKey.trim();

/**
 * Get or create scout profile
 */
export const getOrCreateScout = async (name: string): Promise<Scout> => {
    const key = normalizeScoutKey(name);
    if (!key) {
        throw new Error('Scout name is required');
    }

    const existingScout = await gamificationDB.scouts.get(key);

    if (existingScout) {
        existingScout.lastUpdated = Date.now();
        await gamificationDB.scouts.put(existingScout);
        return existingScout;
    }

    const newScout: Scout = {
        name: key,
        stakes: 0,
        stakesFromPredictions: 0,
        totalPredictions: 0,
        correctPredictions: 0,
        currentStreak: 0,
        longestStreak: 0,
        detailedCommentsCount: 0,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
    };

    await gamificationDB.scouts.put(newScout);
    return newScout;
};

/**
 * Get scout profile
 */
export const getScout = async (name: string): Promise<Scout | undefined> => {
    const key = normalizeScoutKey(name);
    if (!key) return undefined;
    return await gamificationDB.scouts.get(key);
};

/**
 * Get all scouts (ordered by stakes descending)
 */
export const getAllScouts = async (): Promise<Scout[]> => {
    return await gamificationDB.scouts.orderBy('stakes').reverse().toArray();
};

/**
 * Update scout stakes (add points)
 */
export const updateScoutPoints = async (name: string, pointsToAdd: number): Promise<void> => {
    const key = normalizeScoutKey(name);
    if (!key) return;
    const scout = await gamificationDB.scouts.get(key);
    if (scout) {
        scout.stakes += pointsToAdd;
        scout.lastUpdated = Date.now();
        await gamificationDB.scouts.put(scout);
    }
};

/**
 * Update scout statistics
 */
export const updateScoutStats = async (
    name: string,
    newStakes: number,
    correctPredictions: number,
    totalPredictions: number,
    currentStreak?: number,
    longestStreak?: number,
    additionalStakesFromPredictions: number = 0
): Promise<void> => {
    const key = normalizeScoutKey(name);
    if (!key) return;
    const scout = await gamificationDB.scouts.get(key);
    if (scout) {
        scout.stakes = newStakes;
        scout.stakesFromPredictions += additionalStakesFromPredictions;
        scout.correctPredictions = correctPredictions;
        scout.totalPredictions = totalPredictions;

        if (currentStreak !== undefined) {
            scout.currentStreak = currentStreak;
        }
        if (longestStreak !== undefined) {
            scout.longestStreak = Math.max(scout.longestStreak, longestStreak);
        }

        scout.lastUpdated = Date.now();
        await gamificationDB.scouts.put(scout);
    }
};

/**
 * Increment scout's substantive comment count
 */
export const incrementScoutDetailedComments = async (name: string, incrementBy: number = 1): Promise<void> => {
    const key = normalizeScoutKey(name);
    const safeIncrement = Number.isFinite(incrementBy)
        ? Math.max(0, Math.trunc(incrementBy))
        : 0;
    if (!key || safeIncrement === 0) {
        return;
    }

    await gamificationDB.transaction('rw', gamificationDB.scouts, async () => {
        await gamificationDB.scouts
            .where('name')
            .equals(key)
            .modify((scout) => {
                const currentCount = typeof scout.detailedCommentsCount === 'number'
                    ? scout.detailedCommentsCount
                    : 0;

                scout.detailedCommentsCount = currentCount + safeIncrement;
                scout.lastUpdated = Date.now();
            });
    });
};

/**
 * Delete scout profile
 */
export const deleteScout = async (name: string): Promise<void> => {
    const key = normalizeScoutKey(name);
    if (!key) return;
    await gamificationDB.scouts.delete(key);
};

/**
 * Clear all gamification data
 */
export const clearGamificationData = async (): Promise<void> => {
    await gamificationDB.scouts.clear();
    await gamificationDB.predictions.clear();
    await gamificationDB.scoutAchievements.clear();
};

// ============================================================================
// MATCH PREDICTION OPERATIONS
// ============================================================================

/**
 * Create or update match prediction
 */
export const createMatchPrediction = async (
    scoutName: string,
    eventKey: string,
    matchNumber: number,
    predictedWinner: 'red' | 'blue'
): Promise<MatchPrediction> => {
    const normalizedScoutName = normalizeScoutKey(scoutName);
    const normalizedEventKey = normalizeEventKey(eventKey);
    if (!normalizedScoutName) {
        throw new Error('Scout name is required');
    }
    if (!normalizedEventKey) {
        throw new Error('Event key is required');
    }

    const existingPrediction = await gamificationDB.predictions
        .where('[scoutName+eventKey+matchNumber]')
        .equals([normalizedScoutName, normalizedEventKey, matchNumber])
        .first();

    if (existingPrediction) {
        existingPrediction.predictedWinner = predictedWinner;
        existingPrediction.timestamp = Date.now();
        await gamificationDB.predictions.put(existingPrediction);
        return existingPrediction;
    }

    const prediction: MatchPrediction = {
        id: `prediction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        scoutName: normalizedScoutName,
        eventKey: normalizedEventKey,
        matchNumber,
        predictedWinner,
        timestamp: Date.now(),
        verified: false
    };

    await gamificationDB.predictions.put(prediction);

    // Ensure scout exists
    await getOrCreateScout(normalizedScoutName);

    return prediction;
};

/**
 * Get prediction for specific match
 */
export const getPredictionForMatch = async (
    scoutName: string,
    eventKey: string,
    matchNumber: number
): Promise<MatchPrediction | undefined> => {
    const normalizedScoutName = normalizeScoutKey(scoutName);
    const normalizedEventKey = normalizeEventKey(eventKey);
    if (!normalizedScoutName) {
        return undefined;
    }
    if (!normalizedEventKey) {
        return undefined;
    }

    return await gamificationDB.predictions
        .where('[scoutName+eventKey+matchNumber]')
        .equals([normalizedScoutName, normalizedEventKey, matchNumber])
        .first();
};

/**
 * Get all predictions for a scout
 */
export const getAllPredictionsForScout = async (scoutName: string): Promise<MatchPrediction[]> => {
    const normalizedScoutName = normalizeScoutKey(scoutName);
    if (!normalizedScoutName) {
        return [];
    }

    return await gamificationDB.predictions
        .where('scoutName')
        .equals(normalizedScoutName)
        .reverse()
        .toArray();
};

/**
 * Get all predictions for a match
 */
export const getAllPredictionsForMatch = async (
    eventKey: string,
    matchNumber: number
): Promise<MatchPrediction[]> => {
    const normalizedEventKey = normalizeEventKey(eventKey);
    if (!normalizedEventKey) {
        return [];
    }

    return await gamificationDB.predictions
        .where('eventKey')
        .equals(normalizedEventKey)
        .and(prediction => prediction.matchNumber === matchNumber)
        .toArray();
};

/**
 * Mark prediction as verified
 */
export const markPredictionAsVerified = async (predictionId: string): Promise<void> => {
    await gamificationDB.predictions.update(predictionId, { verified: true });
};

// ============================================================================
// ACHIEVEMENT OPERATIONS
// ============================================================================

/**
 * Unlock achievement for scout
 */
export const unlockAchievement = async (
    scoutName: string,
    achievementId: string
): Promise<void> => {
    const normalizedScoutName = normalizeScoutKey(scoutName);
    if (!normalizedScoutName) {
        return;
    }

    const existing = await gamificationDB.scoutAchievements
        .where('[scoutName+achievementId]')
        .equals([normalizedScoutName, achievementId])
        .first();

    if (!existing) {
        await gamificationDB.scoutAchievements.put({
            id: `${normalizedScoutName}_${achievementId}_${Date.now()}`,
            scoutName: normalizedScoutName,
            achievementId,
            unlockedAt: Date.now(),
        });
    }
};

/**
 * Get all achievements for scout
 */
export const getScoutAchievements = async (scoutName: string): Promise<ScoutAchievement[]> => {
    const normalizedScoutName = normalizeScoutKey(scoutName);
    if (!normalizedScoutName) {
        return [];
    }

    return await gamificationDB.scoutAchievements
        .where('scoutName')
        .equals(normalizedScoutName)
        .toArray();
};

/**
 * Check if scout has achievement
 */
export const hasAchievement = async (
    scoutName: string,
    achievementId: string
): Promise<boolean> => {
    const normalizedScoutName = normalizeScoutKey(scoutName);
    if (!normalizedScoutName) {
        return false;
    }

    const achievement = await gamificationDB.scoutAchievements
        .where('[scoutName+achievementId]')
        .equals([normalizedScoutName, achievementId])
        .first();
    return !!achievement;
};
