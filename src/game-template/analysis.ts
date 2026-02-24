/**
 * Game-Specific Strategy Analysis - 2026 REBUILT
 * 
 * This module provides team statistics calculations and display configuration
 * for the Team Statistics page.
 * 
 * 2026 GAME: REBUILT
 * - Primary: Fuel scoring (bulk counters)
 * - Secondary: Tower climbing (3 levels)
 * - New: Auto L1 climb for bonus points
 */

import type { StrategyAnalysis, TeamStats } from "@/types/game-interfaces";
import type { ScoutingEntryBase } from "@/types/scouting-entry";
import type {
    StatSectionDefinition,
    RateSectionDefinition,
    MatchBadgeDefinition,
    StartPositionConfig,
} from "@/types/team-stats-display";
import { scoringCalculations } from "@/game-template/scoring";
import type { GameData as CoreGameData } from "@/game-template/scoring";
// Use 2026 field images
import fieldMapRedImage from "@/game-template/assets/2026-field-red.png";
import fieldMapBlueImage from "@/game-template/assets/2026-field-blue.png";


/**
 * Template scouting entry type
 * Extends ScoutingEntryBase with game-specific gameData
 */
type ScoutingEntryTemplate = ScoutingEntryBase & {
    gameData: CoreGameData;
};

/**
 * Team statistics for 2026 REBUILT
 */
export interface TeamStatsTemplate extends TeamStats {
    // Point averages
    avgTotalPoints: number;
    avgAutoPoints: number;
    avgTeleopPoints: number;
    avgEndgamePoints: number;

    // Fuel averages
    avgAutoFuel: number;
    avgTeleopFuel: number;
    avgAutoFuelPassed: number;
    avgTeleopFuelPassed: number;
    avgFuelPassed: number;
    avgTotalFuel: number;
    avgScaledAutoFuel: number;
    avgScaledTeleopFuel: number;
    avgScaledTotalFuel: number;
    fuelAutoOPR: number;
    fuelTeleopOPR: number;
    fuelTotalOPR: number;
    avgAutoClimbStartTimeSec: number;
    avgTeleopClimbStartTimeSec: number;

    // Fuel maximums
    maxAutoFuel: number;
    maxTeleopFuel: number;
    maxAutoFuelPassed: number;
    maxTeleopFuelPassed: number;
    maxFuelPassed: number;
    maxTotalFuel: number;

    // Rate metrics (0-100%)
    mobilityRate: number;
    autoClimbRate: number;
    autoClimbFromSideRate: number;
    autoClimbFromMiddleRate: number;
    autoClimbAttempts: number;
    climbL1Rate: number;
    climbL1Count: number;
    climbL1Attempts: number;
    climbL2Rate: number;
    climbL2Count: number;
    climbL2Attempts: number;
    climbL3Rate: number;
    climbL3Count: number;
    climbL3Attempts: number;
    climbSuccessRate: number;
    climbFromSideRate: number;
    climbFromMiddleRate: number;
    defenseRate: number;
    autoShotOnTheMoveRate: number;
    autoShotStationaryRate: number;
    teleopShotOnTheMoveRate: number;
    teleopShotStationaryRate: number;

    // Stuck metrics (percentage of matches)
    trenchStuckRate: number;
    bumpStuckRate: number;
    brokeDownRate: number;
    noShowRate: number;
    usedTrenchInTeleopRate: number;
    usedBumpInTeleopRate: number;
    passedToAllianceFromNeutralRate: number;
    passedToAllianceFromOpponentRate: number;
    passedToNeutralRate: number;

    // Start position percentages
    startPositions: Record<string, number>;

    // Match results for performance tab
    matchResults: MatchResult[];
}

/**
 * Match result data for performance display
 */
export interface MatchResult {
    matchNumber: string;
    alliance: string;
    eventKey: string;
    teamNumber?: number;
    scoutName?: string;
    totalPoints: number;
    autoPoints: number;
    teleopPoints: number;
    endgamePoints: number;
    endgameSuccess: boolean;
    climbAttempted: boolean;
    climbFailed: boolean;
    climbLevel: number; // 0=none, 1-3=level
    brokeDown: boolean;
    noShow: boolean;
    startPosition: number;
    comment: string;
    // Fuel data
    autoFuel: number;
    teleopFuel: number;
    fuelPassed: number;
    autoFuelPassed: number;
    teleopFuelPassed: number;
    // Path data
    autoPath?: any[]; // Array of waypoint actions from auto period
    teleopPath?: any[]; // Array of waypoint actions from teleop period
    [key: string]: unknown;
}

/**
 * Strategy Analysis Implementation for 2026
 */
export const strategyAnalysis: StrategyAnalysis<ScoutingEntryTemplate> = {
    /**
     * Calculate basic statistics for a team
     */
    calculateBasicStats(entries: ScoutingEntryTemplate[]): TeamStatsTemplate {
        const matchCount = entries.length;

        if (matchCount === 0) {
            return {
                // Base TeamStats required fields
                teamNumber: 0,
                eventKey: '',
                matchCount: 0,
                totalPoints: 0,
                autoPoints: 0,
                teleopPoints: 0,
                endgamePoints: 0,
                overall: { avgTotalPoints: 0, totalPiecesScored: 0, avgGamePiece1: 0, avgGamePiece2: 0 },
                auto: { avgPoints: 0, avgGamePiece1: 0, avgGamePiece2: 0, mobilityRate: 0, startPositions: [] },
                teleop: { avgPoints: 0, avgGamePiece1: 0, avgGamePiece2: 0 },
                endgame: { avgPoints: 0, climbRate: 0, parkRate: 0 },
                // Template-specific fields
                matchesPlayed: 0,
                avgTotalPoints: 0,
                avgAutoPoints: 0,
                avgTeleopPoints: 0,
                avgEndgamePoints: 0,
                avgAutoFuel: 0,
                avgTeleopFuel: 0,
                avgAutoFuelPassed: 0,
                avgTeleopFuelPassed: 0,
                avgFuelPassed: 0,
                avgTotalFuel: 0,
                avgScaledAutoFuel: 0,
                avgScaledTeleopFuel: 0,
                avgScaledTotalFuel: 0,
                fuelAutoOPR: 0,
                fuelTeleopOPR: 0,
                fuelTotalOPR: 0,
                avgAutoClimbStartTimeSec: 0,
                avgTeleopClimbStartTimeSec: 0,
                maxAutoFuel: 0,
                maxTeleopFuel: 0,
                maxAutoFuelPassed: 0,
                maxTeleopFuelPassed: 0,
                maxFuelPassed: 0,
                maxTotalFuel: 0,
                mobilityRate: 0,
                autoClimbRate: 0,
                autoClimbFromSideRate: 0,
                autoClimbFromMiddleRate: 0,
                autoClimbAttempts: 0,
                climbL1Rate: 0,
                climbL1Count: 0,
                climbL1Attempts: 0,
                climbL2Rate: 0,
                climbL2Count: 0,
                climbL2Attempts: 0,
                climbL3Rate: 0,
                climbL3Count: 0,
                climbL3Attempts: 0,
                climbSuccessRate: 0,
                climbFromSideRate: 0,
                climbFromMiddleRate: 0,
                defenseRate: 0,
                autoShotOnTheMoveRate: 0,
                autoShotStationaryRate: 0,
                teleopShotOnTheMoveRate: 0,
                teleopShotStationaryRate: 0,
                trenchStuckRate: 0,
                bumpStuckRate: 0,
                brokeDownRate: 0,
                noShowRate: 0,
                usedTrenchInTeleopRate: 0,
                usedBumpInTeleopRate: 0,
                passedToAllianceFromNeutralRate: 0,
                passedToAllianceFromOpponentRate: 0,
                passedToNeutralRate: 0,
                startPositions: {},
                matchResults: [],
                primaryActiveRole: 'None',
                primaryInactiveRole: 'None',
                roleActiveCleanUpRate: 0,
                roleActivePasserRate: 0,
                roleActiveDefenseRate: 0,
                roleActiveCyclerRate: 0,
                roleActiveThiefRate: 0,
                roleInactiveCleanUpRate: 0,
                roleInactivePasserRate: 0,
                roleInactiveDefenseRate: 0,
                roleInactiveCyclerRate: 0,
                roleInactiveThiefRate: 0,
            };
        }

        // Calculate totals
        const totals = entries.reduce((acc, entry) => {
            const gameData = entry.gameData;

            const scaledMetrics = gameData?.scaledMetrics as {
                scaledAutoFuel?: number;
                scaledTeleopFuel?: number;
            } | undefined;

            const rawAutoFuel = gameData?.auto?.fuelScoredCount || 0;
            const rawTeleopFuel = gameData?.teleop?.fuelScoredCount || 0;
            const scaledAutoFuel = typeof scaledMetrics?.scaledAutoFuel === 'number'
                ? scaledMetrics.scaledAutoFuel
                : rawAutoFuel;
            const scaledTeleopFuel = typeof scaledMetrics?.scaledTeleopFuel === 'number'
                ? scaledMetrics.scaledTeleopFuel
                : rawTeleopFuel;

            // Fuel counts
            acc.autoFuel += rawAutoFuel;
            acc.teleopFuel += rawTeleopFuel;
            acc.scaledAutoFuel += scaledAutoFuel;
            acc.scaledTeleopFuel += scaledTeleopFuel;
            acc.autoFuelPassed += gameData?.auto?.fuelPassedCount || 0;
            acc.teleopFuelPassed += gameData?.teleop?.fuelPassedCount || 0;
            acc.fuelPassed += (gameData?.auto?.fuelPassedCount || 0) + (gameData?.teleop?.fuelPassedCount || 0);

            // Toggles
            acc.mobility += gameData?.auto?.leftStartZone ? 1 : 0;
            acc.autoClimb += gameData?.auto?.autoClimbL1 ? 1 : 0;
            acc.autoClimbFromSide += gameData?.auto?.autoClimbFromSide ? 1 : 0;
            acc.autoClimbFromMiddle += gameData?.auto?.autoClimbFromMiddle ? 1 : 0;
            acc.climbL1 += gameData?.endgame?.climbL1 ? 1 : 0;
            acc.climbL2 += gameData?.endgame?.climbL2 ? 1 : 0;
            acc.climbL3 += gameData?.endgame?.climbL3 ? 1 : 0;
            acc.climbFailed += gameData?.endgame?.climbFailed ? 1 : 0;
            acc.climbFromSide += gameData?.endgame?.climbFromSide ? 1 : 0;
            acc.climbFromMiddle += gameData?.endgame?.climbFromMiddle ? 1 : 0;
            acc.defense += gameData?.teleop?.playedDefense ? 1 : 0;
            acc.autoShotOnTheMove += Number(gameData?.auto?.shotOnTheMoveCount ?? 0);
            acc.autoShotStationary += Number(gameData?.auto?.shotStationaryCount ?? 0);
            acc.teleopShotOnTheMove += Number(gameData?.teleop?.shotOnTheMoveCount ?? 0);
            acc.teleopShotStationary += Number(gameData?.teleop?.shotStationaryCount ?? 0);

            // Track stuck occurrences (any stuck in auto or teleop)
            acc.trenchStuck += (gameData?.auto?.trenchStuckCount || 0) > 0 || (gameData?.teleop?.trenchStuckCount || 0) > 0 ? 1 : 0;
            acc.bumpStuck += (gameData?.auto?.bumpStuckCount || 0) > 0 || (gameData?.teleop?.bumpStuckCount || 0) > 0 ? 1 : 0;
            acc.brokeDown += (gameData?.auto?.brokenDownCount || 0) > 0 || (gameData?.teleop?.brokenDownCount || 0) > 0 ? 1 : 0;
            acc.noShow += (entry as ScoutingEntryTemplate & { noShow?: boolean }).noShow === true || /no\s*show/i.test(entry.comments || '') ? 1 : 0;
            acc.usedTrenchInTeleop += gameData?.endgame?.usedTrenchInTeleop ? 1 : 0;
            acc.usedBumpInTeleop += gameData?.endgame?.usedBumpInTeleop ? 1 : 0;
            acc.passedToAllianceFromNeutral += gameData?.endgame?.passedToAllianceFromNeutral ? 1 : 0;
            acc.passedToAllianceFromOpponent += gameData?.endgame?.passedToAllianceFromOpponent ? 1 : 0;
            acc.passedToNeutral += gameData?.endgame?.passedToNeutral ? 1 : 0;
            acc.accuracyAll += gameData?.endgame?.accuracyAll ? 1 : 0;
            acc.accuracyMost += gameData?.endgame?.accuracyMost ? 1 : 0;
            acc.accuracySome += gameData?.endgame?.accuracySome ? 1 : 0;
            acc.accuracyFew += gameData?.endgame?.accuracyFew ? 1 : 0;
            acc.accuracyLittle += gameData?.endgame?.accuracyLittle ? 1 : 0;

            // Active shift roles (stored in endgame section)
            acc.roleActiveCleanUp += gameData?.endgame?.roleActiveCleanUp ? 1 : 0;
            acc.roleActivePasser += gameData?.endgame?.roleActivePasser ? 1 : 0;
            acc.roleActiveDefense += gameData?.endgame?.roleActiveDefense ? 1 : 0;
            acc.roleActiveCycler += gameData?.endgame?.roleActiveCycler ? 1 : 0;
            acc.roleActiveThief += gameData?.endgame?.roleActiveThief ? 1 : 0;

            // Inactive shift roles (stored in endgame section)
            acc.roleInactiveCleanUp += gameData?.endgame?.roleInactiveCleanUp ? 1 : 0;
            acc.roleInactivePasser += gameData?.endgame?.roleInactivePasser ? 1 : 0;
            acc.roleInactiveDefense += gameData?.endgame?.roleInactiveDefense ? 1 : 0;
            acc.roleInactiveCycler += gameData?.endgame?.roleInactiveCycler ? 1 : 0;
            acc.roleInactiveThief += gameData?.endgame?.roleInactiveThief ? 1 : 0;

            // Track start positions
            const pos = gameData?.auto?.startPosition;
            if (pos !== null && pos !== undefined && pos >= 0) {
                acc.startPositionCounts[pos] = (acc.startPositionCounts[pos] || 0) + 1;
            }

            return acc;
        }, {
            autoFuel: 0,
            teleopFuel: 0,
            scaledAutoFuel: 0,
            scaledTeleopFuel: 0,
            autoFuelPassed: 0,
            teleopFuelPassed: 0,
            fuelPassed: 0,
            mobility: 0,
            autoClimb: 0,
            autoClimbFromSide: 0,
            autoClimbFromMiddle: 0,
            climbL1: 0,
            climbL2: 0,
            climbL3: 0,
            climbFailed: 0,
            climbFromSide: 0,
            climbFromMiddle: 0,
            defense: 0,
            autoShotOnTheMove: 0,
            autoShotStationary: 0,
            teleopShotOnTheMove: 0,
            teleopShotStationary: 0,
            trenchStuck: 0,
            bumpStuck: 0,
            brokeDown: 0,
            noShow: 0,
            usedTrenchInTeleop: 0,
            usedBumpInTeleop: 0,
            passedToAllianceFromNeutral: 0,
            passedToAllianceFromOpponent: 0,
            passedToNeutral: 0,
            accuracyAll: 0,
            accuracyMost: 0,
            accuracySome: 0,
            accuracyFew: 0,
            accuracyLittle: 0,
            startPositionCounts: {} as Record<number, number>,
            roleActiveCleanUp: 0,
            roleActivePasser: 0,
            roleActiveDefense: 0,
            roleActiveCycler: 0,
            roleActiveThief: 0,
            roleInactiveCleanUp: 0,
            roleInactivePasser: 0,
            roleInactiveDefense: 0,
            roleInactiveCycler: 0,
            roleInactiveThief: 0,
        });

        // Calculate match results
        const matchResults: MatchResult[] = entries.map(entry => {
            const autoPoints = scoringCalculations.calculateAutoPoints(entry as any);
            const teleopPoints = scoringCalculations.calculateTeleopPoints(entry as any);
            const endgamePoints = scoringCalculations.calculateEndgamePoints(entry as any);

            // Determine climb level
            let climbLevel = 0;
            if (entry.gameData?.endgame?.climbL3) climbLevel = 3;
            else if (entry.gameData?.endgame?.climbL2) climbLevel = 2;
            else if (entry.gameData?.endgame?.climbL1) climbLevel = 1;
            const climbFailed = entry.gameData?.endgame?.climbFailed === true;
            const climbAttempted = climbLevel > 0 || climbFailed;
            const isNoShow = (entry as ScoutingEntryTemplate & { noShow?: boolean }).noShow === true
                || /no\s*show/i.test(entry.comments || '');

            return {
                matchNumber: String(entry.matchNumber),
                teamNumber: entry.teamNumber,
                scoutName: entry.scoutName,
                alliance: entry.allianceColor,
                eventKey: entry.eventKey || '',
                totalPoints: autoPoints + teleopPoints + endgamePoints,
                autoPoints,
                teleopPoints,
                endgamePoints,
                endgameSuccess: climbLevel > 0,
                climbAttempted,
                climbFailed,
                climbLevel,
                brokeDown: (entry.gameData?.auto?.brokenDownCount || 0) > 0
                    || (entry.gameData?.teleop?.brokenDownCount || 0) > 0,
                noShow: isNoShow,
                startPosition: entry.gameData?.auto?.startPosition ?? -1,
                comment: entry.comments || '',
                autoFuel: entry.gameData?.auto?.fuelScoredCount || 0,
                teleopFuel: entry.gameData?.teleop?.fuelScoredCount || 0,
                fuelPassed: (entry.gameData?.auto?.fuelPassedCount || 0) + (entry.gameData?.teleop?.fuelPassedCount || 0),
                autoFuelPassed: entry.gameData?.auto?.fuelPassedCount || 0,
                teleopFuelPassed: entry.gameData?.teleop?.fuelPassedCount || 0,
                autoPath: Array.isArray(entry.gameData?.auto?.autoPath) 
                    ? entry.gameData.auto.autoPath.filter((wp: any) => wp && wp.position) 
                    : (Array.isArray(entry.gameData?.auto?.actions) ? entry.gameData.auto.actions.filter((wp: any) => wp && wp.position) : []),
                teleopPath: Array.isArray(entry.gameData?.teleop?.teleopPath)
                    ? entry.gameData.teleop.teleopPath.filter((wp: any) => wp && wp.position)
                    : (Array.isArray(entry.gameData?.teleop?.actions) ? entry.gameData.teleop.actions.filter((wp: any) => wp && wp.position) : []),
                gameData: entry.gameData,
            };
        });

        // Calculate start position percentages
        const startPositions: Record<string, number> = {};
        Object.entries(totals.startPositionCounts).forEach(([pos, count]) => {
            startPositions[`position${pos}`] = Math.round((count / matchCount) * 100);
        });

        const avgAutoPoints = matchResults.reduce((sum, m) => sum + m.autoPoints, 0) / matchCount;
        const avgTeleopPoints = matchResults.reduce((sum, m) => sum + m.teleopPoints, 0) / matchCount;
        const avgEndgamePoints = matchResults.reduce((sum, m) => sum + m.endgamePoints, 0) / matchCount;
        const climbSuccessCount = totals.climbL1 + totals.climbL2 + totals.climbL3;
        const autoClimbLocationAttemptCount = totals.autoClimbFromSide + totals.autoClimbFromMiddle;
        const autoClimbAttemptCount = Math.max(totals.autoClimb, autoClimbLocationAttemptCount);
        const endgameClimbLocationAttemptCount = totals.climbFromSide + totals.climbFromMiddle;
        const hasAttemptAtLevel = (entry: ScoutingEntryTemplate, level: 1 | 2 | 3): boolean => {
            const endgame = entry.gameData?.endgame as Record<string, unknown> | undefined;
            if (endgame?.[`climbAttemptL${level}`] === true) return true;
            if (endgame?.[`climbL${level}`] === true) return true;

            const teleopPath = entry.gameData?.teleop?.teleopPath;
            if (Array.isArray(teleopPath)) {
                return teleopPath.some((waypoint) => {
                    if (!waypoint || typeof waypoint !== 'object') return false;
                    const record = waypoint as Record<string, unknown>;
                    return record.type === 'climb' && record.climbLevel === level;
                });
            }

            return false;
        };
        const climbAttemptL1Count = entries.filter(entry => hasAttemptAtLevel(entry, 1)).length;
        const climbAttemptL2Count = entries.filter(entry => hasAttemptAtLevel(entry, 2)).length;
        const climbAttemptL3Count = entries.filter(entry => hasAttemptAtLevel(entry, 3)).length;
        const levelAttemptCount = climbAttemptL1Count + climbAttemptL2Count + climbAttemptL3Count;
        const teleopClimbAttemptCount = Math.max(levelAttemptCount, climbSuccessCount + totals.climbFailed, endgameClimbLocationAttemptCount);

        const autoClimbStartTimes = entries
            .map(entry => entry.gameData?.auto?.autoClimbStartTimeSecRemaining)
            .filter((time): time is number => typeof time === 'number');
        const teleopClimbStartTimes = entries
            .map(entry => entry.gameData?.teleop?.teleopClimbStartTimeSecRemaining)
            .filter((time): time is number => typeof time === 'number');
        const avgAutoClimbStartTimeSec = autoClimbStartTimes.length > 0
            ? autoClimbStartTimes.reduce((sum, time) => sum + time, 0) / autoClimbStartTimes.length
            : 0;
        const avgTeleopClimbStartTimeSec = teleopClimbStartTimes.length > 0
            ? teleopClimbStartTimes.reduce((sum, time) => sum + time, 0) / teleopClimbStartTimes.length
            : 0;
        const autoShotTypeTotal = totals.autoShotOnTheMove + totals.autoShotStationary;
        const teleopShotTypeTotal = totals.teleopShotOnTheMove + totals.teleopShotStationary;
        const accuracySelectionCount = totals.accuracyAll + totals.accuracyMost + totals.accuracySome + totals.accuracyFew + totals.accuracyLittle;
        const weightedAccuracyTotal =
            (totals.accuracyAll * 5)
            + (totals.accuracyMost * 4)
            + (totals.accuracySome * 3)
            + (totals.accuracyFew * 2)
            + (totals.accuracyLittle * 1);
        const accuracyScore = accuracySelectionCount > 0
            ? Math.round((weightedAccuracyTotal / (accuracySelectionCount * 5)) * 100)
            : 0;

        // Calculate primary roles (most frequently played, supporting ties)
        const activeRoles = [
            { name: 'Cycler', count: totals.roleActiveCycler },
            { name: 'Clean Up', count: totals.roleActiveCleanUp },
            { name: 'Passer', count: totals.roleActivePasser },
            { name: 'Thief', count: totals.roleActiveThief },
            { name: 'Defense', count: totals.roleActiveDefense },
        ];
        const maxActiveCount = Math.max(...activeRoles.map(r => r.count));
        const topActiveRoles = activeRoles.filter(r => r.count === maxActiveCount && r.count > 0);
        const primaryActiveRole = topActiveRoles.length > 0 ? topActiveRoles.map(r => r.name).join(' / ') : 'None';

        const inactiveRoles = [
            { name: 'Cycler', count: totals.roleInactiveCycler },
            { name: 'Clean Up', count: totals.roleInactiveCleanUp },
            { name: 'Passer', count: totals.roleInactivePasser },
            { name: 'Thief', count: totals.roleInactiveThief },
            { name: 'Defense', count: totals.roleInactiveDefense },
        ];
        const maxInactiveCount = Math.max(...inactiveRoles.map(r => r.count));
        const topInactiveRoles = inactiveRoles.filter(r => r.count === maxInactiveCount && r.count > 0);
        const primaryInactiveRole = topInactiveRoles.length > 0 ? topInactiveRoles.map(r => r.name).join(' / ') : 'None';

        return {
            // Base TeamStats required fields
            teamNumber: entries[0]?.teamNumber || 0,
            eventKey: entries[0]?.eventKey || '',
            matchCount,
            totalPoints: matchResults.reduce((sum, m) => sum + m.totalPoints, 0),
            autoPoints: matchResults.reduce((sum, m) => sum + m.autoPoints, 0),
            teleopPoints: matchResults.reduce((sum, m) => sum + m.teleopPoints, 0),
            endgamePoints: matchResults.reduce((sum, m) => sum + m.endgamePoints, 0),
            overall: {
                avgTotalPoints: Math.round((avgAutoPoints + avgTeleopPoints + avgEndgamePoints) * 10) / 10,
                totalPiecesScored: Math.round((totals.autoFuel + totals.teleopFuel) / matchCount * 10) / 10,
                avgGamePiece1: Math.round(((totals.autoFuel + totals.teleopFuel) / matchCount) * 10) / 10,
                avgGamePiece2: Math.round((totals.fuelPassed / matchCount) * 10) / 10,
            },
            auto: {
                avgPoints: Math.round(avgAutoPoints * 10) / 10,
                avgGamePiece1: Math.round((totals.autoFuel / matchCount) * 10) / 10,
                avgGamePiece2: 0,
                mobilityRate: Math.round((totals.mobility / matchCount) * 100),
                startPositions: Object.entries(startPositions).map(([key, value]) => ({ position: key, percentage: value })),
            },
            teleop: {
                avgPoints: Math.round(avgTeleopPoints * 10) / 10,
                avgGamePiece1: Math.round((totals.teleopFuel / matchCount) * 10) / 10,
                avgGamePiece2: Math.round((totals.fuelPassed / matchCount) * 10) / 10,
            },
            endgame: {
                avgPoints: Math.round(avgEndgamePoints * 10) / 10,
                climbRate: teleopClimbAttemptCount > 0
                    ? Math.round((climbSuccessCount / teleopClimbAttemptCount) * 100)
                    : 0,
                parkRate: 0,
            },
            // Template-specific fields
            matchesPlayed: matchCount,
            avgTotalPoints: Math.round((avgAutoPoints + avgTeleopPoints + avgEndgamePoints) * 10) / 10,
            avgAutoPoints: Math.round(avgAutoPoints * 10) / 10,
            avgTeleopPoints: Math.round(avgTeleopPoints * 10) / 10,
            avgEndgamePoints: Math.round(avgEndgamePoints * 10) / 10,
            avgAutoFuel: Math.round((totals.autoFuel / matchCount) * 10) / 10,
            avgTeleopFuel: Math.round((totals.teleopFuel / matchCount) * 10) / 10,
            avgAutoFuelPassed: Math.round((totals.autoFuelPassed / matchCount) * 10) / 10,
            avgTeleopFuelPassed: Math.round((totals.teleopFuelPassed / matchCount) * 10) / 10,
            avgFuelPassed: Math.round((totals.fuelPassed / matchCount) * 10) / 10,
            avgTotalFuel: Math.round(((totals.autoFuel + totals.teleopFuel) / matchCount) * 10) / 10,
            avgScaledAutoFuel: Math.round((totals.scaledAutoFuel / matchCount) * 10) / 10,
            avgScaledTeleopFuel: Math.round((totals.scaledTeleopFuel / matchCount) * 10) / 10,
            avgScaledTotalFuel: Math.round(((totals.scaledAutoFuel + totals.scaledTeleopFuel) / matchCount) * 10) / 10,
            fuelAutoOPR: 0,
            fuelTeleopOPR: 0,
            fuelTotalOPR: 0,
            avgAutoClimbStartTimeSec: Math.round(avgAutoClimbStartTimeSec * 10) / 10,
            avgTeleopClimbStartTimeSec: Math.round(avgTeleopClimbStartTimeSec * 10) / 10,
            maxAutoFuel: Math.max(...matchResults.map(m => m.autoFuel || 0)),
            maxTeleopFuel: Math.max(...matchResults.map(m => m.teleopFuel || 0)),
            maxAutoFuelPassed: Math.max(...matchResults.map(m => m.autoFuelPassed || 0)),
            maxTeleopFuelPassed: Math.max(...matchResults.map(m => m.teleopFuelPassed || 0)),
            maxFuelPassed: Math.max(...matchResults.map(m => (m.autoFuelPassed || 0) + (m.teleopFuelPassed || 0))),
            maxTotalFuel: Math.max(...matchResults.map(m => (m.autoFuel || 0) + (m.teleopFuel || 0))),
            mobilityRate: Math.round((totals.mobility / matchCount) * 100),
            autoClimbRate: autoClimbAttemptCount > 0
                ? Math.round((totals.autoClimb / autoClimbAttemptCount) * 100)
                : 0,
            autoClimbFromSideRate: autoClimbLocationAttemptCount > 0
                ? Math.round((totals.autoClimbFromSide / autoClimbLocationAttemptCount) * 100)
                : 0,
            autoClimbFromMiddleRate: autoClimbLocationAttemptCount > 0
                ? Math.round((totals.autoClimbFromMiddle / autoClimbLocationAttemptCount) * 100)
                : 0,
            autoClimbAttempts: autoClimbAttemptCount,
            climbL1Rate: climbAttemptL1Count > 0
                ? Math.round((totals.climbL1 / climbAttemptL1Count) * 100)
                : 0,
            climbL1Count: totals.climbL1,
            climbL1Attempts: climbAttemptL1Count,
            climbL2Rate: climbAttemptL2Count > 0
                ? Math.round((totals.climbL2 / climbAttemptL2Count) * 100)
                : 0,
            climbL2Count: totals.climbL2,
            climbL2Attempts: climbAttemptL2Count,
            climbL3Rate: climbAttemptL3Count > 0
                ? Math.round((totals.climbL3 / climbAttemptL3Count) * 100)
                : 0,
            climbL3Count: totals.climbL3,
            climbL3Attempts: climbAttemptL3Count,
            climbSuccessRate: teleopClimbAttemptCount > 0
                ? Math.round((climbSuccessCount / teleopClimbAttemptCount) * 100)
                : 0,
            climbFromSideRate: endgameClimbLocationAttemptCount > 0
                ? Math.round((totals.climbFromSide / endgameClimbLocationAttemptCount) * 100)
                : 0,
            climbFromMiddleRate: endgameClimbLocationAttemptCount > 0
                ? Math.round((totals.climbFromMiddle / endgameClimbLocationAttemptCount) * 100)
                : 0,
            defenseRate: Math.round((totals.defense / matchCount) * 100),
            autoShotOnTheMoveRate: autoShotTypeTotal > 0 ? Math.round((totals.autoShotOnTheMove / autoShotTypeTotal) * 100) : 0,
            autoShotStationaryRate: autoShotTypeTotal > 0 ? Math.round((totals.autoShotStationary / autoShotTypeTotal) * 100) : 0,
            teleopShotOnTheMoveRate: teleopShotTypeTotal > 0 ? Math.round((totals.teleopShotOnTheMove / teleopShotTypeTotal) * 100) : 0,
            teleopShotStationaryRate: teleopShotTypeTotal > 0 ? Math.round((totals.teleopShotStationary / teleopShotTypeTotal) * 100) : 0,
            trenchStuckRate: Math.round((totals.trenchStuck / matchCount) * 100),
            bumpStuckRate: Math.round((totals.bumpStuck / matchCount) * 100),
            brokeDownRate: Math.round((totals.brokeDown / matchCount) * 100),
            noShowRate: Math.round((totals.noShow / matchCount) * 100),
            usedTrenchInTeleopRate: Math.round((totals.usedTrenchInTeleop / matchCount) * 100),
            usedBumpInTeleopRate: Math.round((totals.usedBumpInTeleop / matchCount) * 100),
            passedToAllianceFromNeutralRate: Math.round((totals.passedToAllianceFromNeutral / matchCount) * 100),
            passedToAllianceFromOpponentRate: Math.round((totals.passedToAllianceFromOpponent / matchCount) * 100),
            passedToNeutralRate: Math.round((totals.passedToNeutral / matchCount) * 100),
            accuracyAllRate: Math.round((totals.accuracyAll / matchCount) * 100),
            accuracyMostRate: Math.round((totals.accuracyMost / matchCount) * 100),
            accuracySomeRate: Math.round((totals.accuracySome / matchCount) * 100),
            accuracyFewRate: Math.round((totals.accuracyFew / matchCount) * 100),
            accuracyLittleRate: Math.round((totals.accuracyLittle / matchCount) * 100),
            accuracyScore,
            startPositions,
            matchResults: matchResults.sort((a, b) => parseInt(a.matchNumber) - parseInt(b.matchNumber)),
            // Role statistics
            primaryActiveRole,
            primaryInactiveRole,
            roleActiveCleanUpRate: Math.round((totals.roleActiveCleanUp / matchCount) * 100),
            roleActivePasserRate: Math.round((totals.roleActivePasser / matchCount) * 100),
            roleActiveDefenseRate: Math.round((totals.roleActiveDefense / matchCount) * 100),
            roleActiveCyclerRate: Math.round((totals.roleActiveCycler / matchCount) * 100),
            roleActiveThiefRate: Math.round((totals.roleActiveThief / matchCount) * 100),
            roleInactiveCleanUpRate: Math.round((totals.roleInactiveCleanUp / matchCount) * 100),
            roleInactivePasserRate: Math.round((totals.roleInactivePasser / matchCount) * 100),
            roleInactiveDefenseRate: Math.round((totals.roleInactiveDefense / matchCount) * 100),
            roleInactiveCyclerRate: Math.round((totals.roleInactiveCycler / matchCount) * 100),
            roleInactiveThiefRate: Math.round((totals.roleInactiveThief / matchCount) * 100),
        };
    },

    /**
     * Get stat sections for the Team Statistics page
     */
    getStatSections(): StatSectionDefinition[] {
        return [
            // Overview tab - summary stats
            {
                id: 'points-overview',
                title: 'Points Overview',
                tab: 'overview',
                columns: 2,
                stats: [
                    { key: 'avgTotalPoints', label: 'Total Points', type: 'number', color: 'green' },
                    { key: 'avgAutoPoints', label: 'Auto Points', type: 'number', color: 'blue' },
                    { key: 'avgTeleopPoints', label: 'Teleop Points', type: 'number', color: 'purple' },
                    { key: 'avgEndgamePoints', label: 'Endgame Points', type: 'number', color: 'orange' },
                    { key: 'coprTotalPoints', label: 'TBA COPR', type: 'number', color: 'green', subtitle: 'Total Points' },
                    { key: 'coprTotalTeleopPoints', label: 'TBA COPR', type: 'number', color: 'purple', subtitle: 'Teleop Points' },
                    { key: 'coprTotalAutoPoints', label: 'TBA COPR', type: 'number', color: 'blue', subtitle: 'Auto Points' },
                    { key: 'coprTotalTowerPoints', label: 'TBA COPR', type: 'number', color: 'orange', subtitle: 'Tower Points' },
                ],
            },
            {
                id: 'fuel-overview',
                title: 'Fuel Scoring',
                tab: 'overview',
                columns: 2,
                stats: [
                    { key: 'avgTotalFuel', label: 'Total Fuel', type: 'number', color: 'yellow', subtitle: 'avg per match' },
                    { key: 'avgScaledTotalFuel', label: 'Scaled Total Fuel', type: 'number', color: 'green', subtitle: 'TBA-adjusted scout avg' },
                    { key: 'fuelTotalOPR', label: 'Fuel Total OPR', type: 'number', color: 'purple', subtitle: 'alliance decomposition' },
                    { key: 'avgFuelPassed', label: 'Fuel Passed', type: 'number', color: 'blue', subtitle: 'avg per match' },
                    { key: 'accuracyScore', label: 'Accuracy', type: 'percentage', color: 'green', subtitle: 'from matches with an accuracy selection' },
                    { key: 'coprHubTotalPoints', label: 'TBA COPR', type: 'number', color: 'green', subtitle: 'Hub Total Points' },
                ],
            },
            {
                id: 'primary-roles',
                title: 'Primary Roles',
                tab: 'overview',
                columns: 2,
                stats: [
                    { key: 'primaryActiveRole', label: 'Active Shift Role', type: 'text', color: 'green' },
                    { key: 'primaryInactiveRole', label: 'Inactive Shift Role', type: 'text', color: 'purple' },
                ],
            },

            // Scoring tab - fuel breakdown
            {
                id: 'auto-scoring',
                title: 'Auto Fuel',
                tab: 'scoring',
                columns: 2,
                stats: [
                    { key: 'avgAutoFuel', label: 'Fuel Scored', type: 'number', subtitle: 'avg per match' },
                    { key: 'avgScaledAutoFuel', label: 'Scaled Fuel', type: 'number', color: 'green', subtitle: 'TBA-adjusted scout avg' },
                    { key: 'fuelAutoOPR', label: 'Fuel OPR', type: 'number', color: 'purple', subtitle: 'alliance decomposition' },
                    { key: 'coprHubAutoPoints', label: 'TBA COPR', type: 'number', color: 'blue', subtitle: 'Hub Auto Points' },
                    { key: 'maxAutoFuel', label: 'Max Fuel Scored', type: 'number', subtitle: 'best match' },
                    { key: 'autoShotOnTheMoveRate', label: 'On The Move %', type: 'percentage', color: 'orange' },
                    { key: 'autoShotStationaryRate', label: 'Stationary %', type: 'percentage', color: 'blue' },
                    { key: 'avgAutoFuelPassed', label: 'Fuel Passed', type: 'number', subtitle: 'avg per match' },
                    { key: 'maxAutoFuelPassed', label: 'Max Fuel Passed', type: 'number', subtitle: 'best match' },
                ],
            },
            {
                id: 'teleop-scoring',
                title: 'Teleop Fuel',
                tab: 'scoring',
                columns: 2,
                stats: [
                    { key: 'avgTeleopFuel', label: 'Fuel Scored', type: 'number', subtitle: 'avg per match' },
                    { key: 'avgScaledTeleopFuel', label: 'Scaled Fuel', type: 'number', color: 'green', subtitle: 'TBA-adjusted scout avg' },
                    { key: 'fuelTeleopOPR', label: 'Fuel OPR', type: 'number', color: 'purple', subtitle: 'alliance decomposition' },
                    { key: 'coprHubTeleopPoints', label: 'TBA COPR', type: 'number', color: 'purple', subtitle: 'Hub Teleop Points' },
                    { key: 'maxTeleopFuel', label: 'Max Fuel Scored', type: 'number', subtitle: 'best match' },
                    { key: 'teleopShotOnTheMoveRate', label: 'On The Move %', type: 'percentage', color: 'orange' },
                    { key: 'teleopShotStationaryRate', label: 'Stationary %', type: 'percentage', color: 'blue' },
                    { key: 'avgTeleopFuelPassed', label: 'Fuel Passed', type: 'number', subtitle: 'avg per match' },
                    { key: 'maxTeleopFuelPassed', label: 'Max Fuel Passed', type: 'number', subtitle: 'best match' },
                ],
            },
            {
                id: 'auto-climbing',
                title: 'Auto Climbing',
                tab: 'scoring',
                columns: 2,
                stats: [
                    { key: 'autoClimbRate', label: 'Success Rate', type: 'percentage', color: 'blue' },
                    { key: 'autoClimbAttempts', label: 'Total Attempts', type: 'number', color: 'slate' },
                                        { key: 'autoClimbFromSideRate', label: 'From Side %', type: 'percentage', color: 'green' },
                    { key: 'autoClimbFromMiddleRate', label: 'From Middle %', type: 'percentage', color: 'purple' },
                    { key: 'coprAutoTowerPoints', label: 'TBA COPR', type: 'number', color: 'green', subtitle: 'Auto Tower Points' },
                    { key: 'avgAutoClimbStartTimeSec', label: 'Avg Start Time', type: 'number', color: 'orange', subtitle: 'seconds remaining' },
                ],
            },
            {
                id: 'teleop-climbing',
                title: 'Teleop Climbing',
                tab: 'scoring',
                columns: 2,
                stats: [
                    { key: 'climbL1Rate', label: 'Level 1 Success Rate', type: 'percentage', color: 'green' },
                    { key: 'climbL1Attempts', label: 'Level 1 Attempts', type: 'number', color: 'slate' },
                    { key: 'climbL2Rate', label: 'Level 2 Success Rate', type: 'percentage', color: 'blue' },
                    { key: 'climbL2Attempts', label: 'Level 2 Attempts', type: 'number', color: 'slate' },
                    { key: 'climbL3Rate', label: 'Level 3 Success Rate', type: 'percentage', color: 'purple' },
                    { key: 'climbL3Attempts', label: 'Level 3 Attempts', type: 'number', color: 'slate' },
                    { key: 'climbFromSideRate', label: 'From Side %', type: 'percentage', color: 'green' },
                    { key: 'climbFromMiddleRate', label: 'From Middle %', type: 'percentage', color: 'purple' },
                    { key: 'coprEndgameTowerPoints', label: 'TBA COPR', type: 'number', color: 'orange', subtitle: 'Endgame Tower Points' },
                    { key: 'avgTeleopClimbStartTimeSec', label: 'Avg Start Time', type: 'number', color: 'orange', subtitle: 'seconds remaining' },
                ],
            },
        ];
    },

    /**
     * Get rate sections (progress bars) for the Team Statistics page
     */
    getRateSections(): RateSectionDefinition[] {
        return [
            {
                id: 'key-rates',
                title: 'Key Rates',
                tab: 'overview',
                rates: [
                    { key: 'climbSuccessRate', label: 'Climb Success Rate' },
                    { key: 'autoClimbRate', label: 'Auto Climb Rate' },
                ],
            },
            {
                id: 'climb-breakdown',
                title: 'Climb Breakdown',
                tab: 'performance',
                rates: [
                    { key: 'climbL1Rate', label: 'Level 1 (10 pts)' },
                    { key: 'climbL2Rate', label: 'Level 2 (20 pts)' },
                    { key: 'climbL3Rate', label: 'Level 3 (30 pts)' },
                ],
            },
            {
                id: 'active-shift-roles',
                title: 'Active Shift Roles',
                tab: 'performance',
                rates: [
                    { key: 'roleActiveCyclerRate', label: 'Cycler' },
                    { key: 'roleActiveCleanUpRate', label: 'Clean Up' },
                    { key: 'roleActivePasserRate', label: 'Passer' },
                    { key: 'roleActiveThiefRate', label: 'Thief' },
                    { key: 'roleActiveDefenseRate', label: 'Defense' },
                ],
            },
            {
                id: 'inactive-shift-roles',
                title: 'Inactive Shift Roles',
                tab: 'performance',
                rates: [
                    { key: 'roleInactiveCyclerRate', label: 'Cycler' },
                    { key: 'roleInactiveCleanUpRate', label: 'Clean Up' },
                    { key: 'roleInactivePasserRate', label: 'Passer' },
                    { key: 'roleInactiveThiefRate', label: 'Thief' },
                    { key: 'roleInactiveDefenseRate', label: 'Defense' },
                ],
            },
            {
                id: 'other-metrics',
                title: 'Other Metrics',
                tab: 'performance',
                rates: [
                    { key: 'defenseRate', label: 'Played Defense (Any Phase)' },
                    { key: 'noShowRate', label: 'No Show' },
                    { key: 'brokeDownRate', label: 'Broke Down' },
                    { key: 'trenchStuckRate', label: 'Got Stuck in Trench' },
                    { key: 'bumpStuckRate', label: 'Got Stuck on Bump' },
                    { key: 'usedTrenchInTeleopRate', label: 'Used Trench in Teleop' },
                    { key: 'usedBumpInTeleopRate', label: 'Used Bump in Teleop' },
                    { key: 'passedToAllianceFromNeutralRate', label: 'Passed to Alliance Zone from Neutral Zone' },
                    { key: 'passedToAllianceFromOpponentRate', label: 'Passed to Alliance Zone from Opponent Zone' },
                    { key: 'passedToNeutralRate', label: 'Passed to Neutral Zone from Opponent Zone' },
                ],
            },
        ];
    },

    /**
     * Get match badges for match-by-match performance list
     */
    getMatchBadges(): MatchBadgeDefinition[] {
        return [
            { key: 'endgameSuccess', label: 'Climbed', variant: 'secondary', showWhen: true },
            { key: 'climbFailed', label: 'Failed', variant: 'destructive', showWhen: true },
        ];
    },

    /**
     * Get start position configuration for 2026 field
     * Uses the 2026 field images with 5 starting positions along the traversal line
     * Positions 0-4 from driver station view: Left Trench, Left Bump, Hub, Right Bump, Right Trench
     */
    getStartPositionConfig(): StartPositionConfig {
        return {
            positionCount: 5,
            positionLabels: ['Left Trench', 'Left Bump', 'Hub', 'Right Bump', 'Right Trench'],
            positionColors: ['yellow', 'orange', 'green', 'orange', 'yellow'],
            fieldImageRed: fieldMapRedImage,
            fieldImageBlue: fieldMapBlueImage,
            // Zone definitions for the auto start position map
            // Field image is viewed from alliance wall, positions run horizontally across
            // Approximate positions based on field image (1013x728 aspect ratio)
            zones: [
                { x: 40, y: 120, width: 90, height: 100, position: 0, label: 'Trench (L)' },
                { x: 130, y: 120, width: 150, height: 100, position: 1, label: 'Left Bump' },
                { x: 280, y: 120, width: 80, height: 100, position: 2, label: 'Hub' },
                { x: 360, y: 120, width: 150, height: 100, position: 3, label: 'Right Bump' },
                { x: 510, y: 120, width: 90, height: 100, position: 4, label: 'Trench (R)' },
            ],
        };
    },
};

export default strategyAnalysis;
