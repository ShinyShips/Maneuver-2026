/**
 * Scout Gamification Types
 * 
 * OPTIONAL FEATURE: This module provides gamification features for scout motivation.
 * Teams can choose not to use this if they prefer a simpler scouting experience
 * or have concerns about the competitive/gambling-like nature of predictions.
 * 
 * To disable: Simply don't import from this module.
 */

import {
    Scout,
    MatchPrediction,
    LeaderboardEntry,
    Leaderboard
} from '@/core/types/gamification';

// Achievement tier levels
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// Achievement categories
export type AchievementCategory = 'predictions' | 'scouting' | 'streaks' | 'special';

// Achievement requirement definition
export interface AchievementRequirement {
    type: 'count' | 'streak' | 'accuracy' | 'custom';
    value: number;
    description: string;
}

// Achievement definition  
export interface Achievement {
    id: string;
    name: string;
    description: string;
    category: AchievementCategory;
    tier: AchievementTier;
    requirement: AchievementRequirement;
    stakeBonus: number;
    icon?: string;
}

// Scout's unlocked achievement record
export interface ScoutAchievement {
    id: string;
    achievementId: string;
    scoutName: string;
    unlockedAt: number;
    progress?: number;
}

export type {
    Scout,
    MatchPrediction,
    LeaderboardEntry,
    Leaderboard
};
