/**
 * Core Gamification Types
 */

/**
 * Scout profile for gamification system
 * Tracks prediction accuracy, stakes, and achievements
 */
export interface Scout {
    /** Scout's name (primary key - matches nav-user sidebar) */
    name: string;

    /** Total stakes including bonuses from achievements */
    stakes: number;

    /** Stakes earned only from predictions (excludes achievement bonuses) */
    stakesFromPredictions: number;

    /** Total number of match predictions made */
    totalPredictions: number;

    /** Number of correct predictions */
    correctPredictions: number;

    /** Current consecutive correct predictions */
    currentStreak: number;

    /** Best streak ever achieved */
    longestStreak: number;

    /** Number of substantive match comments submitted */
    detailedCommentsCount: number;

    /** Unix timestamp when scout profile was created */
    createdAt: number;

    /** Unix timestamp of last profile update */
    lastUpdated: number;
}

/**
 * Match prediction for gamification system
 * Scouts predict match winners before matches occur
 */
export interface MatchPrediction {
    /** Unique prediction ID */
    id: string;

    /** Scout who made this prediction */
    scoutName: string;

    /** Event key (e.g., "2025mrcmp") */
    eventKey: string;

    /** Match number (numeric) */
    matchNumber: number;

    /** Predicted winning alliance */
    predictedWinner: 'red' | 'blue';

    /** Actual winning alliance (set after match completes) */
    actualWinner?: 'red' | 'blue' | 'tie';

    /** Was the prediction correct? */
    isCorrect?: boolean;

    /** Stakes awarded for this prediction */
    pointsAwarded?: number;

    /** Unix timestamp when prediction was made */
    timestamp: number;

    /** Has this been verified against actual results? */
    verified: boolean;
}

/**
 * Leaderboard entry for displaying scout rankings
 */
export interface LeaderboardEntry {
    rank: number;
    scout: Scout;
    recentChange?: number; // Change in rank since last update
}

/**
 * Leaderboard data structure
 */
export interface Leaderboard {
    entries: LeaderboardEntry[];
    lastUpdated: number;
    season: string;
}
