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

    // ============================================================================
    // AUTO PHASE STATS
    // ============================================================================

    // Auto climb (new for 2026!)
    const autoClimbCount = teamMatches.filter(m => m.gameData?.auto?.autoClimbL1 === true).length;

    // Starting positions
    const startPositions = calculateStartPositions(teamMatches, matchCount);

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
    const climbFailedCount = teamMatches.filter(m => m.gameData?.endgame?.climbFailed === true).length;
    const climbSuccessCount = climbL1Count + climbL2Count + climbL3Count;
    const usedTrenchInTeleopCount = teamMatches.filter(m => m.gameData?.endgame?.usedTrenchInTeleop === true).length;
    const usedBumpInTeleopCount = teamMatches.filter(m => m.gameData?.endgame?.usedBumpInTeleop === true).length;
    const passedToAllianceFromNeutralCount = teamMatches.filter(m => m.gameData?.endgame?.passedToAllianceFromNeutral === true).length;
    const passedToAllianceFromOpponentCount = teamMatches.filter(m => m.gameData?.endgame?.passedToAllianceFromOpponent === true).length;
    const passedToNeutralCount = teamMatches.filter(m => m.gameData?.endgame?.passedToNeutral === true).length;

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
        autoClimbRate: percent(autoClimbCount, matchCount),
        autoClimbAttempts: autoClimbCount,
        climbL1Rate: percent(climbL1Count, matchCount),
        climbL2Rate: percent(climbL2Count, matchCount),
        climbL3Rate: percent(climbL3Count, matchCount),
        climbSuccessRate: percent(climbSuccessCount, matchCount),

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
            avgFuelScored: round(autoFuelTotal / matchCount),
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
            climbL1Rate: percent(climbL1Count, matchCount),
            climbL2Rate: percent(climbL2Count, matchCount),
            climbL3Rate: percent(climbL3Count, matchCount),
            climbSuccessRate: percent(climbSuccessCount, matchCount),
            climbFailedRate: percent(climbFailedCount, matchCount),
            // Legacy compatibility aliases
            climbRate: percent(climbSuccessCount, matchCount),
            parkRate: 0, // Not applicable in 2026
            shallowClimbRate: percent(climbL1Count, matchCount),
            deepClimbRate: percent(climbL3Count, matchCount),
            option1Rate: percent(climbL1Count, matchCount),
            option2Rate: percent(climbL2Count, matchCount),
            option3Rate: percent(climbL3Count, matchCount),
            option4Rate: 0,
            option5Rate: 0,
            toggle1Rate: percent(climbFailedCount, matchCount),
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
    };
}
