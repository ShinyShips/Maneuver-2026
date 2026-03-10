/**
 * Scout Gamification Wrapper
 * 
 * Re-exports gamification functionality from game-template for convenience.
 * This is a thin wrapper that adds achievement checking on top of core gamification.
 * 
 * NOTE: Gamification is OPTIONAL. If teams don't want to use it, they should
 * not import from this module or the game-template/gamification module.
 */

import type { Scout } from '@/game-template/gamification';
import type { Achievement } from './achievementTypes';
import { isSubstantiveComment } from './commentValidation';
import {
  STAKE_VALUES,
  calculateStreakBonus,
  calculateAccuracy,
  getOrCreateScout,
  getScout,
  getAllScouts,
  updateScoutPoints,
  updateScoutStats,
  incrementScoutDetailedComments,
  updateScoutWithPredictionResult,
  getLeaderboard,
  createMatchPrediction,
  getPredictionForMatch,
  getAllPredictionsForScout,
  getAllPredictionsForMatch,
  markPredictionAsVerified,
  deleteScout,
  clearGamificationData,
} from '@/game-template/gamification';
import { checkForNewAchievements } from './achievementUtils';

// Re-export stake values
export { STAKE_VALUES, calculateStreakBonus };

const normalizeScoutName = (name: string): string => name.trim();

// Get or create a scout by name (linked to sidebar selection)
export const getOrCreateScoutByName = async (name: string): Promise<Scout> => {
  return await getOrCreateScout(normalizeScoutName(name));
};

// Re-export accuracy calculation
export { calculateAccuracy };

// Re-export leaderboard
export { getLeaderboard };

// Wrapper function to update scout stats with achievement checking
export const updateScoutStatsWithAchievements = async (
  name: string,
  newStakes: number,
  correctPredictions: number,
  totalPredictions: number,
  currentStreak?: number,
  longestStreak?: number
): Promise<{ newAchievements: Achievement[] }> => {
  const normalizedScoutName = normalizeScoutName(name);
  await updateScoutStats(
    normalizedScoutName,
    newStakes,
    correctPredictions,
    totalPredictions,
    currentStreak,
    longestStreak
  );
  const newAchievements = await checkForNewAchievements(normalizedScoutName);
  return { newAchievements };
};

// Wrapper function to update scout with prediction result and achievement checking
export const updateScoutWithPredictionAndAchievements = async (
  name: string,
  isCorrect: boolean,
  basePoints: number,
  eventKey: string,
  matchNumber: number
): Promise<{ newAchievements: Achievement[] }> => {
  const normalizedScoutName = normalizeScoutName(name);
  await updateScoutWithPredictionResult(normalizedScoutName, isCorrect, basePoints, eventKey, matchNumber);
  const newAchievements = await checkForNewAchievements(normalizedScoutName);
  return { newAchievements };
};

export const recordMatchCommentForAchievements = async (
  scoutName: string,
  comment?: string
): Promise<{ newAchievements: Achievement[] }> => {
  const trimmedScoutName = normalizeScoutName(scoutName);
  const normalizedComment = (comment ?? '').trim();

  if (!trimmedScoutName || !isSubstantiveComment(normalizedComment)) {
    return { newAchievements: [] };
  }

  await getOrCreateScout(trimmedScoutName);
  await incrementScoutDetailedComments(trimmedScoutName, 1);
  const newAchievements = await checkForNewAchievements(trimmedScoutName);
  return { newAchievements };
};

// Re-export all gamification functions for convenience
export {
  getOrCreateScout,
  getScout,
  getAllScouts,
  updateScoutPoints,
  updateScoutStats,
  incrementScoutDetailedComments,
  updateScoutWithPredictionResult,
  createMatchPrediction,
  getPredictionForMatch,
  getAllPredictionsForScout,
  getAllPredictionsForMatch,
  markPredictionAsVerified,
  deleteScout,
  clearGamificationData as clearGameData,
};

// Export Scout type for convenience
export type { Scout };
