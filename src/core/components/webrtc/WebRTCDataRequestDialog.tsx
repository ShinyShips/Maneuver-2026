/**
 * Global WebRTC Data Request Dialog
 * Shows a popup when the lead requests data, regardless of which page the scout is on
 */

import { useState } from 'react';
import { Download, Filter, Info } from 'lucide-react';
import { useWebRTC } from '@/core/contexts/WebRTCContext';
import { buildPitAssignmentsTransferPayload } from '@/core/lib/pitAssignmentTransfer';
import { loadScoutingData } from '@/core/lib/scoutingDataUtils';
import { loadPitScoutingData } from '@/core/lib/pitScoutingUtils';
import { gamificationDB as gameDB } from '@/game-template/gamification';
import { applyFilters, filterPitScoutingEntries, filterScoutProfilePayload, formatTransferMatchLabel } from '@/core/lib/dataFiltering';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core/components/ui/alert-dialog';

export function WebRTCDataRequestDialog() {
  const context = useWebRTC();
  const { dataRequested, setDataRequested, sendData, requestFilters, requestDataType } = context;
  const [transferStatus, setTransferStatus] = useState<string>('');

  const getSafeJsonSize = (value: unknown): number => {
    const seen = new WeakSet<object>();
    const serialized = JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === 'object' && currentValue !== null) {
        if (seen.has(currentValue)) return '[Circular]';
        seen.add(currentValue);
      }
      return currentValue;
    });
    return serialized?.length ?? 0;
  };

  const getDataTypeLabel = (dataType: string | null) => {
    switch (dataType) {
      case 'scouting': return 'Scouting Data';
      case 'pit-scouting': return 'Pit Scouting Data';
      case 'pit-assignments': return 'Pit Assignments';
      case 'match': return 'Match Schedule';
      case 'scout': return 'Scout Profiles';
      case 'combined': return 'Combined Data';
      default: return 'Data';
    }
  };

  const handleAcceptRequest = async () => {
    setTransferStatus(`Loading ${getDataTypeLabel(requestDataType)}...`);
    try {
      let data: any;
      let originalCount = 0;

      // Load data based on requested type
      switch (requestDataType) {
        case 'scouting': {
          let scoutingData = await loadScoutingData();
          originalCount = scoutingData.length;

          // Apply filters if provided
          if (requestFilters) {
            console.log('📋 Applying filters to scouting data:', requestFilters);
            setTransferStatus(`Filtering ${originalCount} entries...`);
            const filteredData = applyFilters({ entries: scoutingData, exportedAt: Date.now(), version: '1.0' }, requestFilters);
            scoutingData = filteredData.entries as typeof scoutingData;
            console.log(`🔍 Filtered: ${originalCount} entries → ${scoutingData.length} entries`);
          }

          data = { entries: scoutingData };
          break;
        }

        case 'pit-scouting': {
          let pitData = await loadPitScoutingData();
          originalCount = pitData.entries?.length || 0;
          if (requestFilters) {
            pitData = {
              ...pitData,
              entries: filterPitScoutingEntries(pitData.entries, requestFilters)
            };
          }
          data = pitData;
          console.log('📊 Loaded pit scouting data:', originalCount, 'entries');
          break;
        }

        case 'pit-assignments': {
          const eventKey = localStorage.getItem('eventKey') || localStorage.getItem('eventName') || '';
          const sourceScoutName = localStorage.getItem('currentScout') || 'Scout';

          if (!eventKey) {
            throw new Error('No active event found for pit assignment transfer');
          }

          data = buildPitAssignmentsTransferPayload(eventKey, sourceScoutName);
          originalCount = data.assignments.length;
          console.log('📊 Loaded pit assignments:', originalCount, 'assignments');
          break;
        }

        case 'match': {
          const matchDataStr = localStorage.getItem('matchData');
          const matches = matchDataStr ? JSON.parse(matchDataStr) : [];
          originalCount = Array.isArray(matches) ? matches.length : 0;
          data = { matches };
          console.log('📊 Loaded match data:', originalCount, 'matches');
          break;
        }

        case 'scout': {
          const scouts = await gameDB.scouts.toArray();
          const predictions = await gameDB.predictions.toArray();
          const achievements = await gameDB.scoutAchievements.toArray();
          originalCount = scouts.length;
          data = requestFilters
            ? filterScoutProfilePayload({ scouts, predictions, achievements }, requestFilters)
            : { scouts, predictions, achievements };
          console.log('📊 Loaded scout profiles:', scouts.length, 'scouts,', predictions.length, 'predictions');
          break;
        }

        case 'combined': {
          let scoutingData = await loadScoutingData();
          const scouts = await gameDB.scouts.toArray();
          const predictions = await gameDB.predictions.toArray();

          // Apply filters to scouting data if provided
          if (requestFilters) {
            const origScoutingCount = scoutingData.length;
            console.log('📋 Applying filters to combined scouting data:', requestFilters);
            const filteredData = applyFilters({ entries: scoutingData, exportedAt: Date.now(), version: '1.0' }, requestFilters);
            scoutingData = filteredData.entries as typeof scoutingData;
            console.log(`📊 Filtered scouting: ${origScoutingCount} → ${scoutingData.length} entries`);
          }

          const filteredScoutProfiles = requestFilters
            ? filterScoutProfilePayload({ scouts, predictions }, requestFilters)
            : { scouts, predictions, achievements: [] };

          data = {
            entries: scoutingData,
            metadata: {
              exportedAt: new Date().toISOString(),
              version: "1.0",
              scoutingEntriesCount: scoutingData.length,
              scoutsCount: filteredScoutProfiles.scouts.length,
              predictionsCount: filteredScoutProfiles.predictions.length
            },
            scoutProfiles: {
              scouts: filteredScoutProfiles.scouts,
              predictions: filteredScoutProfiles.predictions
            }
          };
          originalCount = scoutingData.length + scouts.length + predictions.length;
          console.log('📊 Loaded combined data');
          break;
        }

        default:
          throw new Error(`Unknown data type: ${requestDataType}`);
      }

      const dataSize = getSafeJsonSize(data);
      console.log('Scout sending data:', data);
      console.log('Data size:', dataSize, 'characters');

      setTransferStatus(`Sending ${getDataTypeLabel(requestDataType)}...`);
      await sendData(data, requestDataType);

      // Show success
      setTransferStatus(`✅ Sent ${getDataTypeLabel(requestDataType)}`);

      setTimeout(() => {
        setTransferStatus('');
        setDataRequested(false);
      }, 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to load/send data:', err);
      setTransferStatus(`❌ Error: ${errorMsg}`);
      setTimeout(() => {
        setTransferStatus('');
        setDataRequested(false);
      }, 5000);
    }
  };

  const handleDecline = () => {
    // Send decline message to lead
    context.sendControlMessage({ type: 'request-declined' });

    setDataRequested(false);
    setTransferStatus('');
  };

  // Generate filter description
  const getFilterDescription = () => {
    if (!requestFilters) return 'All data';

    const parts: string[] = [];
    const eventFilter = requestFilters.events ?? { selectedEvents: [], includeAll: true };
    const scoutFilter = requestFilters.scouts ?? { selectedScouts: [], includeAll: true };

    // Match range
    if (requestFilters.matchRange.type === 'preset' && requestFilters.matchRange.preset !== 'all') {
      const presetLabels = {
        'last10': 'Last 10 matches',
        'last15': 'Last 15 matches',
        'last30': 'Last 30 matches',
        'fromLastExport': 'From last export'
      };
      parts.push(presetLabels[requestFilters.matchRange.preset as keyof typeof presetLabels] || 'Custom range');
    } else if (requestFilters.matchRange.type === 'custom') {
      const startLabel = requestFilters.matchRange.customStartKey
        ? formatTransferMatchLabel(requestFilters.matchRange.customStartKey)
        : requestFilters.matchRange.customStart || '?';
      const endLabel = requestFilters.matchRange.customEndKey
        ? formatTransferMatchLabel(requestFilters.matchRange.customEndKey)
        : requestFilters.matchRange.customEnd || '?';
      parts.push(`Matches ${startLabel}-${endLabel}`);
    }

    // Teams
    if (!requestFilters.teams.includeAll && requestFilters.teams.selectedTeams.length > 0) {
      parts.push(`${requestFilters.teams.selectedTeams.length} teams`);
    }

    if (!scoutFilter.includeAll && scoutFilter.selectedScouts.length > 0) {
      parts.push(`${scoutFilter.selectedScouts.length} scouts`);
    }

    // Events
    if (!eventFilter.includeAll && eventFilter.selectedEvents.length > 0) {
      if (eventFilter.selectedEvents.length === 1) {
        parts.push(`Event ${eventFilter.selectedEvents[0]}`);
      } else {
        parts.push(`${eventFilter.selectedEvents.length} events`);
      }
    }

    return parts.length > 0 ? parts.join(' • ') : 'All data';
  };

  // Debug: log when dialog opens
  // console.log('🔍 Dialog state - dataRequested:', dataRequested, 'requestFilters:', requestFilters);

  return (
    <>
      <AlertDialog open={dataRequested && !transferStatus}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Data Request from Lead Scout
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>The lead scout is requesting data from you.</p>

              {/* Data Type Info */}
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium text-blue-900 dark:text-blue-100 text-sm">
                      {getDataTypeLabel(requestDataType)}
                    </span>
                    {requestDataType === 'combined' && (
                      <span className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                        Includes scouting data and scout profiles
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Filter Info */}
              {requestFilters && (
                <div className="flex items-center gap-2 text-sm bg-amber-50 dark:bg-amber-950 p-3 rounded border border-amber-200 dark:border-amber-800">
                  <Filter className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <div className="flex flex-col">
                    <span className="font-medium text-amber-900 dark:text-amber-100">Filter Request</span>
                    <span className="text-xs text-amber-700 dark:text-amber-300">{getFilterDescription()}</span>
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Send your data to the lead scout?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDecline} className='p-2'>Decline</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcceptRequest} className='p-2'>Send Data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer status overlay - shows what's being sent */}
      <AlertDialog open={!!transferStatus}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Sending Data
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="text-center py-2 text-lg">
                {transferStatus}
              </div>
              {requestFilters && transferStatus.includes('Loading') && (
                <div className="text-xs bg-muted p-2 rounded">
                  <Filter className="h-3 w-3 inline mr-1" />
                  Filtering: {getFilterDescription()}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
