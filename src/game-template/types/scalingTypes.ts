/**
 * 2026 Game-Specific: Match Validation Scaling Types
 * 
 * These types extend the core validation system with 2026-specific
 * fuel scaling functionality.
 */

import { ScoutingEntryBase } from '@/core/types/scouting-entry';

/**
 * 2026 Game-Specific Extension: Scaled fuel data
 * This extends the base scouting entry with 2026 scaling fields
 */
export interface ScoutingEntry2026WithScaling extends ScoutingEntryBase {
  // Stored in gameData.scaledMetrics for 2026
  gameData: {
    // ... other 2026 game data ...
    scaledMetrics?: {
      scalingApplied: boolean;
      scaledAutoFuel: number;
      scaledTeleopFuel: number;
      scalingFactorAuto: number;
      scalingFactorTeleop: number;
      officialTowerLevel?: number;
      lastScaledAt: number;
    };
  };
}

/**
 * Scaling factors calculated from TBA vs scouted totals
 */
export interface ScalingFactors {
  autoFuel: number;   // officialAutoTotal / scoutedAutoTotal
  teleopFuel: number; // officialTeleopTotal / scoutedTeleopTotal
}

/**
 * Scaled metrics for a team after applying scaling factors
 */
export interface ScaledTeamMetrics {
  teamNumber: string;
  // Raw scouted values
  rawAutoFuel: number;
  rawTeleopFuel: number;
  rawTowerLevel: number;
  // Scaled values
  scaledAutoFuel: number;
  scaledTeleopFuel: number;
  officialTowerLevel: number;  // From TBA
  // Metadata
  scalingApplied: boolean;
  scalingFactors: ScalingFactors;
}

/**
 * Alliance-level scaling result
 */
export interface AllianceScalingResult {
  alliance: 'red' | 'blue';
  // Totals
  scoutedAutoTotal: number;
  officialAutoTotal: number;
  scoutedTeleopTotal: number;
  officialTeleopTotal: number;
  // Scaling factors
  scalingFactors: ScalingFactors;
  // Per-team scaled metrics
  teams: ScaledTeamMetrics[];
}
