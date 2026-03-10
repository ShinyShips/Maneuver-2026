import { useState, useEffect, useCallback } from "react";
import { useDataStats } from "@/core/hooks/useDataStats";
import { useDataCleaning } from "@/core/hooks/useDataCleaning";
import { DeviceInfoCard } from "@/core/components/data-management/ClearComponents/DeviceInfoCard";
import { BackupRecommendationAlert } from "@/core/components/data-management/ClearComponents/BackupRecommendationAlert";
import { ClearAllDataDialog } from "@/core/components/data-management/ClearComponents/ClearAllDataDialog";
import { DataClearCard } from "@/core/components/data-management/ClearComponents/DataClearCard";
import { EventDataClearCard } from "@/core/components/data-management/ClearComponents/EventDataClearCard";
import { db, pitDB } from "@/core/db/database";
import { gamificationDB as gameDB } from "@/game-template/gamification";


const ClearDataPage = () => {
  const [playerStation, setPlayerStation] = useState("");
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [eventKeys, setEventKeys] = useState<string[]>([]);

  const { stats, refreshData, resetStats, updateMatchData } = useDataStats();
  const {
    handleClearScoutingData,
    handleClearPitScoutingData,
    handleClearScoutGameData,
    handleClearMatchData,
    handleClearApiData,
    handleClearEventData,
    handleClearAllData,
  } = useDataCleaning(refreshData, resetStats, updateMatchData);

  const getEventKeysFromStorage = useCallback(() => {
    const keys = new Set<string>();

    const addIfValid = (value: unknown) => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      keys.add(trimmed);
    };

    const addFromArrayStorage = (storageKey: string) => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;

        parsed.forEach(item => {
          if (typeof item === 'string') {
            addIfValid(item);
            return;
          }

          if (
            typeof item === 'object' &&
            item !== null &&
            'eventKey' in item &&
            typeof (item as { eventKey: unknown }).eventKey === 'string'
          ) {
            addIfValid((item as { eventKey: string }).eventKey);
          }
        });
      } catch (error) {
        console.warn(`Failed to parse ${storageKey}`, error);
      }
    };

    addIfValid(localStorage.getItem('eventKey'));
    addIfValid(localStorage.getItem('current_event'));
    addFromArrayStorage('eventsList');
    addFromArrayStorage('customEventsList');
    addFromArrayStorage('event_history');

    const eventKeyPattern = /^(?:tba_event_teams_|nexus_pit_addresses_|nexus_pit_map_|nexus_event_teams_|matches_|match_results_|event_info_|pit_assignments_|pit_assignments_meta_|pit_assignments_mine_|tba_match_schedule_|tba_match_data_|matchResults_|stakesAwarded_)(.+)$/;

    Object.keys(localStorage).forEach(storageKey => {
      const match = storageKey.match(eventKeyPattern);
      if (match && match[1]) {
        addIfValid(match[1]);
      }
    });

    return keys;
  }, []);

  const refreshEventKeys = useCallback(async () => {
    try {
      const [scoutingEventKeys, pitEventKeys, predictionEventKeys] = await Promise.all([
        db.scoutingData.orderBy('eventKey').uniqueKeys(),
        pitDB.pitScoutingData.orderBy('eventKey').uniqueKeys(),
        gameDB.predictions.orderBy('eventKey').uniqueKeys(),
      ]);

      const allKeys = new Set<string>([...getEventKeysFromStorage()]);

      scoutingEventKeys.forEach(key => {
        if (typeof key === 'string' && key.trim()) {
          allKeys.add(key.trim());
        }
      });

      pitEventKeys.forEach(key => {
        if (typeof key === 'string' && key.trim()) {
          allKeys.add(key.trim());
        }
      });

      predictionEventKeys.forEach(key => {
        if (typeof key === 'string' && key.trim()) {
          allKeys.add(key.trim());
        }
      });

      setEventKeys(Array.from(allKeys));
    } catch (error) {
      console.error('Failed to refresh event keys:', error);
      setEventKeys(Array.from(getEventKeysFromStorage()));
    }
  }, [getEventKeysFromStorage]);

  useEffect(() => {
    const station = localStorage.getItem("playerStation") || "Unknown";
    setPlayerStation(station);
  }, []);

  useEffect(() => {
    void refreshEventKeys();
  }, [
    refreshEventKeys,
    stats.scoutingDataCount,
    stats.pitScoutingDataCount,
    stats.scoutGameDataCount,
    stats.apiDataCount,
    stats.matchDataCount,
  ]);

  return (
    <div className="min-h-screen w-full px-4 pt-12 pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col items-start gap-4 max-w-2xl mb-6">
          <h1 className="text-2xl font-bold">Clear Data</h1>
          <p className="text-muted-foreground">
            Permanently delete stored data from this device. This action cannot be undone.
          </p>
        </div>

        {/* Top Row - Device Info and Alert */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <DeviceInfoCard playerStation={playerStation} />
          <BackupRecommendationAlert
            onClearAllClick={() => setShowClearAllConfirm(true)}
          />
        </div>

        {/* Data Clear Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <DataClearCard
            title="Scouting Data"
            description="Match scouting data collected on this device"
            entryCount={stats.scoutingDataCount}
            entryLabel="entries"
            storageSize={stats.scoutingDataSize}
            onClear={handleClearScoutingData}
          />

          <DataClearCard
            title="Pit Scouting Data"
            description="Robot pit scouting data collected at events"
            entryCount={stats.pitScoutingDataCount}
            entryLabel="entries"
            storageSize={stats.pitScoutingDataSize}
            onClear={handleClearPitScoutingData}
          />

          <DataClearCard
            title="Scout Profile Data"
            description="Scout predictions, stakes, and leaderboard data"
            entryCount={stats.scoutGameDataCount}
            entryLabel="entries"
            storageSize={stats.scoutGameDataSize}
            onClear={handleClearScoutGameData}
            warningMessage={`This will permanently delete ${stats.scoutGameDataCount} scout game entries (scouts and predictions).`}
          />

          <DataClearCard
            title="TBA & Nexus API Data"
            description="Teams, pit data, matches, and event data from APIs"
            entryCount={stats.apiDataCount}
            entryLabel="items"
            storageSize={stats.apiDataSize}
            onClear={handleClearApiData}
            warningMessage={`This will permanently delete all downloaded API data including teams, pit addresses, pit maps, match results, and event information.`}
          />

          <DataClearCard
            title="Match Schedule Data"
            description="Tournament match schedule and team information"
            entryCount={stats.matchDataCount}
            entryLabel="matches"
            storageSize={stats.matchDataSize}
            onClear={handleClearMatchData}
          />

          <EventDataClearCard
            eventKeys={eventKeys}
            onClearEventData={async (eventKey: string) => {
              await handleClearEventData(eventKey);
              await refreshEventKeys();
            }}
          />
        </div>
      </div>

      <ClearAllDataDialog
        open={showClearAllConfirm}
        onOpenChange={setShowClearAllConfirm}
        onConfirm={handleClearAllData}
        scoutingDataCount={stats.scoutingDataCount}
        pitScoutingDataCount={stats.pitScoutingDataCount}
        scoutGameDataCount={stats.scoutGameDataCount}
        apiDataCount={stats.apiDataCount}
        matchDataCount={stats.matchDataCount}
      />
    </div>
  );
};

export default ClearDataPage;
