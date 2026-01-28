/**
 * Game Scoring Calculations - 2026 REBUILT
 * 
 * Calculates points for auto, teleop, and endgame phases.
 * 
 * 2026 SCORING:
 * - Fuel in active HUB: 1 pt (both phases)
 * - Auto Climb L1: 15 pts
 * - Tower L1: 10 pts, L2: 20 pts, L3: 30 pts
 * 
 * DERIVED FROM: game-schema.ts
 */

import type { ScoringCalculations } from "@/types/game-interfaces";
import type { ScoutingEntryBase } from "@/core/types/scouting-entry";
import {
    toggles,
    getActionKeys,
    getActionPoints,
    getAutoTogglePoints,
    type AutoToggleKey
} from "./game-schema";

/**
 * GameData interface for 2026
 * Uses path-based tracking with counter aggregation
 */
export interface GameData {
    auto: {
        startPosition: number | null;
        // Path data for visualization/replay
        autoPath?: any[];       // Full PathWaypoint array
        // Note: alliance is stored at top-level scoutingEntry.allianceColor
        // Fuel counters
        fuelScoredCount?: number;
        fuelPassedCount?: number;
        // Collection counters by location
        depotCollectCount?: number;
        outpostCollectCount?: number;
        // Traversal booleans
        autoTrench?: boolean;
        autoBump?: boolean;
        // Stuck counters (trouble with obstacles)
        trenchStuckCount?: number;
        trenchStuckDuration?: number;
        bumpStuckCount?: number;
        bumpStuckDuration?: number;
        // Broken down tracking
        brokenDownCount?: number;
        brokenDownDuration?: number;
        // Other counters
        foulCommittedCount?: number;
        // Auto toggles
        autoClimbL1?: boolean;
        [key: string]: unknown;
    };
    teleop: {
        // Fuel counters
        fuelScoredCount?: number;
        fuelPassedCount?: number;
        // Action counters
        stealCount?: number;
        // Stuck counters
        trenchStuckCount?: number;
        trenchStuckDuration?: number;
        bumpStuckCount?: number;
        bumpStuckDuration?: number;
        // Broken down tracking
        brokenDownCount?: number;
        brokenDownDuration?: number;
        // Teleop toggles
        playedDefense?: boolean;
        [key: string]: unknown;
    };
    endgame: {
        // Tower climb (mutually exclusive)
        climbL1?: boolean;
        climbL2?: boolean;
        climbL3?: boolean;
        // Status
        climbFailed?: boolean;
        
        // Active Phase Roles (multi-select)
        roleActiveCleanUp?: boolean;
        roleActivePasser?: boolean;
        roleActiveDefense?: boolean;
        roleActiveCycler?: boolean;
        roleActiveThief?: boolean;
        
        // Inactive Phase Roles (multi-select)
        roleInactiveCleanUp?: boolean;
        roleInactivePasser?: boolean;
        roleInactiveDefense?: boolean;
        roleInactiveCycler?: boolean;
        roleInactiveThief?: boolean;
        
        // Passing zones (multi-select)
        passedToAlliance?: boolean;
        passedToNeutral?: boolean;
        
        // Qualitative accuracy (mutually exclusive)
        accuracyAll?: boolean;
        accuracyMost?: boolean;
        accuracySome?: boolean;
        accuracyFew?: boolean;
        accuracyLittle?: boolean;
        
        // Corral usage
        usedCorral?: boolean;
        
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface ScoutingEntry extends ScoutingEntryBase {
    gameData: GameData;
}

export const scoringCalculations: ScoringCalculations<ScoutingEntry> = {
    calculateAutoPoints(entry) {
        const gameData = entry.gameData as GameData;
        let points = 0;

        // Sum points for fuel scored in auto
        getActionKeys().forEach(key => {
            const autoPoints = getActionPoints(key, 'auto');
            if (autoPoints > 0) {
                const count = gameData?.auto?.[`${key}Count`] as number || 0;
                points += count * autoPoints;
            }
        });

        // Add auto climb points if applicable
        Object.keys(toggles.auto).forEach(key => {
            const toggleKey = key as AutoToggleKey;
            const togglePoints = getAutoTogglePoints(toggleKey);
            if (togglePoints > 0 && gameData?.auto?.[key] === true) {
                points += togglePoints;
            }
        });

        return points;
    },

    calculateTeleopPoints(entry) {
        const gameData = entry.gameData as GameData;
        let points = 0;

        // Sum points for fuel scored in teleop
        getActionKeys().forEach(key => {
            const teleopPoints = getActionPoints(key, 'teleop');
            if (teleopPoints > 0) {
                const count = gameData?.teleop?.[`${key}Count`] as number || 0;
                points += count * teleopPoints;
            }
        });

        return points;
    },

    calculateEndgamePoints(entry) {
        const gameData = entry.gameData as GameData;
        let points = 0;

        // Tower climb - check each level and get points from actions
        if (gameData?.endgame?.climbL1 === true) {
            points += getActionPoints('climbL1', 'teleop'); // 10 pts
        }
        if (gameData?.endgame?.climbL2 === true) {
            points += getActionPoints('climbL2', 'teleop'); // 20 pts
        }
        if (gameData?.endgame?.climbL3 === true) {
            points += getActionPoints('climbL3', 'teleop'); // 30 pts
        }

        return points;
    },

    calculateTotalPoints(entry) {
        return (
            this.calculateAutoPoints(entry) +
            this.calculateTeleopPoints(entry) +
            this.calculateEndgamePoints(entry)
        );
    }
};

export default scoringCalculations;
