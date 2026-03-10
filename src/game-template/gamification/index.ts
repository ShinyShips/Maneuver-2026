/**
 * Scout Gamification Module
 * 
 * OPTIONAL FEATURE: This module provides gamification features for scout motivation.
 * Teams can choose not to use this if they prefer a simpler scouting experience
 * or have concerns about the competitive/gambling-like nature of predictions.
 * 
 * To enable: Import from '@/game-template/gamification'
 * To disable: Simply don't import this module
 */

// Types
export type {
    Scout,
    MatchPrediction,
    ScoutAchievement,
    Achievement,
    AchievementCategory,
    AchievementTier,
    AchievementRequirement,
    LeaderboardEntry,
    Leaderboard,
} from './types';

// Database and operations
export {
    gamificationDB,
    ScoutGamificationDB,
    getOrCreateScout,
    getScout,
    getAllScouts,
    updateScoutPoints,
    updateScoutStats,
    incrementScoutDetailedComments,
    deleteScout,
    clearGamificationData,
    createMatchPrediction,
    getPredictionForMatch,
    getAllPredictionsForScout,
    getAllPredictionsForMatch,
    markPredictionAsVerified,
    unlockAchievement,
    getScoutAchievements,
    hasAchievement,
} from './database';

// Utilities
export {
    STAKE_VALUES,
    calculateStreakBonus,
    calculateAccuracy,
    updateScoutWithPredictionResult,
    getLeaderboard,
    getOrCreateScoutByName,
} from './utils';

export {
    ACHIEVEMENT_DEFINITIONS,
    ACHIEVEMENT_TIERS,
} from './achievements';
