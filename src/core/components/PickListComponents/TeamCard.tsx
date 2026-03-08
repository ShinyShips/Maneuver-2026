/**
 * Team Card Component
 * 
 * Displays a single team with stats and add-to-list functionality.
 * Matches 2025 styling.
 */

import { useState } from "react";
import { Card } from "@/core/components/ui/card";
import { GenericSelector } from "@/core/components/ui/generic-selector";
import { TeamCardStats, TeamStatsDialog } from "@/game-template/pick-list-config";
import type { TeamStats } from "@/core/types/team-stats";
import type { PickList } from "@/core/types/pickListTypes";
import type { Alliance } from "@/core/lib/allianceTypes";

interface TeamCardProps {
    team: TeamStats;
    pickLists: PickList[];
    alliances?: Alliance[];
    onAddTeamToList: (team: TeamStats, listId: number) => void;
    onAddTeamToAlliance?: (teamNumber: number, allianceId: number) => void;
}

export const TeamCard = ({ team, pickLists, alliances, onAddTeamToList, onAddTeamToAlliance }: TeamCardProps) => {
    const [selectValue, setSelectValue] = useState("none");

    // Check if a team is in a specific list
    const isTeamInList = (listId: number) => {
        const list = pickLists.find(l => l.id === listId);
        return list?.teams.some(t => t.teamNumber === team.teamNumber) || false;
    };

    // Get all lists that contain this team
    const getTeamLists = () => {
        return pickLists.filter(list =>
            list.teams.some(t => t.teamNumber === team.teamNumber)
        );
    };

    // Check if team is already in an alliance
    const isTeamInAlliance = (allianceId: number) => {
        if (!alliances) return false;
        const alliance = alliances.find(a => a.id === allianceId);
        if (!alliance) return false;
        return alliance.captain === team.teamNumber ||
            alliance.pick1 === team.teamNumber ||
            alliance.pick2 === team.teamNumber ||
            alliance.pick3 === team.teamNumber;
    };

    // Get available alliances (those that have open slots)
    const getAvailableAlliances = () => {
        if (!alliances) return [];
        return alliances.filter(alliance => {
            // Alliance has open slots if any position is empty
            return !alliance.captain || !alliance.pick1 || !alliance.pick2 || !alliance.pick3;
        });
    };

    // Prepare options for GenericSelector
    const availableOptions = [
        "none",
        ...pickLists.map(list => `list-${list.id}`),
        ...(alliances ? getAvailableAlliances().map(alliance => `alliance-${alliance.id}`) : [])
    ];

    const displayFormat = (value: string) => {
        if (value === "none") return "Add to...";

        // Handle pick lists
        if (value.startsWith("list-")) {
            const listId = value.replace("list-", "");
            const list = pickLists.find(l => l.id === Number(listId));
            if (!list) return value;

            const inList = isTeamInList(Number(listId));
            return inList ? `✓ ${list.name}` : list.name;
        }

        // Handle alliances
        if (value.startsWith("alliance-")) {
            const allianceId = value.replace("alliance-", "");
            const alliance = alliances?.find(a => a.id === Number(allianceId));
            if (!alliance) return value;

            const inAlliance = isTeamInAlliance(Number(allianceId));
            return inAlliance ? `✓ Alliance ${alliance.allianceNumber}` : `Alliance ${alliance.allianceNumber}`;
        }

        return value;
    };

    const handleSelection = (value: string) => {
        if (value === "none") return;

        // Check if it's a pick list (format: "list-{id}")
        if (value.startsWith("list-")) {
            const listId = value.replace("list-", "");
            onAddTeamToList(team, Number(listId));
        }
        // Check if it's an alliance (format: "alliance-{id}")
        else if (value.startsWith("alliance-") && onAddTeamToAlliance) {
            const allianceId = value.replace("alliance-", "");
            onAddTeamToAlliance(team.teamNumber, Number(allianceId));
        }

        setSelectValue("none"); // Reset selection
    };

    return (
        <Card className="p-3">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <div className="font-medium">Team {team.teamNumber}</div>
                    <TeamCardStats team={team} />
                    {getTeamLists().length > 0 && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            In lists: {getTeamLists().map(list => list.name).join(", ")}
                        </div>
                    )}
                </div>

                <div className="flex gap-1">
                    <TeamStatsDialog
                        teamNumber={team.teamNumber}
                        teamStats={team}
                        className="h-auto"
                    />

                    <GenericSelector
                        label="Add Team"
                        value={selectValue}
                        availableOptions={availableOptions}
                        onValueChange={handleSelection}
                        placeholder="Add to..."
                        displayFormat={displayFormat}
                        className="w-20"
                    />
                </div>
            </div>
        </Card>
    );
};
