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
    scoutAchievements!: Table<ScoutAchievement, string>;

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
    const safeIncrement = Math.max(0, incrementBy);
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
    if (!normalizedScoutName) {
        throw new Error('Scout name is required');
    }

    const existingPrediction = await gamificationDB.predictions
        .where('[scoutName+eventKey+matchNumber]')
        .equals([normalizedScoutName, eventKey, matchNumber])
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
        eventKey,
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
    return await gamificationDB.predictions
        .where('[scoutName+eventKey+matchNumber]')
        .equals([scoutName, eventKey, matchNumber])
        .first();
};

/**
 * Get all predictions for a scout
 */
export const getAllPredictionsForScout = async (scoutName: string): Promise<MatchPrediction[]> => {
    return await gamificationDB.predictions
        .where('scoutName')
        .equals(scoutName)
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
    return await gamificationDB.predictions
        .where('eventKey')
        .equals(eventKey)
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
    const existing = await gamificationDB.scoutAchievements
        .where('[scoutName+achievementId]')
        .equals([scoutName, achievementId])
        .first();

    if (!existing) {
        await gamificationDB.scoutAchievements.put({
            id: `${scoutName}_${achievementId}_${Date.now()}`,
            scoutName,
            achievementId,
            unlockedAt: Date.now(),
        });
    }
};

/**
 * Get all achievements for scout
 */
export const getScoutAchievements = async (scoutName: string): Promise<ScoutAchievement[]> => {
    return await gamificationDB.scoutAchievements.where('scoutName').equals(scoutName).toArray();
};

/**
 * Check if scout has achievement
 */
export const hasAchievement = async (
    scoutName: string,
    achievementId: string
): Promise<boolean> => {
    const achievement = await gamificationDB.scoutAchievements
        .where('[scoutName+achievementId]')
        .equals([scoutName, achievementId])
        .first();
    return !!achievement;
};
