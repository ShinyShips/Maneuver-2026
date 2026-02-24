/**
 * Centralized Team Statistics Calculations - 2026 REBUILT
 * 
 * This is the SINGLE SOURCE OF TRUTH for all team stat calculations.
 * All pages (Strategy Overview, Match Strategy, etc.) should use this
 * via the useAllTeamStats hook instead of calculating their own stats.
 * 
 * 2026 GAME: Uses fuelScoredCount, fuelPassedCount, and climb toggles
 */

import type { ScoutingEntry } from "@/game-template/scoring";
import type { TeamStats } from "@/core/types/team-stats";
import { scoringCalculations } from "./scoring";
import { millisecondsToSeconds } from "./duration";

// Helper functions
const sum = <T>(arr: T[], fn: (item: T) => number): number =>
    arr.reduce((acc, item) => acc + fn(item), 0);

const round = (n: number, decimals: number = 1): number =>
    Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);

const percent = (count: number, total: number): number =>
    total > 0 ? Math.round((count / total) * 100) : 0;

const val = (n: number | unknown): number => (typeof n === 'number' ? n : 0);

const avg = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const START_POSITION_LABELS = ['Left Trench', 'Left Bump', 'Hub', 'Right Bump', 'Right Trench'];

const getStartPositionIndex = (positionLabel?: string): number => {
    if (!positionLabel) return -1;
    const index = START_POSITION_LABELS.findIndex(
        (label) => label.toLowerCase() === positionLabel.toLowerCase()
    );
    return index;
};

/**
 * Calculate all statistics for a single team from their match entries.
 * Returns a complete TeamStats object with all metrics.
 */
export const calculateTeamStats = (teamMatches: ScoutingEntry[]): Omit<TeamStats, 'teamNumber' | 'eventKey'> => {
    if (teamMatches.length === 0) {
        return getEmptyStats();
    }

    const matchCount = teamMatches.length;

    // ============================================================================
    // POINT CALCULATIONS (using centralized scoring)
    // ============================================================================

    const totalAutoPoints = sum(teamMatches, m =>
        scoringCalculations.calculateAutoPoints({ gameData: m.gameData } as any)
    );
    const totalTeleopPoints = sum(teamMatches, m =>
        scoringCalculations.calculateTeleopPoints({ gameData: m.gameData } as any)
    );
    const totalEndgamePoints = sum(teamMatches, m =>
        scoringCalculations.calculateEndgamePoints({ gameData: m.gameData } as any)
    );
    const totalPoints = totalAutoPoints + totalTeleopPoints + totalEndgamePoints;

    // ============================================================================
    // FUEL CALCULATIONS (2026 Game)
    // ============================================================================

    // Auto fuel
    const autoFuelTotal = sum(teamMatches, m =>
        val(m.gameData?.auto?.fuelScoredCount)
    );

    const autoFuelPassedTotal = sum(teamMatches, m =>
        val(m.gameData?.auto?.fuelPassedCount)
    );

    // Teleop fuel
    const teleopFuelTotal = sum(teamMatches, m =>
        val(m.gameData?.teleop?.fuelScoredCount)
    );

    const teleopFuelPassedTotal = sum(teamMatches, m =>
        val(m.gameData?.teleop?.fuelPassedCount)
    );

    // Total fuel
    const totalFuelScored = autoFuelTotal + teleopFuelTotal;
    const totalFuelPassed = autoFuelPassedTotal + teleopFuelPassedTotal;
    const totalPieces = totalFuelScored; // For compatibility
    const autoShotOnTheMoveTotal = sum(teamMatches, m => val(m.gameData?.auto?.shotOnTheMoveCount));
    const autoShotStationaryTotal = sum(teamMatches, m => val(m.gameData?.auto?.shotStationaryCount));
    const teleopShotOnTheMoveTotal = sum(teamMatches, m => val(m.gameData?.teleop?.shotOnTheMoveCount));
    const teleopShotStationaryTotal = sum(teamMatches, m => val(m.gameData?.teleop?.shotStationaryCount));
    const autoShotTypeTotal = autoShotOnTheMoveTotal + autoShotStationaryTotal;
    const teleopShotTypeTotal = teleopShotOnTheMoveTotal + teleopShotStationaryTotal;

    // ============================================================================
    // AUTO PHASE STATS
    // ============================================================================

    // Auto climb (new for 2026!)
    const autoClimbCount = teamMatches.filter(m => m.gameData?.auto?.autoClimbL1 === true).length;
    const autoClimbFromSideCount = teamMatches.filter(m => m.gameData?.auto?.autoClimbFromSide === true).length;
    const autoClimbFromMiddleCount = teamMatches.filter(m => m.gameData?.auto?.autoClimbFromMiddle === true).length;
    const autoClimbStartTimes = teamMatches
        .map(m => m.gameData?.auto?.autoClimbStartTimeSecRemaining)
        .filter((time): time is number => typeof time === 'number');

    // Starting positions
    const startPositions = calculateStartPositions(teamMatches, matchCount);
    const startPositionPercentages = startPositions.reduce<Record<string, number>>((acc, pos) => {
        const index = getStartPositionIndex(pos.position);
        if (index >= 0) {
            acc[`position${index}`] = pos.percentage;
        }
        return acc;
    }, {});

    const matchResults = teamMatches.map((match) => {
        const autoPoints = scoringCalculations.calculateAutoPoints({ gameData: match.gameData } as any);
        const teleopPoints = scoringCalculations.calculateTeleopPoints({ gameData: match.gameData } as any);
        const endgamePoints = scoringCalculations.calculateEndgamePoints({ gameData: match.gameData } as any);
        const startPositionLabel = typeof match.gameData?.auto?.startPositionLabel === 'string'
            ? match.gameData.auto.startPositionLabel
            : undefined;
        const startPosition = typeof match.gameData?.auto?.startPosition === 'number'
            ? match.gameData.auto.startPosition
            : getStartPositionIndex(startPositionLabel);

        const autoPath = Array.isArray(match.gameData?.auto?.autoPath)
            ? match.gameData.auto.autoPath.filter((wp) => wp && wp.position)
            : (Array.isArray(match.gameData?.auto?.actions)
                ? match.gameData.auto.actions.filter((wp) => wp && wp.position)
                : []);

        return {
            matchNumber: String(match.matchNumber),
            alliance: match.allianceColor,
            eventKey: match.eventKey || '',
            teamNumber: match.teamNumber,
            scoutName: match.scoutName,
            totalPoints: autoPoints + teleopPoints + endgamePoints,
            autoPoints,
            teleopPoints,
            endgamePoints,
            startPosition,
            autoFuel: val(match.gameData?.auto?.fuelScoredCount),
            teleopFuel: val(match.gameData?.teleop?.fuelScoredCount),
            autoPath,
        };
    }).sort((a, b) => parseInt(a.matchNumber) - parseInt(b.matchNumber));

    // Auto stuck tracking
    const autoTrenchStuckTotal = sum(teamMatches, m => val(m.gameData?.auto?.trenchStuckCount));
    const autoBumpStuckTotal = sum(teamMatches, m => val(m.gameData?.auto?.bumpStuckCount));
    const autoTrenchStuckDurationTotal = sum(teamMatches, m => val(m.gameData?.auto?.trenchStuckDuration));
    const autoBumpStuckDurationTotal = sum(teamMatches, m => val(m.gameData?.auto?.bumpStuckDuration));


    // ============================================================================
    // ENDGAME STATS (Tower Climbing - 2026)
    // ============================================================================

    const climbL1Count = teamMatches.filter(m => m.gameData?.endgame?.climbL1 === true).length;
    const climbL2Count = teamMatches.filter(m => m.gameData?.endgame?.climbL2 === true).length;
    const climbL3Count = teamMatches.filter(m => m.gameData?.endgame?.climbL3 === true).length;
    const hasAttemptAtLevel = (match: ScoutingEntry, level: 1 | 2 | 3): boolean => {
        const endgame = match.gameData?.endgame as Record<string, unknown> | undefined;
        if (endgame?.[`climbAttemptL${level}`] === true) return true;
        if (endgame?.[`climbL${level}`] === true) return true;

        const teleopPath = match.gameData?.teleop?.teleopPath;
        if (Array.isArray(teleopPath)) {
            return teleopPath.some((waypoint) => {
                if (!waypoint || typeof waypoint !== 'object') return false;
                const record = waypoint as Record<string, unknown>;
                return record.type === 'climb' && record.climbLevel === level;
            });
        }

        return false;
    };
    const climbAttemptL1Count = teamMatches.filter(m => hasAttemptAtLevel(m, 1)).length;
    const climbAttemptL2Count = teamMatches.filter(m => hasAttemptAtLevel(m, 2)).length;
    const climbAttemptL3Count = teamMatches.filter(m => hasAttemptAtLevel(m, 3)).length;
    const climbFromSideCount = teamMatches.filter(m => m.gameData?.endgame?.climbFromSide === true).length;
    const climbFromMiddleCount = teamMatches.filter(m => m.gameData?.endgame?.climbFromMiddle === true).length;
    const endgameClimbLocationAttemptCount = climbFromSideCount + climbFromMiddleCount;
    const climbFailedCount = teamMatches.filter(m => m.gameData?.endgame?.climbFailed === true).length;
    const climbSuccessCount = climbL1Count + climbL2Count + climbL3Count;
    const levelAttemptCount = climbAttemptL1Count + climbAttemptL2Count + climbAttemptL3Count;
    const teleopClimbAttemptCount = Math.max(levelAttemptCount, climbSuccessCount + climbFailedCount, endgameClimbLocationAttemptCount);
    const usedTrenchInTeleopCount = teamMatches.filter(m => m.gameData?.endgame?.usedTrenchInTeleop === true).length;
    const usedBumpInTeleopCount = teamMatches.filter(m => m.gameData?.endgame?.usedBumpInTeleop === true).length;
    const passedToAllianceFromNeutralCount = teamMatches.filter(m => m.gameData?.endgame?.passedToAllianceFromNeutral === true).length;
    const passedToAllianceFromOpponentCount = teamMatches.filter(m => m.gameData?.endgame?.passedToAllianceFromOpponent === true).length;
    const passedToNeutralCount = teamMatches.filter(m => m.gameData?.endgame?.passedToNeutral === true).length;
    const teleopClimbStartTimes = teamMatches
        .map(m => m.gameData?.teleop?.teleopClimbStartTimeSecRemaining)
        .filter((time): time is number => typeof time === 'number');
    const brokeDownCount = teamMatches.filter(m =>
        val(m.gameData?.auto?.brokenDownCount) > 0 || val(m.gameData?.teleop?.brokenDownCount) > 0
    ).length;
    const noShowCount = teamMatches.filter(m =>
        m.noShow === true || /no\s*show/i.test(m.comments || '')
    ).length;

    // ============================================================================
    // TELEOP STATS
    // ============================================================================

    const defenseCount = teamMatches.filter(m => m.gameData?.teleop?.playedDefense === true).length;

    // Defense counts by zone
    const defenseAllianceTotal = sum(teamMatches, m => val(m.gameData?.teleop?.defenseAllianceCount));
    const defenseNeutralTotal = sum(teamMatches, m => val(m.gameData?.teleop?.defenseNeutralCount));
    const defenseOpponentTotal = sum(teamMatches, m => val(m.gameData?.teleop?.defenseOpponentCount));
    const totalDefenseActions = defenseAllianceTotal + defenseNeutralTotal + defenseOpponentTotal;

    // Steal count
    const stealTotal = sum(teamMatches, m => val(m.gameData?.teleop?.stealCount));

    // Stuck tracking
    const trenchStuckTotal = sum(teamMatches, m => val(m.gameData?.teleop?.trenchStuckCount));
    const bumpStuckTotal = sum(teamMatches, m => val(m.gameData?.teleop?.bumpStuckCount));
    const trenchStuckDurationTotal = sum(teamMatches, m => val(m.gameData?.teleop?.trenchStuckDuration));
    const bumpStuckDurationTotal = sum(teamMatches, m => val(m.gameData?.teleop?.bumpStuckDuration));

    // ============================================================================
    // ROLE CALCULATIONS (Active & Inactive Shifts - 2026)
    // ============================================================================

    const roleActiveCyclerCount = teamMatches.filter(m => m.gameData?.endgame?.roleActiveCycler === true).length;
    const roleActiveCleanUpCount = teamMatches.filter(m => m.gameData?.endgame?.roleActiveCleanUp === true).length;
    const roleActivePasserCount = teamMatches.filter(m => m.gameData?.endgame?.roleActivePasser === true).length;
    const roleActiveThiefCount = teamMatches.filter(m => m.gameData?.endgame?.roleActiveThief === true).length;
    const roleActiveDefenseCount = teamMatches.filter(m => m.gameData?.endgame?.roleActiveDefense === true).length;

    const roleInactiveCyclerCount = teamMatches.filter(m => m.gameData?.endgame?.roleInactiveCycler === true).length;
    const roleInactiveCleanUpCount = teamMatches.filter(m => m.gameData?.endgame?.roleInactiveCleanUp === true).length;
    const roleInactivePasserCount = teamMatches.filter(m => m.gameData?.endgame?.roleInactivePasser === true).length;
    const roleInactiveThiefCount = teamMatches.filter(m => m.gameData?.endgame?.roleInactiveThief === true).length;
    const roleInactiveDefenseCount = teamMatches.filter(m => m.gameData?.endgame?.roleInactiveDefense === true).length;

    // Accuracy selections (qualitative buckets)
    const accuracyAllCount = teamMatches.filter(m => m.gameData?.endgame?.accuracyAll === true).length;
    const accuracyMostCount = teamMatches.filter(m => m.gameData?.endgame?.accuracyMost === true).length;
    const accuracySomeCount = teamMatches.filter(m => m.gameData?.endgame?.accuracySome === true).length;
    const accuracyFewCount = teamMatches.filter(m => m.gameData?.endgame?.accuracyFew === true).length;
    const accuracyLittleCount = teamMatches.filter(m => m.gameData?.endgame?.accuracyLittle === true).length;
    const accuracySelectionCount = accuracyAllCount + accuracyMostCount + accuracySomeCount + accuracyFewCount + accuracyLittleCount;
    const weightedAccuracyTotal =
        (accuracyAllCount * 5)
        + (accuracyMostCount * 4)
        + (accuracySomeCount * 3)
        + (accuracyFewCount * 2)
        + (accuracyLittleCount * 1);
    const accuracyScore = accuracySelectionCount > 0
        ? Math.round((weightedAccuracyTotal / (accuracySelectionCount * 5)) * 100)
        : 0;

    // Calculate primary roles (most frequently played)
    const activeRoles = [
        { name: 'Cycler', count: roleActiveCyclerCount },
        { name: 'Clean Up', count: roleActiveCleanUpCount },
        { name: 'Passer', count: roleActivePasserCount },
        { name: 'Thief', count: roleActiveThiefCount },
        { name: 'Defense', count: roleActiveDefenseCount },
    ];
    const maxActiveCount = Math.max(...activeRoles.map(r => r.count));
    const topActiveRoles = activeRoles.filter(r => r.count === maxActiveCount && r.count > 0);
    const primaryActiveRole = topActiveRoles.length > 0 ? topActiveRoles.map(r => r.name).join(' / ') : 'None';

    const inactiveRoles = [
        { name: 'Cycler', count: roleInactiveCyclerCount },
        { name: 'Clean Up', count: roleInactiveCleanUpCount },
        { name: 'Passer', count: roleInactivePasserCount },
        { name: 'Thief', count: roleInactiveThiefCount },
        { name: 'Defense', count: roleInactiveDefenseCount },
    ];
    const maxInactiveCount = Math.max(...inactiveRoles.map(r => r.count));
    const topInactiveRoles = inactiveRoles.filter(r => r.count === maxInactiveCount && r.count > 0);
    const primaryInactiveRole = topInactiveRoles.length > 0 ? topInactiveRoles.map(r => r.name).join(' / ') : 'None';

    const autoClimbLocationAttemptCount = autoClimbFromSideCount + autoClimbFromMiddleCount;
    const autoClimbAttemptCount = Math.max(autoClimbCount, autoClimbLocationAttemptCount);

    // ============================================================================
    // RAW VALUES (for UI aggregation: average, max, 75th percentile, etc.)
    // ============================================================================

    const rawValues = {
        // Points (per match)
        totalPoints: teamMatches.map(m =>
            scoringCalculations.calculateTotalPoints({ gameData: m.gameData } as any)
        ),
        autoPoints: teamMatches.map(m =>
            scoringCalculations.calculateAutoPoints({ gameData: m.gameData } as any)
        ),
        teleopPoints: teamMatches.map(m =>
            scoringCalculations.calculateTeleopPoints({ gameData: m.gameData } as any)
        ),
        endgamePoints: teamMatches.map(m =>
            scoringCalculations.calculateEndgamePoints({ gameData: m.gameData } as any)
        ),

        // Fuel (per match)
        autoFuel: teamMatches.map(m => val(m.gameData?.auto?.fuelScoredCount)),
        teleopFuel: teamMatches.map(m => val(m.gameData?.teleop?.fuelScoredCount)),
        totalFuel: teamMatches.map(m =>
            val(m.gameData?.auto?.fuelScoredCount) + val(m.gameData?.teleop?.fuelScoredCount)
        ),
        autoFuelPassed: teamMatches.map(m => val(m.gameData?.auto?.fuelPassedCount)),
        teleopFuelPassed: teamMatches.map(m => val(m.gameData?.teleop?.fuelPassedCount)),
        totalFuelPassed: teamMatches.map(m =>
            val(m.gameData?.auto?.fuelPassedCount) + val(m.gameData?.teleop?.fuelPassedCount)
        ),
        scaledAutoFuel: teamMatches.map(m => {
            const scaledMetrics = m.gameData?.scaledMetrics as { scaledAutoFuel?: number } | undefined;
            return typeof scaledMetrics?.scaledAutoFuel === 'number'
                ? scaledMetrics.scaledAutoFuel
                : val(m.gameData?.auto?.fuelScoredCount);
        }),
        scaledTeleopFuel: teamMatches.map(m => {
            const scaledMetrics = m.gameData?.scaledMetrics as { scaledTeleopFuel?: number } | undefined;
            return typeof scaledMetrics?.scaledTeleopFuel === 'number'
                ? scaledMetrics.scaledTeleopFuel
                : val(m.gameData?.teleop?.fuelScoredCount);
        }),
        scaledTotalFuel: teamMatches.map(m => {
            const scaledMetrics = m.gameData?.scaledMetrics as {
                scaledAutoFuel?: number;
                scaledTeleopFuel?: number;
            } | undefined;

            const scaledAuto = typeof scaledMetrics?.scaledAutoFuel === 'number'
                ? scaledMetrics.scaledAutoFuel
                : val(m.gameData?.auto?.fuelScoredCount);
            const scaledTeleop = typeof scaledMetrics?.scaledTeleopFuel === 'number'
                ? scaledMetrics.scaledTeleopFuel
                : val(m.gameData?.teleop?.fuelScoredCount);

            return scaledAuto + scaledTeleop;
        }),

        // Climb (boolean per match - 1 if climbed, 0 if not)
        climbL1: teamMatches.map(m => m.gameData?.endgame?.climbL1 === true ? 1 : 0),
        climbL2: teamMatches.map(m => m.gameData?.endgame?.climbL2 === true ? 1 : 0),
        climbL3: teamMatches.map(m => m.gameData?.endgame?.climbL3 === true ? 1 : 0),
        climbAny: teamMatches.map(m =>
            (m.gameData?.endgame?.climbL1 || m.gameData?.endgame?.climbL2 || m.gameData?.endgame?.climbL3) ? 1 : 0
        ),
        autoClimb: teamMatches.map(m => m.gameData?.auto?.autoClimbL1 === true ? 1 : 0),

        // Defense & Steals (per match)
        steals: teamMatches.map(m => val(m.gameData?.teleop?.stealCount)),
        defenseActions: teamMatches.map(m =>
            val(m.gameData?.teleop?.defenseAllianceCount) +
            val(m.gameData?.teleop?.defenseNeutralCount) +
            val(m.gameData?.teleop?.defenseOpponentCount)
        ),

        // Stuck Durations (per match, in seconds)
        autoTrenchStuckDuration: teamMatches.map(m => millisecondsToSeconds(val(m.gameData?.auto?.trenchStuckDuration))),
        autoBumpStuckDuration: teamMatches.map(m => millisecondsToSeconds(val(m.gameData?.auto?.bumpStuckDuration))),
        teleopTrenchStuckDuration: teamMatches.map(m => millisecondsToSeconds(val(m.gameData?.teleop?.trenchStuckDuration))),
        teleopBumpStuckDuration: teamMatches.map(m => millisecondsToSeconds(val(m.gameData?.teleop?.bumpStuckDuration))),

        // Climb start timing (seconds remaining) - include only matches with recorded values
        autoClimbStartTimeSec: teamMatches
            .map(m => m.gameData?.auto?.autoClimbStartTimeSecRemaining)
            .filter((time): time is number => typeof time === 'number'),
        endgameClimbStartTimeSec: teamMatches
            .map(m => m.gameData?.teleop?.teleopClimbStartTimeSecRemaining)
            .filter((time): time is number => typeof time === 'number'),
    };

    // ============================================================================
    // RETURN COMPLETE STATS OBJECT
    // ============================================================================

    return {
        matchCount,

        // Aggregate scores
        totalPoints: round(totalPoints / matchCount),
        autoPoints: round(totalAutoPoints / matchCount),
        teleopPoints: round(totalTeleopPoints / matchCount),
        endgamePoints: round(totalEndgamePoints / matchCount),

        // Top-level convenience fields (for match-strategy-config.ts compatibility)
        avgTotalPoints: round(totalPoints / matchCount),
        avgAutoPoints: round(totalAutoPoints / matchCount),
        avgTeleopPoints: round(totalTeleopPoints / matchCount),
        avgEndgamePoints: round(totalEndgamePoints / matchCount),
        avgAutoFuel: round(autoFuelTotal / matchCount),
        avgTeleopFuel: round(teleopFuelTotal / matchCount),
        avgAutoFuelPassed: round(autoFuelPassedTotal / matchCount),
        avgTeleopFuelPassed: round(teleopFuelPassedTotal / matchCount),
        avgFuelPassed: round(totalFuelPassed / matchCount),
        avgTotalFuel: round(totalFuelScored / matchCount),
        avgScaledAutoFuel: round(
            sum(teamMatches, m => {
                const scaledMetrics = m.gameData?.scaledMetrics as { scaledAutoFuel?: number } | undefined;
                return typeof scaledMetrics?.scaledAutoFuel === 'number'
                    ? scaledMetrics.scaledAutoFuel
                    : val(m.gameData?.auto?.fuelScoredCount);
            }) / matchCount
        ),
        avgScaledTeleopFuel: round(
            sum(teamMatches, m => {
                const scaledMetrics = m.gameData?.scaledMetrics as { scaledTeleopFuel?: number } | undefined;
                return typeof scaledMetrics?.scaledTeleopFuel === 'number'
                    ? scaledMetrics.scaledTeleopFuel
                    : val(m.gameData?.teleop?.fuelScoredCount);
            }) / matchCount
        ),
        avgScaledTotalFuel: round(
            sum(teamMatches, m => {
                const scaledMetrics = m.gameData?.scaledMetrics as {
                    scaledAutoFuel?: number;
                    scaledTeleopFuel?: number;
                } | undefined;

                const scaledAuto = typeof scaledMetrics?.scaledAutoFuel === 'number'
                    ? scaledMetrics.scaledAutoFuel
                    : val(m.gameData?.auto?.fuelScoredCount);
                const scaledTeleop = typeof scaledMetrics?.scaledTeleopFuel === 'number'
                    ? scaledMetrics.scaledTeleopFuel
                    : val(m.gameData?.teleop?.fuelScoredCount);

                return scaledAuto + scaledTeleop;
            }) / matchCount
        ),
        fuelAutoOPR: 0,
        fuelTeleopOPR: 0,
        fuelTotalOPR: 0,
        avgAutoClimbStartTimeSec: round(avg(autoClimbStartTimes)),
        avgTeleopClimbStartTimeSec: round(avg(teleopClimbStartTimes)),
        autoShotOnTheMoveRate: percent(autoShotOnTheMoveTotal, autoShotTypeTotal),
        autoShotStationaryRate: percent(autoShotStationaryTotal, autoShotTypeTotal),
        teleopShotOnTheMoveRate: percent(teleopShotOnTheMoveTotal, teleopShotTypeTotal),
        teleopShotStationaryRate: percent(teleopShotStationaryTotal, teleopShotTypeTotal),
        autoClimbRate: percent(autoClimbCount, autoClimbAttemptCount),
        autoClimbFromSideRate: percent(autoClimbFromSideCount, autoClimbLocationAttemptCount),
        autoClimbFromMiddleRate: percent(autoClimbFromMiddleCount, autoClimbLocationAttemptCount),
        autoClimbAttempts: autoClimbAttemptCount,
        climbAttempts: teleopClimbAttemptCount,
        climbL1Rate: percent(climbL1Count, climbAttemptL1Count),
        climbL1Attempts: climbAttemptL1Count,
        climbL2Rate: percent(climbL2Count, climbAttemptL2Count),
        climbL2Attempts: climbAttemptL2Count,
        climbL3Rate: percent(climbL3Count, climbAttemptL3Count),
        climbL3Attempts: climbAttemptL3Count,
        climbFromSideRate: percent(climbFromSideCount, endgameClimbLocationAttemptCount),
        climbFromMiddleRate: percent(climbFromMiddleCount, endgameClimbLocationAttemptCount),
        climbSuccessRate: percent(climbSuccessCount, teleopClimbAttemptCount),
        brokeDownCount,
        noShowCount,
        accuracyAllRate: percent(accuracyAllCount, matchCount),
        accuracyMostRate: percent(accuracyMostCount, matchCount),
        accuracySomeRate: percent(accuracySomeCount, matchCount),
        accuracyFewRate: percent(accuracyFewCount, matchCount),
        accuracyLittleRate: percent(accuracyLittleCount, matchCount),
        accuracyScore,
        roleActiveCleanUpRate: percent(roleActiveCleanUpCount, matchCount),
        roleActivePasserRate: percent(roleActivePasserCount, matchCount),
        roleActiveDefenseRate: percent(roleActiveDefenseCount, matchCount),
        roleActiveCyclerRate: percent(roleActiveCyclerCount, matchCount),
        roleActiveThiefRate: percent(roleActiveThiefCount, matchCount),
        roleInactiveCleanUpRate: percent(roleInactiveCleanUpCount, matchCount),
        roleInactivePasserRate: percent(roleInactivePasserCount, matchCount),
        roleInactiveDefenseRate: percent(roleInactiveDefenseCount, matchCount),
        roleInactiveCyclerRate: percent(roleInactiveCyclerCount, matchCount),
        roleInactiveThiefRate: percent(roleInactiveThiefCount, matchCount),
        startPositions: startPositionPercentages,
        matchResults,

        // Role data
        primaryActiveRole,
        primaryInactiveRole,

        // Overall phase
        overall: {
            avgTotalPoints: round(totalPoints / matchCount),
            totalPiecesScored: round(totalPieces / matchCount),
            avgGamePiece1: round(totalFuelScored / matchCount),  // Fuel scored
            avgGamePiece2: round(totalFuelPassed / matchCount),  // Fuel passed
            // 2026-specific
            avgFuelScored: round(totalFuelScored / matchCount),
            avgFuelPassed: round(totalFuelPassed / matchCount),
        },

        // Auto phase
        auto: {
            avgPoints: round(totalAutoPoints / matchCount),
            avgGamePiece1: round(autoFuelTotal / matchCount),     // Auto fuel
            avgGamePiece2: round(autoFuelPassedTotal / matchCount), // Auto passed
            mobilityRate: 0, // Not applicable in 2026
            autoClimbRate: percent(autoClimbCount, matchCount),
            autoClimbFromSideRate: percent(autoClimbFromSideCount, matchCount),
            autoClimbFromMiddleRate: percent(autoClimbFromMiddleCount, matchCount),
            avgFuelScored: round(autoFuelTotal / matchCount),
            shotOnTheMoveRate: percent(autoShotOnTheMoveTotal, autoShotTypeTotal),
            shotStationaryRate: percent(autoShotStationaryTotal, autoShotTypeTotal),
            startPositions,
            // 2026-specific stuck stats
            avgTrenchStuck: round(autoTrenchStuckTotal / matchCount),
            avgBumpStuck: round(autoBumpStuckTotal / matchCount),
            avgTrenchStuckDuration: round(autoTrenchStuckDurationTotal / matchCount / 1000, 1), // in seconds
            avgBumpStuckDuration: round(autoBumpStuckDurationTotal / matchCount / 1000, 1), // in seconds
        },

        // Teleop phase
        teleop: {
            avgPoints: round(totalTeleopPoints / matchCount),
            avgGamePiece1: round(teleopFuelTotal / matchCount),     // Teleop fuel
            avgGamePiece2: round(teleopFuelPassedTotal / matchCount), // Teleop passed
            avgFuelScored: round(teleopFuelTotal / matchCount),
            avgFuelPassed: round(teleopFuelPassedTotal / matchCount),
            shotOnTheMoveRate: percent(teleopShotOnTheMoveTotal, teleopShotTypeTotal),
            shotStationaryRate: percent(teleopShotStationaryTotal, teleopShotTypeTotal),
            defenseRate: percent(defenseCount, matchCount),
            // 2026-specific detailed stats
            totalDefenseActions: round(totalDefenseActions / matchCount),
            avgSteals: round(stealTotal / matchCount),
            avgTrenchStuck: round(trenchStuckTotal / matchCount),
            avgBumpStuck: round(bumpStuckTotal / matchCount),
            avgTrenchStuckDuration: round(trenchStuckDurationTotal / matchCount / 1000, 1), // in seconds
            avgBumpStuckDuration: round(bumpStuckDurationTotal / matchCount / 1000, 1), // in seconds
        },

        // Endgame phase - tower climbing
        endgame: {
            avgPoints: round(totalEndgamePoints / matchCount),
            // Climb rates
            climbL1Rate: percent(climbL1Count, climbAttemptL1Count),
            climbL2Rate: percent(climbL2Count, climbAttemptL2Count),
            climbL3Rate: percent(climbL3Count, climbAttemptL3Count),
            climbAttempts: teleopClimbAttemptCount,
            climbL1Attempts: climbAttemptL1Count,
            climbL2Attempts: climbAttemptL2Count,
            climbL3Attempts: climbAttemptL3Count,
            climbFromSideRate: percent(climbFromSideCount, endgameClimbLocationAttemptCount),
            climbFromMiddleRate: percent(climbFromMiddleCount, endgameClimbLocationAttemptCount),
            climbSuccessRate: percent(climbSuccessCount, teleopClimbAttemptCount),
            climbFailedRate: percent(climbFailedCount, teleopClimbAttemptCount),
            // Legacy compatibility aliases
            climbRate: percent(climbSuccessCount, teleopClimbAttemptCount),
            parkRate: 0, // Not applicable in 2026
            shallowClimbRate: percent(climbL1Count, climbAttemptL1Count),
            deepClimbRate: percent(climbL3Count, climbAttemptL3Count),
            option1Rate: percent(climbL1Count, climbAttemptL1Count),
            option2Rate: percent(climbL2Count, climbAttemptL2Count),
            option3Rate: percent(climbL3Count, climbAttemptL3Count),
            option4Rate: 0,
            option5Rate: 0,
            toggle1Rate: percent(climbFailedCount, teleopClimbAttemptCount),
            toggle2Rate: 0, // Removed noClimb - can be inferred
            usedTrenchInTeleopRate: percent(usedTrenchInTeleopCount, matchCount),
            usedBumpInTeleopRate: percent(usedBumpInTeleopCount, matchCount),
            passedToAllianceFromNeutralRate: percent(passedToAllianceFromNeutralCount, matchCount),
            passedToAllianceFromOpponentRate: percent(passedToAllianceFromOpponentCount, matchCount),
            passedToNeutralRate: percent(passedToNeutralCount, matchCount),
        },

        // Raw values for charts
        rawValues,
    };
};

/**
 * Calculate starting position distribution
 */
function calculateStartPositions(
    teamMatches: ScoutingEntry[],
    matchCount: number
): Array<{ position: string; percentage: number }> {
    // Count occurrences of each start position (0-2 for 2026)
    const positionCounts: Record<number, number> = {};

    teamMatches.forEach(m => {
        const pos = m.gameData?.auto?.startPosition;
        if (typeof pos === 'number' && pos >= 0 && pos <= 5) {
            positionCounts[pos] = (positionCounts[pos] || 0) + 1;
        }
    });

    // Convert to array with percentages
    const result: Array<{ position: string; percentage: number }> = [];
    const posLabels = ['Left Trench', 'Left Bump', 'Hub', 'Right Bump', 'Right Trench'];
    for (let i = 0; i <= 4; i++) {
        const count = positionCounts[i] || 0;
        const percentage = percent(count, matchCount);
        if (percentage > 0) {
            result.push({ position: posLabels[i] || `Pos ${i}`, percentage });
        }
    }

    return result;
}

/**
 * Return empty stats object (for teams with no data)
 */
function getEmptyStats(): Omit<TeamStats, 'teamNumber' | 'eventKey'> {
    return {
        matchCount: 0,
        totalPoints: 0,
        autoPoints: 0,
        teleopPoints: 0,
        endgamePoints: 0,
        overall: {
            avgTotalPoints: 0,
            totalPiecesScored: 0,
            avgGamePiece1: 0,
            avgGamePiece2: 0,
        },
        auto: {
            avgPoints: 0,
            avgGamePiece1: 0,
            avgGamePiece2: 0,
            mobilityRate: 0,
            autoClimbRate: 0,
            autoClimbFromSideRate: 0,
            autoClimbFromMiddleRate: 0,
            startPositions: [],
        },
        teleop: {
            avgPoints: 0,
            avgGamePiece1: 0,
            avgGamePiece2: 0,
        },
        endgame: {
            avgPoints: 0,
            climbRate: 0,
            parkRate: 0,
            shallowClimbRate: 0,
            deepClimbRate: 0,
            climbFromSideRate: 0,
            climbFromMiddleRate: 0,
        },
        rawValues: {
            totalPoints: [],
            autoPoints: [],
            teleopPoints: [],
            endgamePoints: [],
            scaledAutoFuel: [],
            scaledTeleopFuel: [],
            scaledTotalFuel: [],
            autoClimbStartTimeSec: [],
            endgameClimbStartTimeSec: [],
        },
        avgScaledAutoFuel: 0,
        avgScaledTeleopFuel: 0,
        avgScaledTotalFuel: 0,
        fuelAutoOPR: 0,
        fuelTeleopOPR: 0,
        fuelTotalOPR: 0,
        avgAutoClimbStartTimeSec: 0,
        avgTeleopClimbStartTimeSec: 0,
        autoClimbAttempts: 0,
        climbAttempts: 0,
        climbL1Attempts: 0,
        climbL2Attempts: 0,
        climbL3Attempts: 0,
        autoShotOnTheMoveRate: 0,
        autoShotStationaryRate: 0,
        teleopShotOnTheMoveRate: 0,
        teleopShotStationaryRate: 0,
        brokeDownCount: 0,
        noShowCount: 0,
        accuracyAllRate: 0,
        accuracyMostRate: 0,
        accuracySomeRate: 0,
        accuracyFewRate: 0,
        accuracyLittleRate: 0,
        accuracyScore: 0,
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
        startPositions: {},
        matchResults: [],
    };
}
