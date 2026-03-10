/**
 * Global WebRTC Pushed Data Dialog
 * Shows a popup when the lead pushes data to the scout
 */

import { useState } from 'react';
import { Upload, Info } from 'lucide-react';
import { useWebRTC } from '@/core/contexts/WebRTCContext';
import {
  hasPitAssignmentImportConflict,
  importPitAssignmentsPayload,
  type PitAssignmentImportStrategy,
  type PitAssignmentTransferPayload,
} from '@/core/lib/pitAssignmentTransfer';
import { pitDB, saveScoutingEntries } from '@/core/db/database';
import { gamificationDB as gameDB } from '@/game-template/gamification';
import { normalizeTransferredScoutProfile } from '@/core/lib/normalizeTransferredScoutProfile';
import { normalizeTransferredMatchPrediction } from '@/core/lib/normalizeTransferredMatchPrediction';
import { normalizeTransferredScoutAchievement } from '@/core/lib/normalizeTransferredScoutAchievement';
import { toast } from 'sonner';
import { Button } from '@/core/components/ui/button';
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

export function WebRTCPushedDataDialog() {
  const context = useWebRTC();
  const { dataPushed, setDataPushed, pushedData, pushedDataType, sendControlMessage } = context;
  const [importStatus, setImportStatus] = useState<string>('');
  const [pitImportChoiceOpen, setPitImportChoiceOpen] = useState(false);

  const isImportStrategy = (value: unknown): value is PitAssignmentImportStrategy => {
    return value === 'replace' || value === 'merge' || value === 'cancel';
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

  const getDataSummary = () => {
    if (!pushedData) return 'No data';

    try {
      const data = pushedData as any;
      const parts: string[] = [];

      if (pushedDataType === 'combined') {
        // Combined data structure (scouting + scout profiles)
        if (data.entries) parts.push(`${data.entries.length} scouting entries`);
        if (data.scoutProfiles?.scouts) parts.push(`${data.scoutProfiles.scouts.length} scouts`);
        if (data.scoutProfiles?.predictions) parts.push(`${data.scoutProfiles.predictions.length} predictions`);
      } else if (pushedDataType === 'scouting' || pushedDataType === 'pit-scouting') {
        // Scouting or pit data - wrapped format with entries
        if (data.entries && Array.isArray(data.entries)) {
          parts.push(`${data.entries.length} entries`);
        }
      } else if (pushedDataType === 'pit-assignments') {
        if (data.assignments && Array.isArray(data.assignments)) {
          parts.push(`${data.assignments.length} assignments`);
        }
        if (data.eventKey) {
          parts.push(`event ${data.eventKey}`);
        }
      } else if (pushedDataType === 'match') {
        // Match data
        if (data.matches) parts.push(`${Array.isArray(data.matches) ? data.matches.length : 0} matches`);
      } else if (pushedDataType === 'scout') {
        // Scout profile data
        if (data.scouts) parts.push(`${Array.isArray(data.scouts) ? data.scouts.length : 0} scouts`);
        if (data.predictions) parts.push(`${Array.isArray(data.predictions) ? data.predictions.length : 0} predictions`);
      }

      return parts.length > 0 ? parts.join(', ') : 'Unknown data structure';
    } catch (err) {
      console.error('Error parsing pushed data:', err);
      return 'Error reading data';
    }
  };

  const handleAcceptPushedData = async (pitStrategy?: unknown) => {
    const resolvedPitStrategy: PitAssignmentImportStrategy | undefined = isImportStrategy(pitStrategy)
      ? pitStrategy
      : undefined;
    setImportStatus('Importing data...');
    try {
      let importedCount = 0;

      console.log('📦 Pushed data type:', pushedDataType);
      console.log('📦 Pushed data:', pushedData);

      if (pushedDataType === 'combined') {
        // Import combined data (scouting + scout profiles)
        const data = pushedData as any;

        console.log('📦 Combined data structure:', {
          hasEntries: !!data.entries,
          entriesIsArray: Array.isArray(data.entries),
          entriesLength: data.entries?.length,
          hasScoutProfiles: !!data.scoutProfiles
        });

        // Import scouting data
        if (data.entries && Array.isArray(data.entries)) {
          await saveScoutingEntries(data.entries);
          importedCount += data.entries.length;
          console.log('✅ Imported', data.entries.length, 'scouting entries');
        } else {
          console.warn('⚠️ No scouting entries to import or entries is not an array');
        }

        // Import scout profiles
        if (data.scoutProfiles) {
          if (data.scoutProfiles.scouts && Array.isArray(data.scoutProfiles.scouts)) {
            let importedScoutCount = 0;
            for (const scout of data.scoutProfiles.scouts) {
              const normalizedScout = normalizeTransferredScoutProfile(scout);
              if (!normalizedScout) continue;
              await gameDB.scouts.put(normalizedScout as never);
              importedScoutCount += 1;
            }
            importedCount += importedScoutCount;
            console.log('✅ Imported', importedScoutCount, 'scout profiles');
          }

          // Import predictions
          if (data.scoutProfiles.predictions && Array.isArray(data.scoutProfiles.predictions)) {
            let importedPredictionCount = 0;
            for (const prediction of data.scoutProfiles.predictions) {
              const normalizedPrediction = normalizeTransferredMatchPrediction(prediction);
              if (!normalizedPrediction) continue;
              await gameDB.predictions.put(normalizedPrediction as never);
              importedPredictionCount += 1;
            }
            console.log('✅ Imported', importedPredictionCount, 'predictions');
          }
        }

      } else if (pushedDataType === 'scouting') {
        // Import scouting data - wrapped format with entries
        const data = pushedData as { entries?: any[]; version?: string; exportedAt?: number };
        const entries = data.entries;

        if (!entries || !Array.isArray(entries)) {
          console.error('❌ No entries array in scouting data:', data);
          throw new Error('Scouting data must contain entries array');
        }

        if (entries.length === 0) {
          console.warn('⚠️ No scouting entries to import (empty array)');
          toast.info('No scouting data to import');
        } else {
          console.log('🔄 Saving', entries.length, 'scouting entries...');

          // Check if entries are valid
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (!entry) {
              throw new Error(`Entry at index ${i} is null or undefined`);
            }
            if (!entry.id) {
              throw new Error(`Entry at index ${i} missing id: ${JSON.stringify(entry).substring(0, 100)}`);
            }
            // maneuver-core uses gameData, not data
            if (!entry.gameData) {
              throw new Error(`Entry at index ${i} missing gameData property: ${JSON.stringify(entry).substring(0, 100)}`);
            }
          }

          await saveScoutingEntries(entries);
          importedCount = entries.length;
          console.log('✅ Imported', importedCount, 'scouting entries');
        }

      } else if (pushedDataType === 'pit-scouting') {
        // Import pit scouting data - wrapped format with entries
        const data = pushedData as { entries?: any[]; version?: string; exportedAt?: number };
        const entries = data.entries;

        if (entries && Array.isArray(entries)) {
          for (const entry of entries) {
            await pitDB.pitScoutingData.put(entry);
          }
          importedCount = entries.length;
          console.log('✅ Imported', importedCount, 'pit scouting entries');
        }

      } else if (pushedDataType === 'pit-assignments') {
        const currentScoutName = localStorage.getItem('currentScout') || '';
        if (!currentScoutName.trim()) {
          throw new Error('Select a scout profile before importing pit assignments');
        }

        const payload = pushedData as PitAssignmentTransferPayload;
        if (!resolvedPitStrategy && hasPitAssignmentImportConflict(payload)) {
          setImportStatus('');
          setPitImportChoiceOpen(true);
          return;
        }

        const result = importPitAssignmentsPayload(payload, currentScoutName, resolvedPitStrategy);

        if (result.strategy === 'cancel') {
          setImportStatus('Import canceled');
          setTimeout(() => {
            setImportStatus('');
            setDataPushed(false);
          }, 1200);
          return;
        }

        importedCount = result.importedCount;
        console.log('✅ Imported pit assignments:', result);

      } else if (pushedDataType === 'match') {
        // Import match data
        const data = pushedData as any;
        if (data.matches && Array.isArray(data.matches)) {
          localStorage.setItem('matchData', JSON.stringify(data.matches));
          importedCount = data.matches.length;
          console.log('✅ Imported', importedCount, 'matches');
        }

      } else if (pushedDataType === 'scout') {
        // Import scout profile data
        const data = pushedData as any;
        if (data.scouts && Array.isArray(data.scouts)) {
          let importedScoutCount = 0;
          for (const scout of data.scouts) {
            const normalizedScout = normalizeTransferredScoutProfile(scout);
            if (!normalizedScout) continue;
            await gameDB.scouts.put(normalizedScout as never);
            importedScoutCount += 1;
          }
          importedCount = importedScoutCount;
          console.log('✅ Imported', importedCount, 'scout profiles');
        }
        if (data.predictions && Array.isArray(data.predictions)) {
          let importedPredictionCount = 0;
          for (const prediction of data.predictions) {
            const normalizedPrediction = normalizeTransferredMatchPrediction(prediction);
            if (!normalizedPrediction) continue;
            await gameDB.predictions.put(normalizedPrediction as never);
            importedPredictionCount += 1;
          }
          console.log('✅ Imported', importedPredictionCount, 'predictions');
        }
        if (data.achievements && Array.isArray(data.achievements)) {
          let importedAchievementCount = 0;
          for (const achievement of data.achievements) {
            const normalizedAchievement = normalizeTransferredScoutAchievement(achievement);
            if (!normalizedAchievement) continue;
            await gameDB.scoutAchievements.put(normalizedAchievement as never);
            importedAchievementCount += 1;
          }
          console.log('✅ Imported', importedAchievementCount, 'achievements');
        }
      }

      setImportStatus(`✅ Successfully imported ${getDataTypeLabel(pushedDataType)}`);
      toast.success(`Imported ${getDataTypeLabel(pushedDataType)}`);

      setTimeout(() => {
        setImportStatus('');
        setDataPushed(false);
      }, 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to import pushed data:', err);
      setImportStatus(`❌ Error: ${errorMsg}`);
      toast.error(`Failed to import: ${errorMsg}`);
      setTimeout(() => {
        setImportStatus('');
        setDataPushed(false);
      }, 5000);
    }
  };

  const handleDecline = () => {
    console.log('Scout declined pushed data');

    // Send decline message to lead
    sendControlMessage({
      type: 'push-declined',
      dataType: pushedDataType
    });

    toast.info('Declined data from lead');
    setDataPushed(false);
    setImportStatus('');
    setPitImportChoiceOpen(false);
  };

  const handlePitImportChoice = (strategy: PitAssignmentImportStrategy) => {
    setPitImportChoiceOpen(false);
    void handleAcceptPushedData(strategy);
  };

  return (
    <>
      <AlertDialog open={dataPushed && !importStatus && !pitImportChoiceOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Lead Scout is Pushing Data
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>The lead scout wants to send you data.</p>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      {getDataTypeLabel(pushedDataType)}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {getDataSummary()}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Accepting will import this data now. Pit assignments will prompt you to replace or merge when needed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDecline} className='p-2'>Decline</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void handleAcceptPushedData(); }} className='p-2'>Accept & Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import status overlay */}
      <AlertDialog open={!!importStatus}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importing Data
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="text-center py-2 text-lg">
                {importStatus}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pitImportChoiceOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Pit Assignments Already Exist</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You already have pit assignments for this event.</p>
              <p>Choose how to import incoming assignments:</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button className="p-2" onClick={() => handlePitImportChoice('replace')}>Replace</Button>
            <Button variant="secondary" className="p-2" onClick={() => handlePitImportChoice('merge')}>Merge</Button>
            <Button variant="outline" className="p-2" onClick={() => handlePitImportChoice('cancel')}>Cancel</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
