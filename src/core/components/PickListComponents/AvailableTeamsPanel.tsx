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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/core/components/ui/select";
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
    defenseTargetTeamFilter: string;
    hideAllianceAssignedTeams: boolean;
    onSearchChange: (value: string) => void;
    onSortChange: (value: PickListSortOption) => void;
    onFilterChange: (value: string[]) => void;
    onDefenseTargetTeamFilterChange: (value: string) => void;
    onToggleHideAllianceAssignedTeams: (hide: boolean) => void;
    eventFilter: string;
    availableEventKeys: string[];
    onEventFilterChange: (eventKey: string) => void;
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
    defenseTargetTeamFilter,
    hideAllianceAssignedTeams,
    onSearchChange,
    onSortChange,
    onFilterChange,
    onDefenseTargetTeamFilterChange,
    onToggleHideAllianceAssignedTeams,
    eventFilter,
    availableEventKeys,
    onEventFilterChange,
    onAddTeamToList,
    onAddTeamToAlliance
}: AvailableTeamsPanelProps) => {
    const activeFilterCount = activeFilterIds.length;
    const hasDefenseTargetTeam = /^\d+$/.test(defenseTargetTeamFilter.trim());

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
                    <Select value={eventFilter} onValueChange={onEventFilterChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filter by event" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Events</SelectItem>
                            {availableEventKeys.map((eventKey) => (
                                <SelectItem key={eventKey} value={eventKey}>
                                    {eventKey}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <SortSelector sortBy={sortBy} onSortChange={onSortChange} />
                    {filterOptions.length > 0 && (
                        <div className="space-y-2 rounded-md border p-3">
                            <div className="flex items-center justify-between">
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
                                                            const isDefenseFilterGroup = groupName === "Defense vs Team";
                                                            const isDisabled = isDefenseFilterGroup && !hasDefenseTargetTeam;
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
                                                                                disabled={isDisabled}
                                                                                className="mt-0.5 h-4 w-4 border-input text-primary accent-primary"
                                                                            />
                                                                        ) : (
                                                                            <Checkbox
                                                                                id={checkboxId}
                                                                                checked={isSelected}
                                                                                disabled={isDisabled}
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

                                                        {groupName === "Defense vs Team" && (
                                                            <div className="space-y-1">
                                                                <Label htmlFor="pick-list-defense-target-team" className="text-sm">
                                                                    Defended: Team #
                                                                </Label>
                                                                <Input
                                                                    id="pick-list-defense-target-team"
                                                                    inputMode="numeric"
                                                                    pattern="[0-9]*"
                                                                    placeholder="e.g. 3314"
                                                                    value={defenseTargetTeamFilter}
                                                                    onChange={(event) => {
                                                                        const numericOnly = event.target.value.replace(/\D/g, "");
                                                                        onDefenseTargetTeamFilterChange(numericOnly);
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
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
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="hide-alliance-assigned-teams"
                                    checked={hideAllianceAssignedTeams}
                                    onCheckedChange={(checked) => onToggleHideAllianceAssignedTeams(checked === true)}
                                />
                                <Label htmlFor="hide-alliance-assigned-teams" className="text-sm font-normal cursor-pointer">
                                    Hide alliance-assigned teams
                                </Label>
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
