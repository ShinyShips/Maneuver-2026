/**
 * Game Point Values - 2026 REBUILT
 * 
 * DERIVED FROM: game-schema.ts
 * 
 * This file re-exports point values from the schema for backwards compatibility.
 * New code should import directly from game-schema.ts.
 */

import { actions, gameConstants } from "./game-schema";

// Re-export point values derived from schema
export const AUTO_POINTS = {
    FUEL_SCORED: actions.fuelScored.points.auto ?? 0,
    FUEL_PASSED: actions.fuelPassed.points.auto ?? 0,
    AUTO_CLIMB_L1: actions.autoClimb.points.auto ?? 0,
} as const;

export const TELEOP_POINTS = {
    FUEL_SCORED: actions.fuelScored.points.teleop ?? 0,
    FUEL_PASSED: actions.fuelPassed.points.teleop ?? 0,
} as const;

export const ENDGAME_POINTS = {
    CLIMB_L1: actions.climbL1.points.teleop ?? 0,
    CLIMB_L2: actions.climbL2.points.teleop ?? 0,
    CLIMB_L3: actions.climbL3.points.teleop ?? 0,
} as const;

export const PENALTY_POINTS = {
    FOUL: 2,
    TECH_FOUL: 5,
} as const;

// Re-export game constants for convenience
export const RANKING_POINT_THRESHOLDS = {
    TOWER: gameConstants.towerRPThreshold,
    FUEL_1: gameConstants.fuelRP1Threshold,
    FUEL_2: gameConstants.fuelRP2Threshold,
} as const;

export const ROBOT_RESTRICTIONS = {
    MAX_WEIGHT: gameConstants.maxWeight,
    MAX_PERIMETER: gameConstants.maxPerimeter,
    MAX_HEIGHT: gameConstants.maxHeight,
    MAX_EXTENSION: gameConstants.maxExtension,
    TRENCH_CLEARANCE: gameConstants.trenchClearance,
} as const;
