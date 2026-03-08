/**
 * Desktop Pick List Layout
 * 
 * Side-by-side layout for larger screens.
 * Matches 2025 styling.
 */

import { AvailableTeamsPanel } from "./AvailableTeamsPanel";
import { CreatePickList } from "./CreatePickList";
import { PickListCard } from "./PickListCard";
import { AllianceSelectionTable } from "./AllianceSelectionTable";
import type { TeamStats } from "@/core/types/team-stats";
import type { PickList, PickListItem } from "@/core/types/pickListTypes";
import type { PickListSortOption } from "@/game-template/pick-list-config";
import type { Alliance, BackupTeam } from "@/core/lib/allianceTypes";

interface DesktopPickListLayoutProps {
    showAllianceSelection: boolean;
    filteredAndSortedTeams: TeamStats[];
    pickLists: PickList[];
    alliances: Alliance[];
    backups: BackupTeam[];
    availableTeams: TeamStats[];
    newListName: string;
    newListDescription: string;
    searchFilter: string;
    sortBy: PickListSortOption;
    canDeleteAll?: boolean;
    onSearchChange: (search: string) => void;
    onSortChange: (sort: PickListSortOption) => void;
    onAddTeamToList: (team: TeamStats, listId: number) => void;
    onAddTeamToAlliance?: (teamNumber: number, allianceId: number) => void;
    onUpdateAlliances: (alliances: Alliance[]) => void;
    onUpdateBackups: (backups: BackupTeam[]) => void;
    onNameChange: (name: string) => void;
    onDescriptionChange: (description: string) => void;
    onCreateList: () => void;
    onDeleteList: (listId: number) => void;
    onUpdateTeams: (listId: number, newTeams: PickListItem[]) => void;
    onAssignToAlliance: (teamNumber: number, allianceIndex: number) => void;
}

export const DesktopPickListLayout = ({
    showAllianceSelection,
    filteredAndSortedTeams,
    pickLists,
    alliances,
    backups,
    availableTeams,
    newListName,
    newListDescription,
    searchFilter,
    sortBy,
    canDeleteAll = true,
    onSearchChange,
    onSortChange,
    onAddTeamToList,
    onAddTeamToAlliance,
    onUpdateAlliances,
    onUpdateBackups,
    onNameChange,
    onDescriptionChange,
    onCreateList,
    onDeleteList,
    onUpdateTeams,
    onAssignToAlliance
}: DesktopPickListLayoutProps) => {
    return (
        <div className="hidden xl:block">
            <div className={`grid gap-6 ${showAllianceSelection ? 'grid-cols-3' : 'grid-cols-2'}`}>

                {/* Available Teams Panel */}
                <AvailableTeamsPanel
                    teams={filteredAndSortedTeams}
                    pickLists={pickLists}
                    alliances={alliances}
                    searchFilter={searchFilter}
                    sortBy={sortBy}
                    onSearchChange={onSearchChange}
                    onSortChange={onSortChange}
                    onAddTeamToList={onAddTeamToList}
                    onAddTeamToAlliance={onAddTeamToAlliance}
                />

                {/* Pick Lists and Alliance Panel */}
                <div className={`space-y-6 ${showAllianceSelection ? 'col-span-2' : 'col-span-1'}`}>

                    {/* Alliance Selection Table */}
                    {showAllianceSelection && (
                        <AllianceSelectionTable
                            alliances={alliances}
                            backups={backups}
                            availableTeams={availableTeams}
                            onUpdateAlliances={onUpdateAlliances}
                            onUpdateBackups={onUpdateBackups}
                        />
                    )}

                    {/* Create New List */}
                    <CreatePickList
                        newListName={newListName}
                        newListDescription={newListDescription}
                        onNameChange={onNameChange}
                        onDescriptionChange={onDescriptionChange}
                        onCreateList={onCreateList}
                    />

                    {/* Pick Lists or Empty State */}
                    {pickLists.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                            <div className="text-muted-foreground mb-4">
                                <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-muted-foreground mb-2">No Pick Lists</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Create your first pick list to start organizing teams for alliance selection.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                You can also import existing pick lists using the Import button above.
                            </p>
                        </div>
                    ) : (
                        pickLists.map(list => (
                            <PickListCard
                                key={list.id}
                                pickList={list}
                                availableTeams={availableTeams}
                                alliances={alliances}
                                canDelete={canDeleteAll}
                                onDeleteList={onDeleteList}
                                onUpdateTeams={onUpdateTeams}
                                onAssignToAlliance={onAssignToAlliance}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
