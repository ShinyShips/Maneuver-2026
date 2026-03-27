/**
 * Alliance Selection Table Component
 * 
 * Combines AllianceInitializer, AllianceTable, and BackupTeamsSection.
 * Matches 2025 styling.
 */

import { useState } from "react";
import { toast } from "sonner";
import { AllianceInitializer } from "./AllianceInitializer";
import { AllianceTable } from "./AllianceTable";
import { BackupTeamsSection } from "./BackupTeamsSection";
import { Button } from "@/core/components/ui/button";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/core/components/ui/alert-dialog";
import type { Alliance, BackupTeam } from "@/core/lib/allianceTypes";
import type { TeamStats } from "@/core/types/team-stats";

type AlliancePosition = 'captain' | 'pick1' | 'pick2' | 'pick3';

interface PendingAllianceRemoval {
    teamNumbers: number[];
    title: string;
    description: string;
    onConfirmRemoval: () => void;
}

interface AllianceSelectionTableProps {
    alliances: Alliance[];
    backups: BackupTeam[];
    availableTeams: TeamStats[];
    onUpdateAlliances: (alliances: Alliance[]) => void;
    onUpdateBackups: (backups: BackupTeam[]) => void;
    onHasTeamPickListSnapshot: (teamNumber: number) => boolean;
    onRestoreTeamToPickLists: (teamNumber: number) => void;
    onDiscardTeamPickListSnapshot: (teamNumber: number) => void;
}

export const AllianceSelectionTable = ({
    alliances,
    backups,
    availableTeams,
    onUpdateAlliances,
    onUpdateBackups,
    onHasTeamPickListSnapshot,
    onRestoreTeamToPickLists,
    onDiscardTeamPickListSnapshot,
}: AllianceSelectionTableProps) => {
    const [pendingRemoval, setPendingRemoval] = useState<PendingAllianceRemoval | null>(null);

    // Get all teams that are already selected
    const getSelectedTeams = (): number[] => {
        const selectedTeams: number[] = [];
        alliances.forEach(alliance => {
            if (alliance.captain) selectedTeams.push(alliance.captain);
            if (alliance.pick1) selectedTeams.push(alliance.pick1);
            if (alliance.pick2) selectedTeams.push(alliance.pick2);
            if (alliance.pick3) selectedTeams.push(alliance.pick3);
        });
        backups.forEach(backup => {
            if (backup.teamNumber) selectedTeams.push(backup.teamNumber);
        });
        return selectedTeams;
    };

    const openRemovalDialog = (
        teamNumbers: number[],
        onConfirmRemoval: () => void,
        title: string,
        description: string
    ) => {
        const restorableTeamNumbers = teamNumbers.filter((teamNumber) => onHasTeamPickListSnapshot(teamNumber));

        if (restorableTeamNumbers.length === 0) {
            onConfirmRemoval();
            return;
        }

        setPendingRemoval({
            teamNumbers: restorableTeamNumbers,
            onConfirmRemoval,
            title,
            description,
        });
    };

    const applyRemovalDecision = (removeWithoutRestoring: boolean) => {
        if (!pendingRemoval) {
            return;
        }

        pendingRemoval.onConfirmRemoval();

        pendingRemoval.teamNumbers.forEach((teamNumber) => {
            if (removeWithoutRestoring) {
                onDiscardTeamPickListSnapshot(teamNumber);
                return;
            }

            onRestoreTeamToPickLists(teamNumber);
        });

        const teamCount = pendingRemoval.teamNumbers.length;
        if (removeWithoutRestoring) {
            toast.success(
                teamCount === 1
                    ? `Team ${pendingRemoval.teamNumbers[0]} removed without restoring prior pick lists`
                    : `${teamCount} teams removed without restoring prior pick lists`
            );
        } else {
            toast.success(
                teamCount === 1
                    ? `Team ${pendingRemoval.teamNumbers[0]} restored to prior pick lists`
                    : `${teamCount} teams restored to prior pick lists`
            );
        }

        setPendingRemoval(null);
    };

    // Update a team in an alliance
    const updateAllianceTeam = (allianceId: number, position: AlliancePosition, teamNumber: number | null) => {
        const alliance = alliances.find((candidate) => candidate.id === allianceId);
        if (!alliance) {
            return;
        }

        const currentTeamNumber = alliance[position];
        if (currentTeamNumber === teamNumber) {
            return;
        }

        const updatedAlliances = alliances.map(alliance => {
            if (alliance.id === allianceId) {
                return { ...alliance, [position]: teamNumber };
            }
            return alliance;
        });

        if (currentTeamNumber) {
            openRemovalDialog(
                [currentTeamNumber],
                () => onUpdateAlliances(updatedAlliances),
                teamNumber
                    ? `Replace Team ${currentTeamNumber}?`
                    : `Remove Team ${currentTeamNumber}?`,
                teamNumber
                    ? `Team ${currentTeamNumber} is being removed from Alliance ${alliance.allianceNumber} ${position} and replaced with Team ${teamNumber}. Should Team ${currentTeamNumber} go back to its previous pick lists, or stay removed from them?`
                    : `Team ${currentTeamNumber} is being removed from Alliance ${alliance.allianceNumber} ${position}. Should Team ${currentTeamNumber} go back to its previous pick lists, or stay removed from them?`
            );
            return;
        }

        onUpdateAlliances(updatedAlliances);
    };

    // Remove a team from an alliance
    const removeAllianceTeam = (allianceId: number, position: AlliancePosition) => {
        updateAllianceTeam(allianceId, position, null);
    };

    // Add a new alliance
    const addAlliance = () => {
        const newAlliance: Alliance = {
            id: Date.now(),
            allianceNumber: alliances.length + 1,
            captain: null,
            pick1: null,
            pick2: null,
            pick3: null
        };
        onUpdateAlliances([...alliances, newAlliance]);
    };

    // Remove an alliance
    const removeAlliance = (allianceId: number) => {
        if (alliances.length <= 1) {
            toast.error("Must have at least one alliance");
            return;
        }

        const allianceToRemove = alliances.find((alliance) => alliance.id === allianceId);
        if (!allianceToRemove) {
            return;
        }

        const updatedAlliances = alliances.filter(a => a.id !== allianceId);
        // Renumber alliances
        const renumberedAlliances = updatedAlliances.map((alliance, index) => ({
            ...alliance,
            allianceNumber: index + 1
        }));

        const removedTeamNumbers = [
            allianceToRemove.captain,
            allianceToRemove.pick1,
            allianceToRemove.pick2,
            allianceToRemove.pick3,
        ].filter((teamNumber): teamNumber is number => teamNumber !== null);

        openRemovalDialog(
            removedTeamNumbers,
            () => onUpdateAlliances(renumberedAlliances),
            `Remove Alliance ${allianceToRemove.allianceNumber}?`,
            removedTeamNumbers.length > 0
                ? `Alliance ${allianceToRemove.allianceNumber} will be removed, which also removes ${removedTeamNumbers.length === 1 ? "its team" : `its ${removedTeamNumbers.length} teams`} from alliance assignments. Should those teams go back to their previous pick lists, or stay removed from them?`
                : `Alliance ${allianceToRemove.allianceNumber} will be removed.`,
        );
    };

    // Initialize alliances
    const initializeAlliances = (count: number) => {
        const newAlliances: Alliance[] = [];
        for (let i = 1; i <= count; i++) {
            newAlliances.push({
                id: Date.now() + i,
                allianceNumber: i,
                captain: null,
                pick1: null,
                pick2: null,
                pick3: null
            });
        }
        onUpdateAlliances(newAlliances);
    };

    // Confirm alliances - save to localStorage for use in other parts of the app
    const confirmAlliances = () => {
        const completedAlliances = alliances.filter(alliance => {
            // Minimum requirement: Captain and Pick 1 must be filled
            // Pick 2 and Pick 3 are optional (for district/regional vs championship events)
            return alliance.captain && alliance.pick1;
        });

        if (completedAlliances.length === 0) {
            toast.error("No completed alliances to confirm (need at least Captain and Pick 1)");
            return;
        }

        // Save to localStorage with a different key for confirmed alliances
        localStorage.setItem("confirmedAlliances", JSON.stringify(completedAlliances));

        toast.success(`${completedAlliances.length} alliance${completedAlliances.length === 1 ? '' : 's'} confirmed and saved`);
    };

    const selectedTeams = getSelectedTeams();

    if (alliances.length === 0) {
        return <AllianceInitializer onInitialize={initializeAlliances} />;
    }

    return (
        <div className="space-y-6">
            <AllianceTable
                alliances={alliances}
                availableTeams={availableTeams}
                selectedTeams={selectedTeams}
                onUpdateTeam={updateAllianceTeam}
                onRemoveTeam={removeAllianceTeam}
                onRemoveAlliance={removeAlliance}
                onAddAlliance={addAlliance}
                onConfirmAlliances={confirmAlliances}
            />

            <BackupTeamsSection
                backups={backups}
                availableTeams={availableTeams}
                selectedTeams={selectedTeams}
                onUpdateBackups={onUpdateBackups}
            />

            <AlertDialog
                open={pendingRemoval !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingRemoval(null);
                    }
                }}
            >
                <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{pendingRemoval?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            <div className="space-y-3">
                                <p>{pendingRemoval?.description}</p>
                                <p>Choose Restore to Pick Lists to undo an early or mistaken alliance assignment. Choose Remove Without Restoring if you want the team to stay out of its previous custom pick lists.</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-0">
                        <Button type="button" variant="outline" className="p-2" onClick={() => setPendingRemoval(null)}>
                            Cancel
                        </Button>
                        <Button type="button" variant="outline" className="p-2" onClick={() => applyRemovalDecision(false)}>
                            Restore to Pick Lists
                        </Button>
                        <Button type="button" variant="destructive" className="p-2" onClick={() => applyRemovalDecision(true)}>
                            Remove Without Restoring
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
