/**
 * 2026 Game-Specific Demo Data Generator
 * 
 * Generates realistic 2026 FUEL game data based on team skill profiles.
 * Outputs raw match data that gets transformed through gameDataTransformation.
 */

import type { GameDataGenerator } from '@/core/lib/demoDataGenerator';
import { gameDataTransformation } from './transformation';

// Field element positions (normalized 0-1) for realistic waypoint placement
const POSITIONS = {
    hub: { x: 0.31, y: 0.50 },
    depot: { x: 0.09, y: 0.29 },
    outpost: { x: 0.09, y: 0.87 },
    tower: { x: 0.10, y: 0.53 },
    trench1: { x: 0.31, y: 0.13 },
    bump1: { x: 0.31, y: 0.32 },
    bump2: { x: 0.31, y: 0.68 },
    trench2: { x: 0.31, y: 0.87 },
    pass: { x: 0.50, y: 0.50 },
} as const;

type WeightedSpot = {
    pos: { x: number; y: number };
    spread: number;
    weight: number;
    lane?: 'upper' | 'lower' | 'center';
    depth?: 'near' | 'far';
};

// Alliance scoring hotspots (clustered shooting lanes, all within alliance side)
const ALLIANCE_SCORING_SPOTS: WeightedSpot[] = [
    { pos: { x: 0.27, y: 0.50 }, spread: 0.05, weight: 0.34, lane: 'center', depth: 'near' },
    { pos: { x: 0.25, y: 0.35 }, spread: 0.05, weight: 0.20, lane: 'upper', depth: 'near' },
    { pos: { x: 0.25, y: 0.65 }, spread: 0.05, weight: 0.20, lane: 'lower', depth: 'near' },
    { pos: { x: 0.19, y: 0.28 }, spread: 0.06, weight: 0.13, lane: 'upper', depth: 'far' },
    { pos: { x: 0.19, y: 0.72 }, spread: 0.06, weight: 0.13, lane: 'lower', depth: 'far' },
];

// Neutral-zone passing origins (distributed across midfield, away from hub-front lanes)
const NEUTRAL_PASS_SPOTS: WeightedSpot[] = [
    { pos: { x: 0.52, y: 0.22 }, spread: 0.05, weight: 0.22, lane: 'upper', depth: 'near' },
    { pos: { x: 0.56, y: 0.34 }, spread: 0.05, weight: 0.18, lane: 'upper', depth: 'near' },
    { pos: { x: 0.52, y: 0.78 }, spread: 0.05, weight: 0.22, lane: 'lower', depth: 'near' },
    { pos: { x: 0.56, y: 0.66 }, spread: 0.05, weight: 0.18, lane: 'lower', depth: 'near' },
    { pos: { x: 0.62, y: 0.26 }, spread: 0.06, weight: 0.10, lane: 'upper', depth: 'far' },
    { pos: { x: 0.62, y: 0.74 }, spread: 0.06, weight: 0.10, lane: 'lower', depth: 'far' },
];

// Opponent-zone passing origins (fuel theft/collection returns, avoid directly in front of hub)
const OPPONENT_PASS_SPOTS: WeightedSpot[] = [
    { pos: { x: 0.80, y: 0.22 }, spread: 0.05, weight: 0.24, lane: 'upper', depth: 'near' },
    { pos: { x: 0.80, y: 0.78 }, spread: 0.05, weight: 0.24, lane: 'lower', depth: 'near' },
    { pos: { x: 0.86, y: 0.34 }, spread: 0.05, weight: 0.18, lane: 'upper', depth: 'near' },
    { pos: { x: 0.86, y: 0.66 }, spread: 0.05, weight: 0.18, lane: 'lower', depth: 'near' },
    { pos: { x: 0.92, y: 0.28 }, spread: 0.06, weight: 0.08, lane: 'upper', depth: 'far' },
    { pos: { x: 0.92, y: 0.72 }, spread: 0.06, weight: 0.08, lane: 'lower', depth: 'far' },
];

function pickWeightedSpot(
    spots: WeightedSpot[],
    bias?: {
        preferredLane?: 'upper' | 'lower';
        preferredDepth?: 'near' | 'far';
        profile?: 'auto' | 'teleop';
    }
): WeightedSpot {
    const lanePreferredMultiplier = bias?.profile === 'auto' ? 1.8 : 1.15;
    const laneOtherMultiplier = bias?.profile === 'auto' ? 0.55 : 0.92;
    const depthPreferredMultiplier = bias?.profile === 'auto' ? 1.35 : 1.08;
    const depthOtherMultiplier = bias?.profile === 'auto' ? 0.75 : 0.95;

    const weightedSpots = spots.map(spot => {
        let adjustedWeight = spot.weight;
        if (bias?.preferredLane) {
            if (spot.lane === bias.preferredLane) adjustedWeight *= lanePreferredMultiplier;
            else if (spot.lane && spot.lane !== 'center') adjustedWeight *= laneOtherMultiplier;
        }
        if (bias?.preferredDepth) {
            if (spot.depth === bias.preferredDepth) adjustedWeight *= depthPreferredMultiplier;
            else if (spot.depth && spot.depth !== bias.preferredDepth) adjustedWeight *= depthOtherMultiplier;
        }
        return { spot, adjustedWeight };
    });

    const totalWeight = weightedSpots.reduce((sum, item) => sum + item.adjustedWeight, 0);
    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    for (const item of weightedSpots) {
        cumulative += item.adjustedWeight;
        if (roll <= cumulative) return item.spot;
    }
    return weightedSpots[weightedSpots.length - 1]!.spot;
}

/** Add small random jitter to a position (stays within 0-1 range) */
function jitter(pos: { x: number; y: number }, spread = 0.05): { x: number; y: number } {
    return {
        x: Math.max(0, Math.min(1, pos.x + (Math.random() - 0.5) * spread)),
        y: Math.max(0, Math.min(1, pos.y + (Math.random() - 0.5) * spread)),
    };
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate realistic 2026 game data based on team skill profile
 */
export const generate2026GameData: GameDataGenerator = (profile, matchKey) => {
    const isPlayoff = matchKey.includes('qf') || matchKey.includes('sf') || matchKey.includes('f');
    const preferredLane: 'upper' | 'lower' = Math.random() < 0.5 ? 'upper' : 'lower';
    const preferredDepth: 'near' | 'far' = Math.random() < 0.6 ? 'near' : 'far';

    // =========================================================================
    // Auto Phase - Generate PathWaypoint-style actions
    // =========================================================================
    const autoActions: any[] = [];

    // Start position (required by transformation)
    const startPositionIndex = Math.floor(Math.random() * 5); // 0-4: trench1, bump1, hub, bump2, trench2
    const startPositions = ['trench1', 'bump1', 'hub', 'bump2', 'trench2'] as const;
    const startKey = startPositions[startPositionIndex]!;
    autoActions.push({
        type: 'start',
        action: startKey,
        timestamp: Date.now(),
        position: POSITIONS[startKey],
    });

    // Auto fuel scoring - Elite teams can score 100-150 in auto
    // Elite: 100-150, Strong: 60-100, Average: 30-60, Developing: 10-30
    let autoFuelCount = 0;
    if (profile.skillLevel === 'elite') {
        autoFuelCount = 100 + Math.floor(Math.random() * 51);
    } else if (profile.skillLevel === 'strong') {
        autoFuelCount = 60 + Math.floor(Math.random() * 41);
    } else if (profile.skillLevel === 'average') {
        autoFuelCount = 30 + Math.floor(Math.random() * 31);
    } else {
        autoFuelCount = 10 + Math.floor(Math.random() * 21);
    }

    // Apply consistency variance and accuracy
    const variance = 1 - profile.consistency;
    autoFuelCount = Math.max(0, Math.floor(autoFuelCount * (1 + (Math.random() - 0.5) * variance)));
    autoFuelCount = Math.floor(autoFuelCount * profile.autoAccuracy);

    // Add auto fuel scored waypoints as bursts (multi-ball per action)
    let remainingAutoFuel = autoFuelCount;
    let autoScoreTimestamp = Date.now();
    while (remainingAutoFuel > 0) {
        const autoBurstMaxBySkill = {
            elite: 8,
            strong: 6,
            average: 5,
            developing: 4,
        } as const;
        const burst = Math.min(remainingAutoFuel, randomInt(2, autoBurstMaxBySkill[profile.skillLevel] ?? 5));
        const autoScoreSpot = pickWeightedSpot(ALLIANCE_SCORING_SPOTS, {
            preferredLane,
            preferredDepth,
            profile: 'auto',
        });
        autoActions.push({
            type: 'score',
            action: 'fuelScored',
            timestamp: autoScoreTimestamp,
            position: jitter(autoScoreSpot.pos, autoScoreSpot.spread),
            fuelDelta: -burst,
            amountLabel: `${burst}`,
        });
        remainingAutoFuel -= burst;
        autoScoreTimestamp += randomInt(700, 1400);
    }

    // Some robots collect from depot/outpost
    if (Math.random() < 0.4) {
        const collectCount = Math.floor(Math.random() * 3);
        for (let i = 0; i < collectCount; i++) {
            const isDepot = Math.random() < 0.5;
            autoActions.push({
                type: 'collect',
                action: isDepot ? 'depot' : 'outpost',
                timestamp: Date.now() + i * 1500,
                position: isDepot ? POSITIONS.depot : POSITIONS.outpost,
            });
        }
    }

    // =========================================================================
    // Teleop Phase - Generate PathWaypoint-style actions
    // =========================================================================
    const teleopActions: any[] = [];

    // Determine robot role - some robots are passers
    const isPasser = Math.random() < 0.25; // 25% chance to be a passer
    const playedDefense = Math.random() < 0.2;

    // Traversal archetype influences hopper size and cycle tempo
    // - bump-primary: larger hopper, fewer/bigger dumps
    // - trench-primary: smaller hopper, more frequent cleanup/cycles
    const bumpPrimaryChanceBySkill = {
        elite: 0.58,
        strong: 0.48,
        average: 0.34,
        developing: 0.25,
    } as const;
    let bumpPrimaryChance: number = bumpPrimaryChanceBySkill[profile.skillLevel] ?? 0.4;
    if (isPasser) bumpPrimaryChance -= 0.1;
    if (playedDefense) bumpPrimaryChance += 0.08;
    bumpPrimaryChance = Math.max(0.1, Math.min(0.9, bumpPrimaryChance));
    const traversalArchetype: 'bump' | 'trench' = Math.random() < bumpPrimaryChance ? 'bump' : 'trench';

    // Teleop fuel activity - Best robots ~400-500 total
    // Elite: 250-400, Strong: 180-280, Average: 100-200, Developing: 50-120
    let teleopFuelActivity = 0;
    if (profile.skillLevel === 'elite') {
        teleopFuelActivity = 250 + Math.floor(Math.random() * 151);
    } else if (profile.skillLevel === 'strong') {
        teleopFuelActivity = 180 + Math.floor(Math.random() * 101);
    } else if (profile.skillLevel === 'average') {
        teleopFuelActivity = 100 + Math.floor(Math.random() * 101);
    } else {
        teleopFuelActivity = 50 + Math.floor(Math.random() * 71);
    }

    // Apply variance and accuracy
    teleopFuelActivity = Math.max(0, Math.floor(teleopFuelActivity * (1 + (Math.random() - 0.5) * variance)));
    teleopFuelActivity = Math.floor(teleopFuelActivity * profile.teleopAccuracy);

    // In playoffs, teams push harder
    if (isPlayoff) {
        teleopFuelActivity = Math.floor(teleopFuelActivity * 1.15);
    }

    // Split between scoring and passing based on role
    let teleopFuelCount = 0;
    let teleopPassCount = 0;

    if (isPasser) {
        // Passers: 30% score, 70% pass
        teleopFuelCount = Math.floor(teleopFuelActivity * 0.3);
        teleopPassCount = Math.floor(teleopFuelActivity * 0.7);
    } else {
        // Scorers: 85% score, 15% pass
        teleopFuelCount = Math.floor(teleopFuelActivity * 0.85);
        teleopPassCount = Math.floor(teleopFuelActivity * 0.15);
    }

    // Add teleop scored waypoints as bursts (multi-ball per action)
    let remainingTeleopFuel = teleopFuelCount;
    let teleopScoreTimestamp = Date.now();
    while (remainingTeleopFuel > 0) {
        const scoreBurstRangeByArchetype = {
            bump: {
                elite: { min: 8, max: 80 },
                strong: { min: 7, max: 65 },
                average: { min: 6, max: 50 },
                developing: { min: 5, max: 40 },
            },
            trench: {
                elite: { min: 4, max: 50 },
                strong: { min: 4, max: 42 },
                average: { min: 3, max: 34 },
                developing: { min: 3, max: 26 },
            },
        } as const;
        const scoreBurstRange = scoreBurstRangeByArchetype[traversalArchetype][profile.skillLevel];
        const burst = Math.min(remainingTeleopFuel, randomInt(scoreBurstRange.min, scoreBurstRange.max));
        const useTeleopBias = Math.random() < 0.6;
        const teleopScoreSpot = pickWeightedSpot(
            ALLIANCE_SCORING_SPOTS,
            useTeleopBias
                ? { preferredLane, preferredDepth, profile: 'teleop' }
                : undefined
        );
        teleopActions.push({
            type: 'score',
            action: 'fuelScored',
            timestamp: teleopScoreTimestamp,
            position: jitter(teleopScoreSpot.pos, teleopScoreSpot.spread * 1.1),
            fuelDelta: -burst,
            amountLabel: `${burst}`,
        });
        remainingTeleopFuel -= burst;
        teleopScoreTimestamp += traversalArchetype === 'bump'
            ? randomInt(700, 1600)
            : randomInt(350, 900);
    }

    // Add fuel passed waypoints as bursts (distributed across neutral/opponent origin points)
    const opponentOriginChance = isPasser ? 0.55 : playedDefense ? 0.45 : 0.2;
    let remainingTeleopPasses = teleopPassCount;
    let teleopPassTimestamp = Date.now();
    while (remainingTeleopPasses > 0) {
        const passBurstRangeByArchetype = {
            bump: {
                elite: { min: 6, max: 55 },
                strong: { min: 5, max: 45 },
                average: { min: 4, max: 35 },
                developing: { min: 3, max: 28 },
            },
            trench: {
                elite: { min: 3, max: 35 },
                strong: { min: 3, max: 30 },
                average: { min: 2, max: 24 },
                developing: { min: 2, max: 18 },
            },
        } as const;
        const passBurstRange = passBurstRangeByArchetype[traversalArchetype][profile.skillLevel];
        const burst = Math.min(remainingTeleopPasses, randomInt(passBurstRange.min, passBurstRange.max));
        const passFromOpponentZone = Math.random() < opponentOriginChance;
        const usePassBias = Math.random() < 0.55;
        const passSpot = pickWeightedSpot(
            passFromOpponentZone ? OPPONENT_PASS_SPOTS : NEUTRAL_PASS_SPOTS,
            usePassBias
                ? { preferredLane, preferredDepth, profile: 'teleop' }
                : undefined
        );
        teleopActions.push({
            type: 'pass',
            action: 'fuelPassed',
            timestamp: teleopPassTimestamp,
            position: jitter(passSpot.pos, passSpot.spread),
            fuelDelta: -burst,
            amountLabel: `${burst}`,
        });
        remainingTeleopPasses -= burst;
        teleopPassTimestamp += traversalArchetype === 'bump'
            ? randomInt(650, 1400)
            : randomInt(420, 1000);
    }

    // =========================================================================
    // Robot Status (Toggles)
    // =========================================================================
    const autoRobotStatus: Record<string, boolean> = {
        // Auto climb L1 (15 pts) - elite teams sometimes do this
        autoClimbL1: profile.skillLevel === 'elite' && Math.random() < 0.2,
    };

    const teleopRobotStatus: Record<string, boolean> = {
        // Defense play
        playedDefense,
    };

    // =========================================================================
    // Endgame Robot Status (Tower Climbing + Roles)
    // =========================================================================
    const endgameRobotStatus: Record<string, boolean> = {
        // Tower climb (mutually exclusive)
        climbL1: false,
        climbL2: false,
        climbL3: false,
        climbFailed: false,
    };

    // Determine climb level based on skill and endgame success
    const endgameRoll = Math.random();

    if (endgameRoll < profile.endgameSuccess) {
        // Successful climb - pick level based on skill
        if (profile.skillLevel === 'elite' && Math.random() < 0.7) {
            // Elite teams often go for level 3
            endgameRobotStatus.climbL3 = true;
        } else if (profile.skillLevel === 'strong' || (profile.skillLevel === 'elite' && Math.random() < 0.9)) {
            // Strong teams usually level 2
            endgameRobotStatus.climbL2 = true;
        } else {
            // Average/developing teams go for level 1
            endgameRobotStatus.climbL1 = true;
        }
    } else {
        // Failed climb
        endgameRobotStatus.climbFailed = true;
    }

    // Active phase roles (multi-select) - favor passer role if isPasser
    const activeRoles = ['roleActiveCycler', 'roleActiveCleanUp', 'roleActivePasser', 'roleActiveDefense', 'roleActiveThief'];
    let selectedActiveRole;
    if (isPasser && Math.random() < 0.7) {
        selectedActiveRole = 'roleActivePasser';
    } else {
        selectedActiveRole = activeRoles[Math.floor(Math.random() * activeRoles.length)];
    }
    if (selectedActiveRole) {
        endgameRobotStatus[selectedActiveRole] = true;
    }

    // Inactive phase roles (multi-select)
    const inactiveRoles = ['roleInactiveCycler', 'roleInactiveCleanUp', 'roleInactivePasser'];
    let selectedInactiveRole;
    if (isPasser && Math.random() < 0.7) {
        selectedInactiveRole = 'roleInactivePasser';
    } else {
        selectedInactiveRole = inactiveRoles[Math.floor(Math.random() * inactiveRoles.length)];
    }
    if (selectedInactiveRole) {
        endgameRobotStatus[selectedInactiveRole] = true;
    }

    const isDefenseRole = selectedActiveRole === 'roleActiveDefense' || teleopRobotStatus.playedDefense;
    const isCyclerRole = selectedActiveRole === 'roleActiveCycler' || selectedActiveRole === 'roleActiveCleanUp';
    const skillFactorByLevel = {
        elite: 1.2,
        strong: 1.1,
        average: 1.0,
        developing: 0.9,
    } as const;
    const skillFactor = skillFactorByLevel[profile.skillLevel] ?? 1.0;
    const adjustedChance = (baseChance: number, maxChance = 0.95) => Math.max(0, Math.min(maxChance, baseChance * skillFactor));

    // Simulated breakdowns (rare) - primary source of non-traversal
    const breakdownChanceBySkill = {
        elite: 0.004,
        strong: 0.008,
        average: 0.015,
        developing: 0.03,
    } as const;
    const simulatedBreakdown = Math.random() < (breakdownChanceBySkill[profile.skillLevel] ?? 0.01);

    if (simulatedBreakdown) {
        const breakdownTimestamp = Date.now() + 45000;
        const breakdownDuration = 10000 + Math.floor(Math.random() * 50000);
        teleopActions.push({
            type: 'broken-down',
            action: 'broken-down',
            timestamp: breakdownTimestamp,
            position: jitter(POSITIONS.pass, 0.1),
            duration: breakdownDuration,
        });
    }

    // Passing zones (multi-select) tuned by likely playstyle
    const neutralToAllianceChance = adjustedChance(isPasser ? 0.8 : isCyclerRole ? 0.45 : isDefenseRole ? 0.2 : 0.3);
    const opponentToAllianceChance = adjustedChance(isPasser ? 0.5 : isCyclerRole ? 0.25 : isDefenseRole ? 0.15 : 0.2);
    const opponentToNeutralChance = adjustedChance(isPasser ? 0.7 : isCyclerRole ? 0.35 : isDefenseRole ? 0.2 : 0.25);

    if (Math.random() < neutralToAllianceChance) {
        endgameRobotStatus.passedToAllianceFromNeutral = true;
    }
    if (Math.random() < opponentToAllianceChance) {
        endgameRobotStatus.passedToAllianceFromOpponent = true;
    }
    if (Math.random() < opponentToNeutralChance) {
        endgameRobotStatus.passedToNeutral = true;
    }

    // Teleop traversal usage (post-match confirmation toggles)
    // Model as: did they traverse at all? if yes, pick one primary route (trench OR bump)
    // This keeps trench+bump near 100% among traversing teams, with a small non-traversal group.
    const isEliteCleanupSupport =
        profile.skillLevel === 'elite' &&
        selectedActiveRole === 'roleActiveCleanUp' &&
        !isPasser &&
        Math.random() < 0.08;

    let traversedFieldChance = isPasser ? 0.995 : isCyclerRole ? 0.99 : isDefenseRole ? 0.985 : 0.99;
    if (isEliteCleanupSupport) {
        traversedFieldChance = Math.min(traversedFieldChance, 0.7);
    }
    if (simulatedBreakdown) {
        traversedFieldChance = Math.min(traversedFieldChance, 0.05);
    }
    let trenchPreference = traversalArchetype === 'trench' ? 0.82 : 0.22;
    if (isPasser) trenchPreference += 0.06;
    if (isCyclerRole) trenchPreference += 0.04;
    if (isDefenseRole) trenchPreference -= 0.1;
    trenchPreference = Math.max(0.05, Math.min(0.95, trenchPreference));
    const usedTraversalRoute = Math.random() < traversedFieldChance;

    endgameRobotStatus.usedTrenchInTeleop = false;
    endgameRobotStatus.usedBumpInTeleop = false;

    if (usedTraversalRoute) {
        if (Math.random() < trenchPreference) {
            endgameRobotStatus.usedTrenchInTeleop = true;
        } else {
            endgameRobotStatus.usedBumpInTeleop = true;
        }
    }

    // Accuracy (mutually exclusive)
    const accuracyLevels = ['accuracyAll', 'accuracyMost', 'accuracySome', 'accuracyFew', 'accuracyLittle'];
    let accuracyIndex = 2; // Default to "some"
    if (profile.teleopAccuracy > 0.9) accuracyIndex = 0; // All
    else if (profile.teleopAccuracy > 0.75) accuracyIndex = 1; // Most
    else if (profile.teleopAccuracy > 0.5) accuracyIndex = 2; // Some
    else if (profile.teleopAccuracy > 0.25) accuracyIndex = 3; // Few
    else accuracyIndex = 4; // Little

    const selectedAccuracy = accuracyLevels[accuracyIndex];
    if (selectedAccuracy) {
        endgameRobotStatus[selectedAccuracy] = true;
    }

    // Corral usage
    endgameRobotStatus.usedCorral = Math.random() < 0.3;

    // =========================================================================
    // Optional Stalls and Stuck states (Obstacles)
    // =========================================================================

    // Auto stuck chance (5%)
    if (Math.random() < 0.05) {
        const obstacleKey = Math.random() < 0.5 ? 'trench1' : 'bump1';
        const obstacleType = obstacleKey.includes('trench') ? 'trench' : 'bump';
        const duration = 2000 + Math.floor(Math.random() * 5000);
        const timestamp = Date.now() + 5000;

        autoActions.push({
            type: 'stuck',
            action: `stuck-${obstacleType}`,
            timestamp,
            position: POSITIONS[obstacleKey],
            obstacleType
        });

        autoActions.push({
            type: 'unstuck',
            action: `unstuck-${obstacleType}`,
            timestamp: timestamp + duration,
            position: POSITIONS[obstacleKey],
            duration,
            obstacleType,
            amountLabel: `${Math.round(duration / 1000)}s`
        });
    }

    // Teleop stuck chance (15%)
    if (Math.random() < 0.15) {
        const obstacleKey = Math.random() < 0.5 ? 'trench2' : 'bump2';
        const obstacleType = obstacleKey.includes('trench') ? 'trench' : 'bump';
        const duration = 3000 + Math.floor(Math.random() * 15000);
        const timestamp = Date.now() + 30000;

        teleopActions.push({
            type: 'stuck',
            action: `stuck-${obstacleType}`,
            timestamp,
            position: POSITIONS[obstacleKey],
            obstacleType
        });

        teleopActions.push({
            type: 'unstuck',
            action: `unstuck-${obstacleType}`,
            timestamp: timestamp + duration,
            position: POSITIONS[obstacleKey],
            duration,
            obstacleType,
            amountLabel: `${Math.round(duration / 1000)}s`
        });
    }

    // Start position as boolean array (transformation also checks this)
    const startPosition = [false, false, false, false, false];
    startPosition[startPositionIndex] = true;

    // =========================================================================
    // Transform to database format using game transformation
    // =========================================================================
    const rawMatchData = {
        autoActions,
        teleopActions,
        autoRobotStatus,
        teleopRobotStatus,
        endgameRobotStatus,
        startPosition,
    };

    return gameDataTransformation.transformActionsToCounters(rawMatchData);
};
