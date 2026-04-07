/**
 * Pick List Hook
 * 
 * Central hook for managing pick lists, alliances, and team selection.
 * Uses useAllTeamStats for centralized team statistics.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { downloadTextFile } from "@/core/lib/downloadUtils";
import { useAllTeamStats } from "./useAllTeamStats";
import {
    filterTeams,
    isTeamInList,
    createPickListItem,
    createDefaultAlliances,
    createDefaultPickList
} from "@/core/lib/pickListUtils";
import type {
    PickList,
    PickListItem,
    PickListMembershipSnapshot,
    TeamMembershipSnapshots,
} from "@/core/types/pickListTypes";
import {
    filterOptions,
    getSortValue,
    isAscendingSort,
    type PickListSortOption,
} from "@/game-template/pick-list-config";
import type { Alliance, BackupTeam } from "@/core/lib/allianceTypes";
import type { TeamStats } from "@/core/types/team-stats";

type AlliancePosition = 'captain' | 'pick1' | 'pick2' | 'pick3';

export interface UsePickListResult {
    // Data
    availableTeams: TeamStats[];
    teamLookupTeams: TeamStats[];
    pickListEventTeamCount: number;
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
    activeFilterIds: string[];
    pickListEvent: string;
    availableEventKeys: string[];
    activeTab: string;
    showAllianceSelection: boolean;
    hideAllianceAssignedTeams: boolean;

    // State setters
    setNewListName: (name: string) => void;
    setNewListDescription: (desc: string) => void;
    setSearchFilter: (filter: string) => void;
    setSortBy: (sort: PickListSortOption) => void;
    setActiveFilterIds: (filters: string[]) => void;
    setPickListEvent: (eventKey: string) => void;
    setActiveTab: (tab: string) => void;
    setAlliances: (alliances: Alliance[]) => void;
    setBackups: (backups: BackupTeam[]) => void;
    setHideAllianceAssignedTeams: (hide: boolean) => void;

    // Actions
    addTeamToList: (team: TeamStats, listId: number) => void;
    createNewList: () => void;
    deleteList: (listId: number) => void;
    updateListTeams: (listId: number, teams: PickListItem[]) => void;
    exportPickLists: () => void;
    importPickLists: (event: React.ChangeEvent<HTMLInputElement>) => void;
    addTeamToAlliance: (teamNumber: number, allianceId: number) => void;
    assignToAllianceAndRemove: (teamNumber: number, allianceIndex: number) => void;
    assignTeamToAllianceSlot: (teamNumber: number, allianceId: number, position: AlliancePosition) => void;
    hasTeamPickListSnapshot: (teamNumber: number) => boolean;
    restoreTeamToPickLists: (teamNumber: number) => void;
    discardTeamPickListSnapshot: (teamNumber: number) => void;
    handleToggleAllianceSelection: () => void;
}

const TEAM_MEMBERSHIP_SNAPSHOTS_STORAGE_KEY = "pickListTeamMembershipSnapshots";
const PICK_LIST_EVENT_STORAGE_KEY = "pickListEventKey";
const LEGACY_PICK_LIST_EVENT_STORAGE_KEY = "pickListEventFilter";

const clonePickListItem = (item: PickListItem): PickListItem => ({
    ...item,
    checked: false,
});

const removeTeamFromLists = (lists: PickList[], teamNumber: number): PickList[] =>
    lists.map((list) => ({
        ...list,
        teams: list.teams.filter((team) => team.teamNumber !== teamNumber),
    }));

const captureTeamMembershipSnapshot = (
    lists: PickList[],
    teamNumber: number,
    existingSnapshot?: PickListMembershipSnapshot[]
): PickListMembershipSnapshot[] => {
    if (existingSnapshot && existingSnapshot.length > 0) {
        return existingSnapshot;
    }

    return lists.flatMap((list) => {
        const index = list.teams.findIndex((team) => team.teamNumber === teamNumber);
        if (index === -1) {
            return [];
        }

        const teamItem = list.teams[index];
        if (!teamItem) {
            return [];
        }

        return [{
            listId: list.id,
            index,
            item: clonePickListItem(teamItem),
        }];
    });
};

const restoreTeamInLists = (
    lists: PickList[],
    teamNumber: number,
    snapshot: PickListMembershipSnapshot[]
): PickList[] => {
    if (snapshot.length === 0) {
        return lists;
    }

    const snapshotByListId = new Map(snapshot.map((entry) => [entry.listId, entry]));

    return lists.map((list) => {
        const savedPlacement = snapshotByListId.get(list.id);
        if (!savedPlacement || list.teams.some((team) => team.teamNumber === teamNumber)) {
            return list;
        }

        const nextTeams = [...list.teams];
        const insertAt = Math.min(Math.max(savedPlacement.index, 0), nextTeams.length);
        nextTeams.splice(insertAt, 0, clonePickListItem(savedPlacement.item));

        return {
            ...list,
            teams: nextTeams,
        };
    });
};

const pickPreferredTeamStats = (
    current: TeamStats,
    candidate: TeamStats,
    preferredEventKey?: string
): TeamStats => {
    const normalizedPreferredEventKey = preferredEventKey?.trim().toLowerCase();
    const currentMatchesPreferredEvent = normalizedPreferredEventKey
        ? current.eventKey?.trim().toLowerCase() === normalizedPreferredEventKey
        : false;
    const candidateMatchesPreferredEvent = normalizedPreferredEventKey
        ? candidate.eventKey?.trim().toLowerCase() === normalizedPreferredEventKey
        : false;

    if (candidateMatchesPreferredEvent && !currentMatchesPreferredEvent) {
        return candidate;
    }

    if (currentMatchesPreferredEvent && !candidateMatchesPreferredEvent) {
        return current;
    }

    if (candidate.matchCount !== current.matchCount) {
        return candidate.matchCount > current.matchCount ? candidate : current;
    }

    const currentEventKey = current.eventKey ?? "";
    const candidateEventKey = candidate.eventKey ?? "";
    return candidateEventKey.localeCompare(currentEventKey) > 0 ? candidate : current;
};

const dedupeTeamsByNumber = (teams: TeamStats[], preferredEventKey?: string): TeamStats[] => {
    const teamsByNumber = new Map<number, TeamStats>();

    teams.forEach((team) => {
        const existing = teamsByNumber.get(team.teamNumber);
        if (!existing) {
            teamsByNumber.set(team.teamNumber, team);
            return;
        }

        teamsByNumber.set(
            team.teamNumber,
            pickPreferredTeamStats(existing, team, preferredEventKey)
        );
    });

    return Array.from(teamsByNumber.values()).sort((a, b) => a.teamNumber - b.teamNumber);
};

export const usePickList = (eventKey?: string): UsePickListResult => {
    // Get team stats from centralized hook
    const { teamStats, isLoading } = useAllTeamStats(eventKey);
    const normalizedEventKey = eventKey?.trim();

    // State
    const [pickLists, setPickLists] = useState<PickList[]>([]);
    const [alliances, setAlliances] = useState<Alliance[]>([]);
    const [backups, setBackups] = useState<BackupTeam[]>([]);
    const [newListName, setNewListName] = useState("");
    const [newListDescription, setNewListDescription] = useState("");
    const [searchFilter, setSearchFilter] = useState("");
    const [sortBy, setSortBy] = useState<PickListSortOption>("teamNumber");
    const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
    const [pickListEvent, setPickListEvent] = useState("");
    const [activeTab, setActiveTab] = useState("teams");
    const [showAllianceSelection, setShowAllianceSelection] = useState(true);
    const [hideAllianceAssignedTeams, setHideAllianceAssignedTeams] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const [teamMembershipSnapshots, setTeamMembershipSnapshots] = useState<TeamMembershipSnapshots>({});

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

    // Load team membership snapshots from localStorage
    useEffect(() => {
        const savedSnapshots = localStorage.getItem(TEAM_MEMBERSHIP_SNAPSHOTS_STORAGE_KEY);
        if (!savedSnapshots) {
            return;
        }

        try {
            setTeamMembershipSnapshots(JSON.parse(savedSnapshots) as TeamMembershipSnapshots);
        } catch {
            setTeamMembershipSnapshots({});
        }
    }, []);

    // Load available team filtering preference from localStorage
    useEffect(() => {
        const savedPreference = localStorage.getItem("pickListHideAllianceAssignedTeams");
        if (savedPreference !== null) {
            setHideAllianceAssignedTeams(savedPreference === "true");
        }
    }, []);

    // Save alliances to localStorage
    useEffect(() => {
        if (alliances.length > 0) {
            localStorage.setItem("alliances", JSON.stringify(alliances));
        }
    }, [alliances]);

    // Save team membership snapshots to localStorage
    useEffect(() => {
        localStorage.setItem(TEAM_MEMBERSHIP_SNAPSHOTS_STORAGE_KEY, JSON.stringify(teamMembershipSnapshots));
    }, [teamMembershipSnapshots]);

    // Save available team filtering preference to localStorage
    useEffect(() => {
        localStorage.setItem("pickListHideAllianceAssignedTeams", String(hideAllianceAssignedTeams));
    }, [hideAllianceAssignedTeams]);

    // Load event filter preference from localStorage
    useEffect(() => {
        const savedPickListEvent = localStorage.getItem(PICK_LIST_EVENT_STORAGE_KEY)
            ?? localStorage.getItem(LEGACY_PICK_LIST_EVENT_STORAGE_KEY);
        if (savedPickListEvent && savedPickListEvent.trim() && savedPickListEvent !== "all") {
            setPickListEvent(savedPickListEvent);
        }
    }, []);

    // Save pick list event preference to localStorage
    useEffect(() => {
        localStorage.setItem(PICK_LIST_EVENT_STORAGE_KEY, pickListEvent);
        localStorage.removeItem(LEGACY_PICK_LIST_EVENT_STORAGE_KEY);
    }, [pickListEvent]);

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

    const allianceAssignedTeams = useMemo(() => {
        const assigned = new Set<number>();

        alliances.forEach((alliance) => {
            if (alliance.captain) assigned.add(alliance.captain);
            if (alliance.pick1) assigned.add(alliance.pick1);
            if (alliance.pick2) assigned.add(alliance.pick2);
            if (alliance.pick3) assigned.add(alliance.pick3);
        });

        return assigned;
    }, [alliances]);

    const availableEventKeys = useMemo(() => {
        const eventKeys = Array.from(new Set(
            teamStats
                .map((team) => team.eventKey)
                .filter((key): key is string => typeof key === "string" && key.trim().length > 0)
        ));

        return eventKeys.sort((a, b) => a.localeCompare(b));
    }, [teamStats]);

    useEffect(() => {
        // Don't validate/reset until we actually have keys to validate against.
        if (availableEventKeys.length === 0) {
            return;
        }

        if (normalizedEventKey) {
            const canonicalEventKey = availableEventKeys.find(
                (key) => key.trim().toLowerCase() === normalizedEventKey.toLowerCase()
            );

            if (canonicalEventKey && canonicalEventKey !== pickListEvent) {
                setPickListEvent(canonicalEventKey);
            }
            return;
        }

        if (!pickListEvent.trim()) {
            setPickListEvent(availableEventKeys[0] ?? "");
            return;
        }

        const canonicalEventKey = availableEventKeys.find(
            (key) => key.trim().toLowerCase() === pickListEvent.trim().toLowerCase()
        );

        if (!canonicalEventKey) {
            setPickListEvent(availableEventKeys[0] ?? "");
            return;
        }

        if (canonicalEventKey !== pickListEvent) {
            setPickListEvent(canonicalEventKey);
        }
    }, [availableEventKeys, pickListEvent, normalizedEventKey]);

    const eventFilteredTeams = useMemo(() => {
        const normalizedPickListEvent = pickListEvent.trim().toLowerCase();
        if (!normalizedPickListEvent) {
            return teamStats;
        }

        return teamStats.filter((team) => team.eventKey?.trim().toLowerCase() === normalizedPickListEvent);
    }, [teamStats, pickListEvent]);

    const availableTeams = useMemo(
        () => dedupeTeamsByNumber(eventFilteredTeams, pickListEvent || normalizedEventKey),
        [eventFilteredTeams, pickListEvent, normalizedEventKey]
    );

    const teamLookupTeams = useMemo(
        () => dedupeTeamsByNumber(teamStats, pickListEvent || normalizedEventKey),
        [teamStats, pickListEvent, normalizedEventKey]
    );

    // Filtered and sorted teams
    const filteredAndSortedTeams = useMemo(() => {
        const filtered = filterTeams(availableTeams, searchFilter)
            .filter((team) => {
                if (activeFilterIds.length === 0) {
                    return true;
                }

                return activeFilterIds.every((filterId) => {
                    const option = filterOptions.find((candidate) => candidate.id === filterId);
                    return option ? option.predicate(team) : true;
                });
            })
            .filter((team) => {
                if (!hideAllianceAssignedTeams) {
                    return true;
                }

                return !allianceAssignedTeams.has(team.teamNumber);
            });

        return sortTeams(filtered, sortBy);
    }, [availableTeams, searchFilter, activeFilterIds, sortBy, sortTeams, allianceAssignedTeams, hideAllianceAssignedTeams]);

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
        downloadTextFile('pick-lists.json', JSON.stringify(pickLists, null, 2), 'application/json;charset=utf-8');

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

        const membershipSnapshot = captureTeamMembershipSnapshot(
            pickLists,
            teamNumber,
            teamMembershipSnapshots[String(teamNumber)]
        );

        setTeamMembershipSnapshots((prev) => ({
            ...prev,
            [String(teamNumber)]: membershipSnapshot,
        }));

        setPickLists((prev) => removeTeamFromLists(prev, teamNumber));

        const positionNames: Record<Position, string> = {
            captain: 'Captain',
            pick1: 'Pick 1',
            pick2: 'Pick 2',
            pick3: 'Pick 3',
        };
        toast.success(`Team ${teamNumber} assigned as ${positionNames[position]} of Alliance ${alliance.allianceNumber}`);
    }, [alliances, pickLists, teamMembershipSnapshots]);

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

        const membershipSnapshot = captureTeamMembershipSnapshot(
            pickLists,
            teamNumber,
            teamMembershipSnapshots[String(teamNumber)]
        );

        setTeamMembershipSnapshots((prev) => ({
            ...prev,
            [String(teamNumber)]: membershipSnapshot,
        }));

        setPickLists((prev) => removeTeamFromLists(prev, teamNumber));

        const positionNames: Record<Position, string> = {
            captain: 'Captain',
            pick1: 'Pick 1',
            pick2: 'Pick 2',
            pick3: 'Pick 3',
        };
        toast.success(`Team ${teamNumber} added to Alliance ${alliance.allianceNumber} as ${positionNames[position]}`);
    }, [alliances, pickLists, teamMembershipSnapshots]);

    const assignTeamToAllianceSlot = useCallback((teamNumber: number, allianceId: number, position: AlliancePosition) => {
        const alliance = alliances.find((candidate) => candidate.id === allianceId);
        if (!alliance) {
            return;
        }

        if (alliance[position] === teamNumber) {
            return;
        }

        setAlliances((prev) => prev.map((candidate) =>
            candidate.id === allianceId ? { ...candidate, [position]: teamNumber } : candidate
        ));

        const membershipSnapshot = captureTeamMembershipSnapshot(
            pickLists,
            teamNumber,
            teamMembershipSnapshots[String(teamNumber)]
        );

        setTeamMembershipSnapshots((prev) => ({
            ...prev,
            [String(teamNumber)]: membershipSnapshot,
        }));

        setPickLists((prev) => removeTeamFromLists(prev, teamNumber));

        const positionNames: Record<AlliancePosition, string> = {
            captain: 'Captain',
            pick1: 'Pick 1',
            pick2: 'Pick 2',
            pick3: 'Pick 3',
        };

        toast.success(`Team ${teamNumber} assigned to Alliance ${alliance.allianceNumber} as ${positionNames[position]}`);
    }, [alliances, pickLists, teamMembershipSnapshots]);

    const restoreTeamToPickLists = useCallback((teamNumber: number) => {
        const snapshot = teamMembershipSnapshots[String(teamNumber)] ?? [];

        if (snapshot.length > 0) {
            setPickLists((prev) => restoreTeamInLists(prev, teamNumber, snapshot));
        }

        setTeamMembershipSnapshots((prev) => {
            const { [String(teamNumber)]: _removed, ...remaining } = prev;
            return remaining;
        });
    }, [teamMembershipSnapshots]);

    const hasTeamPickListSnapshot = useCallback((teamNumber: number) => {
        const snapshot = teamMembershipSnapshots[String(teamNumber)] ?? [];
        return snapshot.length > 0;
    }, [teamMembershipSnapshots]);

    const discardTeamPickListSnapshot = useCallback((teamNumber: number) => {
        setTeamMembershipSnapshots((prev) => {
            if (!(String(teamNumber) in prev)) {
                return prev;
            }

            const { [String(teamNumber)]: _removed, ...remaining } = prev;
            return remaining;
        });
    }, []);

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
        availableTeams,
        teamLookupTeams,
        pickListEventTeamCount: availableTeams.length,
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
        activeFilterIds,
        pickListEvent,
        availableEventKeys,
        activeTab,
        showAllianceSelection,
        hideAllianceAssignedTeams,

        // State setters
        setNewListName,
        setNewListDescription,
        setSearchFilter,
        setSortBy,
        setActiveFilterIds,
        setPickListEvent,
        setActiveTab,
        setAlliances,
        setBackups,
        setHideAllianceAssignedTeams,

        // Actions
        addTeamToList,
        createNewList,
        deleteList,
        updateListTeams,
        exportPickLists,
        importPickLists,
        addTeamToAlliance,
        assignToAllianceAndRemove,
        assignTeamToAllianceSlot,
        hasTeamPickListSnapshot,
        restoreTeamToPickLists,
        discardTeamPickListSnapshot,
        handleToggleAllianceSelection,
    };
};
