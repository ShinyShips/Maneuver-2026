import React, { useState, useEffect } from 'react';

// Import hooks and components
import { useTBAData } from '@/core/hooks/useTBAData';
import { useTBAMatchData } from '@/core/hooks/useTBAMatchData';
import { ProcessingResults } from '@/core/components/tba';
import {
  MatchDataLoader,
  DataStatusCard,
  DataOperationsCard,
  MatchValidationDataDisplay,
  PitDataDisplay
} from '@/core/components/tba/DataManagement';
import {
  DataTypeSelector,
  EventConfigurationCard,
  EventSwitchConfirmDialog,
  EventTeamsDisplay,
  type TBADataType
} from '@/core/components/tba/EventConfiguration';
// GAME-SPECIFIC: ValidationTesting requires game-specific validation logic
// import { ValidationTesting } from '@/core/components/tba/ValidationTesting';
import { DataAttribution } from '@/core/components/DataAttribution';
import { getNexusPitData, storePitData, getStoredPitData, getNexusEvents, extractAndStoreTeamsFromPitAddresses, type NexusPitAddresses, type NexusPitMap } from '@/core/lib/tba';
import { clearEventData, hasStoredEventData, setCurrentEvent, getCurrentEvent, isDifferentEvent } from '@/core/lib/tba';
import { processPredictionRewardsForMatches } from '@/core/lib/predictionRewards';
import { toast } from 'sonner';

interface ProcessingResult {
  matchNumber: number;
  winner: string;
  predictionsCount: number;
  correctPredictions: number;
  stakesAwarded: number;
}

const APIDataPage: React.FC = () => {
  // API calls are proxied through Netlify Functions (server-side keys)
  const apiKey = '';
  const nexusApiKey = '';

  // Shared state for configuration
  const [eventKey, setEventKey] = useState('');
  const [dataType, setDataType] = useState<TBADataType>('match-data');

  // Event data management
  const [clearingEventData, setClearingEventData] = useState(false);
  const [storedDataExists, setStoredDataExists] = useState(false);

  // Event switch confirmation
  const [showEventSwitchDialog, setShowEventSwitchDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<() => void>(() => { });

  // Processing results state
  const [processedResults, setProcessedResults] = useState<ProcessingResult[]>([]);
  const [lastAutoProcessedSignature, setLastAutoProcessedSignature] = useState<string>('');

  // Nexus data state
  const [pitDataLoading, setPitDataLoading] = useState(false);
  const [pitData, setPitData] = useState<{
    addresses: NexusPitAddresses | null;
    map: NexusPitMap | null;
  }>({ addresses: null, map: null });

  // Debug Nexus state
  const [debugNexusLoading, setDebugNexusLoading] = useState(false);
  const [nexusEvents, setNexusEvents] = useState<Record<string, unknown> | null>(null);

  // Use the TBA data hook
  const {
    matchDataLoading,
    matchResultsLoading,
    eventTeamsLoading,
    matches,
    teams,
    isStored,
    fetchMatchDataFromTBA,
    loadMatchResults,
    loadEventTeams,
    handleStoreTeams,
    handleClearStored,
  } = useTBAData();

  // Use the TBA match data hook for validation
  const {
    loading: validationLoading,
    matches: validationMatches,
    isOnline: validationOnline,
    cacheExpired: validationCacheExpired,
    cacheMetadata,
    clearCache: clearValidationCache,
    fetchEventMatches: fetchValidationMatches,
  } = useTBAMatchData();

  // Load event from localStorage on mount
  useEffect(() => {
    const sessionEventKey = localStorage.getItem("eventKey");
    if (sessionEventKey) {
      setEventKey(sessionEventKey);
    }
  }, []);

  // Check if stored data exists
  useEffect(() => {
    if (eventKey) {
      setStoredDataExists(hasStoredEventData(eventKey));
    }
  }, [eventKey]);

  // Check if event has changed and prompt user
  const executeWithConfirmation = (action: () => void) => {
    const currentEvent = getCurrentEvent();
    if (eventKey && currentEvent && isDifferentEvent(eventKey)) {
      setPendingAction(() => action);
      setShowEventSwitchDialog(true);
    } else {
      action();
    }
  };

  const handleConfirmEventSwitch = () => {
    setShowEventSwitchDialog(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(() => { });
    }
  };

  const handleCancelEventSwitch = () => {
    setShowEventSwitchDialog(false);
    setPendingAction(() => { });
  };

  const handleClearAllEventData = async () => {
    if (!eventKey.trim()) {
      toast.error('Please enter an event key');
      return;
    }

    setClearingEventData(true);
    try {
      await clearEventData(eventKey);
      setStoredDataExists(false);
      setPitData({ addresses: null, map: null });
      setProcessedResults([]);
      toast.success('All event data cleared successfully');
    } catch (error) {
      console.error('Error clearing event data:', error);
      toast.error('Failed to clear event data');
    } finally {
      setClearingEventData(false);
    }
  };

  const handleLoadMatchData = async () => {
    if (!eventKey.trim()) {
      toast.error('Please enter an event key');
      return;
    }

    executeWithConfirmation(async () => {
      await fetchMatchDataFromTBA(apiKey, eventKey, false, () => { });

      // Update current event in localStorage after successful load
      setCurrentEvent(eventKey.trim());
    });
  };

  const handleLoadMatchResults = async () => {
    if (!eventKey.trim()) {
      toast.error('Please enter an event key');
      return;
    }

    await loadMatchResults(apiKey, eventKey, false, () => { });
  };

  const handleLoadValidationData = async () => {
    if (!eventKey.trim()) {
      toast.error('Please enter an event key');
      return;
    }

    executeWithConfirmation(async () => {
      await fetchValidationMatches(eventKey, apiKey, false);

      // Update current event in localStorage after successful load
      setCurrentEvent(eventKey.trim());
    });
  };

  const handleLoadEventTeams = async () => {
    if (!eventKey.trim()) {
      toast.error('Please enter an event key');
      return;
    }

    await loadEventTeams(apiKey, eventKey, false, () => { });
  };

  const handleLoadPitData = async () => {
    if (!eventKey.trim()) {
      toast.error('Please enter an event key');
      return;
    }

    executeWithConfirmation(async () => {
      setPitDataLoading(true);
      try {
        // First check if pit data is already stored
        const storedData = getStoredPitData(eventKey);
        if (storedData.addresses || storedData.map) {
          setPitData(storedData);
          toast.success('Loaded pit data from local storage');

          // Update current event in localStorage after successful load
          setCurrentEvent(eventKey.trim());

          setPitDataLoading(false);
          return;
        }

        // If not stored, fetch from Nexus API
        const fetchedData = await getNexusPitData(eventKey, nexusApiKey);
        setPitData(fetchedData);

        // Store the data locally
        storePitData(eventKey, fetchedData.addresses, fetchedData.map);

        // Update current event in localStorage after successful load
        setCurrentEvent(eventKey.trim());

        // Extract and store teams from pit addresses for pit assignments
        let extractedTeamCount = 0;
        if (fetchedData.addresses && Object.keys(fetchedData.addresses).length > 0) {
          try {
            const extractedTeams = extractAndStoreTeamsFromPitAddresses(eventKey, fetchedData.addresses);
            extractedTeamCount = extractedTeams.length;
            console.log(`Extracted ${extractedTeamCount} teams from pit addresses for pit assignments`);
          } catch (error) {
            console.warn('Failed to extract teams from pit addresses:', error);
          }
        }

        const addressCount = fetchedData.addresses ? Object.keys(fetchedData.addresses).length : 0;
        const hasMap = fetchedData.map !== null;

        if (addressCount > 0 && hasMap) {
          const message = extractedTeamCount > 0
            ? `Loaded pit data: ${addressCount} addresses, pit map, and extracted ${extractedTeamCount} teams for pit assignments`
            : `Loaded pit data: ${addressCount} addresses and pit map`;
          toast.success(message);
        } else if (addressCount > 0) {
          const message = extractedTeamCount > 0
            ? `Loaded ${addressCount} pit addresses and extracted ${extractedTeamCount} teams for pit assignments (no map available)`
            : `Loaded ${addressCount} pit addresses (no map available)`;
          toast.success(message);
        } else if (hasMap) {
          toast.warning('Loaded pit map but no team addresses found');
        } else {
          toast.warning('No pit data available for this event');
        }
      } catch (error) {
        console.error('Error loading pit data:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load pit data');
      } finally {
        setPitDataLoading(false);
      }
    });
  };

  const handleDebugNexus = async () => {
    setDebugNexusLoading(true);
    try {
      const eventsData = await getNexusEvents(nexusApiKey);
      const eventCount = Object.keys(eventsData).length;
      setNexusEvents(eventsData);
      toast.success(`Loaded ${eventCount} events from Nexus API`);
    } catch (error) {
      console.error('Error loading Nexus events:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load Nexus events');
      setNexusEvents(null);
    } finally {
      setDebugNexusLoading(false);
    }
  };

  useEffect(() => {
    if (dataType !== 'match-results') return;
    if (!eventKey.trim()) return;
    if (matchResultsLoading) return;
    if (matches.length === 0) {
      setProcessedResults([]);
      return;
    }

    const maxMatchNumber = matches.reduce((max, match) => Math.max(max, match.match_number), 0);
    const signature = `${eventKey}:${matches.length}:${maxMatchNumber}`;
    if (signature === lastAutoProcessedSignature) {
      return;
    }

    let cancelled = false;

    const autoProcess = async () => {
      try {
        const processed = await processPredictionRewardsForMatches(matches, {
          eventKey,
          onlyFinalResults: true,
          includeZeroResultMatches: true,
        });

        if (cancelled) return;

        setProcessedResults(processed.results);
        setLastAutoProcessedSignature(signature);

        const totalPredictions = processed.summary.processedPredictionCount;
        if (totalPredictions > 0) {
          toast.success(
            `Auto-processed ${matches.length} matches: ${processed.summary.correctPredictionCount}/${totalPredictions} correct predictions, ${processed.summary.totalStakesAwarded} stakes awarded`
          );
        }
      } catch (error) {
        console.error('Error auto-processing match results:', error);
        if (!cancelled) {
          toast.error('Failed to auto-process match results.');
        }
      }
    };

    void autoProcess();

    return () => {
      cancelled = true;
    };
  }, [dataType, eventKey, matchResultsLoading, matches, lastAutoProcessedSignature]);

  // Create handlers with correct signatures for the components
  const handleStoreTeamsWithEventKey = () => {
    handleStoreTeams(eventKey);
  };

  const handleClearStoredWithEventKey = () => {
    handleClearStored(eventKey);
  };

  return (
    <div className="min-h-screen container mx-auto px-4 pt-12 pb-24 space-y-6 max-w-7xl">
      <div className="text-start">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">API Data</h1>
            <p className="text-muted-foreground">
              Import match schedules, results, and team lists from The Blue Alliance or pit information from Nexus for FRC.
            </p>
          </div>
          {/* Attribution for TBA and Nexus APIs */}
          <div className="hidden md:block">
            <DataAttribution sources={['tba', 'nexus']} variant="full" />
          </div>
        </div>
        <div className="md:hidden mt-2">
          <DataAttribution sources={['tba', 'nexus']} variant="compact" />
        </div>
      </div>

      {/* Configuration Cards - Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Configuration */}
        <div className="lg:col-span-1">
          <EventConfigurationCard
            eventKey={eventKey}
            setEventKey={setEventKey}
            hasStoredData={storedDataExists}
            onClearAllData={handleClearAllEventData}
            clearingData={clearingEventData}
          />
        </div>

        {/* Data Type Selection */}
        <div className="lg:col-span-1">
          <DataTypeSelector
            dataType={dataType}
            setDataType={setDataType}
          />
        </div>
      </div>

      {/* Data Status Card */}
      <DataStatusCard eventKey={eventKey} />

      {/* Data Operations */}
      <DataOperationsCard
        dataType={dataType}
        eventKey={eventKey}
        apiKey={apiKey}
        nexusApiKey={nexusApiKey}
        matchDataLoading={matchDataLoading}
        matchResultsLoading={matchResultsLoading}
        validationLoading={validationLoading}
        eventTeamsLoading={eventTeamsLoading}
        pitDataLoading={pitDataLoading}
        debugNexusLoading={debugNexusLoading}
        onLoadMatchData={handleLoadMatchData}
        onLoadMatchResults={handleLoadMatchResults}
        onLoadValidationData={handleLoadValidationData}
        onLoadEventTeams={handleLoadEventTeams}
        onLoadPitData={handleLoadPitData}
        onDebugNexus={handleDebugNexus}
      />

      {/* Match Data Loader */}
      {dataType === 'match-data' && (
        <MatchDataLoader />
      )}

      {/* Match Results Section */}
      {dataType === 'match-results' && (
        <>
          {processedResults.length > 0 && (
            <ProcessingResults results={processedResults} />
          )}
        </>
      )}

      {/* Match Validation Data Display */}
      {dataType === 'match-validation-data' && (
        <MatchValidationDataDisplay
          matches={validationMatches}
          cacheMetadata={cacheMetadata}
          eventKey={eventKey}
          isOnline={validationOnline}
          cacheExpired={validationCacheExpired}
          onClearCache={() => clearValidationCache(eventKey)}
        />
      )}

      {/* Event Teams Display */}
      {dataType === 'event-teams' && (
        <EventTeamsDisplay
          teams={teams}
          eventKey={eventKey}
          isStored={isStored}
          onStoreTeams={handleStoreTeamsWithEventKey}
          onClearStored={handleClearStoredWithEventKey}
        />
      )}

      {/* Pit Data Display */}
      {dataType === 'pit-data' && (
        <PitDataDisplay
          addresses={pitData.addresses}
          map={pitData.map}
          eventKey={eventKey}
        />
      )}

      {/* Debug Nexus Events Display */}
      {dataType === 'debug-nexus' && nexusEvents && (
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-card">
            <h3 className="text-lg font-semibold mb-4">Available Nexus Events</h3>
            <div className="space-y-2">
              {Object.entries(nexusEvents).map(([eventCode, eventData]) => (
                <div key={eventCode} className="p-3 border rounded bg-muted/50">
                  <div className="font-medium">{eventCode}</div>
                  <div className="text-sm text-muted-foreground">
                    {JSON.stringify(eventData, null, 2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GAME-SPECIFIC: Validation Testing requires game-specific validation logic */}
      {/* {dataType === 'validation-testing' && eventKey && (
        <ValidationTesting eventKey={eventKey} tbaApiKey={apiKey} />
      )} */}

      {/* Event Switch Confirmation Dialog */}
      <EventSwitchConfirmDialog
        open={showEventSwitchDialog}
        onOpenChange={setShowEventSwitchDialog}
        onConfirm={handleConfirmEventSwitch}
        onCancel={handleCancelEventSwitch}
        currentEvent={getCurrentEvent()}
        newEvent={eventKey}
        hasStoredData={getCurrentEvent() ? hasStoredEventData(getCurrentEvent()) : false}
      />
    </div>
  );
};

export default APIDataPage;
