import { useCallback } from "react";
import { toast } from "sonner";
import { clearAllScoutingData, db, pitDB } from "@/core/db/database";
import { clearGamificationData as clearGameData } from "@/game-template/gamification";
import { gamificationDB as gameDB } from "@/game-template/gamification";
import { clearAllPitScoutingData } from "@/core/lib/pitScoutingUtils";
import { clearAllTBACache, clearEventCache, clearEventValidationResults } from "@/core/lib/tbaCache";
import { clearStoredEventTeams, clearStoredNexusData } from "@/core/lib/tba";

export const useDataCleaning = (
  refreshData: () => Promise<void>,
  resetStats: () => void,
  updateMatchData?: (matchData: string | null) => void
) => {
  const removeEventFromArrayStorage = useCallback((storageKey: string, eventKey: string) => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const filtered = parsed.filter(item => {
        if (typeof item === 'string') {
          return item.trim().toLowerCase() !== eventKey.toLowerCase();
        }

        if (
          typeof item === 'object' &&
          item !== null &&
          'eventKey' in item &&
          typeof (item as { eventKey: unknown }).eventKey === 'string'
        ) {
          return (item as { eventKey: string }).eventKey.trim().toLowerCase() !== eventKey.toLowerCase();
        }

        return true;
      });

      localStorage.setItem(storageKey, JSON.stringify(filtered));
    } catch (error) {
      console.warn(`Failed to update ${storageKey} while clearing event data`, error);
    }
  }, []);

  const clearEventLocalStorageData = useCallback((eventKey: string) => {
    const normalizedEventKey = eventKey.trim();
    if (!normalizedEventKey) return;

    clearStoredEventTeams(normalizedEventKey);
    clearStoredNexusData(normalizedEventKey);

    const directKeys = [
      `matches_${normalizedEventKey}`,
      `match_results_${normalizedEventKey}`,
      `event_info_${normalizedEventKey}`,
      `pit_assignments_${normalizedEventKey}`,
      `pit_assignments_meta_${normalizedEventKey}`,
      `pit_assignments_mine_${normalizedEventKey}`,
      `tba_match_schedule_${normalizedEventKey}`,
      `tba_match_data_${normalizedEventKey}`,
      `matchResults_${normalizedEventKey}`,
      `stakesAwarded_${normalizedEventKey}`,
    ];

    directKeys.forEach(key => localStorage.removeItem(key));

    removeEventFromArrayStorage('eventsList', normalizedEventKey);
    removeEventFromArrayStorage('customEventsList', normalizedEventKey);
    removeEventFromArrayStorage('event_history', normalizedEventKey);

    const currentEventKey = localStorage.getItem('eventKey');
    if (currentEventKey && currentEventKey.trim().toLowerCase() === normalizedEventKey.toLowerCase()) {
      localStorage.removeItem('eventKey');
      localStorage.removeItem('current_event');
      localStorage.removeItem('matchData');
      if (updateMatchData) {
        updateMatchData(null);
      }
    }
  }, [removeEventFromArrayStorage, updateMatchData]);

  const handleClearScoutingData = useCallback(async () => {
    try {
      await clearAllScoutingData();
      localStorage.setItem("scoutingData", JSON.stringify({ data: [] }));

      await refreshData();
      window.dispatchEvent(new Event('dataChanged'));
      toast.success("Cleared all scouting data");
    } catch (error) {
      console.error("Error clearing scouting data:", error);
      localStorage.setItem("scoutingData", JSON.stringify({ data: [] }));
      await refreshData();
      window.dispatchEvent(new Event('dataChanged'));
      toast.success("Cleared all scouting data");
    }
  }, [refreshData]);

  const handleClearPitScoutingData = useCallback(async () => {
    try {
      await clearAllPitScoutingData();
      await refreshData();
      window.dispatchEvent(new Event('dataChanged'));
      toast.success("Cleared all pit scouting data");
    } catch (error) {
      console.error("Error clearing pit scouting data:", error);
      toast.error("Failed to clear pit scouting data");
    }
  }, [refreshData]);

  const handleClearScoutGameData = useCallback(async () => {
    try {
      await clearGameData();

      localStorage.removeItem("scoutsList");
      localStorage.removeItem("currentScout");
      localStorage.removeItem("scoutName");

      window.dispatchEvent(new CustomEvent('scoutDataCleared'));
      window.dispatchEvent(new Event('dataChanged'));

      await refreshData();
      toast.success("Cleared all scout profile data");
      console.log("ClearDataPage - Scout profile data cleared successfully");
    } catch (error) {
      console.error("Error clearing scout profile data:", error);
      toast.error("Failed to clear scout profile data");
    }
  }, [refreshData]);

  const handleClearMatchData = useCallback(async () => {
    localStorage.setItem("matchData", "");
    await clearAllTBACache();
    if (updateMatchData) {
      updateMatchData(null);
    }
    window.dispatchEvent(new Event('dataChanged'));
    toast.success("Cleared match schedule data");
  }, [updateMatchData]);

  const handleClearApiData = useCallback(async () => {
    try {
      const allKeys = Object.keys(localStorage);
      const apiKeys = allKeys.filter(key =>
        key.includes('tba_') ||
        key.startsWith('tba_') ||
        key.includes('nexus_') ||
        key.startsWith('nexus_') ||
        key === 'matchData' ||
        key === 'eventsList' ||
        key === 'eventKey' ||
        key.includes('matchResults_') ||
        key.includes('stakesAwarded_') ||
        key.includes('pit_assignments_')
      );

      console.log('Clearing API data keys:', apiKeys);

      apiKeys.forEach(key => {
        localStorage.removeItem(key);
      });

      await clearAllTBACache();

      await refreshData();
      window.dispatchEvent(new Event('dataChanged'));
      toast.success(`Cleared all API data (${apiKeys.length} items)`);
    } catch (error) {
      console.error("Error clearing API data:", error);
      toast.error("Failed to clear API data");
    }
  }, [refreshData]);

  const handleClearEventData = useCallback(async (eventKey: string) => {
    const normalizedEventKey = eventKey.trim();
    if (!normalizedEventKey) {
      toast.error('Please select an event to delete');
      return;
    }

    try {
      const scoutingCollection = db.scoutingData.where('eventKey').equalsIgnoreCase(normalizedEventKey);
      const pitCollection = pitDB.pitScoutingData.where('eventKey').equalsIgnoreCase(normalizedEventKey);
      const predictionCollection = gameDB.predictions.where('eventKey').equalsIgnoreCase(normalizedEventKey);

      const [scoutingCount, pitCount, predictionCount] = await Promise.all([
        scoutingCollection.count(),
        pitCollection.count(),
        predictionCollection.count(),
      ]);

      await Promise.all([
        scoutingCount > 0 ? scoutingCollection.delete() : Promise.resolve(),
        pitCount > 0 ? pitCollection.delete() : Promise.resolve(),
        predictionCount > 0 ? predictionCollection.delete() : Promise.resolve(),
      ]);

      await Promise.all([
        clearEventCache(normalizedEventKey),
        clearEventValidationResults(normalizedEventKey),
      ]);

      clearEventLocalStorageData(normalizedEventKey);

      await refreshData();
      window.dispatchEvent(new Event('dataChanged'));

      const deletedEntryCount = scoutingCount + pitCount + predictionCount;
      toast.success(`Cleared event data for ${normalizedEventKey}`, {
        description: `Deleted ${deletedEntryCount} scouting/pit/prediction entries and related cached data.`
      });
    } catch (error) {
      console.error('Error clearing event data:', error);
      toast.error(`Failed to clear event data for ${normalizedEventKey}`);
    }
  }, [clearEventLocalStorageData, refreshData]);

  const handleClearAllData = useCallback(async () => {
    try {
      console.log("localStorage before clearing:", Object.keys(localStorage));

      await clearAllScoutingData();
      await clearAllPitScoutingData();
      await clearGameData();
      await clearAllTBACache();

      localStorage.clear();

      console.log("localStorage after clearing:", Object.keys(localStorage));

      resetStats();

      window.dispatchEvent(new CustomEvent('scoutDataCleared'));
      window.dispatchEvent(new CustomEvent('allDataCleared'));
      window.dispatchEvent(new Event('dataChanged'));

      toast.success("Cleared all data - complete clean slate", {
        description: "All stored data has been permanently removed from this device."
      });

    } catch (error) {
      console.error("Error clearing all data:", error);
      toast.error("Failed to clear all data");
    }
  }, [resetStats]);

  return {
    handleClearScoutingData,
    handleClearPitScoutingData,
    handleClearScoutGameData,
    handleClearMatchData,
    handleClearApiData,
    handleClearEventData,
    handleClearAllData,
  };
};
