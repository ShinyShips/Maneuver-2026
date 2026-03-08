/**
 * Available Teams Panel Component
 * 
 * Panel showing all available teams with search and sort.
 * Matches 2025 styling.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
import { Badge } from "@/core/components/ui/badge";
import { TeamCard } from "./TeamCard";
import { SortSelector } from "./SortSelector";
import type { TeamStats } from "@/core/types/team-stats";
import type { PickList } from "@/core/types/pickListTypes";
import type { PickListSortOption } from "@/game-template/pick-list-config";
import type { Alliance } from "@/core/lib/allianceTypes";

interface AvailableTeamsPanelProps {
    teams: TeamStats[];
    pickLists: PickList[];
    alliances?: Alliance[];
    searchFilter: string;
    sortBy: PickListSortOption;
    onSearchChange: (value: string) => void;
    onSortChange: (value: PickListSortOption) => void;
    onAddTeamToList: (team: TeamStats, listId: number) => void;
    onAddTeamToAlliance?: (teamNumber: number, allianceId: number) => void;
}

export const AvailableTeamsPanel = ({
    teams,
    pickLists,
    alliances,
    searchFilter,
    sortBy,
    onSearchChange,
    onSortChange,
    onAddTeamToList,
    onAddTeamToAlliance
}: AvailableTeamsPanelProps) => {
    return (
        <Card className="lg:col-span-1 max-h-screen">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    Available Teams
                    <Badge variant="secondary">{teams.length} teams</Badge>
                </CardTitle>

                {/* Filters */}
                <div className="space-y-3">
                    <Input
                        placeholder="Search teams..."
                        value={searchFilter}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    <SortSelector sortBy={sortBy} onSortChange={onSortChange} />
                </div>
            </CardHeader>

            <CardContent className="space-y-2 max-h-10/12 overflow-y-auto">
                {teams.map(team => (
                    <TeamCard
                        key={team.teamNumber}
                        team={team}
                        pickLists={pickLists}
                        alliances={alliances}
                        onAddTeamToList={onAddTeamToList}
                        onAddTeamToAlliance={onAddTeamToAlliance}
                    />
                ))}

                {/* Placeholder for no teams */}
                {teams.length === 0 && (
                    <div className="flex flex-col text-center items-center justify-center py-8 text-muted-foreground">
                        <p>No teams found. Try adjusting your search or filters.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
