/**
 * Core type exports
 * All year-agnostic types that define the framework's data structures.
 * 
 * SINGLE SOURCE OF TRUTH: All types are defined in src/core/types/
 * This barrel file provides convenient imports via @/types
 */

// Scouting entry types (from core/types/scouting-entry.ts - SINGLE SOURCE)
export type {
  ScoutingEntryBase,
  ScoutingDataExport,
  ImportResult,
  DBStats,
  FilterOptions,
  QueryFilters,
} from '../core/types/scouting-entry';

// Pit scouting types (from core/types/pit-scouting.ts - SINGLE SOURCE)
export type {
  PitScoutingEntryBase,
  PitScoutingData,
  PitScoutingStats,
  DrivetrainType,
  ProgrammingLanguage,
} from '../core/types/pit-scouting';

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
  ScoutOptionValue,
  ScoutOptionsState,
  ScoutOptionsContentProps,
  GameStartScreenProps,
  AutoStartScreenProps,
  ScoringScreenProps,
  TBAMatchData,
  MatchValidationResult,
  AllianceValidation as GameAllianceValidation,
  Discrepancy as GameDiscrepancy,
  AdvancedTeamStats,
  PredictionSystem,
  ValidationConfig as GameValidationConfig,
  ValidationThresholds as GameValidationThresholds,
  AllianceStats,
  DataTransformation,
} from './game-interfaces';

// Database schema types (from database.ts) - only schema types, entry types from pit-scouting
export type {
  ScoutingDatabaseSchema,
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

// TeamStats types (from core/types/team-stats.ts - SINGLE SOURCE)
export type {
  TeamStats,
  TeamStatsWithId,
} from '../core/types/team-stats';

// Team stats display configuration types (from team-stats-display.ts)
export type {
  StatSectionDefinition,
  StatDefinition,
  RateSectionDefinition,
  RateDefinition,
  MatchBadgeDefinition,
  StartPositionConfig,
  TeamStatsDisplayConfig,
} from './team-stats-display';
