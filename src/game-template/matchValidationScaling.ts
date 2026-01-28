/**
 * 2026 Game-Specific: Match Validation Scaling
 * 
 * Proportional scaling logic for fuel counts based on official TBA totals.
 * 
 * THEORY:
 * Scouting large numbers of flying game pieces is inherently imprecise.
 * Rather than flag every minor discrepancy, we proportionally scale each
 * robot's scouted fuel counts to match the official alliance totals.
 * 
 * EXAMPLE:
 * - R1 scouts 2 auto fuel, R2 scouts 3, R3 scouts 5 (scouted total: 10)
 * - Official TBA total: 20 auto fuel scored
 * - Scaling factor: 20/10 = 2.0
 * - Scaled: R1=4, R2=6, R3=10
 * 
 * Tower climbing values are discrete and cannot be scaled - we use official
 * TBA values when they differ from scouted data.
 */

import { ScoutingEntryBase } from '@/core/types/scouting-entry';
import { ScalingFactors, ScaledTeamMetrics, AllianceScalingResult } from './types/scalingTypes';
import { db } from '@/db';

// ============================================================================
// TBA 2026 Data Extraction
// ============================================================================

/**
 * Extract official fuel counts from TBA 2026 breakdown
 * TBA structure: Match_Score_Breakdown_2026_Alliance.hubScore
 */
export function extractOfficialFuelCounts(tbaBreakdown: Record<string, unknown>): {
    autoFuel: number;
    teleopFuel: number;
} {
    const hubScore = tbaBreakdown.hubScore as Record<string, unknown> | undefined;
    
    if (!hubScore) {
        console.warn('[2026 TBA] No hubScore found in breakdown');
        return { autoFuel: 0, teleopFuel: 0 };
    }

    return {
        autoFuel: (hubScore.autoCount as number) ?? 0,
        teleopFuel: (hubScore.teleopCount as number) ?? 0,
    };
}

/**
 * Parse tower level from TBA 2026 string format
 * TBA format: "Level1", "Level2", "Level3", "None"
 */
export function parseTowerLevel(tbaValue: unknown): number {
    if (typeof tbaValue !== 'string') return 0;
    
    const match = tbaValue.match(/Level(\d)/);
    return match?.[1] ? parseInt(match[1], 10) : 0;
}

// ============================================================================
// Scaling Calculations
// ============================================================================

/**
 * Calculate scaling factors from alliance totals
 */
export function calculateScalingFactors(
    scoutedAutoTotal: number,
    officialAutoTotal: number,
    scoutedTeleopTotal: number,
    officialTeleopTotal: number
): ScalingFactors {
    return {
        autoFuel: scoutedAutoTotal > 0 ? officialAutoTotal / scoutedAutoTotal : 1.0,
        teleopFuel: scoutedTeleopTotal > 0 ? officialTeleopTotal / scoutedTeleopTotal : 1.0,
    };
}

/**
 * Apply scaling to individual team's fuel counts
 */
export function applyScalingToTeam(
    teamNumber: string,
    rawAutoFuel: number,
    rawTeleopFuel: number,
    rawTowerLevel: number,
    scalingFactors: ScalingFactors,
    officialTowerLevel?: number
): ScaledTeamMetrics {
    return {
        teamNumber,
        rawAutoFuel,
        rawTeleopFuel,
        rawTowerLevel,
        scaledAutoFuel: Math.round(rawAutoFuel * scalingFactors.autoFuel),
        scaledTeleopFuel: Math.round(rawTeleopFuel * scalingFactors.teleopFuel),
        officialTowerLevel: officialTowerLevel ?? rawTowerLevel,
        scalingApplied: true,
        scalingFactors,
    };
}

/**
 * Calculate and apply scaling for an entire alliance
 * 
 * @param alliance - 'red' or 'blue'
 * @param entries - Scouting entries for this alliance
 * @param tbaBreakdown - TBA Match_Score_Breakdown_2026_Alliance object
 */
export function calculateAllianceScaling(
    alliance: 'red' | 'blue',
    entries: Array<{
        teamNumber: number;
        gameData: Record<string, unknown>;
    }>,
    tbaBreakdown: Record<string, unknown>
): AllianceScalingResult {
    // Extract official fuel totals from TBA hubScore
    const { autoFuel: officialAutoTotal, teleopFuel: officialTeleopTotal } = 
        extractOfficialFuelCounts(tbaBreakdown);
    // Aggregate scouted totals
    let scoutedAutoTotal = 0;
    let scoutedTeleopTotal = 0;

    const teamData: Array<{
        teamNumber: string;
        autoFuel: number;
        teleopFuel: number;
        towerLevel: number;
    }> = [];

    for (const entry of entries) {
        const gameData = entry.gameData;
        
        // Extract fuel counts from gameData (supports both nested and flat structures)
        let autoFuel = 0;
        let teleopFuel = 0;
        let towerLevel = 0;

        // Check for nested structure (auto.*, teleop.*, endgame.*)
        if (gameData.auto && typeof gameData.auto === 'object') {
            const autoData = gameData.auto as Record<string, unknown>;
            autoFuel = (autoData.fuelScored as number) ?? 0;
        }

        if (gameData.teleop && typeof gameData.teleop === 'object') {
            const teleopData = gameData.teleop as Record<string, unknown>;
            teleopFuel = (teleopData.fuelScored as number) ?? 0;
        }

        if (gameData.endgame && typeof gameData.endgame === 'object') {
            const endgameData = gameData.endgame as Record<string, unknown>;
            towerLevel = (endgameData.towerLevel as number) ?? 0;
        }

        // Fallback to flat structure
        if (autoFuel === 0 && gameData.autoFuelScored) {
            autoFuel = gameData.autoFuelScored as number;
        }
        if (teleopFuel === 0 && gameData.teleopFuelScored) {
            teleopFuel = gameData.teleopFuelScored as number;
        }
        if (towerLevel === 0 && gameData.towerLevel) {
            towerLevel = gameData.towerLevel as number;
        }

        scoutedAutoTotal += autoFuel;
        scoutedTeleopTotal += teleopFuel;

        teamData.push({
            teamNumber: entry.teamNumber.toString(),
            autoFuel,
            teleopFuel,
            towerLevel,
        });
    }

    // Calculate scaling factors
    const scalingFactors = calculateScalingFactors(
        scoutedAutoTotal,
        officialAutoTotal,
        scoutedTeleopTotal,
        officialTeleopTotal
    );

    // Apply scaling to each team
    const teams: ScaledTeamMetrics[] = teamData.map((team, index) => {
        // Try to get official tower level from TBA breakdown
        // TBA Format: endGameTowerRobot1/2/3 = "Level1", "Level2", "Level3", "None"
        const towerKey = `endGameTowerRobot${index + 1}`;
        const towerValue = tbaBreakdown[towerKey];
        const officialTowerLevel = parseTowerLevel(towerValue);

        return applyScalingToTeam(
            team.teamNumber,
            team.autoFuel,
            team.teleopFuel,
            team.towerLevel,
            scalingFactors,
            officialTowerLevel
        );
    });

    return {
        alliance,
        scoutedAutoTotal,
        officialAutoTotal,
        scoutedTeleopTotal,
        officialTeleopTotal,
        scalingFactors,
        teams,
    };
}

// ============================================================================
// Database Updates
// ============================================================================

/**
 * Update scouting entries in the database with scaled values
 * Stores scaled data in gameData.scaledMetrics (2026-specific)
 */
export async function updateEntriesWithScaling(
    eventKey: string,
    matchKey: string,
    scalingResults: { red: AllianceScalingResult; blue: AllianceScalingResult }
): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;

    const allTeams = [...scalingResults.red.teams, ...scalingResults.blue.teams];

    for (const team of allTeams) {
        try {
            // Find the entry by composite key pattern
            const entries = await db.scoutingData
                .where('[teamNumber+eventKey]')
                .equals([parseInt(team.teamNumber), eventKey])
                .toArray();

            // Find the specific match entry
            const entry = entries.find(e => e.matchKey === matchKey);

            if (entry) {
                // Update gameData with scaled metrics (2026-specific structure)
                const updatedGameData = {
                    ...entry.gameData,
                    scaledMetrics: {
                        scalingApplied: true,
                        scaledAutoFuel: team.scaledAutoFuel,
                        scaledTeleopFuel: team.scaledTeleopFuel,
                        scalingFactorAuto: team.scalingFactors.autoFuel,
                        scalingFactorTeleop: team.scalingFactors.teleopFuel,
                        officialTowerLevel: team.officialTowerLevel,
                        lastScaledAt: Date.now(),
                    },
                };

                await db.scoutingData.update(entry.id, {
                    gameData: updatedGameData,
                } as Partial<ScoutingEntryBase>);

                updated++;
                console.log(`[2026 Scaling] Updated entry for team ${team.teamNumber}:`, {
                    scaledAuto: team.scaledAutoFuel,
                    scaledTeleop: team.scaledTeleopFuel,
                    officialTower: team.officialTowerLevel,
                });
            } else {
                console.warn(`[2026 Scaling] Entry not found for team ${team.teamNumber} in match ${matchKey}`);
                errors++;
            }
        } catch (error) {
            console.error(`[2026 Scaling] Error updating team ${team.teamNumber}:`, error);
            errors++;
        }
    }

    return { updated, errors };
}

/**
 * Check if a match has already been scaled
 * Checks gameData.scaledMetrics field (2026-specific)
 */
export async function isMatchScaled(eventKey: string, matchKey: string): Promise<boolean> {
    const entries = await db.scoutingData
        .where('eventKey')
        .equals(eventKey)
        .filter(e => e.matchKey === matchKey)
        .toArray();

    // Match is scaled if any entry has gameData.scaledMetrics.scalingApplied = true
    return entries.some(e => {
        const gameData = e.gameData as any;
        return gameData?.scaledMetrics?.scalingApplied === true;
    });
}

/**
 * Clear scaling data from match entries (for re-validation)
 * Removes gameData.scaledMetrics field (2026-specific)
 */
export async function clearMatchScaling(eventKey: string, matchKey: string): Promise<number> {
    const entries = await db.scoutingData
        .where('eventKey')
        .equals(eventKey)
        .filter(e => e.matchKey === matchKey)
        .toArray();

    let cleared = 0;

    for (const entry of entries) {
        const gameData = entry.gameData as any;
        if (gameData?.scaledMetrics?.scalingApplied) {
            // Remove scaledMetrics from gameData
            const { scaledMetrics, ...restGameData } = gameData;
            
            await db.scoutingData.update(entry.id, {
                gameData: restGameData,
            } as Partial<ScoutingEntryBase>);
            cleared++;
        }
    }

    return cleared;
}
