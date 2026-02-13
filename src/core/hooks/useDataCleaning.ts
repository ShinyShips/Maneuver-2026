import { useCallback } from "react";
import { toast } from "sonner";
import { clearAllScoutingData } from "@/core/db/database";
import { clearGamificationData as clearGameData } from "@/game-template/gamification";
import { clearAllPitScoutingData } from "@/core/lib/pitScoutingUtils";
import { clearAllTBACache } from "@/core/lib/tbaCache";

export const useDataCleaning = (
  refreshData: () => Promise<void>,
  resetStats: () => void,
  updateMatchData?: (matchData: string | null) => void
) => {
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
    handleClearAllData,
  };
};
