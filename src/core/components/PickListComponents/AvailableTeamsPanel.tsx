/**
 * Available Teams Panel Component
 * 
 * Panel showing all available teams with search and sort.
 * Matches 2025 styling.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Label } from "@/core/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/core/components/ui/dialog";
import { Filter } from "lucide-react";
import { TeamCard } from "./TeamCard";
import { SortSelector } from "./SortSelector";
import type { TeamStats } from "@/core/types/team-stats";
import type { PickList } from "@/core/types/pickListTypes";
import type { PickListSortOption } from "@/game-template/pick-list-config";
import { filterGroupSelectionModes, filterOptions } from "@/game-template/pick-list-config";
import type { Alliance } from "@/core/lib/allianceTypes";

interface AvailableTeamsPanelProps {
    teams: TeamStats[];
    totalTeams: number;
    pickLists: PickList[];
    alliances?: Alliance[];
    searchFilter: string;
    sortBy: PickListSortOption;
    activeFilterIds: string[];
    onSearchChange: (value: string) => void;
    onSortChange: (value: PickListSortOption) => void;
    onFilterChange: (value: string[]) => void;
    onAddTeamToList: (team: TeamStats, listId: number) => void;
    onAddTeamToAlliance?: (teamNumber: number, allianceId: number) => void;
}

export const AvailableTeamsPanel = ({
    teams,
    totalTeams,
    pickLists,
    alliances,
    searchFilter,
    sortBy,
    activeFilterIds,
    onSearchChange,
    onSortChange,
    onFilterChange,
    onAddTeamToList,
    onAddTeamToAlliance
}: AvailableTeamsPanelProps) => {
    const activeFilterCount = activeFilterIds.length;

    const toggleFilter = (filterId: string, checked: boolean | "indeterminate") => {
        if (checked === "indeterminate") return;

        const option = filterOptions.find((item) => item.id === filterId);
        const groupName = option?.group || "Other";
        const selectionMode = filterGroupSelectionModes[groupName] || "multi";

        if (checked) {
            if (selectionMode === "single") {
                const otherGroupFilterIds = filterOptions
                    .filter((item) => (item.group || "Other") === groupName)
                    .map((item) => item.id);
                const nextFilterIds = activeFilterIds.filter((id) => !otherGroupFilterIds.includes(id));
                onFilterChange([...nextFilterIds, filterId]);
                return;
            }

            onFilterChange([...activeFilterIds, filterId]);
            return;
        }

        onFilterChange(activeFilterIds.filter((id) => id !== filterId));
    };

    const selectFilter = (filterId: string) => {
        const option = filterOptions.find((item) => item.id === filterId);
        if (!option) return;

        const groupName = option.group || "Other";
        const selectionMode = filterGroupSelectionModes[groupName] || "multi";

        if (selectionMode === "single") {
            const otherGroupFilterIds = filterOptions
                .filter((item) => (item.group || "Other") === groupName)
                .map((item) => item.id);
            const nextFilterIds = activeFilterIds.filter((id) => !otherGroupFilterIds.includes(id));
            onFilterChange([...nextFilterIds, filterId]);
            return;
        }

        if (!activeFilterIds.includes(filterId)) {
            onFilterChange([...activeFilterIds, filterId]);
        }
    };

    const handleClearFilters = () => {
        onFilterChange([]);
    };

    const groupedFilterOptions = filterOptions.reduce<Record<string, typeof filterOptions>>((acc, option) => {
        const group = option.group || "Other";
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(option);
        return acc;
    }, {});

    return (
        <Card className="lg:col-span-1 max-h-screen">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    Available Teams
                    <Badge variant="secondary">{teams.length} / {totalTeams}</Badge>
                </CardTitle>

                {/* Filters */}
                <div className="space-y-3">
                    <Input
                        placeholder="Search teams..."
                        value={searchFilter}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    <SortSelector sortBy={sortBy} onSortChange={onSortChange} />
                    {filterOptions.length > 0 && (
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <p className="text-sm font-medium">Team Filters</p>
                            <div className="flex items-center gap-2">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <Filter className="h-4 w-4" />
                                            Filters
                                            {activeFilterCount > 0 && (
                                                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                                                    {activeFilterCount}
                                                </Badge>
                                            )}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Team Filters</DialogTitle>
                                        </DialogHeader>
                                        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                                            {Object.entries(groupedFilterOptions).map(([groupName, options]) => (
                                                <div key={groupName} className="space-y-3">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                        {groupName}
                                                    </p>
                                                    {options.map((option) => {
                                                        const checkboxId = `pick-list-filter-dialog-${option.id}`;
                                                        const selectionMode = filterGroupSelectionModes[groupName] || "multi";
                                                        const isSelected = activeFilterIds.includes(option.id);
                                                        return (
                                                            <div key={option.id} className="space-y-1">
                                                                <div className="flex items-start gap-2">
                                                                    {selectionMode === "single" ? (
                                                                        <input
                                                                            id={checkboxId}
                                                                            type="radio"
                                                                            name={`pick-list-group-${groupName}`}
                                                                            checked={isSelected}
                                                                            onChange={() => selectFilter(option.id)}
                                                                            className="mt-0.5 h-4 w-4 border-input text-primary accent-primary"
                                                                        />
                                                                    ) : (
                                                                        <Checkbox
                                                                            id={checkboxId}
                                                                            checked={isSelected}
                                                                            onCheckedChange={(checked) => toggleFilter(option.id, checked)}
                                                                        />
                                                                    )}
                                                                    <Label htmlFor={checkboxId} className="text-sm leading-snug">
                                                                        {option.label}
                                                                    </Label>
                                                                </div>
                                                                {option.description && (
                                                                    <p className="ml-6 text-xs text-muted-foreground">{option.description}</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleClearFilters}
                                                disabled={activeFilterCount === 0}
                                            >
                                                Clear filters
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    )}
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
