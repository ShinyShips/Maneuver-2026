/**
 * Strategy and gamification types for scout profiles, achievements, and predictions
 * These are game-agnostic features that work with any FRC game
 */

/**
 * Scout profile with gamification tracking
 * Tracks stakes (points), predictions, streaks, and achievements
 */
export interface Scout {
  /** Scout's name (primary key - matches nav-user sidebar) */
  name: string;

  /** Total stakes including bonuses from achievements */
  stakes: number;

  /** Stakes earned only from match predictions (excludes achievement bonuses) */
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
 * Achievement unlocked by a scout
 */
export interface ScoutAchievement {
  /** Scout who unlocked this achievement */
  scoutName: string;

  /** Achievement definition ID */
  achievementId: string;

  /** Unix timestamp when achievement was unlocked */
  unlockedAt: number;

  /** Current progress toward achievement (for multi-level achievements) */
  progress?: number;
}

/**
 * Achievement definition structure
 * Teams can customize achievements for their specific game
 */
export interface Achievement {
  /** Unique achievement ID */
  id: string;

  /** Display name */
  name: string;

  /** Description of how to earn */
  description: string;

  /** Emoji or icon identifier */
  icon: string;

  /** Achievement category */
  category: AchievementCategory;

  /** Achievement tier (difficulty/prestige) */
  tier: AchievementTier;

  /** Requirements to unlock */
  requirements: AchievementRequirement;

  /** Stakes bonus awarded */
  stakesReward: number;
}

/**
 * Achievement categories
 */
export type AchievementCategory =
  | 'accuracy'      // Prediction accuracy
  | 'volume'        // Quantity of entries/predictions
  | 'streaks'       // Consecutive successes
  | 'special'       // Unique/rare accomplishments
  | 'social'        // Team collaboration
  | 'time'          // Time-based (early bird, night owl)
  | 'improvement';  // Personal progress

/**
 * Achievement tiers (difficulty levels)
 */
export type AchievementTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'legendary';

/**
 * Achievement requirement structure
 */
export interface AchievementRequirement {
  /** Requirement type */
  type: 'minimum' | 'streak' | 'percentage' | 'special';

  /** Target value to reach */
  value: number;

  /** Scout property to check (e.g., 'totalPredictions', 'currentStreak') */
  property?: keyof Scout;

  /** Custom validation function name (for special requirements) */
  customCheck?: string;
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

// ==============================================================================
// TEAM PERFORMANCE & STRATEGY ANALYSIS TYPES
// ==============================================================================

export type AggregationType = "average" | "median" | "max" | "min" | "p75" | "p25" | "sum";
export type FilterOperator = ">" | ">=" | "<" | "<=" | "=" | "!=" | "between";

export interface ColumnFilter {
  operator: FilterOperator;
  value: number;
  value2?: number;
}

export interface StrategyColumnConfig {
  key: string;
  label: string;
  category: string;
  visible: boolean;
  numeric: boolean;
  percentage?: boolean;
  /**
   * Optional custom calculation for this column.
   * If not provided, it assumes the key exists directly on the scouting entry's gameData (or root).
   * The calculation function receives the full list of matches for a team.
   */
  calculation?: (matches: any[]) => number;
}

export interface StrategyConfig {
  /**
   * Definitions for all columns available in the strategy table and charts.
   */
  columns: StrategyColumnConfig[];

  /**
   * Default columns to show for specific presets.
   */
  presets: Record<string, string[]>;

  /**
   * Calculation logic for aggregate metrics (like Total Points) that might be used
   * across different visualizers (charts, tables).
   */
  aggregates?: Record<string, (match: any) => number>;
}

export interface TeamData {
  teamNumber: number;
  eventKey: string;
  matchCount: number;
  [key: string]: string | number;
}
