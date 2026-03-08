import { db, pitDB, saveScoutingEntry } from '@/db';
import {
    gamificationDB,
} from '@/game-template/gamification';
import { actions, toggles } from '@/game-template/game-schema';
import type { Scout, MatchPrediction } from '@/core/types/gamification';
import type { ScoutingEntryBase } from '@/core/types/scouting-entry';

/**
 * Agnostic Test Data Generator
 * 
 * This utility provides framework-level functions for generating random test data
 * predicated on the current game schema.
 */

const TEST_SCOUT_NAMES = [
    "Riley Davis",
    "Alex Kim",
    "Sarah Chen",
    "Marcus Rodriguez",
    "Taylor Wilson",
    "Emma Thompson",
    "Jordan Smith",
    "Casey Park"
];

const EVENT_KEY = "2025test";

import { gameDataTransformation } from '@/game-template/transformation';

/**
 * Generate a random integer between min and max (inclusive)
 */
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Generate random scouting data for a single match based on the schema
 * 
 * Uses gameDataTransformation to ensure the output format exactly matches
 * what the real application saves to the database.
 */
export const generateRandomGameData = (): Record<string, unknown> => {
    // 1. Generate Raw Match Data (Simulating the Form State)
    const autoActions: any[] = [];
    const teleopActions: any[] = [];

    // Generate random actions
    Object.entries(actions).forEach(([key, action]) => {
        // Auto actions
        if ('points' in action && (action.points as any).auto > 0) {
            const count = randomInt(0, 5);
            for (let i = 0; i < count; i++) {
                autoActions.push({ actionType: key, timestamp: Date.now() });
            }
        }

        // Teleop actions
        if ('points' in action && (action.points as any).teleop > 0) {
            const count = randomInt(0, 15);
            for (let i = 0; i < count; i++) {
                teleopActions.push({ actionType: key, timestamp: Date.now() });
            }
        }
    });

    // Generate random toggles (Robot Status)
    const autoRobotStatus: Record<string, boolean> = {};
    const teleopRobotStatus: Record<string, boolean> = {};
    const endgameRobotStatus: Record<string, boolean> = {};

    // Auto Toggles
    Object.keys(toggles.auto).forEach(key => {
        autoRobotStatus[key] = Math.random() > 0.5;
    });

    // Teleop Toggles
    Object.keys(toggles.teleop).forEach(key => {
        teleopRobotStatus[key] = Math.random() > 0.5;
    });

    // Endgame Toggles
    const endgameConfig = toggles.endgame as Record<string, any>;
    const selectionGroups: Record<string, string[]> = {};

    Object.entries(endgameConfig).forEach(([key, config]) => {
        if (config.group === 'selection') {
            if (!selectionGroups['selection']) selectionGroups['selection'] = [];
            selectionGroups['selection'].push(key);
        } else {
            endgameRobotStatus[key] = Math.random() > 0.3;
        }
    });

    // Handle selection groups (mutually exclusive)
    Object.values(selectionGroups).forEach(groupKeys => {
        const selected = groupKeys[randomInt(0, groupKeys.length - 1)];
        groupKeys.forEach(k => {
            endgameRobotStatus[k] = k === selected;
        });
    });

    // Generate Start Position (Boolean Array)
    const startPosition = [false, false, false, false];
    startPosition[randomInt(0, 3)] = true;

    // 2. Transform Raw Data to Database Format
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

/**
 * Generate and save random match scouting entries
 */
export const generateRandomScoutingData = async (count: number = 20) => {
    console.log(`🧪 Generating ${count} random scouting entries...`);

    const teams = [254, 1323, 1678, 3314, 118, 148, 111, 2056];

    for (let i = 0; i < count; i++) {
        const scoutName = TEST_SCOUT_NAMES[randomInt(0, TEST_SCOUT_NAMES.length - 1)] || "Unknown Scout";
        const teamNumber = teams[randomInt(0, teams.length - 1)] || 0;
        const matchNumber = randomInt(1, 100);
        const allianceColor = Math.random() > 0.5 ? 'red' : 'blue';

        const entry: ScoutingEntryBase<Record<string, unknown>> = {
            id: crypto.randomUUID(),
            teamNumber,
            matchNumber,
            allianceColor,
            scoutName,
            eventKey: EVENT_KEY,
            matchKey: `${EVENT_KEY}_qm${matchNumber}`,
            timestamp: Date.now() - randomInt(0, 1000 * 60 * 60 * 24 * 7), // Up to 7 days ago
            comments: Math.random() > 0.3 ? "Randomly generated note for this match." : undefined,
            gameData: generateRandomGameData(),
        };

        await saveScoutingEntry(entry);
    }
};

/**
 * Generate random scout profiles
 */
export const generateRandomScouts = async () => {
    console.log('🧪 Generating random scout profiles...');

    for (const name of TEST_SCOUT_NAMES) {
        const totalPredictions = randomInt(5, 50);
        const correctPredictions = Math.floor(totalPredictions * (0.4 + Math.random() * 0.5));
        const stakesFromPredictions = correctPredictions * 10;

        const scout: Scout = {
            name,
            stakes: stakesFromPredictions + randomInt(0, 100), // Random achievement bonus
            stakesFromPredictions,
            totalPredictions,
            correctPredictions,
            currentStreak: randomInt(0, 5),
            longestStreak: randomInt(5, 12),
            createdAt: Date.now() - (1000 * 60 * 60 * 24 * 30),
            lastUpdated: Date.now()
        };

        await gamificationDB.scouts.put(scout);

        // Generate some random predictions for this scout
        await generateRandomPredictions(name, totalPredictions);
    }
};

/**
 * Generate random predictions for a scout
 */
export const generateRandomPredictions = async (scoutName: string, count: number) => {
    for (let i = 0; i < count; i++) {
        const isCorrect = Math.random() > 0.4;
        const prediction: MatchPrediction = {
            id: crypto.randomUUID(),
            scoutName,
            eventKey: EVENT_KEY,
            matchNumber: i + 1,
            predictedWinner: Math.random() > 0.5 ? 'red' : 'blue',
            timestamp: Date.now() - randomInt(0, 1000 * 60 * 60 * 24 * 14),
            verified: true,
            isCorrect,
            pointsAwarded: isCorrect ? 10 : 0
        };

        await gamificationDB.predictions.put(prediction);
    }
};

/**
 * Generate scouting data aligned with TBA match data for validation testing
 * 
 * This fetches actual TBA matches for the current event and generates
 * scouting entries for all teams. The data will have realistic values
 * for testing the match validation feature.
 */
export const generateTBAAlignedScoutingData = async (matchCount: number = 10): Promise<{ success: boolean; message: string; matchesGenerated: number }> => {
    console.log('🧪 Generating TBA-aligned scouting data for validation testing...');

    // Get current event from localStorage
    const eventKey = localStorage.getItem('eventKey');
    if (!eventKey) {
        return { success: false, message: 'No event selected. Please select an event first.', matchesGenerated: 0 };
    }

    // Get TBA API key
    const apiKey = import.meta.env.VITE_TBA_API_KEY;
    if (!apiKey) {
        return { success: false, message: 'TBA API key not configured in .env file.', matchesGenerated: 0 };
    }

    try {
        // Fetch TBA matches for the event
        const response = await fetch(`https://www.thebluealliance.com/api/v3/event/${eventKey}/matches`, {
            headers: { 'X-TBA-Auth-Key': apiKey }
        });

        if (!response.ok) {
            return { success: false, message: `TBA API error: ${response.status}`, matchesGenerated: 0 };
        }

        const allMatches = await response.json();

        // Filter to qualification matches with score breakdowns, limit to matchCount
        const matches = allMatches
            .filter((m: any) => m.comp_level === 'qm' && m.score_breakdown)
            .slice(0, matchCount);

        if (matches.length === 0) {
            return { success: false, message: 'No qualification matches with scores found.', matchesGenerated: 0 };
        }

        let entriesGenerated = 0;

        for (const match of matches) {
            const redTeams = (match.alliances.red.team_keys as string[]).map(k => parseInt(k.replace('frc', '')));
            const blueTeams = (match.alliances.blue.team_keys as string[]).map(k => parseInt(k.replace('frc', '')));

            // Extract matchKey from full TBA key (e.g., "2025mrcmp_qm10" -> "qm10")
            const matchKey = match.key.includes('_') ? match.key.split('_')[1] : match.key;

            // Generate scouting entry for each team
            for (const teamNumber of redTeams) {
                const entry: ScoutingEntryBase<Record<string, unknown>> = {
                    id: `${eventKey}::${matchKey}::${teamNumber}::red`,
                    teamNumber,
                    matchNumber: match.match_number,
                    allianceColor: 'red',
                    scoutName: TEST_SCOUT_NAMES[randomInt(0, TEST_SCOUT_NAMES.length - 1)] || "Test Scout",
                    eventKey,
                    matchKey: matchKey,
                    timestamp: Date.now() - randomInt(0, 1000 * 60 * 60),
                    comments: `Auto-generated for validation testing`,
                    gameData: generateRandomGameData(),
                };
                await saveScoutingEntry(entry);
                entriesGenerated++;
            }

            for (const teamNumber of blueTeams) {
                const entry: ScoutingEntryBase<Record<string, unknown>> = {
                    id: `${eventKey}::${matchKey}::${teamNumber}::blue`,
                    teamNumber,
                    matchNumber: match.match_number,
                    allianceColor: 'blue',
                    scoutName: TEST_SCOUT_NAMES[randomInt(0, TEST_SCOUT_NAMES.length - 1)] || "Test Scout",
                    eventKey,
                    matchKey: matchKey,
                    timestamp: Date.now() - randomInt(0, 1000 * 60 * 60),
                    comments: `Auto-generated for validation testing`,
                    gameData: generateRandomGameData(),
                };
                await saveScoutingEntry(entry);
                entriesGenerated++;
            }
        }

        console.log(`✅ Generated ${entriesGenerated} scouting entries for ${matches.length} matches`);
        return {
            success: true,
            message: `Generated ${entriesGenerated} entries for ${matches.length} matches`,
            matchesGenerated: matches.length
        };

    } catch (error) {
        console.error('Error generating TBA-aligned data:', error);
        return { success: false, message: `Error: ${error}`, matchesGenerated: 0 };
    }
};

/**
 * Completely reset all databases
 */
export const resetEntireDatabase = async () => {
    console.log('🧹 Resetting all databases...');
    await Promise.all([
        db.scoutingData.clear(),
        pitDB.pitScoutingData.clear(),
        gamificationDB.scouts.clear(),
        gamificationDB.predictions.clear(),
        gamificationDB.scoutAchievements.clear()
    ]);
    console.log('✅ Databases cleared successfully');
};
