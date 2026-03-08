/**
 * Game-Template Component Exports
 * 
 * This file exports all game-specific components that teams should customize
 * for their particular game year.
 * 
 * Components are organized by the page they're used on:
 * - auto-start: Components for AutoStartPage
 * - auto-path: Components for auto path tracking
 * - teleop-path: Components for teleop field map
 * - pit-scouting: Components for PitScoutingPage
 * - scoring: Components for AutoScoringPage and TeleopScoringPage
 */

// Auto Start Page Components
export { AutoStartFieldSelector } from './auto-start';

// Auto Path Tracking
export { AutoFieldMap } from './auto-path';

// Teleop Field Map
export { TeleopFieldMap } from './teleop-path';

// Pit Scouting Page Components
export { GameSpecificQuestions } from './pit-scouting';

// Scoring Page Components (used by both Auto and Teleop)
export { ScoringSections, StatusToggles } from './scoring';
export { PostClimbProceed } from './scoring/PostClimbProceed';

