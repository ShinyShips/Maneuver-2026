/**
 * Team Analysis Component
 * 
 * Main container for team stats display with phase tabs and alliance cards.
 * Displays Blue and Red alliances side-by-side with swipeable phase tabs.
 */

import { useRef } from "react";
import { Card, CardContent, CardHeader } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/core/components/animate-ui/radix/tabs";
import { AllianceCard } from "./AllianceCard";
import { AllianceSelectionControls } from "./AllianceSelectionControls";
import type { MatchStrategyDisplayMode } from "@/game-template/match-strategy-config";
import type { Alliance } from "@/core/lib/allianceTypes";
import type { TeamStats } from "@/core/types/team-stats";
import type { AutoRoutineSelection, AutoRoutineSource, AutoRoutineWaypoint, StartPositionLabel, StrategyAutoRoutine } from "@/core/hooks/useMatchStrategy";

interface TeamSlotSpotVisibility {
    showShooting: boolean;
    showPassing: boolean;
}

interface TeamAnalysisProps {
    selectedTeams: (number | null)[];
    availableTeams: number[];
    activeStatsTab: string;
    displayMode: MatchStrategyDisplayMode;
    confirmedAlliances: Alliance[];
    selectedBlueAlliance: string;
    selectedRedAlliance: string;
    getTeamStats: (teamNumber: number | null) => TeamStats | null;
    teamSlotSpotVisibility: TeamSlotSpotVisibility[];
    onTeamSlotSpotToggle: (index: number, type: 'shooting' | 'passing') => void;
    onSetAllSpotVisibility: (type: 'shooting' | 'passing', enabled: boolean) => void;
    onTeamChange: (index: number, teamNumber: number | null) => void;
    getTeamAutoRoutines: (teamNumber: number | null, source: AutoRoutineSource) => StrategyAutoRoutine[];
    getSelectedAutoRoutineForSlot: (slotIndex: number) => StrategyAutoRoutine | null;
    getSelectedAutoRoutineSelectionForSlot: (slotIndex: number) => AutoRoutineSelection | null;
    onSelectAutoRoutineForSlot: (slotIndex: number, selection: AutoRoutineSelection | null) => void;
    onAddReportedAutoForTeam: (teamNumber: number, startLabel: StartPositionLabel, name: string, actions: AutoRoutineWaypoint[]) => Promise<AutoRoutineSelection | null>;
    onUpdateReportedAutoForTeam: (teamNumber: number, routineId: string, name: string, actions: AutoRoutineWaypoint[]) => Promise<boolean>;
    onDeleteReportedAutoForTeam: (teamNumber: number, routineId: string) => Promise<boolean>;
    onStatsTabChange: (value: string) => void;
    onBlueAllianceChange: (allianceId: string) => void;
    onRedAllianceChange: (allianceId: string) => void;
}

export const TeamAnalysis = ({
    selectedTeams,
    availableTeams,
    activeStatsTab,
    displayMode,
    confirmedAlliances,
    selectedBlueAlliance,
    selectedRedAlliance,
    getTeamStats,
    teamSlotSpotVisibility,
    onTeamSlotSpotToggle,
    onSetAllSpotVisibility,
    onTeamChange,
    getTeamAutoRoutines,
    getSelectedAutoRoutineForSlot,
    getSelectedAutoRoutineSelectionForSlot,
    onSelectAutoRoutineForSlot,
    onAddReportedAutoForTeam,
    onUpdateReportedAutoForTeam,
    onDeleteReportedAutoForTeam,
    onStatsTabChange,
    onBlueAllianceChange,
    onRedAllianceChange
}: TeamAnalysisProps) => {
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    const handleAllianceCardTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (touch) {
            touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }
    };

    const handleAllianceCardTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;

        const touch = e.changedTouches[0];
        if (!touch) return;

        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            import('@/core/lib/haptics').then(({ haptics }) => {
                haptics.light();
            });

            const tabValues = ['overall', 'auto', 'teleop', 'endgame'];
            const currentIndex = tabValues.indexOf(activeStatsTab);

            if (currentIndex !== -1) {
                let newIndex;
                if (deltaX > 0) {
                    newIndex = currentIndex > 0 ? currentIndex - 1 : tabValues.length - 1;
                } else {
                    newIndex = currentIndex < tabValues.length - 1 ? currentIndex + 1 : 0;
                }

                const newValue = tabValues[newIndex] ?? activeStatsTab;
                onStatsTabChange(newValue);
            }
        }

        touchStartRef.current = null;
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <AllianceSelectionControls
                    confirmedAlliances={confirmedAlliances}
                    selectedBlueAlliance={selectedBlueAlliance}
                    selectedRedAlliance={selectedRedAlliance}
                    onBlueAllianceChange={onBlueAllianceChange}
                    onRedAllianceChange={onRedAllianceChange}
                />

                <Tabs value={activeStatsTab} onValueChange={onStatsTabChange} className="w-full" enableSwipe={true}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overall">Overall</TabsTrigger>
                        <TabsTrigger value="auto">Auto</TabsTrigger>
                        <TabsTrigger value="teleop">Teleop</TabsTrigger>
                        <TabsTrigger value="endgame">Endgame</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-7 px-2 text-xs"
                        onClick={() => onSetAllSpotVisibility('shooting', true)}
                    >
                        Select All Shooting
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => onSetAllSpotVisibility('shooting', false)}
                    >
                        Deselect Shooting
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-7 px-2 text-xs"
                        onClick={() => onSetAllSpotVisibility('passing', true)}
                    >
                        Select All Passing
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => onSetAllSpotVisibility('passing', false)}
                    >
                        Deselect Passing
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                <div className="flex flex-col lg:flex-row gap-6">
                    <AllianceCard
                        alliance="blue"
                        selectedTeams={selectedTeams}
                        availableTeams={availableTeams}
                        activeStatsTab={activeStatsTab}
                        displayMode={displayMode}
                        getTeamStats={getTeamStats}
                        teamSlotSpotVisibility={teamSlotSpotVisibility}
                        onTeamSlotSpotToggle={onTeamSlotSpotToggle}
                        onTeamChange={onTeamChange}
                        getTeamAutoRoutines={getTeamAutoRoutines}
                        getSelectedAutoRoutineForSlot={getSelectedAutoRoutineForSlot}
                        getSelectedAutoRoutineSelectionForSlot={getSelectedAutoRoutineSelectionForSlot}
                        onSelectAutoRoutineForSlot={onSelectAutoRoutineForSlot}
                        onAddReportedAutoForTeam={onAddReportedAutoForTeam}
                        onUpdateReportedAutoForTeam={onUpdateReportedAutoForTeam}
                        onDeleteReportedAutoForTeam={onDeleteReportedAutoForTeam}
                        onTouchStart={handleAllianceCardTouchStart}
                        onTouchEnd={handleAllianceCardTouchEnd}
                    />

                    <div className="lg:w-px lg:bg-border lg:mx-0 lg:h-auto h-px bg-border w-full my-0 lg:my-4"></div>

                    <AllianceCard
                        alliance="red"
                        selectedTeams={selectedTeams}
                        availableTeams={availableTeams}
                        activeStatsTab={activeStatsTab}
                        displayMode={displayMode}
                        getTeamStats={getTeamStats}
                        teamSlotSpotVisibility={teamSlotSpotVisibility}
                        onTeamSlotSpotToggle={onTeamSlotSpotToggle}
                        onTeamChange={onTeamChange}
                        getTeamAutoRoutines={getTeamAutoRoutines}
                        getSelectedAutoRoutineForSlot={getSelectedAutoRoutineForSlot}
                        getSelectedAutoRoutineSelectionForSlot={getSelectedAutoRoutineSelectionForSlot}
                        onSelectAutoRoutineForSlot={onSelectAutoRoutineForSlot}
                        onAddReportedAutoForTeam={onAddReportedAutoForTeam}
                        onUpdateReportedAutoForTeam={onUpdateReportedAutoForTeam}
                        onDeleteReportedAutoForTeam={onDeleteReportedAutoForTeam}
                        onTouchStart={handleAllianceCardTouchStart}
                        onTouchEnd={handleAllianceCardTouchEnd}
                    />
                </div>
            </CardContent>
        </Card>
    );
};
