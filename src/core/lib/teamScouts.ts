/**
 * Team Scouts - FRC Team 3314 Scouters
 * 
 * This file contains the official scouters list for the team.
 * Run `initializeTeamScouts()` to add all scouts to the system.
 */

import { gamificationDB } from '@/game-template/gamification';
import type { Scout } from '@/core/types/gamification';

/**
 * Official team scouters list
 */
export const TEAM_SCOUTS = [
    "Adwik Rath",
    "Ananth Sridhar",
    "Antara Save",
    "Asmi Gupta",
    "Chelliyen Karthik",
    "Crann Bisson-Donahue",
    "Darryl Tang",
    "Gautam Kapasi",
    "Geet Nijhawan",
    "Ibrahim",
    "Jacob Priester",
    "Jadon Daniel",
    "Lasya Nugala",
    "Nav Parikh",
    "Nishka Gupta",
    "Patrick Davoli",
    "Patrick Li",
    "Pranav Dharanipathy",
    "Pranav Mandapati",
    "Reesha Malpani",
    "Rithwik Nair",
    "Rohan Desam",
    "Saharsh Gurram",
    "Souren Uchat",
    "Suchir Shah",
    "Varun Harith",
    "Varun Sanghavi",
    "Viraj Gadiya",
    "Vishnu Nair",
    "Zaeem Saiyed",
    "Zoey Zhang"
].sort();

/**
 * Initialize all team scouts in the database and localStorage
 */
export const initializeTeamScouts = async (): Promise<{ success: boolean; message: string }> => {
    try {
        console.log('🔧 Initializing team scouts...');
        
        let created = 0;
        let existing = 0;

        // Create scout profiles in gamification database
        for (const name of TEAM_SCOUTS) {
            const existingScout = await gamificationDB.scouts.get(name);
            
            if (!existingScout) {
                const newScout: Scout = {
                    name,
                    stakes: 0,
                    stakesFromPredictions: 0,
                    totalPredictions: 0,
                    correctPredictions: 0,
                    currentStreak: 0,
                    longestStreak: 0,
                    createdAt: Date.now(),
                    lastUpdated: Date.now(),
                };
                
                await gamificationDB.scouts.put(newScout);
                created++;
            } else {
                existing++;
            }
        }

        // Update localStorage with scouts list
        const currentScoutsList = localStorage.getItem('scoutsList');
        const existingScouts = currentScoutsList ? JSON.parse(currentScoutsList) : [];
        
        // Merge and deduplicate
        const allScouts = [...new Set([...existingScouts, ...TEAM_SCOUTS])].sort();
        localStorage.setItem('scoutsList', JSON.stringify(allScouts));

        // Notify ScoutContext to reload scouts list
        window.dispatchEvent(new Event('scoutChanged'));

        const message = `✅ Initialized ${TEAM_SCOUTS.length} team scouts (${created} created, ${existing} already existed)`;
        console.log(message);
        
        return {
            success: true,
            message
        };
    } catch (error) {
        console.error('Error initializing team scouts:', error);
        return {
            success: false,
            message: `❌ Failed to initialize team scouts: ${error}`
        };
    }
};

/**
 * Clear all team scouts from the system
 * WARNING: This will remove all scout profiles and data
 */
export const clearTeamScouts = async (): Promise<{ success: boolean; message: string }> => {
    try {
        console.log('🗑️ Clearing team scouts...');
        
        // Remove from gamification database
        for (const name of TEAM_SCOUTS) {
            await gamificationDB.scouts.delete(name);
        }

        // Update localStorage
        const currentScoutsList = localStorage.getItem('scoutsList');
        const existingScouts = currentScoutsList ? JSON.parse(currentScoutsList) : [];
        const remainingScouts = existingScouts.filter((scout: string) => !TEAM_SCOUTS.includes(scout));
        localStorage.setItem('scoutsList', JSON.stringify(remainingScouts));

        // Notify ScoutContext to reload scouts list
        window.dispatchEvent(new Event('scoutChanged'));

        const message = `✅ Cleared ${TEAM_SCOUTS.length} team scouts from the system`;
        console.log(message);
        
        return {
            success: true,
            message
        };
    } catch (error) {
        console.error('Error clearing team scouts:', error);
        return {
            success: false,
            message: `❌ Failed to clear team scouts: ${error}`
        };
    }
};
