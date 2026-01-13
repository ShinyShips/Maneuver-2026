/**
 * Game-Specific Strategy Analysis
 * 
 * This module provides team statistics calculations and display configuration
 * for the Team Statistics page.
 * 
 * HOW TO CUSTOMIZE FOR YOUR GAME YEAR:
 * ====================================
 * 
 * 1. Update calculateBasicStats() to compute your game's metrics
 * 2. Update getStatSections() to define stat cards for each tab
 * 3. Update getRateSections() to define progress bar sections
 * 4. Update getMatchBadges() to define match-by-match indicators
 * 5. Update getStartPositionConfig() for your field layout
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
import fieldMapImage from "@/game-template/assets/FieldMap.png";
import fieldMapBlueImage from "@/game-template/assets/FieldMapBlue.png";


/**
 * Template scouting entry type
 * Extends ScoutingEntryBase with game-specific gameData
 */
type ScoutingEntryTemplate = ScoutingEntryBase & {
    gameData: CoreGameData;
};

/**
 * Template team statistics type
 * CUSTOMIZE: Add your game-specific calculated stats
 */
interface TeamStatsTemplate extends TeamStats {
    // Point averages
    avgTotalPoints: number;
    avgAutoPoints: number;
    avgTeleopPoints: number;
    avgEndgamePoints: number;

    // Game-specific averages
    avgAutoAction1: number;
    avgAutoAction2: number;
    avgTeleopAction1: number;
    avgTeleopAction2: number;

    // Rate metrics (0-100%)
    mobilityRate: number;
    endgameSuccessRate: number;
    breakdownRate: number;

    // Start position percentages
    startPositions: Record<string, number>;

    // Match results for performance tab
    matchResults: MatchResult[];
}

/**
 * Match result data for performance display
 * SINGLE SOURCE OF TRUTH: Used by PerformanceAnalysis and MatchStatsDialog
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
    brokeDown: boolean;
    startPosition: number;
    comment: string;
    // Allow additional game-specific fields
    [key: string]: unknown;
}

/**
 * Strategy Analysis Implementation
 * 
 * CUSTOMIZE: Update all methods for your game year
 */
export const strategyAnalysis: StrategyAnalysis<ScoutingEntryTemplate> = {
    /**
     * Calculate basic statistics for a team
     * 
     * CUSTOMIZE: Update this method with your game's scoring logic
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
                avgAutoAction1: 0,
                avgAutoAction2: 0,
                avgTeleopAction1: 0,
                avgTeleopAction2: 0,
                mobilityRate: 0,
                endgameSuccessRate: 0,
                breakdownRate: 0,
                startPositions: {},
                matchResults: [],
            };
        }

        // Calculate totals
        // CUSTOMIZE: Add your game's scoring calculations
        // Access game-specific data through entry.gameData
        const totals = entries.reduce((acc, entry) => {
            const gameData = entry.gameData;
            acc.autoAction1 += gameData?.auto?.action1Count || 0;
            acc.autoAction2 += gameData?.auto?.action2Count || 0;
            acc.teleopAction1 += gameData?.teleop?.action1Count || 0;
            acc.teleopAction2 += gameData?.teleop?.action2Count || 0;
            acc.endgameSuccess += gameData?.endgame?.option1 ? 1 : 0;
            acc.breakdown += gameData?.endgame?.option2 ? 1 : 0;

            // Track start positions
            const pos = gameData?.auto?.startPosition;
            if (pos !== null && pos !== undefined && pos >= 0) {
                acc.startPositionCounts[pos] = (acc.startPositionCounts[pos] || 0) + 1;
            }

            return acc;
        }, {
            autoAction1: 0,
            autoAction2: 0,
            teleopAction1: 0,
            teleopAction2: 0,
            endgameSuccess: 0,
            breakdown: 0,
            startPositionCounts: {} as Record<number, number>,
        });

        // Calculate match results
        // CUSTOMIZE: Update point calculations for your game
        const matchResults: MatchResult[] = entries.map(entry => {
            const autoPoints = scoringCalculations.calculateAutoPoints(entry as any);
            const teleopPoints = scoringCalculations.calculateTeleopPoints(entry as any);
            const endgamePoints = scoringCalculations.calculateEndgamePoints(entry as any);
            const endgameSuccess = entry.gameData?.endgame?.option1 || false;

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
                endgameSuccess: endgameSuccess || false,
                brokeDown: entry.gameData?.endgame?.option2 || false,
                startPosition: entry.gameData?.auto?.startPosition ?? -1,
                comment: entry.comments || '',
                // Include all action counts for the dialog
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
                totalPiecesScored: totals.autoAction1 + totals.autoAction2 + totals.teleopAction1 + totals.teleopAction2,
                avgGamePiece1: Math.round(((totals.autoAction1 + totals.teleopAction1) / matchCount) * 10) / 10,
                avgGamePiece2: Math.round(((totals.autoAction2 + totals.teleopAction2) / matchCount) * 10) / 10,
            },
            auto: {
                avgPoints: Math.round(avgAutoPoints * 10) / 10,
                avgGamePiece1: Math.round((totals.autoAction1 / matchCount) * 10) / 10,
                avgGamePiece2: Math.round((totals.autoAction2 / matchCount) * 10) / 10,
                mobilityRate: 0,
                startPositions: Object.entries(startPositions).map(([key, value]) => ({ position: key, percentage: value })),
            },
            teleop: {
                avgPoints: Math.round(avgTeleopPoints * 10) / 10,
                avgGamePiece1: Math.round((totals.teleopAction1 / matchCount) * 10) / 10,
                avgGamePiece2: Math.round((totals.teleopAction2 / matchCount) * 10) / 10,
            },
            endgame: {
                avgPoints: Math.round(avgEndgamePoints * 10) / 10,
                climbRate: Math.round((totals.endgameSuccess / matchCount) * 100),
                parkRate: 0,
            },
            // Template-specific fields
            matchesPlayed: matchCount,
            avgTotalPoints: Math.round((avgAutoPoints + avgTeleopPoints + avgEndgamePoints) * 10) / 10,
            avgAutoPoints: Math.round(avgAutoPoints * 10) / 10,
            avgTeleopPoints: Math.round(avgTeleopPoints * 10) / 10,
            avgEndgamePoints: Math.round(avgEndgamePoints * 10) / 10,
            avgAutoAction1: Math.round((totals.autoAction1 / matchCount) * 10) / 10,
            avgAutoAction2: Math.round((totals.autoAction2 / matchCount) * 10) / 10,
            avgTeleopAction1: Math.round((totals.teleopAction1 / matchCount) * 10) / 10,
            avgTeleopAction2: Math.round((totals.teleopAction2 / matchCount) * 10) / 10,
            mobilityRate: 0, // CUSTOMIZE: Add mobility tracking
            endgameSuccessRate: Math.round((totals.endgameSuccess / matchCount) * 100),
            breakdownRate: Math.round((totals.breakdown / matchCount) * 100),
            startPositions,
            matchResults: matchResults.sort((a, b) => parseInt(a.matchNumber) - parseInt(b.matchNumber)),
        };
    },

    /**
     * Get stat sections for the Team Statistics page
     * 
     * CUSTOMIZE: Define stat cards for Overview and Scoring tabs
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
                ],
            },

            // Scoring tab - auto scoring
            {
                id: 'auto-scoring',
                title: 'Auto Scoring',
                tab: 'scoring',
                columns: 2,
                stats: [
                    { key: 'avgAutoAction1', label: 'Action 1', type: 'number', subtitle: 'avg per match' },
                    { key: 'avgAutoAction2', label: 'Action 2', type: 'number', subtitle: 'avg per match' },
                ],
            },

            // Scoring tab - teleop scoring
            {
                id: 'teleop-scoring',
                title: 'Teleop Scoring',
                tab: 'scoring',
                columns: 2,
                stats: [
                    { key: 'avgTeleopAction1', label: 'Action 1', type: 'number', subtitle: 'avg per match' },
                    { key: 'avgTeleopAction2', label: 'Action 2', type: 'number', subtitle: 'avg per match' },
                ],
            },
        ];
    },

    /**
     * Get rate sections (progress bars) for the Team Statistics page
     * 
     * CUSTOMIZE: Define progress bar sections for Overview and Performance tabs
     */
    getRateSections(): RateSectionDefinition[] {
        return [
            {
                id: 'key-rates',
                title: 'Key Rates',
                tab: 'overview',
                rates: [
                    { key: 'mobilityRate', label: 'Mobility Rate' },
                    { key: 'endgameSuccessRate', label: 'Endgame Success Rate' },
                    { key: 'breakdownRate', label: 'Breakdown Rate' },
                ],
            },
            {
                id: 'reliability-metrics',
                title: 'Reliability Metrics',
                tab: 'performance',
                rates: [
                    { key: 'mobilityRate', label: 'Mobility Success' },
                    { key: 'endgameSuccessRate', label: 'Endgame Success' },
                    { key: 'breakdownRate', label: 'Breakdown Rate' },
                ],
            },
        ];
    },

    /**
     * Get match badges for match-by-match performance list
     * 
     * CUSTOMIZE: Define game-specific badges (e.g., "Climbed", "Broke Down")
     */
    getMatchBadges(): MatchBadgeDefinition[] {
        return [
            { key: 'endgameSuccess', label: 'Endgame ✓', variant: 'secondary', showWhen: true },
            { key: 'brokeDown', label: 'Broke Down', variant: 'destructive', showWhen: true },
        ];
    },

    /**
     * Get start position configuration
     * 
     * CUSTOMIZE: Define positions for your game's field layout
     * Zones are relative to a 640x480 base canvas
     */
    getStartPositionConfig(): StartPositionConfig {
        return {
            positionCount: 5, // 2025 Reefscape: 5 horizontal starting positions
            positionLabels: ['Position 0', 'Position 1', 'Position 2', 'Position 3', 'Position 4'],
            positionColors: ['blue', 'blue', 'blue', 'blue', 'blue'],
            fieldImageRed: fieldMapImage, // Red alliance field map
            fieldImageBlue: fieldMapBlueImage, // Blue alliance field map
            // Zone definitions for the auto start position map (640x480 base)
            zones: [
                { x: 0, y: 50, width: 128, height: 100, position: 0 },
                { x: 128, y: 50, width: 128, height: 100, position: 1 },
                { x: 256, y: 50, width: 128, height: 100, position: 2 },
                { x: 384, y: 50, width: 128, height: 100, position: 3 },
                { x: 512, y: 50, width: 128, height: 100, position: 4 },
            ],
        };
    },
};

export default strategyAnalysis;
