/**
 * Alliance Card Component
 * 
 * Displays team selectors and stats for one alliance (Red or Blue).
 * Contains 3 team slots with selectors and stats display.
 */

import { useMemo, useState } from "react";
import { Card } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { TeamSelector } from "./TeamSelector";
import { TeamStatsDetail } from "./TeamStatsDetail";
import { TeamStatsHeaders } from "./TeamStatsHeaders";
import { AutoRoutineDialog } from "./AutoRoutineDialog";
import type { MatchStrategyDisplayMode } from "@/game-template/match-strategy-config";
import type { TeamStats } from "@/core/types/team-stats";
import type { AutoRoutineSelection, AutoRoutineSource, AutoRoutineWaypoint, StartPositionLabel, StrategyAutoRoutine } from "@/core/hooks/useMatchStrategy";

interface TeamSlotSpotVisibility {
    showShooting: boolean;
    showPassing: boolean;
}

interface AllianceCardProps {
    alliance: 'red' | 'blue';
    selectedTeams: (number | null)[];
    availableTeams: number[];
    activeStatsTab: string;
    displayMode: MatchStrategyDisplayMode;
    getTeamStats: (teamNumber: number | null) => TeamStats | null;
    teamSlotSpotVisibility: TeamSlotSpotVisibility[];
    onTeamSlotSpotToggle: (index: number, type: 'shooting' | 'passing') => void;
    onTeamChange: (index: number, teamNumber: number | null) => void;
    getTeamAutoRoutines: (teamNumber: number | null, source: AutoRoutineSource) => StrategyAutoRoutine[];
    getSelectedAutoRoutineForSlot: (slotIndex: number) => StrategyAutoRoutine | null;
    getSelectedAutoRoutineSelectionForSlot: (slotIndex: number) => AutoRoutineSelection | null;
    onSelectAutoRoutineForSlot: (slotIndex: number, selection: AutoRoutineSelection | null) => void;
    onAddReportedAutoForTeam: (teamNumber: number, startLabel: StartPositionLabel, name: string, actions: AutoRoutineWaypoint[]) => Promise<AutoRoutineSelection | null>;
    onUpdateReportedAutoForTeam: (teamNumber: number, routineId: string, name: string, actions: AutoRoutineWaypoint[]) => Promise<boolean>;
    onDeleteReportedAutoForTeam: (teamNumber: number, routineId: string) => Promise<boolean>;
    onTouchStart?: (e: React.TouchEvent) => void;
    onTouchEnd?: (e: React.TouchEvent) => void;
}

export const AllianceCard = ({
    alliance,
    selectedTeams,
    availableTeams,
    activeStatsTab,
    displayMode,
    getTeamStats,
    teamSlotSpotVisibility,
    onTeamSlotSpotToggle,
    onTeamChange,
    getTeamAutoRoutines,
    getSelectedAutoRoutineForSlot,
    getSelectedAutoRoutineSelectionForSlot,
    onSelectAutoRoutineForSlot,
    onAddReportedAutoForTeam,
    onUpdateReportedAutoForTeam,
    onDeleteReportedAutoForTeam,
    onTouchStart,
    onTouchEnd
}: AllianceCardProps) => {
    const isBlue = alliance === 'blue';
    const startIndex = isBlue ? 3 : 0;
    const borderColor = isBlue ? 'border-blue-200 dark:border-blue-800' : 'border-red-200 dark:border-red-800';
    const textColor = isBlue ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400';
    const [activeRoutineSlot, setActiveRoutineSlot] = useState<number | null>(null);

    const activeRoutineTeam = activeRoutineSlot !== null
        ? selectedTeams[activeRoutineSlot] ?? null
        : null;

    const activeScoutedRoutines = useMemo(
        () => getTeamAutoRoutines(activeRoutineTeam, 'scouted'),
        [activeRoutineTeam, getTeamAutoRoutines]
    );

    const activeReportedRoutines = useMemo(
        () => getTeamAutoRoutines(activeRoutineTeam, 'reported'),
        [activeRoutineTeam, getTeamAutoRoutines]
    );

    const activeSelection = activeRoutineSlot !== null
        ? getSelectedAutoRoutineSelectionForSlot(activeRoutineSlot)
        : null;

    return (
        <div className="flex-1" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className={`border rounded-lg ${borderColor}`}>
                <div className={`p-4 border-b ${borderColor}`}>
                    <div className="flex items-center justify-between">
                        <h3 className={`text-lg font-semibold ${textColor}`}>
                            {alliance === 'blue' ? 'Blue' : 'Red'} Alliance
                        </h3>
                        <TeamStatsHeaders
                            alliance={alliance}
                            activeStatsTab={activeStatsTab}
                            displayMode={displayMode}
                            selectedTeams={selectedTeams}
                            getTeamStats={getTeamStats}
                        />
                    </div>
                </div>
                <div className="p-4 space-y-3">
                    {Array.from({ length: 3 }, (_, index) => {
                        const teamIndex = startIndex + index;
                        const team = selectedTeams[teamIndex] ?? null;
                        const stats = getTeamStats(team);
                        const visibility = teamSlotSpotVisibility[teamIndex] ?? { showShooting: true, showPassing: true };

                        return (
                            <Card key={teamIndex} className="p-3">
                                <div className="space-y-3">
                                    {/* Team Selector */}
                                    <div className="flex items-center gap-3">
                                        <label className={`text-sm font-medium ${textColor} min-w-0 shrink-0`}>
                                            {alliance === 'blue' ? 'Blue' : 'Red'} Team {index + 1}:
                                        </label>
                                        <div className="w-full flex-1">
                                            <TeamSelector
                                                index={teamIndex}
                                                label={`${alliance === 'blue' ? 'Blue' : 'Red'} Team ${index + 1}`}
                                                labelColor={textColor}
                                                value={selectedTeams[teamIndex] ?? null}
                                                availableTeams={availableTeams}
                                                onValueChange={(value) => onTeamChange(teamIndex, value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={visibility.showShooting ? "default" : "outline"}
                                                className="h-7 px-2 text-xs"
                                                disabled={!team}
                                                onClick={() => onTeamSlotSpotToggle(teamIndex, 'shooting')}
                                            >
                                                Shooting Spots
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={visibility.showPassing ? "default" : "outline"}
                                                className="h-7 px-2 text-xs"
                                                disabled={!team}
                                                onClick={() => onTeamSlotSpotToggle(teamIndex, 'passing')}
                                            >
                                                Passing Spots
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2 text-xs"
                                                disabled={!team}
                                                onClick={() => setActiveRoutineSlot(teamIndex)}
                                            >
                                                Auto Routine
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2 text-xs"
                                                disabled={!team || !getSelectedAutoRoutineForSlot(teamIndex)}
                                                onClick={() => onSelectAutoRoutineForSlot(teamIndex, null)}
                                            >
                                                Clear Auto
                                            </Button>
                                        </div>
                                    </div>

                                    {team && getSelectedAutoRoutineForSlot(teamIndex) ? (
                                        <p className="text-xs text-muted-foreground">
                                            Selected Auto: {getSelectedAutoRoutineForSlot(teamIndex)?.label}
                                            {getSelectedAutoRoutineForSlot(teamIndex)?.eventKey ? ` (${getSelectedAutoRoutineForSlot(teamIndex)?.eventKey})` : ''}
                                        </p>
                                    ) : null}

                                    {/* Team Stats */}
                                    {team && stats ? (
                                        <TeamStatsDetail
                                            stats={stats}
                                            activeStatsTab={activeStatsTab}
                                            displayMode={displayMode}
                                        />
                                    ) : (
                                        <div className="text-center py-2 text-muted-foreground text-sm">
                                            {team ? "No data available" : "No team selected"}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <AutoRoutineDialog
                open={activeRoutineSlot !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setActiveRoutineSlot(null);
                    }
                }}
                teamNumber={activeRoutineTeam}
                selectedSelection={activeSelection}
                scoutedRoutines={activeScoutedRoutines}
                reportedRoutines={activeReportedRoutines}
                onSelectRoutine={(selection) => {
                    if (activeRoutineSlot === null) return;
                    onSelectAutoRoutineForSlot(activeRoutineSlot, selection);
                }}
                onAddReportedRoutine={async (startLabel, name, actions) => {
                    if (!activeRoutineTeam) return null;
                    return onAddReportedAutoForTeam(activeRoutineTeam, startLabel, name, actions);
                }}
                onUpdateReportedRoutine={async (routineId, name, actions) => {
                    if (!activeRoutineTeam) return false;
                    return onUpdateReportedAutoForTeam(activeRoutineTeam, routineId, name, actions);
                }}
                onDeleteReportedRoutine={async (routineId) => {
                    if (!activeRoutineTeam) return false;
                    return onDeleteReportedAutoForTeam(activeRoutineTeam, routineId);
                }}
            />
        </div>
    );
};
