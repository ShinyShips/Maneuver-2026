/**
 * Game-Specific Interface Contracts
 * 
 * These interfaces define the contract between the core framework
 * and game-specific implementations. Each year's game must implement
 * these interfaces to work with the framework.
 * 
 * See FRAMEWORK_DESIGN.md for detailed documentation.
 */

import * as React from 'react';
import type { ScoutingEntryBase } from './scouting-entry';
import type { TeamStats } from '../core/types/team-stats';
export type { TeamStats };

/**
 * Interface 1: GameConfig
 * 
 * Defines the game's basic configuration and metadata.
 */
export interface GameConfig {
  // REQUIRED fields
  year: number;
  gameName: string;

  // OPTIONAL fields (could maybe be useful in future extensions)
  description?: string;
  duration?: {
    auto: number;
    teleop: number;
    endgame: number;
  };
  dimensions?: {
    fieldLength: number;
    fieldWidth: number;
  };
  features?: string[];
}

/**
 * Interface 3: ScoringCalculations
 * 
 * Game-specific logic for calculating points from scouted data.
 */
export interface ScoringCalculations<T extends ScoutingEntryBase> {
  calculateAutoPoints(entry: T): number;
  calculateTeleopPoints(entry: T): number;
  calculateEndgamePoints(entry: T): number;
  calculateTotalPoints(entry: T): number;
}

/**
 * Interface 3.5: DataTransformation
 * 
 * Game-specific logic for transforming action arrays into counter fields.
 * 
 * During match scouting, actions are recorded as timestamped objects in arrays:
 * - autoActions: [{ type: 'score', pieceType: 'coral', level: 'l1', timestamp: 123 }]
 * - teleopActions: [{ type: 'pickup', pieceType: 'algae', location: 'reef', timestamp: 456 }]
 * 
 * Before saving to the database, these arrays are transformed into counter fields:
 * - autoCoralPlaceL1Count: 3
 * - teleopAlgaePickReefCount: 2
 * 
 * This interface defines how that transformation happens for a specific game.
 */
export interface DataTransformation {
  /**
   * Transform action arrays and status objects into counter fields for database storage.
   * 
   * @param matchData - Raw match data containing action arrays and status objects
   * @returns Object with counter fields ready for database storage
   * 
   * @example
   * // Input:
   * {
   *   autoActions: [
   *     { type: 'score', pieceType: 'coral', location: 'reef', level: 'l1', timestamp: 123 },
   *     { type: 'score', pieceType: 'coral', location: 'reef', level: 'l1', timestamp: 456 }
   *   ],
   *   teleopActions: [
   *     { type: 'pickup', pieceType: 'algae', location: 'reef', timestamp: 789 }
   *   ],
   *   endgameRobotStatus: {
   *     deepClimbAttempted: true,
   *     climbFailed: false
   *   }
   * }
   * 
   * // Output:
   * {
   *   autoCoralPlaceL1Count: 2,
   *   teleopAlgaePickReefCount: 1,
   *   deepClimbAttempted: true,
   *   climbFailed: false
   * }
   */
  transformActionsToCounters(matchData: {
    autoActions?: any[];
    teleopActions?: any[];
    autoRobotStatus?: Record<string, any>;
    teleopRobotStatus?: Record<string, any>;
    endgameRobotStatus?: Record<string, any>;
    startPosition?: boolean[]; // Array of starting positions (converted to auto.startPosition)
    [key: string]: any; // Allow additional fields (comments, etc.)
  }): Record<string, any>;
}

/**
 * Interface 4: ValidationRules
 * 
 * Game-specific validation logic for comparing scouted data with TBA.
 * 
 * IMPORTANT: This interface is more complex than others because match validation
 * requires sophisticated threshold management, severity levels, and confidence scoring.
 */
export interface ValidationRules<T extends ScoutingEntryBase> {
  /**
   * Returns the data categories used for validation.
   * 
   * Example categories for 2025: 
   * ['auto-coral', 'teleop-coral', 'algae', 'endgame', 'mobility', 'fouls', 'total-score']
   */
  getDataCategories(): string[];

  /**
   * Calculate aggregated statistics for an alliance from individual team entries.
   * This sums up data from 3 robots into alliance-level totals.
   * 
   * @param entries - Array of 3 scouting entries (one per robot on alliance)
   * @returns Aggregated statistics for the alliance
   */
  calculateAllianceStats(entries: T[]): AllianceStats;

  /**
   * Calculate the total alliance score from 3 robots.
   * This is a convenience method that uses calculateAllianceStats internally.
   */
  calculateAllianceScore(robots: T[]): {
    auto: number;
    teleop: number;
    endgame: number;
    total: number;
  };

  /**
   * Validate a complete match by comparing scouted data with TBA data.
   * 
   * @param scoutedAlliances - Object with 'red' and 'blue' arrays of scouting entries
   * @param tbaMatchData - TBA API match data (includes score breakdown)
   * @param config - Validation configuration (thresholds, feature flags)
   * @returns Complete validation result with discrepancies, confidence, status
   */
  validateMatch(
    scoutedAlliances: {
      red: T[];
      blue: T[];
    },
    tbaMatchData: TBAMatchData,
    config?: ValidationConfig
  ): Promise<MatchValidationResult>;

  /**
   * Get the default validation configuration for this game.
   * Teams can customize thresholds and feature flags.
   */
  getDefaultConfig(): ValidationConfig;
}

/**
 * Alliance statistics - game-specific aggregated data
 * 
 * Each game year will have different fields here.
 * This is a placeholder showing common patterns.
 */
export interface AllianceStats {
  [key: string]: number; // Game-specific fields (e.g., autoCoralL1, teleopAlgae, etc.)
}

/**
 * Validation configuration with thresholds and feature flags
 */
export interface ValidationConfig {
  thresholds: ValidationThresholds;
  categoryThresholds?: Record<string, ValidationThresholds>;
  [key: string]: unknown; // Game-specific config (e.g., checkAutoCoralByLevel, checkEndgame, etc.)
}

/**
 * Validation thresholds (percentage and absolute)
 */
export interface ValidationThresholds {
  critical: number;          // % difference for critical severity (default: 25%)
  warning: number;           // % difference for warning severity (default: 15%)
  minor: number;             // % difference for minor severity (default: 5%)
  criticalAbsolute: number;  // Absolute difference for critical (default: 5)
  warningAbsolute: number;   // Absolute difference for warning (default: 3)
  minorAbsolute: number;     // Absolute difference for minor (default: 1)
}

/**
 * TBA match data (from TBA API)
 */
export interface TBAMatchData {
  key: string;
  comp_level: string;
  match_number: number;
  alliances: {
    red: {
      team_keys: string[];
      score: number;
    };
    blue: {
      team_keys: string[];
      score: number;
    };
  };
  score_breakdown?: {
    red: Record<string, unknown>;
    blue: Record<string, unknown>;
  };
}

/**
 * Match validation result
 */
export interface MatchValidationResult {
  matchKey: string;
  matchNumber: number;
  eventKey: string;
  status: 'pending' | 'passed' | 'flagged' | 'failed' | 'no-tba-data';
  confidence: 'high' | 'medium' | 'low';
  redAlliance: AllianceValidation;
  blueAlliance: AllianceValidation;
  totalDiscrepancies: number;
  criticalDiscrepancies: number;
  warningDiscrepancies: number;
  flaggedForReview: boolean;
  requiresReScout: boolean;
  validatedAt: number;
}

/**
 * Alliance validation result
 */
export interface AllianceValidation {
  alliance: 'red' | 'blue';
  status: 'pending' | 'passed' | 'flagged' | 'failed' | 'no-tba-data';
  confidence: 'high' | 'medium' | 'low';
  dataComplete: boolean;
  teams: number[];
  scoutNames: string[];
  missingTeams: number[];
  discrepancies: Discrepancy[];
  scoreDelta: number; // Difference between scouted and TBA total score
}

/**
 * Individual field discrepancy
 */
export interface Discrepancy {
  category: string;
  field: string;
  scoutedValue: number;
  tbaValue: number;
  difference: number;
  percentDiff: number;
  severity: 'critical' | 'warning' | 'minor' | 'none';
  message: string;
}

/**
 * Interface 5: StrategyAnalysis
 * 
 * Game-specific strategy calculations.
 * 
 * Each game year will calculate different statistics based on that year's
 * game pieces, scoring zones, and strategic elements.
 */
export interface StrategyAnalysis<T extends ScoutingEntryBase> {
  /**
   * Calculate basic statistics for a team.
   * 
   * Returns game-specific statistics. The exact fields depend on the game year.
   * Common fields include:
   * - matchesPlayed
   * - averagePoints (auto, teleop, endgame, total)
   * - Game-specific breakdowns (e.g., avgCoralL1, avgAlgae, etc.)
   * - Rates (e.g., mobilityRate, climbRate, defenseRate)
   * - Positional data (e.g., starting positions)
   * 
   * @param entries - Array of scouting entries for the team
   * @returns Team statistics object (game-specific structure)
   */
  calculateBasicStats(entries: T[]): TeamStats;

  /**
   * OPTIONAL: Calculate advanced statistics.
   * Teams can implement additional analysis methods as needed.
   */
  calculateAdvancedStats?(entries: T[]): AdvancedTeamStats;

  // ========== DISPLAY CONFIGURATION ==========
  // These methods define how the Team Statistics page renders stats.
  // The framework calls these to build the UI dynamically.

  /**
   * Get stat sections to display on the Team Statistics page.
   * Each section appears as a card with stat values.
   * 
   * @returns Array of stat section definitions
   */
  getStatSections(): import('./team-stats-display').StatSectionDefinition[];

  /**
   * Get rate sections to display (progress bars).
   * Used for Key Rates, Climb Breakdown, etc.
   * 
   * @returns Array of rate section definitions
   */
  getRateSections(): import('./team-stats-display').RateSectionDefinition[];

  /**
   * Get match badges to show in match-by-match performance list.
   * These are game-specific indicators like "Climbed", "Broke Down".
   * 
   * @returns Array of match badge definitions
   */
  getMatchBadges(): import('./team-stats-display').MatchBadgeDefinition[];

  /**
   * Get start position configuration for the Auto tab.
   * Defines number of positions and optional field image.
   * 
   * @returns Start position configuration
   */
  getStartPositionConfig(): import('./team-stats-display').StartPositionConfig;
}

// TeamStats is now imported from core/types/team-stats.ts (single source of truth)

/**
 * OPTIONAL: Advanced team statistics
 * 
 * Teams can define their own advanced stats structure.
 * 
 * Example advanced stats:
 * - Consistency scores (standard deviation)
 * - Trend analysis (improving/declining/stable)
 * - Predictive modeling (expected performance)
 * - Comparative rankings (percentile vs other teams)
 */
export interface AdvancedTeamStats {
  [key: string]: unknown;
}

/**
 * Interface 6: PredictionSystem (OPTIONAL)
 * 
 * Scout gamification system for match predictions.
 * Teams can choose to implement this for fun/engagement.
 */
export interface PredictionSystem {
  /**
   * Calculate stakes earned for a correct prediction
   * @param confidence - Confidence level (1-5)
   * @param wasCorrect - Whether the prediction was correct
   * @returns Stakes earned (positive) or lost (negative)
   */
  calculateStakes(confidence: number, wasCorrect: boolean): number;

  /**
   * Get a scout's total stakes/points
   * @param scoutName - Name of the scout
   * @returns Total stakes earned
   */
  getScoutStakes(scoutName: string): Promise<number>;

  /**
   * Get leaderboard of scouts by stakes
   * @param limit - Number of top scouts to return
   * @returns Array of scouts with their stakes
   */
  getStakesLeaderboard(limit?: number): Promise<Array<{
    scoutName: string;
    totalStakes: number;
    correctPredictions: number;
    totalPredictions: number;
    accuracy: number;
  }>>;
}

export type ScoutOptionValue = boolean;
export type ScoutOptionsState = Record<string, ScoutOptionValue>;

export interface ScoutOptionsContentProps {
  options: ScoutOptionsState;
  onOptionChange: (key: string, value: ScoutOptionValue) => void;
}

export interface UIComponents<T extends ScoutingEntryBase> {
  GameStartScreen: React.ComponentType<GameStartScreenProps>;
  AutoStartScreen?: React.ComponentType<AutoStartScreenProps>; // OPTIONAL - not all teams scout starting position
  AutoScoringScreen: React.ComponentType<ScoringScreenProps<T>>;
  TeleopScoringScreen: React.ComponentType<ScoringScreenProps<T>>;
  EndgameScreen?: React.ComponentType<ScoringScreenProps<T>>; // OPTIONAL - endgame data may come from TBA API
  StatusToggles: React.ComponentType<{
    phase: 'auto' | 'teleop' | 'endgame';
    status: any;
    onStatusUpdate: (updates: any) => void;
  }>;
  PitScoutingQuestions?: React.ComponentType<PitScoutingQuestionsProps>; // OPTIONAL - game-specific pit scouting questions
  ScoutOptionsContent?: React.ComponentType<ScoutOptionsContentProps>; // OPTIONAL - game-specific scouting options shown on Game Start
}

/**
 * Props for GameStartScreen component
 */
export interface GameStartScreenProps {
  onStart: (data: {
    scoutName: string;
    teamNumber: number;
    matchNumber: number;
    eventKey: string;
    allianceColor: 'red' | 'blue';
    // Optional: Match prediction data
    prediction?: {
      predictedWinner: 'red' | 'blue' | 'none';
      confidence?: number; // 0-5, for dynamic stakes
    };
  }) => void;

  // Optional: Existing prediction for this match (if scout already made one)
  existingPrediction?: {
    predictedWinner: 'red' | 'blue' | 'none';
    confidence?: number;
  };
}

/**
 * Props for AutoStartScreen component (starting position selection)
 * 
 * This screen allows the scout to select the robot's starting position
 * on the field (e.g., position 0-4 in 2025).
 */
export interface AutoStartScreenProps {
  matchInfo: {
    matchNumber: number;
    teamNumber: number;
    allianceColor: 'red' | 'blue';
    scoutName: string;
  };
  onPositionSelected: (position: number | string) => void;
  onBack: () => void;
}

/**
 * Props for scoring screen components
 * Auto, Scoring (Teleop), and Endgame all use this interface
 */
export interface ScoringScreenProps<T extends ScoutingEntryBase> {
  entry: Partial<T>;
  onUpdate: (updates: Partial<T>) => void;
  onNext: () => void;
  onBack: () => void;
  onCancel?: () => void; // Optional: User wants to exit and discard current entry
  onSave?: (entry: T) => Promise<void>; // Optional: Endgame screen saves and returns to GameStart
}

/**
 * Props for PitScoutingQuestions component
 * 
 * Game-specific pit scouting questions receive gameData and onGameDataChange
 * to manage their custom fields within the pit scouting form.
 */
export interface PitScoutingQuestionsProps {
  gameData: Record<string, any>;
  onGameDataChange: (updates: Record<string, any>) => void;
}

/**
 * Interface 6: PitScoutingRules
 * 
 * Game-specific pit scouting questions and form elements.
 * Framework provides universal fields (photo, weight, drivetrain, language, notes).
 * Game implementations provide additional questions that get stored in gameData.
 */
export interface PitScoutingRules {
  /**
   * Get game-specific pit scouting questions
   * These will be rendered after universal fields
   * 
   * @returns Array of question definitions
   */
  getGameSpecificQuestions(): PitScoutingQuestion[];
}

/**
 * Definition for a game-specific pit scouting question
 */
export interface PitScoutingQuestion {
  id: string;                    // Unique identifier (used as key in gameData)
  label: string;                 // Display label for the question
  type: 'boolean' | 'text' | 'number' | 'select' | 'multiselect';
  options?: string[];            // For select/multiselect types
  required?: boolean;            // Whether this field is required
  placeholder?: string;          // Placeholder text for text/number inputs
  helperText?: string;           // Additional help text displayed below the input
}
