/**
 * Pick List Card Component
 * 
 * A single pick list with drag-and-drop reorder controls.
 * Matches 2025 styling with SortableList for drag-drop.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import { SortableList, SortableListItem } from "@/core/components/ui/sortable-list";
import { GenericSelector } from "@/core/components/ui/generic-selector";
import { TeamStatsDialog } from "@/game-template/pick-list-config";
import { Trash2 } from "lucide-react";
import type { PickList, PickListItem } from "@/core/types/pickListTypes";
import type { TeamStats } from "@/core/types/team-stats";
import type { Alliance } from "@/core/lib/allianceTypes";

interface PickListCardProps {
    pickList: PickList;
    teamLookupTeams: TeamStats[];
    alliances: Alliance[];
    canDelete: boolean;
    onDeleteList: (listId: number) => void;
    onUpdateTeams: (listId: number, newTeams: PickListItem[]) => void;
    onAssignToAlliance: (teamNumber: number, allianceIndex: number) => void;
}

export const PickListCard = ({
    pickList,
    teamLookupTeams,
    alliances,
    canDelete,
    onDeleteList,
    onUpdateTeams,
    onAssignToAlliance
}: PickListCardProps) => {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            {pickList.name}
                            <Badge variant="outline">{pickList.teams.length} teams</Badge>
                        </CardTitle>
                        {pickList.description && (
                            <p className="text-sm text-muted-foreground mt-1">{pickList.description}</p>
                        )}
                    </div>
                    {canDelete && (
                        <Button
                            onClick={() => onDeleteList(pickList.id)}
                            variant="outline"
                            size="sm"
                            className="text-red-400 hover:text-red-500"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                {pickList.teams.length === 0 ? (
                    <div className="flex flex-col text-center items-center justify-center py-8 text-muted-foreground">
                        <p>No teams in this list yet</p>
                        <p className="text-sm">Add teams from the available teams panel</p>
                    </div>
                ) : (
                    <SortableList
                        items={pickList.teams}
                        setItems={(newTeams) => {
                            // Handle both function and direct array updates
                            if (typeof newTeams === 'function') {
                                onUpdateTeams(pickList.id, newTeams(pickList.teams) as PickListItem[]);
                            } else {
                                onUpdateTeams(pickList.id, newTeams as PickListItem[]);
                            }
                        }}
                        onCompleteItem={(id) => {
                            // Toggle the checked state to show/hide delete button
                            const updatedTeams = pickList.teams.map(team =>
                                team.id === id ? { ...team, checked: !team.checked } : team
                            );
                            onUpdateTeams(pickList.id, updatedTeams);
                        }}
                        renderItem={(item, order, onCompleteItem, onRemoveItem) => {
                            const teamNumber = item.teamNumber;
                            const teamStats = teamLookupTeams.find(t => t.teamNumber === teamNumber);
                            return (
                                <SortableListItem
                                    key={item.id}
                                    item={item}
                                    order={order}
                                    onCompleteItem={onCompleteItem}
                                    onRemoveItem={onRemoveItem}
                                    handleDrag={() => { }}
                                    renderExtra={() => (
                                        <div className="flex w-full items-center gap-1 sm:w-auto sm:flex-none">
                                            <GenericSelector
                                                label="Add to Alliance"
                                                value=""
                                                availableOptions={alliances.map((_, index) => `${index}`)}
                                                onValueChange={(value: string) => {
                                                    if (value) {
                                                        onAssignToAlliance(teamNumber, parseInt(value));
                                                    }
                                                }}
                                                placeholder="Add to..."
                                                displayFormat={(value: string) => `Alliance ${parseInt(value) + 1}`}
                                                buttonDisplayFormat={(value: string) => value ? `Alliance ${parseInt(value) + 1}` : "Add to..."}
                                                className="h-8 min-w-0 flex-1 sm:w-fit sm:flex-none"
                                            />
                                            <TeamStatsDialog
                                                teamNumber={teamNumber}
                                                teamStats={teamStats}
                                                variant="ghost"
                                                size="sm"
                                                className="h-8"
                                            />
                                        </div>
                                    )}
                                />
                            );
                        }}
                    />
                )}
            </CardContent>
        </Card>
    );
};
