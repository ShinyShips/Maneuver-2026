/**
 * Game-Template Component Exports
 * 
 * This file exports all game-specific components that teams should customize
 * for their particular game year.
 * 
 * Components are organized by the page they're used on:
 * - auto-start: Components for AutoStartPage
 * - pit-scouting: Components for PitScoutingPage
 * - scoring: Components for AutoScoringPage and TeleopScoringPage
 */

// Auto Start Page Components
export { AutoStartFieldSelector } from './auto-start';

// Game Start Page Components
export { GameSpecificScoutOptions } from './game-start';

// Pit Scouting Page Components
export { GameSpecificQuestions } from './pit-scouting';

// Scoring Page Components (used by both Auto and Teleop)
export { ScoringSections, StatusToggles } from './scoring';
