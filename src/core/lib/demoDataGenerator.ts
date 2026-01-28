/**
 * Demo Data Generator
 * 
 * Creates realistic demo data for testing the entire scouting workflow:
 * - 30 teams with varying skill levels
 * - 60 qualification matches (each team plays ~12 matches)
 * - Full playoff bracket (quarterfinals, semifinals, finals)
 * - Scouting entries for all matches
 * - Realistic scoring patterns
 * 
 * This is game-agnostic and uses the game context to generate game-specific data.
 */

import { db, saveScoutingEntry, savePitScoutingEntry } from '@/core/db/database';
import type { ScoutingEntryBase } from '@/core/types/scouting-entry';
import type { PitScoutingEntryBase, DrivetrainType, ProgrammingLanguage } from '@/core/types/pit-scouting';
import { setCurrentEvent } from '@/core/lib/tba/eventDataUtils';
import { cacheTBAMatches } from '@/core/lib/tbaCache';
import { getOrCreateScoutByName, updateScoutStats } from '@/core/lib/scoutGamificationUtils';
import { gamificationDB, createMatchPrediction } from '@/game/gamification';

// ============================================================================
// Configuration
// ============================================================================

const DEMO_EVENT_KEY = 'demo2026';
const TEAMS_COUNT = 30;
const QUAL_MATCHES = 60;
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
const START_POSITIONS = ['Left Trench', 'Left Bump', 'Hub', 'Right Bump', 'Right Trench'];

// ============================================================================
// Team Skill Profiles
// ============================================================================

interface TeamSkillProfile {
    teamNumber: number;
    skillLevel: 'elite' | 'strong' | 'average' | 'developing';
    tier: 'elite' | 'strong' | 'average' | 'developing'; // Alias for skillLevel
    autoAccuracy: number;      // 0-1, likelihood of successful auto actions
    teleopAccuracy: number;     // 0-1, likelihood of successful teleop actions
    endgameSuccess: number;     // 0-1, likelihood of successful endgame
    consistency: number;        // 0-1, variance in performance (1 = very consistent)
}

/**
 * Generate team skill profiles with realistic distribution
 */
function generateTeamProfiles(): TeamSkillProfile[] {
    const teams: TeamSkillProfile[] = [];
    
    // Elite teams (top 10%)
    const eliteCount = Math.ceil(TEAMS_COUNT * 0.1);
    for (let i = 0; i < eliteCount; i++) {
        teams.push({
            teamNumber: 1000 + i,
            skillLevel: 'elite',
            tier: 'elite',
            autoAccuracy: 0.85 + Math.random() * 0.15,
            teleopAccuracy: 0.80 + Math.random() * 0.20,
            endgameSuccess: 0.90 + Math.random() * 0.10,
            consistency: 0.85 + Math.random() * 0.15,
        });
    }
    
    // Strong teams (next 25%)
    const strongCount = Math.ceil(TEAMS_COUNT * 0.25);
    for (let i = 0; i < strongCount; i++) {
        teams.push({
            teamNumber: 2000 + i,
            skillLevel: 'strong',
            tier: 'strong',
            autoAccuracy: 0.65 + Math.random() * 0.20,
            teleopAccuracy: 0.65 + Math.random() * 0.20,
            endgameSuccess: 0.70 + Math.random() * 0.20,
            consistency: 0.70 + Math.random() * 0.20,
        });
    }
    
    // Average teams (next 40%)
    const averageCount = Math.ceil(TEAMS_COUNT * 0.40);
    for (let i = 0; i < averageCount; i++) {
        teams.push({
            teamNumber: 3000 + i,
            skillLevel: 'average',
            tier: 'average',
            autoAccuracy: 0.40 + Math.random() * 0.30,
            teleopAccuracy: 0.45 + Math.random() * 0.30,
            endgameSuccess: 0.50 + Math.random() * 0.30,
            consistency: 0.50 + Math.random() * 0.30,
        });
    }
    
    // Developing teams (remaining ~25%)
    const remaining = TEAMS_COUNT - teams.length;
    for (let i = 0; i < remaining; i++) {
        teams.push({
            teamNumber: 4000 + i,
            skillLevel: 'developing',
            tier: 'developing',
            autoAccuracy: 0.20 + Math.random() * 0.30,
            teleopAccuracy: 0.25 + Math.random() * 0.35,
            endgameSuccess: 0.30 + Math.random() * 0.30,
            consistency: 0.30 + Math.random() * 0.40,
        });
    }
    
    return teams;
}

// ============================================================================
// Match Schedule Generation
// ============================================================================

interface MatchSchedule {
    matchKey: string;
    matchNumber: number;
    compLevel: 'qm' | 'qf' | 'sf' | 'f';
    redTeams: number[];
    blueTeams: number[];
}

/**
 * Generate qualification match schedule
 * Uses sequential team assignment to ensure each team plays exactly 12 matches
 */
function generateQualSchedule(teams: TeamSkillProfile[]): MatchSchedule[] {
    const matches: MatchSchedule[] = [];
    const teamNumbers = teams.map(t => t.teamNumber);
    
    for (let matchNum = 1; matchNum <= QUAL_MATCHES; matchNum++) {
        // Calculate starting index for this match (cycles through teams)
        const startIndex = ((matchNum - 1) * 6) % teamNumbers.length;
        
        // Get 6 consecutive teams (wrapping around if needed)
        const selectedTeams: number[] = [];
        for (let i = 0; i < 6; i++) {
            const teamIndex = (startIndex + i) % teamNumbers.length;
            selectedTeams.push(teamNumbers[teamIndex]!);
        }
        
        // Split into alliances (first 3 red, next 3 blue)
        const redTeams = selectedTeams.slice(0, 3);
        const blueTeams = selectedTeams.slice(3, 6);
        
        matches.push({
            matchKey: `${DEMO_EVENT_KEY}_qm${matchNum}`,
            matchNumber: matchNum,
            compLevel: 'qm',
            redTeams,
            blueTeams,
        });
    }
    
    return matches;
}

// ============================================================================
// Match Outcome & Predictions
// ============================================================================

/**
 * Calculate match winner based on team skill profiles
 * Returns 'red', 'blue', or 'tie'
 */
function determineMatchWinner(
    redTeams: number[],
    blueTeams: number[],
    teamProfiles: Map<number, TeamSkillProfile>
): 'red' | 'blue' | 'tie' {
    // Calculate alliance strength (average of all skill factors)
    const calculateAllianceStrength = (teams: number[]) => {
        let totalStrength = 0;
        for (const teamNum of teams) {
            const profile = teamProfiles.get(teamNum);
            if (profile) {
                // Add some randomness based on consistency
                const variance = (1 - profile.consistency) * 0.3;
                const randomFactor = 1 + (Math.random() - 0.5) * variance;
                
                const strength = (
                    profile.autoAccuracy +
                    profile.teleopAccuracy +
                    profile.endgameSuccess
                ) / 3 * randomFactor;
                
                totalStrength += strength;
            }
        }
        return totalStrength / teams.length;
    };

    const redStrength = calculateAllianceStrength(redTeams);
    const blueStrength = calculateAllianceStrength(blueTeams);

    // 5% tie chance if strengths are very close
    if (Math.abs(redStrength - blueStrength) < 0.05) {
        if (Math.random() < 0.05) return 'tie';
    }

    return redStrength > blueStrength ? 'red' : 'blue';
}

/**
 * Generate scout prediction with varying accuracy based on skill
 * Better scouts have higher prediction accuracy
 */
function generatePrediction(
    actualWinner: 'red' | 'blue' | 'tie',
    scoutAccuracy: number // 0-1, how good this scout is at predictions
): 'red' | 'blue' {
    // If tie, random prediction
    if (actualWinner === 'tie') {
        return Math.random() < 0.5 ? 'red' : 'blue';
    }

    // Scout predicts correctly based on their accuracy
    if (Math.random() < scoutAccuracy) {
        return actualWinner;
    } else {
        // Wrong prediction
        return actualWinner === 'red' ? 'blue' : 'red';
    }
}

// ============================================================================
// Game Data Generation (uses injected generator)
// ============================================================================

export type GameDataGenerator = (profile: TeamSkillProfile, matchKey: string) => Record<string, unknown>;

/**
 * Default game data generator (random data, no profile consideration)
 * Game implementations should provide their own generator for realistic data
 */
const defaultGameDataGenerator: GameDataGenerator = () => {
    return {
        autoActions: [],
        teleopActions: [],
        endgameStatus: {},
    };
};

// ============================================================================
// Main Generation Functions
// ============================================================================

export interface DemoDataOptions {
    eventKey?: string;
    clearExisting?: boolean;
    gameDataGenerator?: GameDataGenerator;
    includePlayoffs?: boolean;
}

export interface DemoDataResult {
    success: boolean;
    message: string;
    stats: {
        teamsGenerated: number;
        qualMatches: number;
        playoffMatches: number;
        entriesGenerated: number;
    };
}

/**
 * Generate complete demo event data
 */
export async function generateDemoEvent(options: DemoDataOptions = {}): Promise<DemoDataResult> {
    const {
        eventKey = DEMO_EVENT_KEY,
        clearExisting = true,
        gameDataGenerator = defaultGameDataGenerator,
        includePlayoffs: _includePlayoffs = true,
    } = options;
    
    console.log('🎲 Generating demo event data...');
    
    try {
        // Clear existing demo data if requested
        if (clearExisting) {
            await db.scoutingData
                .where('eventKey')
                .equals(eventKey)
                .delete();
            console.log('  ✓ Cleared existing demo data');
        }
        
        // Generate team profiles
        const teams = generateTeamProfiles();
        console.log(`  ✓ Generated ${teams.length} team profiles`);
        
        // Generate match schedules (only qualification matches)
        const qualSchedule = generateQualSchedule(teams);
        const allMatches = qualSchedule;
        console.log(`  ✓ Generated ${qualSchedule.length} qual matches`);
        
        // Generate scouting entries for all matches
        let entriesGenerated = 0;
        const processedEntries = new Set<string>(); // Track entry IDs to prevent duplicates
        
        for (const match of allMatches) {
            // Red alliance entries
            for (let i = 0; i < match.redTeams.length; i++) {
                const teamNumber = match.redTeams[i];
                if (!teamNumber) continue;
                
                // Check for duplicate team in this match
                const entryId = `${eventKey}::${match.matchKey.split('_')[1]}::${teamNumber}::red`;
                if (processedEntries.has(entryId)) {
                    console.warn(`Duplicate entry detected: ${entryId}`);
                    continue;
                }
                processedEntries.add(entryId);
                
                const profile = teams.find(t => t.teamNumber === teamNumber);
                if (!profile) continue;
                
                const scoutName = TEST_SCOUT_NAMES[Math.floor(Math.random() * TEST_SCOUT_NAMES.length)] || "Demo Scout";
                
                const entry: ScoutingEntryBase<Record<string, unknown>> = {
                    id: `${eventKey}::${match.matchKey.split('_')[1]}::${teamNumber}::red`,
                    teamNumber,
                    matchNumber: match.matchNumber,
                    allianceColor: 'red',
                    scoutName,
                    eventKey,
                    matchKey: match.matchKey,
                    timestamp: Date.now() - (allMatches.length - allMatches.indexOf(match)) * 60000, // Spread over time
                    comments: Math.random() > 0.7 ? generateRandomComment(profile) : undefined,
                    gameData: gameDataGenerator(profile, match.matchKey),
                };
                
                await saveScoutingEntry(entry);
                entriesGenerated++;
            }
            
            // Blue alliance entries
            for (let i = 0; i < match.blueTeams.length; i++) {
                const teamNumber = match.blueTeams[i];
                if (!teamNumber) continue;
                
                // Check for duplicate team in this match
                const entryId = `${eventKey}::${match.matchKey.split('_')[1]}::${teamNumber}::blue`;
                if (processedEntries.has(entryId)) {
                    console.warn(`Duplicate entry detected: ${entryId}`);
                    continue;
                }
                processedEntries.add(entryId);
                
                const profile = teams.find(t => t.teamNumber === teamNumber);
                if (!profile) continue;
                
                const scoutName = TEST_SCOUT_NAMES[Math.floor(Math.random() * TEST_SCOUT_NAMES.length)] || "Demo Scout";
                
                const entry: ScoutingEntryBase<Record<string, unknown>> = {
                    id: `${eventKey}::${match.matchKey.split('_')[1]}::${teamNumber}::blue`,
                    teamNumber,
                    matchNumber: match.matchNumber,
                    allianceColor: 'blue',
                    scoutName,
                    eventKey,
                    matchKey: match.matchKey,
                    timestamp: Date.now() - (allMatches.length - allMatches.indexOf(match)) * 60000,
                    comments: Math.random() > 0.7 ? generateRandomComment(profile) : undefined,
                    gameData: gameDataGenerator(profile, match.matchKey),
                };
                
                await saveScoutingEntry(entry);
                entriesGenerated++;
            }
        }
        
        console.log(`  ✓ Generated ${entriesGenerated} scouting entries`);
        // Create team profiles map for reuse
        const teamProfilesMap = new Map(teams.map(t => [t.teamNumber, t]));
        // Generate pit scouting data for all teams
        console.log('\n📋 Generating pit scouting data...');
        let pitEntriesGenerated = 0;
        const drivetrains: DrivetrainType[] = ['swerve', 'tank', 'mecanum', 'other'];
        const programmingLanguages: ProgrammingLanguage[] = ['Java', 'C++', 'Python', 'LabVIEW'];
        
        for (const team of teams) {
            const profile = teamProfilesMap.get(team.teamNumber);
            if (!profile) continue;

            // Assign scout (rotate through scouts for pit scouting too)
            const pitScout = TEST_SCOUT_NAMES[team.teamNumber % TEST_SCOUT_NAMES.length]!;
            
            // Generate realistic robot specs based on team skill
            // 90% of all non-developing teams use Swerve (very common in modern FRC)
            const drivetrain = profile.tier === 'developing'
                ? drivetrains[Math.floor(Math.random() * drivetrains.length)]! // Developing teams use varied drivetrains
                : 'swerve'; // Almost all competitive teams use Swerve now
            
            const weight = 90 + Math.random() * 25; // 90-115 lbs
            
            // 90% of teams use Java
            const programmingLanguage = Math.random() < 0.9 
                ? 'Java' 
                : programmingLanguages[Math.floor(Math.random() * programmingLanguages.length)]!;
            
            // Generate robot capabilities based on skill tier
            // Physical dimensions
            const robotHeight = profile.tier === 'developing' 
                ? 24 + Math.random() * 6  // 24-30" (can't go under trench)
                : 18 + Math.random() * 4; // 18-22" (most can go under)
            const canGoUnderTrench = robotHeight < 22.25;
            
            // Fuel capacity - taller robots hold more (more vertical space)
            // Tall robots (24-30"): 80-120 pieces
            // Medium robots (22-24"): 50-80 pieces
            // Short robots (18-22"): 20-50 pieces
            const fuelCapacity = robotHeight >= 24 ? 80 + Math.floor(Math.random() * 41) : // 80-120
                                robotHeight >= 22 ? 50 + Math.floor(Math.random() * 31) : // 50-80
                                20 + Math.floor(Math.random() * 31); // 20-50
            
            // Strategic preferences
            const startPositions = START_POSITIONS;
            const preferredStartPositions = startPositions.slice(0, 1 + Math.floor(Math.random() * 3)); // 1-3 positions
            
            const activeRoles = profile.tier === 'elite' ? ['Cycler', 'Thief'] :
                               profile.tier === 'strong' ? ['Cycler', 'Clean Up'] :
                               profile.tier === 'average' ? ['Clean Up', 'Passer'] :
                               ['Defense', 'Passer'];
            
            const inactiveRoles = profile.tier === 'elite' ? ['Passer', 'Defense'] :
                                 profile.tier === 'strong' ? ['Passer', 'Thief'] :
                                 profile.tier === 'average' ? ['Passer', 'Defense'] :
                                 ['Clean Up'];
            
            // Climbing capabilities
            const canAutoClimbL1 = profile.tier === 'elite' && Math.random() > 0.5;
            const targetClimbLevel = profile.tier === 'elite' ? 'level3' :
                                   profile.tier === 'strong' ? (Math.random() > 0.5 ? 'level3' : 'level2') :
                                   profile.tier === 'average' ? (Math.random() > 0.3 ? 'level2' : 'level1') :
                                   Math.random() > 0.5 ? 'level1' : 'none';

            const pitEntry: PitScoutingEntryBase = {
                id: `pit-${team.teamNumber}-${eventKey}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                teamNumber: team.teamNumber,
                eventKey,
                scoutName: pitScout,
                timestamp: Date.now() - Math.random() * 86400000, // Random time in last 24 hours
                robotPhoto: undefined, // Could add placeholder URLs if needed
                weight: Math.round(weight * 10) / 10, // Round to 1 decimal
                drivetrain,
                programmingLanguage,
                notes: generatePitNotes(profile, { canAutoClimbL1, targetClimbLevel, fuelCapacity, canGoUnderTrench }),
                gameData: {
                    // Physical Specifications
                    maxLength: Math.round(28 + Math.random() * 4), // 28-32"
                    maxWidth: Math.round(26 + Math.random() * 4), // 26-30"
                    maxHeight: Math.round(robotHeight),
                    canGoUnderTrench,
                    
                    // Fuel Handling
                    fuelCapacity,
                    canOutpostPickup: Math.random() > 0.2, // 80% can pickup from outpost
                    canPassToCorral: Math.random() > 0.3, // 70% can pass to corral
                    
                    // Strategic Preferences
                    preferredStartPositions,
                    preferredActiveRoles: activeRoles,
                    preferredInactiveRoles: inactiveRoles,
                    
                    // Autonomous & Endgame
                    canAutoClimbL1,
                    targetClimbLevel,
                }
            };

            await savePitScoutingEntry(pitEntry);
            pitEntriesGenerated++;
        }

        console.log(`  ✓ Generated ${pitEntriesGenerated} pit scouting entries`);
        
        // Generate match predictions for all test scouts
        // Scout prediction accuracies (varying skill levels)
        const scoutAccuracies: Record<string, number> = {
            "Riley Davis": 0.85,      // Elite predictor
            "Alex Kim": 0.75,         // Strong predictor
            "Sarah Chen": 0.70,       // Above average
            "Marcus Rodriguez": 0.65, // Average
            "Taylor Wilson": 0.60,    // Slightly below average
            "Emma Thompson": 0.55,    // Learning
            "Jordan Smith": 0.50,     // Still learning
            "Casey Park": 0.45        // Beginner
        };

        let predictionsGenerated = 0;
        let correctPredictions = 0;

        // Assign each match to a random scout for predictions
        for (const match of allMatches) {
            const actualWinner = determineMatchWinner(
                match.redTeams,
                match.blueTeams,
                teamProfilesMap
            );

            // Each scout makes predictions for some matches (not all)
            // Distribute matches among scouts
            const assignedScout = TEST_SCOUT_NAMES[match.matchNumber % TEST_SCOUT_NAMES.length]!;
            const scoutAccuracy = scoutAccuracies[assignedScout] || 0.5;

            const predictedWinner = generatePrediction(actualWinner, scoutAccuracy);
            const isCorrect = (actualWinner !== 'tie' && predictedWinner === actualWinner);

            // Use database function to create prediction (ensures scout exists)
            const prediction = await createMatchPrediction(
                assignedScout,
                eventKey,
                match.matchNumber,
                predictedWinner
            );

            // Update prediction with verification results
            prediction.actualWinner = actualWinner === 'tie' ? undefined : actualWinner;
            prediction.isCorrect = isCorrect;
            prediction.pointsAwarded = isCorrect ? 10 : 0;
            prediction.timestamp = Date.now() - (QUAL_MATCHES - match.matchNumber) * 600000;
            prediction.verified = true;
            await gamificationDB.predictions.put(prediction);

            predictionsGenerated++;
            if (isCorrect) correctPredictions++;
        }

        console.log(`  ✓ Generated ${predictionsGenerated} predictions (${correctPredictions} correct, ${Math.round(correctPredictions / predictionsGenerated * 100)}% accuracy)`);

        // Update scout stats based on predictions
        for (const scoutName of TEST_SCOUT_NAMES) {
            const scoutPredictions = await gamificationDB.predictions
                .where('scoutName')
                .equals(scoutName)
                .filter(p => p.eventKey === eventKey)
                .toArray();

            if (scoutPredictions.length > 0) {
                const correct = scoutPredictions.filter(p => p.isCorrect).length;
                const total = scoutPredictions.length;
                const totalStakesFromPredictions = scoutPredictions.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);

                // Get current scout to preserve existing stakes
                const scout = await gamificationDB.scouts.get(scoutName);
                const currentStakes = scout?.stakes || 0;
                const newTotalStakes = currentStakes + totalStakesFromPredictions;

                await updateScoutStats(
                    scoutName,
                    newTotalStakes, // total stakes
                    correct, // correct predictions
                    total, // total predictions
                    undefined, // currentStreak (calculate separately if needed)
                    undefined, // longestStreak (calculate separately if needed)
                    totalStakesFromPredictions // additional stakes from these predictions
                );
            }
        }

        console.log(`  ✓ Updated scout prediction stats for ${TEST_SCOUT_NAMES.length} scouts`);
        
        // Create all test scouts in database and scouts list
        const scoutsList = localStorage.getItem('scoutsList');
        const existingScouts = scoutsList ? JSON.parse(scoutsList) : [];
        
        for (const scoutName of TEST_SCOUT_NAMES) {
            await getOrCreateScoutByName(scoutName);
            if (!existingScouts.includes(scoutName)) {
                existingScouts.push(scoutName);
            }
        }
        
        // Update scouts list
        localStorage.setItem('scoutsList', JSON.stringify(existingScouts.sort()));
        console.log(`  ✓ Created ${TEST_SCOUT_NAMES.length} test scouts in database`);
        
        // Set first scout as current scout
        // Note: This updates localStorage directly. The ScoutContext will pick it up
        // via its event listener when the scoutChanged event is dispatched.
        const demoScoutName = TEST_SCOUT_NAMES[0]!; // Use first scout name
        try {
            // Set current scout
            localStorage.setItem('currentScout', demoScoutName);
            
            // Set default player station to Red 1
            localStorage.setItem('playerStation', 'red-1');
            
            // Dispatch events to notify ScoutContext and nav-main
            window.dispatchEvent(new Event('scoutChanged'));
            window.dispatchEvent(new Event('playerStationChanged'));
            
            console.log(`  ✓ Set ${demoScoutName} as current scout (Red 1)`);
        } catch (error) {
            console.error('Failed to create demo scout:', error);
        }
        
        // Set the demo event as current event in localStorage
        localStorage.setItem('eventKey', eventKey);
        setCurrentEvent(eventKey); // Also adds to event history
        console.log(`  ✓ Set ${eventKey} as current event`);
        
        // Add demo event to custom events list if not already there
        try {
            const customEventsList = localStorage.getItem('customEventsList');
            const customEvents = customEventsList ? JSON.parse(customEventsList) : [];
            if (!customEvents.includes(eventKey)) {
                customEvents.push(eventKey);
                localStorage.setItem('customEventsList', JSON.stringify(customEvents));
                console.log(`  ✓ Added ${eventKey} to custom events list`);
            }
        } catch (error) {
            console.error('Failed to update custom events list:', error);
        }
        
        // Generate and cache TBA-style match schedule
        const tbaMatches = allMatches.map((match, index) => ({
            key: match.matchKey,
            comp_level: match.compLevel,
            set_number: 1,
            match_number: match.matchNumber,
            alliances: {
                red: {
                    score: -1,
                    team_keys: match.redTeams.map(t => `frc${t}`),
                    surrogate_team_keys: [],
                    dq_team_keys: []
                },
                blue: {
                    score: -1,
                    team_keys: match.blueTeams.map(t => `frc${t}`),
                    surrogate_team_keys: [],
                    dq_team_keys: []
                }
            },
            winning_alliance: "" as "" | "red" | "blue",
            event_key: eventKey,
            time: Math.floor(Date.now() / 1000) + (index * 600), // 10 minutes apart
            predicted_time: Math.floor(Date.now() / 1000) + (index * 600),
            actual_time: 0,
            post_result_time: 0,
            score_breakdown: null,
            videos: []
        }));
        
        // Cache the matches (pass matches first, not eventKey)
        await cacheTBAMatches(tbaMatches);
        console.log(`  ✓ Cached ${tbaMatches.length} matches as TBA data`);
        
        // Store match data in localStorage for team selection on GameStartPage
        const matchData = allMatches.map(match => ({
            matchNumber: match.matchNumber,
            redAlliance: match.redTeams,
            blueAlliance: match.blueTeams
        }));
        localStorage.setItem('matchData', JSON.stringify(matchData));
        console.log(`  ✓ Stored match schedule in localStorage for team selection`);
        
        return {
            success: true,
            message: `Demo event created: ${teams.length} teams, ${qualSchedule.length} matches, ${entriesGenerated} entries, ${pitEntriesGenerated} pit entries, ${predictionsGenerated} predictions by ${TEST_SCOUT_NAMES.length} scouts`,
            stats: {
                teamsGenerated: teams.length,
                qualMatches: qualSchedule.length,
                playoffMatches: 0,
                entriesGenerated,
            },
        };
        
    } catch (error) {
        console.error('❌ Error generating demo data:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            stats: {
                teamsGenerated: 0,
                qualMatches: 0,
                playoffMatches: 0,
                entriesGenerated: 0,
            },
        };
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate realistic scout comments based on team performance
 */
function generateRandomComment(profile: TeamSkillProfile): string {
    const comments = {
        elite: [
            "Incredibly consistent robot",
            "Strong autonomous routine",
            "Very fast cycle times",
            "Excellent driver control",
            "Top tier defense capabilities",
        ],
        strong: [
            "Solid performance overall",
            "Good scoring consistency",
            "Reliable endgame",
            "Decent auto routine",
            "Few mistakes",
        ],
        average: [
            "Average performance",
            "Some scoring but inconsistent",
            "Struggled with accuracy",
            "Okay endgame",
            "Room for improvement",
        ],
        developing: [
            "Still learning the game",
            "Had some technical difficulties",
            "Improving throughout match",
            "Needs practice with scoring",
            "Good effort",
        ],
    };
    
    const skillComments = comments[profile.skillLevel];
    return skillComments[Math.floor(Math.random() * skillComments.length)] || "Good effort";
}

/**
 * Generate realistic pit scouting notes based on team capabilities
 */
function generatePitNotes(
    profile: TeamSkillProfile, 
    capabilities: { canAutoClimbL1: boolean; targetClimbLevel: string; fuelCapacity: number; canGoUnderTrench: boolean }
): string {
    const notes: string[] = [];
    
    // Add notes based on skill tier
    if (profile.tier === 'elite') {
        notes.push('Very experienced team with well-built robot.');
    } else if (profile.tier === 'strong') {
        notes.push('Solid robot design with good build quality.');
    } else if (profile.tier === 'average') {
        notes.push('Functional robot, still working out some issues.');
    } else {
        notes.push('Rookie or developing team, learning as they go.');
    }
    
    // Add capability notes
    if (capabilities.canGoUnderTrench) {
        notes.push('Can navigate under trench for faster field traversal.');
    }
    if (capabilities.fuelCapacity >= 80) {
        notes.push(`High fuel capacity (${capabilities.fuelCapacity} pieces).`);
    } else if (capabilities.fuelCapacity >= 50) {
        notes.push(`Good fuel capacity (${capabilities.fuelCapacity} pieces).`);
    }
    if (capabilities.canAutoClimbL1) {
        notes.push('Has autonomous climb capability (15pts).');
    }
    if (capabilities.targetClimbLevel === 'level3') {
        notes.push('Targets Level 3 climb (30pts).');
    } else if (capabilities.targetClimbLevel === 'level2') {
        notes.push('Targets Level 2 climb (20pts).');
    }
    
    return notes.join(' ');
}
