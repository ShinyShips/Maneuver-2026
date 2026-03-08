/**
 * Match Strategy Hook
 * 
 * Manages state for the Match Strategy page including:
 * - Team selection (6 teams: 3 red, 3 blue)
 * - Match number lookup (auto-fills teams from match data)
 * - Alliance selection (for elimination matches)
 * - Team stats retrieval using centralized useAllTeamStats
 */

import { useState, useEffect, useCallback } from "react";
import { loadScoutingData } from "@/core/lib/scoutingDataUtils";
import { loadScoutingEntriesByMatch } from "@/core/db/database";
import { useAllTeamStats } from "@/core/hooks/useAllTeamStats";
import type { Alliance } from "../lib/allianceTypes";
import type { TeamStats } from "@/core/types/team-stats";

export const useMatchStrategy = () => {
    const [selectedTeams, setSelectedTeams] = useState<(number | null)[]>(Array(6).fill(null));
    const [availableTeams, setAvailableTeams] = useState<number[]>([]);
    const [matchNumber, setMatchNumber] = useState<string>("");
    const [isLookingUpMatch, setIsLookingUpMatch] = useState(false);
    const [confirmedAlliances, setConfirmedAlliances] = useState<Alliance[]>([]);
    const [selectedBlueAlliance, setSelectedBlueAlliance] = useState<string>("");
    const [selectedRedAlliance, setSelectedRedAlliance] = useState<string>("");

    // Get all team stats using centralized hook
    const { teamStats: allTeamStats } = useAllTeamStats();

    // Function to get stats for a specific team
    const getTeamStats = useCallback((teamNumber: number | null): TeamStats | null => {
        if (teamNumber === null) return null;
        const stats = allTeamStats.find(s => s.teamNumber === teamNumber);
        return stats || null;
    }, [allTeamStats]);

    // Debounced match number lookup
    const lookupMatchTeams = useCallback(async (matchNum: string) => {
        if (!matchNum.trim()) return;

        setIsLookingUpMatch(true);
        try {
            const matchNumberValue = parseInt(matchNum.trim());

            // First check localStorage match data (from TBA API)
            const matchDataStr = localStorage.getItem("matchData");
            if (matchDataStr) {
                try {
                    const matchData = JSON.parse(matchDataStr);
                    const match = matchData.find((m: any) => m.matchNum === matchNumberValue);

                    if (match && match.redAlliance && match.blueAlliance) {
                        const redTeams = match.redAlliance.slice(0, 3);
                        const blueTeams = match.blueAlliance.slice(0, 3);

                        const newSelectedTeams = Array(6).fill(null);

                        for (let i = 0; i < redTeams.length && i < 3; i++) {
                            newSelectedTeams[i] = Number(redTeams[i]);
                        }

                        for (let i = 0; i < blueTeams.length && i < 3; i++) {
                            newSelectedTeams[i + 3] = Number(blueTeams[i]);
                        }

                        setSelectedTeams(newSelectedTeams);
                        setIsLookingUpMatch(false);
                        return;
                    }
                } catch (error) {
                    console.error("Error parsing match data:", error);
                }
            }

            // Fallback: Try scouting database
            const matchEntries = await loadScoutingEntriesByMatch(matchNumberValue);

            const redTeams: number[] = [];
            const blueTeams: number[] = [];

            matchEntries.forEach(entry => {
                if (entry.teamNumber) {
                    if (entry.allianceColor === "red") {
                        if (!redTeams.includes(entry.teamNumber)) {
                            redTeams.push(entry.teamNumber);
                        }
                    } else if (entry.allianceColor === "blue") {
                        if (!blueTeams.includes(entry.teamNumber)) {
                            blueTeams.push(entry.teamNumber);
                        }
                    }
                }
            });

            if (redTeams.length > 0 || blueTeams.length > 0) {
                redTeams.sort((a, b) => a - b);
                blueTeams.sort((a, b) => a - b);

                const newSelectedTeams = Array(6).fill(null);

                for (let i = 0; i < 3; i++) {
                    newSelectedTeams[i] = redTeams[i] || null;
                }

                for (let i = 0; i < 3; i++) {
                    newSelectedTeams[i + 3] = blueTeams[i] || null;
                }

                setSelectedTeams(newSelectedTeams);
            } else {
                console.log("No match entries found for match number:", matchNum);
            }
        } catch (error) {
            console.error("Error looking up match teams:", error);
        } finally {
            setIsLookingUpMatch(false);
        }
    }, []);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await loadScoutingData();

                // Extract unique team numbers - use teamNumber field (correct field name)
                const teams = [...new Set(
                    data
                        .map((entry) => entry.teamNumber)
                        .filter(Boolean)
                )] as number[];
                teams.sort((a, b) => a - b);
                setAvailableTeams(teams);
            } catch (error) {
                console.error("Error loading scouting data:", error);
            }
        };

        const loadConfirmedAlliances = () => {
            try {
                const savedAlliances = localStorage.getItem("confirmedAlliances");
                if (savedAlliances) {
                    setConfirmedAlliances(JSON.parse(savedAlliances));
                }
            } catch (error) {
                console.error("Error loading confirmed alliances:", error);
            }
        };

        loadData();
        loadConfirmedAlliances();
    }, []);

    // Debounced match lookup
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (matchNumber.trim()) {
                lookupMatchTeams(matchNumber);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [matchNumber, lookupMatchTeams]);

    const handleTeamChange = (index: number, teamNumber: number | null) => {
        const newSelectedTeams = [...selectedTeams];
        newSelectedTeams[index] = teamNumber;
        setSelectedTeams(newSelectedTeams);
    };

    const applyAllianceToRed = (allianceId: string) => {
        setSelectedRedAlliance(allianceId === "none" ? "" : allianceId);
        if (allianceId === "none") return;

        const alliance = confirmedAlliances.find(a => a.id.toString() === allianceId);
        if (!alliance) return;

        const newSelectedTeams = [...selectedTeams];
        newSelectedTeams[0] = alliance.captain || null;
        newSelectedTeams[1] = alliance.pick1 || null;
        newSelectedTeams[2] = alliance.pick2 || null;
        setSelectedTeams(newSelectedTeams);
    };

    const applyAllianceToBlue = (allianceId: string) => {
        setSelectedBlueAlliance(allianceId === "none" ? "" : allianceId);
        if (allianceId === "none") return;

        const alliance = confirmedAlliances.find(a => a.id.toString() === allianceId);
        if (!alliance) return;

        const newSelectedTeams = [...selectedTeams];
        newSelectedTeams[3] = alliance.captain || null;
        newSelectedTeams[4] = alliance.pick1 || null;
        newSelectedTeams[5] = alliance.pick2 || null;
        setSelectedTeams(newSelectedTeams);
    };

    return {
        // State
        selectedTeams,
        availableTeams,
        matchNumber,
        isLookingUpMatch,
        confirmedAlliances,
        selectedBlueAlliance,
        selectedRedAlliance,

        // Functions
        getTeamStats,
        handleTeamChange,
        applyAllianceToRed,
        applyAllianceToBlue,
        setMatchNumber
    };
};
