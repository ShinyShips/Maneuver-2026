/**
 * Pick List Page
 * 
 * Main page for managing pick lists and alliance selection.
 */

import { PickListHeader } from "@/core/components/PickListComponents/PickListHeader";
import { MobilePickListLayout } from "@/core/components/PickListComponents/MobilePickListLayout";
import { DesktopPickListLayout } from "@/core/components/PickListComponents/DesktopPickListLayout";
import { usePickList } from "@/core/hooks/usePickList";

const PickListPage = () => {
    const {
        // State
        pickLists,
        alliances,
        backups,
        availableTeams,
        teamLookupTeams,
        pickListEventTeamCount,
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
        filteredAndSortedTeams,

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
    } = usePickList();

    return (
        <div className="min-h-screen w-full flex flex-col px-4 pt-12 pb-24">
            <div className="flex flex-col max-w-7xl w-full mx-auto flex-1 pb-6">
                <h1 className="text-2xl font-bold">Pick Lists</h1>
                <p className="text-muted-foreground pb-2">Create and manage alliance selection pick lists</p>

                {/* Header - Desktop Only */}
                <div className="hidden xl:block">
                    <PickListHeader
                        onExport={exportPickLists}
                        onImport={importPickLists}
                        showAllianceSelection={showAllianceSelection}
                        onToggleAllianceSelection={handleToggleAllianceSelection}
                    />
                </div>

                {/* Mobile Layout (below xl) - Tabs */}
                <MobilePickListLayout
                    activeTab={activeTab}
                    showAllianceSelection={showAllianceSelection}
                    filteredAndSortedTeams={filteredAndSortedTeams}
                    pickLists={pickLists}
                    alliances={alliances}
                    backups={backups}
                    availableTeams={availableTeams}
                    teamLookupTeams={teamLookupTeams}
                    pickListEventTeamCount={pickListEventTeamCount}
                    newListName={newListName}
                    newListDescription={newListDescription}
                    searchFilter={searchFilter}
                    sortBy={sortBy}
                    activeFilterIds={activeFilterIds}
                    hideAllianceAssignedTeams={hideAllianceAssignedTeams}
                    pickListEvent={pickListEvent}
                    availableEventKeys={availableEventKeys}
                    onTabChange={setActiveTab}
                    onSearchChange={setSearchFilter}
                    onSortChange={setSortBy}
                    onFilterChange={setActiveFilterIds}
                    onPickListEventChange={setPickListEvent}
                    onToggleHideAllianceAssignedTeams={setHideAllianceAssignedTeams}
                    onAddTeamToList={addTeamToList}
                    onAddTeamToAlliance={showAllianceSelection ? addTeamToAlliance : undefined}
                    onUpdateAlliances={setAlliances}
                    onUpdateBackups={setBackups}
                    onAssignTeamToAllianceSlot={assignTeamToAllianceSlot}
                    onHasTeamPickListSnapshot={hasTeamPickListSnapshot}
                    onRestoreTeamToPickLists={restoreTeamToPickLists}
                    onDiscardTeamPickListSnapshot={discardTeamPickListSnapshot}
                    onNameChange={setNewListName}
                    onDescriptionChange={setNewListDescription}
                    onCreateList={createNewList}
                    onDeleteList={deleteList}
                    onUpdateTeams={updateListTeams}
                    onAssignToAlliance={assignToAllianceAndRemove}
                    // Header props
                    onExport={exportPickLists}
                    onImport={importPickLists}
                    onToggleAllianceSelection={handleToggleAllianceSelection}
                />

                {/* Desktop Layout (xl and above) - Side by Side */}
                <DesktopPickListLayout
                    showAllianceSelection={showAllianceSelection}
                    filteredAndSortedTeams={filteredAndSortedTeams}
                    pickLists={pickLists}
                    alliances={alliances}
                    backups={backups}
                    availableTeams={availableTeams}
                    teamLookupTeams={teamLookupTeams}
                    pickListEventTeamCount={pickListEventTeamCount}
                    newListName={newListName}
                    newListDescription={newListDescription}
                    searchFilter={searchFilter}
                    sortBy={sortBy}
                    activeFilterIds={activeFilterIds}
                    hideAllianceAssignedTeams={hideAllianceAssignedTeams}
                    pickListEvent={pickListEvent}
                    availableEventKeys={availableEventKeys}
                    onSearchChange={setSearchFilter}
                    onSortChange={setSortBy}
                    onFilterChange={setActiveFilterIds}
                    onPickListEventChange={setPickListEvent}
                    onToggleHideAllianceAssignedTeams={setHideAllianceAssignedTeams}
                    onAddTeamToList={addTeamToList}
                    onAddTeamToAlliance={showAllianceSelection ? addTeamToAlliance : undefined}
                    onUpdateAlliances={setAlliances}
                    onUpdateBackups={setBackups}
                    onAssignTeamToAllianceSlot={assignTeamToAllianceSlot}
                    onHasTeamPickListSnapshot={hasTeamPickListSnapshot}
                    onRestoreTeamToPickLists={restoreTeamToPickLists}
                    onDiscardTeamPickListSnapshot={discardTeamPickListSnapshot}
                    onNameChange={setNewListName}
                    onDescriptionChange={setNewListDescription}
                    onCreateList={createNewList}
                    onDeleteList={deleteList}
                    onUpdateTeams={updateListTeams}
                    onAssignToAlliance={assignToAllianceAndRemove}
                />
            </div>
        </div>
    );
};

export default PickListPage;
