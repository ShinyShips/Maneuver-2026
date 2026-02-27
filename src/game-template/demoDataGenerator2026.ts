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

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function sampleSkewedInt(min: number, max: number, skewPower = 1): number {
    const u = Math.random();
    const skewed = Math.pow(u, skewPower);
    return Math.floor(min + skewed * (max - min + 1));
}

function parseMatchOrdinal(matchKey: string): number {
    const normalized = matchKey.toLowerCase();
    const qm = normalized.match(/qm(\d+)/);
    if (qm && qm[1]) {
        return Number.parseInt(qm[1], 10);
    }

    const fallback = normalized.match(/(\d+)$/);
    if (fallback && fallback[1]) {
        return Number.parseInt(fallback[1], 10);
    }

    return 1;
}

function chooseClimbLocation(skillLevel: string, phase: 'auto' | 'teleop'): 'side' | 'middle' {
    const sideChanceBySkill = phase === 'auto'
        ? { elite: 0.72, strong: 0.64, average: 0.55, developing: 0.48 }
        : { elite: 0.78, strong: 0.7, average: 0.6, developing: 0.52 };
    const sideChance = sideChanceBySkill[skillLevel as keyof typeof sideChanceBySkill] ?? 0.55;
    return Math.random() < sideChance ? 'side' : 'middle';
}

function sampleAutoClimbStartSec(skillLevel: string): number {
    const baseBySkill = { elite: 4, strong: 6, average: 8, developing: 9 };
    const rushedChanceBySkill = { elite: 0.1, strong: 0.14, average: 0.2, developing: 0.28 };
    const cautiousChanceBySkill = { elite: 0.16, strong: 0.18, average: 0.2, developing: 0.25 };

    const base = baseBySkill[skillLevel as keyof typeof baseBySkill] ?? 8;
    let startSec = base + randomInt(-2, 2);

    if (Math.random() < (rushedChanceBySkill[skillLevel as keyof typeof rushedChanceBySkill] ?? 0.2)) {
        startSec -= randomInt(2, 4);
    }
    if (Math.random() < (cautiousChanceBySkill[skillLevel as keyof typeof cautiousChanceBySkill] ?? 0.2)) {
        startSec += randomInt(1, 3);
    }

    return clamp(startSec, 0, 20);
}

function maxTeleopClimbLevelForTime(startSec: number): 0 | 1 | 2 | 3 {
    if (startSec >= 26) return 3;
    if (startSec >= 14) return 2;
    if (startSec >= 8) return 1;
    return 0;
}

type TeleopClimbBuildStyle = 'l1-only' | 'l3-focused';

function chooseTeleopClimbBuildStyle(skillLevel: string): TeleopClimbBuildStyle {
    const l3FocusChanceBySkill = {
        elite: 0.82,
        strong: 0.64,
        average: 0.3,
        developing: 0.14,
    } as const;

    const l3FocusChance = l3FocusChanceBySkill[skillLevel as keyof typeof l3FocusChanceBySkill] ?? 0.35;
    return Math.random() < l3FocusChance ? 'l3-focused' : 'l1-only';
}

function sampleTeleopClimbStartSecForStyle(skillLevel: string, style: TeleopClimbBuildStyle): number {
    const baseBySkillAndStyle = {
        'l1-only': { elite: 14, strong: 18, average: 23, developing: 29 },
        'l3-focused': { elite: 23, strong: 31, average: 40, developing: 48 },
    } as const;

    const rushedChanceBySkill = { elite: 0.08, strong: 0.12, average: 0.18, developing: 0.26 };
    const cautiousChanceBySkill = style === 'l3-focused'
        ? { elite: 0.26, strong: 0.3, average: 0.34, developing: 0.36 }
        : { elite: 0.14, strong: 0.16, average: 0.2, developing: 0.24 };

    const base = baseBySkillAndStyle[style][skillLevel as keyof (typeof baseBySkillAndStyle)[TeleopClimbBuildStyle]]
        ?? (style === 'l3-focused' ? 38 : 24);
    let startSec = base + randomInt(-6, 6);

    if (style === 'l3-focused' && skillLevel === 'elite' && Math.random() < 0.35) {
        startSec -= randomInt(5, 11);
    }

    if (Math.random() < (rushedChanceBySkill[skillLevel as keyof typeof rushedChanceBySkill] ?? 0.16)) {
        startSec -= randomInt(4, 10);
    }
    if (Math.random() < (cautiousChanceBySkill[skillLevel as keyof typeof cautiousChanceBySkill] ?? 0.22)) {
        startSec += randomInt(3, 10);
    }

    return clamp(startSec, 0, 135);
}

function pickShotType(phase: 'auto' | 'teleop', skillLevel: string): 'onTheMove' | 'stationary' {
    if (phase === 'auto') {
        const movingChanceBySkill: Record<string, number> = {
            elite: 0.7,
            strong: 0.56,
            average: 0.32,
            developing: 0.14,
        };
        const movingChance = movingChanceBySkill[skillLevel] ?? 0.3;
        return Math.random() < movingChance ? 'onTheMove' : 'stationary';
    }

    const movingChanceBySkill: Record<string, number> = {
        elite: 0.82,
        strong: 0.66,
        average: 0.4,
        developing: 0.18,
    };
    const movingChance = movingChanceBySkill[skillLevel] ?? 0.4;
    return Math.random() < movingChance ? 'onTheMove' : 'stationary';
}

/**
 * Generate realistic 2026 game data based on team skill profile
 */
export const generate2026GameData: GameDataGenerator = (profile, matchKey) => {
    const isPlayoff = matchKey.includes('qf') || matchKey.includes('sf') || matchKey.includes('f');
    const matchOrdinal = parseMatchOrdinal(matchKey);
    const eventProgress = clamp(matchOrdinal / 70, 0, 1);
    const rhythmVariance = (Math.random() - 0.5) * (1 - profile.consistency) * 0.16;
    const progressionMultiplier = clamp(0.92 + eventProgress * 0.12 + rhythmVariance, 0.82, 1.18);
    const lowOutputChanceBySkill = {
        elite: 0.03,
        strong: 0.07,
        average: 0.13,
        developing: 0.2,
    } as const;
    const deadMatchChanceBySkill = {
        elite: 0.005,
        strong: 0.012,
        average: 0.025,
        developing: 0.05,
    } as const;

    let profilePerformanceFactor = 1;
    if (Math.random() < (lowOutputChanceBySkill[profile.skillLevel] ?? 0.1)) {
        profilePerformanceFactor *= 0.45 + Math.random() * 0.35;
    }
    if (Math.random() < (deadMatchChanceBySkill[profile.skillLevel] ?? 0.02)) {
        profilePerformanceFactor *= 0.03 + Math.random() * 0.12;
    }

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

    // Auto fuel scoring calibrated from real-event distributions (per-match outputs)
    const autoRangeBySkill = {
        elite: { min: 6, max: 34, skew: 1.8 },
        strong: { min: 2, max: 22, skew: 1.9 },
        average: { min: 0, max: 14, skew: 2.1 },
        developing: { min: 0, max: 8, skew: 2.3 },
    } as const;
    const autoRange = autoRangeBySkill[profile.skillLevel] ?? autoRangeBySkill.average;
    let autoFuelCount = sampleSkewedInt(autoRange.min, autoRange.max, autoRange.skew);

    // Apply consistency variance and accuracy
    const variance = 1 - profile.consistency;
    autoFuelCount = Math.max(0, Math.floor(autoFuelCount * (1 + (Math.random() - 0.5) * variance)));
    autoFuelCount = Math.max(0, Math.floor(autoFuelCount * profilePerformanceFactor));
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
            shotType: pickShotType('auto', profile.skillLevel),
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

    // Determine robot role tendencies
    const passerBaseBySkill = {
        elite: 0.18,
        strong: 0.24,
        average: 0.3,
        developing: 0.34,
    } as const;
    const defenseBaseBySkill = {
        elite: 0.1,
        strong: 0.16,
        average: 0.24,
        developing: 0.3,
    } as const;

    let passerChance = passerBaseBySkill[profile.skillLevel] ?? 0.24;
    passerChance += profile.teleopAccuracy < 0.65 ? 0.06 : -0.03;
    passerChance += profile.consistency < 0.72 ? 0.03 : -0.02;
    const isPasser = Math.random() < clamp(passerChance, 0.08, 0.55);

    let defenseChance = defenseBaseBySkill[profile.skillLevel] ?? 0.2;
    defenseChance += profile.consistency < 0.68 ? 0.06 : -0.03;
    defenseChance += isPlayoff ? -0.03 : 0.02;
    const playedDefense = Math.random() < clamp(defenseChance, 0.06, 0.45);

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

    // Teleop fuel activity calibrated from real-event long-tail distribution
    const teleopRangeBySkill = {
        elite: { min: 35, max: 170, skew: 1.35 },
        strong: { min: 18, max: 120, skew: 1.55 },
        average: { min: 8, max: 85, skew: 1.8 },
        developing: { min: 0, max: 52, skew: 2.1 },
    } as const;
    const teleopRange = teleopRangeBySkill[profile.skillLevel] ?? teleopRangeBySkill.average;
    let teleopFuelActivity = sampleSkewedInt(teleopRange.min, teleopRange.max, teleopRange.skew);

    // Apply variance and accuracy
    teleopFuelActivity = Math.max(0, Math.floor(teleopFuelActivity * (1 + (Math.random() - 0.5) * variance)));
    teleopFuelActivity = Math.max(0, Math.floor(teleopFuelActivity * progressionMultiplier));
    teleopFuelActivity = Math.max(0, Math.floor(teleopFuelActivity * profilePerformanceFactor));
    teleopFuelActivity = Math.floor(teleopFuelActivity * profile.teleopAccuracy);

    // In playoffs, teams push harder
    if (isPlayoff) {
        teleopFuelActivity = Math.floor(teleopFuelActivity * 1.15);
    }

    // Split between scoring and passing based on role
    let teleopFuelCount = 0;
    let teleopPassCount = 0;

    if (isPasser) {
        const isPurePasser = Math.random() < 0.55;
        if (isPurePasser) {
            // Pure pass specialists from observed data: heavy pass, minimal score
            teleopFuelCount = Math.floor(teleopFuelActivity * 0.15);
            teleopPassCount = Math.floor(teleopFuelActivity * 0.85);
        } else {
            // Hybrid passers still contribute some direct scoring
            teleopFuelCount = Math.floor(teleopFuelActivity * 0.4);
            teleopPassCount = Math.floor(teleopFuelActivity * 0.6);
        }
    } else {
        // Scorers pass occasionally, especially under pressure
        teleopFuelCount = Math.floor(teleopFuelActivity * 0.9);
        teleopPassCount = Math.floor(teleopFuelActivity * 0.1);
    }

    const passCapBySkill = {
        elite: 145,
        strong: 120,
        average: 95,
        developing: 75,
    } as const;
    teleopPassCount = Math.min(teleopPassCount, passCapBySkill[profile.skillLevel] ?? 100);

    // Add teleop scored waypoints as bursts (multi-ball per action)
    let remainingTeleopFuel = teleopFuelCount;
    let teleopScoreTimestamp = Date.now();
    while (remainingTeleopFuel > 0) {
        const scoreBurstRangeByArchetype = {
            bump: {
                elite: { min: 5, max: 34 },
                strong: { min: 4, max: 27 },
                average: { min: 3, max: 20 },
                developing: { min: 2, max: 14 },
            },
            trench: {
                elite: { min: 3, max: 24 },
                strong: { min: 2, max: 20 },
                average: { min: 2, max: 15 },
                developing: { min: 1, max: 10 },
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
            shotType: pickShotType('teleop', profile.skillLevel),
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
                elite: { min: 4, max: 26 },
                strong: { min: 3, max: 22 },
                average: { min: 2, max: 18 },
                developing: { min: 1, max: 14 },
            },
            trench: {
                elite: { min: 2, max: 20 },
                strong: { min: 2, max: 16 },
                average: { min: 1, max: 13 },
                developing: { min: 1, max: 10 },
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
    // Climbing Simulation (start time + location + outcome)
    // =========================================================================

    const autoRobotStatus: Record<string, boolean> = {
        autoClimbL1: false,
    };

    const autoClimbAttemptChanceBySkill = {
        elite: 0.38,
        strong: 0.26,
        average: 0.16,
        developing: 0.09,
    } as const;
    const autoClimbSuccessBaseBySkill = {
        elite: 0.9,
        strong: 0.76,
        average: 0.58,
        developing: 0.42,
    } as const;

    let autoAttemptChance: number = autoClimbAttemptChanceBySkill[profile.skillLevel] ?? 0.15;
    if (isPlayoff) autoAttemptChance = Math.min(0.55, autoAttemptChance + 0.05);

    if (Math.random() < autoAttemptChance) {
        const startSec = sampleAutoClimbStartSec(profile.skillLevel);
        const climbLocation = chooseClimbLocation(profile.skillLevel, 'auto');
        let successChance: number = autoClimbSuccessBaseBySkill[profile.skillLevel] ?? 0.6;

        if (startSec <= 2) successChance -= 0.35;
        else if (startSec <= 4) successChance -= 0.2;
        else if (startSec <= 6) successChance -= 0.08;
        else if (startSec >= 10) successChance += 0.05;

        successChance = clamp(successChance * (0.9 + profile.consistency * 0.2), 0.1, 0.98);
        const autoClimbSuccess = Math.random() < successChance;

        autoActions.push({
            type: 'climb',
            action: autoClimbSuccess ? 'climb-success' : 'climb-fail',
            timestamp: Date.now() + randomInt(12000, 19500),
            position: jitter(POSITIONS.tower, 0.02),
            climbResult: autoClimbSuccess ? 'success' : 'fail',
            climbLocation,
            climbStartTimeSecRemaining: startSec,
            amountLabel: `${climbLocation === 'side' ? 'Side' : 'Middle'} ${autoClimbSuccess ? 'Succeeded' : 'Failed'}`,
        });

        autoRobotStatus.autoClimbL1 = autoClimbSuccess;
    }

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

    const teleopClimbAttemptChanceBySkill = {
        elite: 0.97,
        strong: 0.9,
        average: 0.78,
        developing: 0.62,
    } as const;

    let teleopAttemptChance: number = teleopClimbAttemptChanceBySkill[profile.skillLevel] ?? 0.75;
    if (isPlayoff) teleopAttemptChance = Math.min(0.99, teleopAttemptChance + 0.03);

    if (Math.random() < teleopAttemptChance) {
        const buildStyle = chooseTeleopClimbBuildStyle(profile.skillLevel);
        const climbStartTimeSecRemaining = sampleTeleopClimbStartSecForStyle(profile.skillLevel, buildStyle);
        const climbLocation = chooseClimbLocation(profile.skillLevel, 'teleop');
        const desiredLevel: 1 | 3 = buildStyle === 'l3-focused' ? 3 : 1;
        const maxLevelByTime = maxTeleopClimbLevelForTime(climbStartTimeSecRemaining);
        let achievedLevel: 1 | 2 | 3 = desiredLevel;
        let overreachingLevel = false;

        if (buildStyle === 'l1-only') {
            achievedLevel = 1;
        } else {
            if (maxLevelByTime >= 3) {
                achievedLevel = 3;
            } else if (maxLevelByTime === 2) {
                // Rarely settle for L2; most L3-focused teams still attempt L3 and risk failure
                if (Math.random() < 0.14) {
                    achievedLevel = 2;
                } else {
                    achievedLevel = 3;
                    overreachingLevel = true;
                }
            } else {
                achievedLevel = 3;
                overreachingLevel = true;
            }
        }

        let successChance = profile.endgameSuccess;
        successChance += buildStyle === 'l1-only' ? 0.08 : -0.03;
        successChance -= (achievedLevel - 1) * 0.07;
        if (overreachingLevel) successChance -= 0.18;
        if (climbStartTimeSecRemaining <= 5) successChance -= 0.28;
        else if (climbStartTimeSecRemaining <= 8) successChance -= 0.16;
        else if (climbStartTimeSecRemaining <= 12) successChance -= 0.08;
        successChance = clamp(successChance * (0.9 + profile.consistency * 0.2), 0.05, 0.98);

        const canAttemptAtAll = maxLevelByTime > 0;
        const climbSuccess = canAttemptAtAll && Math.random() < successChance;

        teleopActions.push({
            type: 'climb',
            action: climbSuccess ? `climbL${achievedLevel}` : 'climb-fail',
            timestamp: Date.now() + randomInt(85000, 130000),
            position: jitter(POSITIONS.tower, 0.02),
            climbLevel: achievedLevel,
            climbResult: climbSuccess ? 'success' : 'fail',
            climbLocation,
            climbStartTimeSecRemaining,
            amountLabel: `${climbLocation === 'side' ? 'Side' : 'Middle'} L${achievedLevel} ${climbSuccess ? '✓' : '✗'}`,
        });

        if (climbSuccess) {
            endgameRobotStatus[`climbL${achievedLevel}`] = true;
        } else {
            endgameRobotStatus.climbFailed = true;
        }
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

    const transformed = gameDataTransformation.transformActionsToCounters(rawMatchData);

    // Simulate occasional incomplete passing tracking in scouting entries.
    // This keeps demo data realistic for analytics that must handle missing assist inputs.
    const passTrackingMissingChanceBySkill = {
        elite: 0.06,
        strong: 0.1,
        average: 0.15,
        developing: 0.2,
    } as const;

    const passTrackingMissingChance = passTrackingMissingChanceBySkill[profile.skillLevel] ?? 0.12;
    if (Math.random() < passTrackingMissingChance) {
        if (transformed.auto && typeof transformed.auto === 'object') {
            delete transformed.auto.fuelPassedCount;
        }
        if (transformed.teleop && typeof transformed.teleop === 'object') {
            delete transformed.teleop.fuelPassedCount;
        }
    }

    return transformed;
};
