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
        newListName,
        newListDescription,
        searchFilter,
        sortBy,
        activeTab,
        showAllianceSelection,
        filteredAndSortedTeams,

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
                    newListName={newListName}
                    newListDescription={newListDescription}
                    searchFilter={searchFilter}
                    sortBy={sortBy}
                    onTabChange={setActiveTab}
                    onSearchChange={setSearchFilter}
                    onSortChange={setSortBy}
                    onAddTeamToList={addTeamToList}
                    onAddTeamToAlliance={showAllianceSelection ? addTeamToAlliance : undefined}
                    onUpdateAlliances={setAlliances}
                    onUpdateBackups={setBackups}
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
                    newListName={newListName}
                    newListDescription={newListDescription}
                    searchFilter={searchFilter}
                    sortBy={sortBy}
                    onSearchChange={setSearchFilter}
                    onSortChange={setSortBy}
                    onAddTeamToList={addTeamToList}
                    onAddTeamToAlliance={showAllianceSelection ? addTeamToAlliance : undefined}
                    onUpdateAlliances={setAlliances}
                    onUpdateBackups={setBackups}
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
