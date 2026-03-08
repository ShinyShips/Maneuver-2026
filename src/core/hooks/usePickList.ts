/**
 * Pick List Hook
 * 
 * Central hook for managing pick lists, alliances, and team selection.
 * Uses useAllTeamStats for centralized team statistics.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAllTeamStats } from "./useAllTeamStats";
import {
    filterTeams,
    isTeamInList,
    createPickListItem,
    createDefaultAlliances,
    createDefaultPickList
} from "@/core/lib/pickListUtils";
import type { PickList, PickListItem } from "@/core/types/pickListTypes";
import { getSortValue, isAscendingSort, type PickListSortOption } from "@/game-template/pick-list-config";
import type { Alliance, BackupTeam } from "@/core/lib/allianceTypes";
import type { TeamStats } from "@/core/types/team-stats";

export interface UsePickListResult {
    // Data
    availableTeams: TeamStats[];
    filteredAndSortedTeams: TeamStats[];
    pickLists: PickList[];
    alliances: Alliance[];
    backups: BackupTeam[];
    isLoading: boolean;

    // Form state
    newListName: string;
    newListDescription: string;
    searchFilter: string;
    sortBy: PickListSortOption;
    activeTab: string;
    showAllianceSelection: boolean;

    // State setters
    setNewListName: (name: string) => void;
    setNewListDescription: (desc: string) => void;
    setSearchFilter: (filter: string) => void;
    setSortBy: (sort: PickListSortOption) => void;
    setActiveTab: (tab: string) => void;
    setAlliances: (alliances: Alliance[]) => void;
    setBackups: (backups: BackupTeam[]) => void;

    // Actions
    addTeamToList: (team: TeamStats, listId: number) => void;
    createNewList: () => void;
    deleteList: (listId: number) => void;
    updateListTeams: (listId: number, teams: PickListItem[]) => void;
    exportPickLists: () => void;
    importPickLists: (event: React.ChangeEvent<HTMLInputElement>) => void;
    addTeamToAlliance: (teamNumber: number, allianceId: number) => void;
    assignToAllianceAndRemove: (teamNumber: number, allianceIndex: number) => void;
    handleToggleAllianceSelection: () => void;
}

export const usePickList = (eventKey?: string): UsePickListResult => {
    // Get team stats from centralized hook
    const { teamStats, isLoading } = useAllTeamStats(eventKey);

    // State
    const [pickLists, setPickLists] = useState<PickList[]>([]);
    const [alliances, setAlliances] = useState<Alliance[]>([]);
    const [backups, setBackups] = useState<BackupTeam[]>([]);
    const [newListName, setNewListName] = useState("");
    const [newListDescription, setNewListDescription] = useState("");
    const [searchFilter, setSearchFilter] = useState("");
    const [sortBy, setSortBy] = useState<PickListSortOption>("teamNumber");
    const [activeTab, setActiveTab] = useState("teams");
    const [showAllianceSelection, setShowAllianceSelection] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load pick lists from localStorage
    useEffect(() => {
        const savedLists = localStorage.getItem("pickLists");
        if (savedLists) {
            try {
                setPickLists(JSON.parse(savedLists));
            } catch {
                setPickLists([createDefaultPickList()]);
            }
        } else {
            setPickLists([createDefaultPickList()]);
        }
        setIsInitialized(true);
    }, []);

    // Save pick lists to localStorage
    useEffect(() => {
        if (!isInitialized) return;
        localStorage.setItem("pickLists", JSON.stringify(pickLists));
    }, [pickLists, isInitialized]);

    // Load alliances from localStorage
    useEffect(() => {
        const savedAlliances = localStorage.getItem("alliances");
        if (savedAlliances) {
            try {
                setAlliances(JSON.parse(savedAlliances));
            } catch {
                setAlliances(createDefaultAlliances());
            }
        } else {
            setAlliances(createDefaultAlliances());
        }
    }, []);

    // Save alliances to localStorage
    useEffect(() => {
        if (alliances.length > 0) {
            localStorage.setItem("alliances", JSON.stringify(alliances));
        }
    }, [alliances]);

    // Load backups from localStorage
    useEffect(() => {
        const savedBackups = localStorage.getItem("backups");
        if (savedBackups) {
            try {
                setBackups(JSON.parse(savedBackups));
            } catch {
                setBackups([]);
            }
        }
    }, []);

    // Save backups to localStorage
    useEffect(() => {
        if (backups.length > 0) {
            localStorage.setItem("backups", JSON.stringify(backups));
        }
    }, [backups]);


    // Sort teams based on selected criteria using configurable sort functions
    const sortTeams = useCallback((teams: TeamStats[], sort: PickListSortOption): TeamStats[] => {
        const ascending = isAscendingSort(sort);

        return [...teams].sort((a, b) => {
            // Put teams with 0 matches at bottom for performance sorts (non-ascending)
            if (!ascending) {
                if (a.matchCount === 0 && b.matchCount > 0) return 1;
                if (b.matchCount === 0 && a.matchCount > 0) return -1;
                if (a.matchCount === 0 && b.matchCount === 0) {
                    return a.teamNumber - b.teamNumber;
                }
            }

            const aValue = getSortValue(a, sort);
            const bValue = getSortValue(b, sort);

            return ascending ? aValue - bValue : bValue - aValue;
        });
    }, []);

    // Filtered and sorted teams
    const filteredAndSortedTeams = useMemo(() => {
        return sortTeams(filterTeams(teamStats, searchFilter), sortBy);
    }, [teamStats, searchFilter, sortBy, sortTeams]);

    // Add team to a pick list
    const addTeamToList = useCallback((team: TeamStats, listId: number) => {
        const teamNumber = team.teamNumber;
        const list = pickLists.find(l => l.id === listId);
        if (list && isTeamInList(teamNumber, list)) {
            toast.error(`Team ${teamNumber} is already in ${list.name}`);
            return;
        }

        const newItem = createPickListItem(teamNumber);
        setPickLists(prev => prev.map(list =>
            list.id === listId
                ? { ...list, teams: [...list.teams, newItem] }
                : list
        ));

        toast.success(`Team ${teamNumber} added to ${list?.name || 'list'}`);
    }, [pickLists]);

    // Create new pick list
    const createNewList = useCallback(() => {
        if (!newListName.trim()) {
            toast.error("Please enter a list name");
            return;
        }

        const newList: PickList = {
            id: Date.now(),
            name: newListName.trim(),
            description: newListDescription.trim(),
            teams: [],
        };

        setPickLists(prev => [...prev, newList]);
        setNewListName("");
        setNewListDescription("");
        toast.success("New pick list created");
    }, [newListName, newListDescription]);

    // Delete pick list
    const deleteList = useCallback((listId: number) => {
        setPickLists(prev => prev.filter(list => list.id !== listId));
        toast.success("Pick list deleted");
    }, []);

    // Update pick list teams order
    const updateListTeams = useCallback((listId: number, newTeams: PickListItem[]) => {
        setPickLists(prev => prev.map(list =>
            list.id === listId ? { ...list, teams: newTeams } : list
        ));
    }, []);

    // Export pick lists
    const exportPickLists = useCallback(() => {
        const dataStr = JSON.stringify(pickLists, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', 'pick-lists.json');
        linkElement.click();

        toast.success("Pick lists exported");
    }, [pickLists]);

    // Import pick lists
    const importPickLists = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = e.target?.result as string;
                if (!result) {
                    toast.error("Error reading file");
                    return;
                }

                const importedData = JSON.parse(result);

                if (!Array.isArray(importedData)) {
                    toast.error("Invalid file format");
                    return;
                }

                // Validate pick lists
                const validPickLists = importedData.filter((list): list is PickList =>
                    typeof list === 'object' &&
                    list !== null &&
                    'id' in list &&
                    'name' in list &&
                    'teams' in list &&
                    Array.isArray(list.teams)
                );

                if (validPickLists.length === 0) {
                    toast.error("No valid pick lists found");
                    return;
                }

                // Ensure unique IDs
                const currentMaxId = Math.max(0, ...pickLists.map(list => list.id));
                const importedWithNewIds = validPickLists.map((list, index) => ({
                    ...list,
                    id: currentMaxId + index + 1,
                }));

                setPickLists(importedWithNewIds);
                toast.success(`${validPickLists.length} pick lists imported`);
                event.target.value = '';
            } catch {
                toast.error("Error importing pick lists");
                event.target.value = '';
            }
        };

        reader.readAsText(file);
    }, [pickLists]);

    // Add team to alliance
    const addTeamToAlliance = useCallback((teamNumber: number, allianceId: number) => {
        const alliance = alliances.find(a => a.id === allianceId);
        if (!alliance) return;

        // Find next available position
        type Position = 'captain' | 'pick1' | 'pick2' | 'pick3';
        let position: Position | null = null;
        if (!alliance.captain) position = 'captain';
        else if (!alliance.pick1) position = 'pick1';
        else if (!alliance.pick2) position = 'pick2';
        else if (!alliance.pick3) position = 'pick3';

        if (!position) {
            toast.error(`Alliance ${alliance.allianceNumber} is full`);
            return;
        }

        setAlliances(prev => prev.map(a =>
            a.id === allianceId ? { ...a, [position]: teamNumber } : a
        ));

        const positionNames: Record<Position, string> = {
            captain: 'Captain',
            pick1: 'Pick 1',
            pick2: 'Pick 2',
            pick3: 'Pick 3',
        };
        toast.success(`Team ${teamNumber} assigned as ${positionNames[position]} of Alliance ${alliance.allianceNumber}`);
    }, [alliances]);

    // Assign to alliance and remove from pick lists
    const assignToAllianceAndRemove = useCallback((teamNumber: number, allianceIndex: number) => {
        const alliance = alliances[allianceIndex];
        if (!alliance) return;

        // Find next available position
        type Position = 'captain' | 'pick1' | 'pick2' | 'pick3';
        let position: Position | null = null;
        if (!alliance.captain) position = 'captain';
        else if (!alliance.pick1) position = 'pick1';
        else if (!alliance.pick2) position = 'pick2';
        else if (!alliance.pick3) position = 'pick3';

        if (!position) {
            toast.error(`Alliance ${alliance.allianceNumber} is full`);
            return;
        }

        // Update alliance
        setAlliances(prev => prev.map((a, index) =>
            index === allianceIndex ? { ...a, [position]: teamNumber } : a
        ));

        // Remove from all pick lists
        setPickLists(prev => prev.map(list => ({
            ...list,
            teams: list.teams.filter(team => team.teamNumber !== teamNumber),
        })));

        const positionNames: Record<Position, string> = {
            captain: 'Captain',
            pick1: 'Pick 1',
            pick2: 'Pick 2',
            pick3: 'Pick 3',
        };
        toast.success(`Team ${teamNumber} added to Alliance ${alliance.allianceNumber} as ${positionNames[position]}`);
    }, [alliances]);

    // Toggle alliance selection panel
    const handleToggleAllianceSelection = useCallback(() => {
        const newValue = !showAllianceSelection;
        setShowAllianceSelection(newValue);
        if (!newValue && activeTab === "alliances") {
            setActiveTab("teams");
        }
    }, [showAllianceSelection, activeTab]);

    return {
        // Data
        availableTeams: teamStats,
        filteredAndSortedTeams,
        pickLists,
        alliances,
        backups,
        isLoading,

        // Form state
        newListName,
        newListDescription,
        searchFilter,
        sortBy,
        activeTab,
        showAllianceSelection,

        // State setters
        setNewListName,
        setNewListDescription,
        setSearchFilter,
        setSortBy,
        setActiveTab,
        setAlliances,
        setBackups,

        // Actions
        addTeamToList,
        createNewList,
        deleteList,
        updateListTeams,
        exportPickLists,
        importPickLists,
        addTeamToAlliance,
        assignToAllianceAndRemove,
        handleToggleAllianceSelection,
    };
};
