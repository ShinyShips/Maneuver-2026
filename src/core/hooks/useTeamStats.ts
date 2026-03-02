import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useGame } from "@/core/contexts/GameContext";
import {
    loadAllScoutingEntries,
    loadAllPitScoutingEntries,
    loadScoutingEntriesByTeamAndEvent,
    loadScoutingEntriesByTeam
} from "@/core/db/database";
import type { TeamStats } from "@/types/game-interfaces";
import type { ScoutingEntryBase } from "@/types/scouting-entry";
import { getCachedTBAEventMatches } from "@/core/lib/tbaCache";
import { calculateFuelOPRHybrid } from "@/game-template/fuelOpr";
import { getCachedCOPREventKeys, getCachedEventCOPRs } from "@/core/lib/tba/coprUtils";
import { getCachedEventStatboticsEPA, getCachedStatboticsEventKeys } from "@/core/lib/statbotics/epaUtils";

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
    const fuelOprCacheRef = useRef<Map<string, Map<number, { auto: number; teleop: number; total: number }>>>(new Map());

    const resolveOprEventKeys = useCallback((eventFilter?: string, entries: ScoutingEntryBase[] = []): string[] => {
        if (eventFilter && eventFilter !== 'all') {
            return [eventFilter];
        }

        const currentEvent = localStorage.getItem('eventKey');
        return [
            ...new Set([
                ...entries.map(entry => entry.eventKey).filter(Boolean),
                ...availableEvents.filter(eventKey => eventKey && eventKey !== 'all'),
                ...(currentEvent ? [currentEvent] : []),
                ...getCachedCOPREventKeys(),
                ...getCachedStatboticsEventKeys(),
            ]),
        ];
    }, [availableEvents]);

    // Load basic metadata (teams and events)
    useEffect(() => {
        const loadMetadata = async () => {
            setIsLoading(true);
            try {
                const [entries, pitEntries] = await Promise.all([
                    loadAllScoutingEntries(),
                    loadAllPitScoutingEntries(),
                ]);

                const eventSet = new Set<string>([
                    ...entries.map(e => e.eventKey).filter(Boolean),
                    ...pitEntries.map(e => e.eventKey).filter(Boolean),
                    ...getCachedCOPREventKeys(),
                    ...getCachedStatboticsEventKeys(),
                ]);

                const currentEvent = localStorage.getItem('eventKey');
                if (currentEvent) {
                    eventSet.add(currentEvent);
                }

                const teamsFromTBA = new Set<string>();
                await Promise.all(
                    [...eventSet].map(async eventKey => {
                        const matches = await getCachedTBAEventMatches(eventKey, true);
                        for (const match of matches) {
                            for (const teamKey of match.alliances.red.team_keys) {
                                const team = teamKey.replace(/^frc/i, '');
                                if (team) teamsFromTBA.add(team);
                            }
                            for (const teamKey of match.alliances.blue.team_keys) {
                                const team = teamKey.replace(/^frc/i, '');
                                if (team) teamsFromTBA.add(team);
                            }
                        }
                    })
                );

                const teamsFromCOPR = new Set<string>();
                for (const eventKey of getCachedCOPREventKeys()) {
                    for (const teamNumber of getCachedEventCOPRs(eventKey).keys()) {
                        teamsFromCOPR.add(String(teamNumber));
                    }
                }

                const teamsFromStatbotics = new Set<string>();
                for (const eventKey of getCachedStatboticsEventKeys()) {
                    for (const teamNumber of getCachedEventStatboticsEPA(eventKey).keys()) {
                        teamsFromStatbotics.add(String(teamNumber));
                    }
                }

                // Extract unique teams (sorted)
                const teams = [
                    ...new Set([
                        ...entries.map(e => String(e.teamNumber)).filter(Boolean),
                        ...pitEntries.map(e => String(e.teamNumber)).filter(Boolean),
                        ...teamsFromTBA,
                        ...teamsFromCOPR,
                        ...teamsFromStatbotics,
                    ]),
                ];
                teams.sort((a, b) => parseInt(a) - parseInt(b));
                setAvailableTeams(teams);

                // Extract unique events (sorted)
                const events = [...eventSet];
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
    const calculateStats = useCallback(async (teamNumber: string, eventFilter?: string): Promise<TeamStats | null> => {
        if (!teamNumber) return null;

        try {
            let entries: ScoutingEntryBase[];
            const teamNum = parseInt(teamNumber);
            const round1 = (value: number) => Math.round(value * 10) / 10;

            const coprEventKeys = eventFilter && eventFilter !== 'all'
                ? [eventFilter]
                : [...new Set(getCachedCOPREventKeys())];

            const statboticsEventKeys = eventFilter && eventFilter !== 'all'
                ? [eventFilter]
                : [...new Set(getCachedStatboticsEventKeys())];

            const coprSamples = coprEventKeys
                .map(key => getCachedEventCOPRs(key).get(teamNum))
                .filter((sample): sample is NonNullable<typeof sample> => sample !== undefined);

            const statboticsSamples = statboticsEventKeys
                .map(key => getCachedEventStatboticsEPA(key).get(teamNum))
                .filter((sample): sample is NonNullable<typeof sample> => sample !== undefined);

            const average = (values: Array<number | undefined>): number => {
                const validValues = values.filter((value): value is number => Number.isFinite(value));
                if (validValues.length === 0) return 0;
                return validValues.reduce((total, value) => total + value, 0) / validValues.length;
            };

            const averageOrUndefined = (values: Array<number | undefined>): number | undefined => {
                const validValues = values.filter((value): value is number => Number.isFinite(value));
                if (validValues.length === 0) return undefined;
                return average(values);
            };

            const round1OrUndefined = (value: number | undefined): number | undefined => {
                if (value === undefined) return undefined;
                return round1(value);
            };

            if (eventFilter && eventFilter !== "all") {
                entries = await loadScoutingEntriesByTeamAndEvent(teamNum, eventFilter);
            } else {
                entries = await loadScoutingEntriesByTeam(teamNum);
            }

            const eventKeysForOpr = resolveOprEventKeys(eventFilter, entries);
            const cacheKey = eventKeysForOpr.length > 0
                ? `events:${[...eventKeysForOpr].sort().join('|')}`
                : 'events:none';

            let oprByTeam = fuelOprCacheRef.current.get(cacheKey);

            if (!oprByTeam) {
                const allMatches = (
                    await Promise.all(eventKeysForOpr.map(eventKey => getCachedTBAEventMatches(eventKey, true)))
                ).flat();

                const hybrid = calculateFuelOPRHybrid(allMatches, {
                    includePlayoffs: true,
                });

                oprByTeam = new Map(
                    hybrid.opr.teams.map(team => [
                        team.teamNumber,
                        {
                            auto: team.autoFuelOPR,
                            teleop: team.teleopFuelOPR,
                            total: team.totalFuelOPR,
                        },
                    ])
                );

                fuelOprCacheRef.current.set(cacheKey, oprByTeam);
            }

            const teamOpr = oprByTeam.get(teamNum);

            if (entries.length === 0) {
                // Return a basic object with matchesPlayed: 0
                return {
                    teamNumber: teamNum,
                    eventKey: eventFilter || '',
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
                    fuelAutoOPR: round1(teamOpr?.auto ?? 0),
                    fuelTeleopOPR: round1(teamOpr?.teleop ?? 0),
                    fuelTotalOPR: round1(teamOpr?.total ?? 0),
                    coprHubAutoPoints: round1OrUndefined(averageOrUndefined(coprSamples.map(sample => sample.hubAutoPoints))),
                    coprHubTeleopPoints: round1OrUndefined(averageOrUndefined(coprSamples.map(sample => sample.hubTeleopPoints))),
                    coprHubTotalPoints: round1OrUndefined(averageOrUndefined(coprSamples.map(sample => sample.hubTotalPoints))),
                    coprAutoTowerPoints: round1OrUndefined(averageOrUndefined(coprSamples.map(sample => sample.autoTowerPoints))),
                    coprEndgameTowerPoints: round1OrUndefined(averageOrUndefined(coprSamples.map(sample => sample.endgameTowerPoints))),
                    coprTotalPoints: round1OrUndefined(averageOrUndefined(coprSamples.map(sample => sample.totalPoints))),
                    coprTotalTeleopPoints: round1OrUndefined(averageOrUndefined(coprSamples.map(sample => sample.totalTeleopPoints))),
                    coprTotalAutoPoints: round1OrUndefined(averageOrUndefined(coprSamples.map(sample => sample.totalAutoPoints))),
                    coprTotalTowerPoints: round1OrUndefined(averageOrUndefined(coprSamples.map(sample => sample.totalTowerPoints))),
                    statboticsTotalPoints: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.totalPoints))),
                    statboticsAutoPoints: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.autoPoints))),
                    statboticsTeleopPoints: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.teleopPoints))),
                    statboticsEndgamePoints: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.endgamePoints))),
                    statboticsTotalFuel: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.totalFuel))),
                    statboticsAutoFuel: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.autoFuel))),
                    statboticsTeleopFuel: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.teleopFuel))),
                    statboticsEndgameFuel: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.endgameFuel))),
                    statboticsTotalTower: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.totalTower))),
                    statboticsAutoTower: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.autoTower))),
                    statboticsEndgameTower: round1OrUndefined(averageOrUndefined(statboticsSamples.map(sample => sample.endgameTower))),
                } as TeamStats;
            }

            // Use the game-specific analysis implementation
            const baseStats = analysis.calculateBasicStats(entries) as TeamStats & {
                fuelAutoOPR?: number;
                fuelTeleopOPR?: number;
                fuelTotalOPR?: number;
                coprHubAutoPoints?: number;
                coprHubTeleopPoints?: number;
                coprHubTotalPoints?: number;
                coprAutoTowerPoints?: number;
                coprEndgameTowerPoints?: number;
                coprTotalPoints?: number;
                coprTotalTeleopPoints?: number;
                coprTotalAutoPoints?: number;
                coprTotalTowerPoints?: number;
                statboticsTotalPoints?: number;
                statboticsAutoPoints?: number;
                statboticsTeleopPoints?: number;
                statboticsEndgamePoints?: number;
                statboticsTotalFuel?: number;
                statboticsAutoFuel?: number;
                statboticsTeleopFuel?: number;
                statboticsEndgameFuel?: number;
                statboticsTotalTower?: number;
                statboticsAutoTower?: number;
                statboticsEndgameTower?: number;
            };

            baseStats.fuelAutoOPR = round1(teamOpr?.auto ?? 0);
            baseStats.fuelTeleopOPR = round1(teamOpr?.teleop ?? 0);
            baseStats.fuelTotalOPR = round1(teamOpr?.total ?? 0);

            const coprHubAuto = averageOrUndefined(coprSamples.map(sample => sample.hubAutoPoints));
            const coprHubTeleop = averageOrUndefined(coprSamples.map(sample => sample.hubTeleopPoints));
            const coprHubTotal = averageOrUndefined(coprSamples.map(sample => sample.hubTotalPoints));
            const coprAutoTower = averageOrUndefined(coprSamples.map(sample => sample.autoTowerPoints));
            const coprEndgameTower = averageOrUndefined(coprSamples.map(sample => sample.endgameTowerPoints));
            const coprTotalPoints = averageOrUndefined(coprSamples.map(sample => sample.totalPoints));
            const coprTotalTeleopPoints = averageOrUndefined(coprSamples.map(sample => sample.totalTeleopPoints));
            const coprTotalAutoPoints = averageOrUndefined(coprSamples.map(sample => sample.totalAutoPoints));
            const coprTotalTowerPoints = averageOrUndefined(coprSamples.map(sample => sample.totalTowerPoints));

            const statboticsTotalPoints = averageOrUndefined(statboticsSamples.map(sample => sample.totalPoints));
            const statboticsAutoPoints = averageOrUndefined(statboticsSamples.map(sample => sample.autoPoints));
            const statboticsTeleopPoints = averageOrUndefined(statboticsSamples.map(sample => sample.teleopPoints));
            const statboticsEndgamePoints = averageOrUndefined(statboticsSamples.map(sample => sample.endgamePoints));
            const statboticsTotalFuel = averageOrUndefined(statboticsSamples.map(sample => sample.totalFuel));
            const statboticsAutoFuel = averageOrUndefined(statboticsSamples.map(sample => sample.autoFuel));
            const statboticsTeleopFuel = averageOrUndefined(statboticsSamples.map(sample => sample.teleopFuel));
            const statboticsEndgameFuel = averageOrUndefined(statboticsSamples.map(sample => sample.endgameFuel));
            const statboticsTotalTower = averageOrUndefined(statboticsSamples.map(sample => sample.totalTower));
            const statboticsAutoTower = averageOrUndefined(statboticsSamples.map(sample => sample.autoTower));
            const statboticsEndgameTower = averageOrUndefined(statboticsSamples.map(sample => sample.endgameTower));

            baseStats.coprHubAutoPoints = coprHubAuto === undefined ? undefined : round1(coprHubAuto);
            baseStats.coprHubTeleopPoints = coprHubTeleop === undefined ? undefined : round1(coprHubTeleop);
            baseStats.coprHubTotalPoints = coprHubTotal === undefined ? undefined : round1(coprHubTotal);
            baseStats.coprAutoTowerPoints = coprAutoTower === undefined ? undefined : round1(coprAutoTower);
            baseStats.coprEndgameTowerPoints = coprEndgameTower === undefined ? undefined : round1(coprEndgameTower);
            baseStats.coprTotalPoints = coprTotalPoints === undefined ? undefined : round1(coprTotalPoints);
            baseStats.coprTotalTeleopPoints = coprTotalTeleopPoints === undefined ? undefined : round1(coprTotalTeleopPoints);
            baseStats.coprTotalAutoPoints = coprTotalAutoPoints === undefined ? undefined : round1(coprTotalAutoPoints);
            baseStats.coprTotalTowerPoints = coprTotalTowerPoints === undefined ? undefined : round1(coprTotalTowerPoints);

            baseStats.statboticsTotalPoints = statboticsTotalPoints === undefined ? undefined : round1(statboticsTotalPoints);
            baseStats.statboticsAutoPoints = statboticsAutoPoints === undefined ? undefined : round1(statboticsAutoPoints);
            baseStats.statboticsTeleopPoints = statboticsTeleopPoints === undefined ? undefined : round1(statboticsTeleopPoints);
            baseStats.statboticsEndgamePoints = statboticsEndgamePoints === undefined ? undefined : round1(statboticsEndgamePoints);
            baseStats.statboticsTotalFuel = statboticsTotalFuel === undefined ? undefined : round1(statboticsTotalFuel);
            baseStats.statboticsAutoFuel = statboticsAutoFuel === undefined ? undefined : round1(statboticsAutoFuel);
            baseStats.statboticsTeleopFuel = statboticsTeleopFuel === undefined ? undefined : round1(statboticsTeleopFuel);
            baseStats.statboticsEndgameFuel = statboticsEndgameFuel === undefined ? undefined : round1(statboticsEndgameFuel);
            baseStats.statboticsTotalTower = statboticsTotalTower === undefined ? undefined : round1(statboticsTotalTower);
            baseStats.statboticsAutoTower = statboticsAutoTower === undefined ? undefined : round1(statboticsAutoTower);
            baseStats.statboticsEndgameTower = statboticsEndgameTower === undefined ? undefined : round1(statboticsEndgameTower);

            return baseStats;
        } catch (error) {
            console.error(`Error calculating stats for team ${teamNumber}:`, error);
            return null;
        }
    }, [analysis, resolveOprEventKeys]);

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
