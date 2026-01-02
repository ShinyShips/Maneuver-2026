/**
 * Core type exports
 * All year-agnostic types that define the framework's data structures.
 */

// Scouting entry types (from core/types/scouting-entry.ts)
export type {
  ScoutingEntryBase,
  ScoutingDataExport,
  ImportResult,
  DBStats,
  FilterOptions,
  QueryFilters,
  PitScoutingEntry,
  PitScoutingData,
  PitScoutingStats,
} from '../core/types/scouting-entry';

// Strategy and gamification types (from core/types/strategy.ts)
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
} from '../core/types/strategy';

// Game interface types (from game-interfaces.ts)
export type {
  GameConfig,
  ScoringCalculations,
  ValidationRules,
  StrategyAnalysis,
  UIComponents,
  GameStartScreenProps,
  AutoStartScreenProps,
  ScoringScreenProps,
  TBAMatchData,
  MatchValidationResult,
  AllianceValidation as GameAllianceValidation,
  Discrepancy as GameDiscrepancy,
  TeamStats as GameTeamStats,
  AdvancedTeamStats,
  PredictionSystem,
  ValidationConfig as GameValidationConfig,
  ValidationThresholds as GameValidationThresholds,
  AllianceStats,
} from './game-interfaces';

// Database schema types (from database.ts)
export type {
  ScoutingDatabaseSchema,
  DrivetrainType,
  ProgrammingLanguage,
  PitScoutingEntryBase,
  PitScoutingDatabaseSchema,
  CachedTBAMatch,
  TBACacheMetadata,
  ValidationResultDB,
  TBACacheDatabaseSchema,
  Scout as ScoutDB,
  MatchPrediction as MatchPredictionDB,
  ScoutAchievement as ScoutAchievementDB,
  ScoutProfileDatabaseSchema,
} from './database';

// Validation types (from validation.ts)
export type {
  DiscrepancySeverity,
  ValidationStatus,
  ConfidenceLevel,
  DataCategory,
  Discrepancy,
  AllianceValidation,
  TeamValidation,
  MatchValidationResult as ValidationMatchValidationResult,
  ValidationThresholds,
  CategoryThresholds,
  ValidationConfig,
  ValidationSummary,
  ValidationResultDB as ValidationResult,
} from './validation';

// Strategy types (from strategy.ts)
export type {
  TeamStats,
} from './strategy';
