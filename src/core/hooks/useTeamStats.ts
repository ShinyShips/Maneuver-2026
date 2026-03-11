import { useState, useEffect, useCallback, useMemo } from "react";
import { useGame } from "@/core/contexts/GameContext";
import {
    loadAllScoutingEntries,
    loadAllPitScoutingEntries,
    loadScoutingEntriesByTeamAndEvent,
    loadScoutingEntriesByTeam
} from "@/core/db/database";
import type { TeamStats } from "@/types/game-interfaces";
import type { ScoutingEntryBase } from "@/types/scouting-entry";

/**
 * useTeamStats - Hook for the Team Statistics page
 * 
 * Handles loading available teams, events, and calculating 
 * statistics using the game-specific StrategyAnalysis implementation.
 */
export const useTeamStats = () => {
    const { analysis } = useGame();

    const [availableTeams, setAvailableTeams] = useState<string[]>([]);
    const [availableEvents, setAvailableEvents] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load basic metadata (teams and events)
    useEffect(() => {
        const loadMetadata = async () => {
            setIsLoading(true);
            try {
                const [entries, pitEntries] = await Promise.all([
                    loadAllScoutingEntries(),
                    loadAllPitScoutingEntries(),
                ]);

                // Extract unique teams (sorted)
                const teams = [
                    ...new Set([
                        ...entries.map(e => String(e.teamNumber)).filter(Boolean),
                        ...pitEntries.map(e => String(e.teamNumber)).filter(Boolean),
                    ]),
                ];
                teams.sort((a, b) => parseInt(a) - parseInt(b));
                setAvailableTeams(teams);

                // Extract unique events (sorted)
                const events = [
                    ...new Set([
                        ...entries.map(e => e.eventKey).filter(Boolean),
                        ...pitEntries.map(e => e.eventKey).filter(Boolean),
                    ]),
                ];
                events.sort();
                setAvailableEvents(events);
            } catch (error) {
                console.error("Error loading team stats metadata:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadMetadata();
    }, []);

    /**
     * Calculate stats for a specific team and optional event
     */
    const calculateStats = useCallback(async (teamNumber: string, eventFilter?: string | string[]): Promise<TeamStats | null> => {
        if (!teamNumber) return null;

        try {
            let entries: ScoutingEntryBase[];
            const teamNum = parseInt(teamNumber);

            const selectedEventKeys = Array.isArray(eventFilter)
                ? [...new Set(eventFilter.filter((key): key is string => !!key && key !== 'all'))]
                : (eventFilter && eventFilter !== 'all' ? [eventFilter] : []);

            const resolvedEventKey = selectedEventKeys.length === 0
                ? 'all'
                : selectedEventKeys.length === 1
                    ? selectedEventKeys[0] || 'all'
                    : 'multiple';

            const singleEventKey = selectedEventKeys[0];

            if (selectedEventKeys.length === 1 && singleEventKey) {
                entries = await loadScoutingEntriesByTeamAndEvent(teamNum, singleEventKey);
            } else {
                entries = await loadScoutingEntriesByTeam(teamNum);
                if (selectedEventKeys.length > 0) {
                    const selectedEventKeySet = new Set(selectedEventKeys);
                    entries = entries.filter(entry => selectedEventKeySet.has(entry.eventKey));
                }
            }

            if (entries.length === 0) {
                // Return a basic object with matchesPlayed: 0
                return {
                    teamNumber: teamNum,
                    eventKey: resolvedEventKey,
                    matchCount: 0,
                    totalPoints: 0,
                    autoPoints: 0,
                    teleopPoints: 0,
                    endgamePoints: 0,
                    overall: { avgTotalPoints: 0, totalPiecesScored: 0, avgGamePiece1: 0, avgGamePiece2: 0 },
                    auto: { avgPoints: 0, avgGamePiece1: 0, avgGamePiece2: 0, mobilityRate: 0, startPositions: [] },
                    teleop: { avgPoints: 0, avgGamePiece1: 0, avgGamePiece2: 0 },
                    endgame: { avgPoints: 0, climbRate: 0, parkRate: 0 },
                    matchesPlayed: 0,
                } as TeamStats;
            }

            // Use the game-specific analysis implementation and normalize the event context.
            const stats = analysis.calculateBasicStats(entries);
            return {
                ...stats,
                eventKey: resolvedEventKey,
            };
        } catch (error) {
            console.error(`Error calculating stats for team ${teamNumber}:`, error);
            return null;
        }
    }, [analysis]);

    // Provide display configurations from analysis
    const displayConfig = useMemo(() => ({
        statSections: analysis.getStatSections(),
        rateSections: analysis.getRateSections(),
        matchBadges: analysis.getMatchBadges(),
        startPositionConfig: analysis.getStartPositionConfig(),
    }), [analysis]);

    return {
        availableTeams,
        availableEvents,
        displayConfig,
        calculateStats,
        isLoading,
    };
};
