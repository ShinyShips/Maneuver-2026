/**
 * Custom hook for handling automatic import of received data
 * Manages conflict detection, batch review, and database operations
 */

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { detectConflicts, type ConflictInfo } from '@/core/lib/scoutingDataUtils';
import { importPitAssignmentsPayload, type PitAssignmentTransferPayload } from '@/core/lib/pitAssignmentTransfer';
import type { ScoutingEntryBase } from '@/core/types/scouting-entry';
import { debugLog } from '@/core/lib/peerTransferUtils';
import { db, pitDB, saveScoutingEntry } from '@/core/db/database';
import { normalizeTransferredScoutProfile } from '@/core/lib/normalizeTransferredScoutProfile';
import { normalizeTransferredMatchPrediction } from '@/core/lib/normalizeTransferredMatchPrediction';
import { normalizeTransferredScoutAchievement } from '@/core/lib/normalizeTransferredScoutAchievement';
import type { MatchPrediction } from '@/game-template/gamification';
import type { ScoutAchievement } from '@/game-template/gamification';

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

interface ReceivedDataEntry {
    scoutName: string;
    data: unknown;
    timestamp: number;
    dataType?: string;
}

interface ConnectedScout {
    id: string;
    name: string;
    channel?: RTCDataChannel | null;
}

interface UsePeerTransferImportOptions {
    receivedData: ReceivedDataEntry[];
    importedDataCount: number;
    setImportedDataCount: (count: number) => void;
    connectedScouts: ConnectedScout[];
    setRequestingScouts: React.Dispatch<React.SetStateAction<Set<string>>>;
    setBatchReviewEntries: (entries: ScoutingEntryBase[]) => void;
    setPendingConflicts: (conflicts: ConflictInfo[]) => void;
    setShowBatchDialog: (show: boolean) => void;
    setCurrentConflicts: (conflicts: ConflictInfo[]) => void;
    setCurrentConflictIndex: (index: number) => void;
    setConflictResolutions: React.Dispatch<React.SetStateAction<Map<string, 'skip' | 'replace'>>>;
    setShowConflictDialog: (show: boolean) => void;
    setErrorMessage: (message: string) => void;
    setShowErrorDialog: (show: boolean) => void;
}

export function usePeerTransferImport(options: UsePeerTransferImportOptions) {
    const {
        receivedData,
        importedDataCount,
        setImportedDataCount,
        connectedScouts,
        setRequestingScouts,
        setBatchReviewEntries,
        setPendingConflicts,
        setShowBatchDialog,
        setCurrentConflicts,
        setCurrentConflictIndex,
        setConflictResolutions,
        setShowConflictDialog,
        setErrorMessage,
        setShowErrorDialog,
    } = options;

    const importScoutProfiles = useCallback(async (scoutData: { scouts?: unknown[]; predictions?: unknown[]; achievements?: unknown[] }) => {
        const { gamificationDB } = await import('@/game-template/gamification/database');
        let importedCount = 0;

        if (scoutData.scouts && Array.isArray(scoutData.scouts)) {
            const normalizedScouts = scoutData.scouts
                .map((scout) => normalizeTransferredScoutProfile(scout))
                .filter((scout): scout is NonNullable<ReturnType<typeof normalizeTransferredScoutProfile>> => !!scout);
            await gamificationDB.scouts.bulkPut(normalizedScouts as never[]);
            importedCount += normalizedScouts.length;
            console.log(`✅ Imported ${normalizedScouts.length} scouts`);
        }
        if (scoutData.predictions && Array.isArray(scoutData.predictions)) {
            const normalizedPredictions = scoutData.predictions
                .map((prediction) => normalizeTransferredMatchPrediction(prediction))
                .filter((prediction): prediction is MatchPrediction => !!prediction);
            await gamificationDB.predictions.bulkPut(normalizedPredictions as never[]);
            importedCount += normalizedPredictions.length;
            console.log(`✅ Imported ${normalizedPredictions.length} predictions`);
        }
        if (scoutData.achievements && Array.isArray(scoutData.achievements)) {
            const normalizedAchievements = scoutData.achievements
                .map((achievement) => normalizeTransferredScoutAchievement(achievement))
                .filter((achievement): achievement is ScoutAchievement => !!achievement);
            await gamificationDB.scoutAchievements.bulkPut(normalizedAchievements as never[]);
            importedCount += normalizedAchievements.length;
            console.log(`✅ Imported ${normalizedAchievements.length} achievements`);
        }

        return importedCount;
    }, []);

    const importMatchData = useCallback(async (matchData: { matches?: unknown[] }, scoutName: string) => {
        if (matchData.matches && Array.isArray(matchData.matches)) {
            localStorage.setItem('matchData', JSON.stringify(matchData.matches));
            toast.success(`Imported ${matchData.matches.length} matches from ${scoutName}`);
        }
    }, []);

    const importPitScoutingData = useCallback(async (pitData: { entries?: unknown[] }, scoutName: string) => {
        if (pitData.entries && Array.isArray(pitData.entries)) {
            await pitDB.pitScoutingData.bulkPut(pitData.entries as never[]);
            toast.success(`Imported ${pitData.entries.length} pit scouting entries from ${scoutName}`);
        }
    }, []);

    const importScoutingData = useCallback(async (
        newDataWithIds: ScoutingEntryBase[],
        scoutName: string
    ) => {
        console.log('📊 Incoming data count:', newDataWithIds.length);
        console.log('📊 Sample entry:', newDataWithIds[0]);

        // Check if data has the required fields for conflict detection
        const firstEntry = newDataWithIds[0];
        if (firstEntry) {
            console.log('📊 Key fields check:', {
                hasId: !!firstEntry.id,
                hasMatchNumber: 'matchNumber' in firstEntry,
                hasTeamNumber: 'teamNumber' in firstEntry,
                hasAlliance: 'allianceColor' in firstEntry,
                hasEventKey: 'eventKey' in firstEntry,
            });
        }

        // Check local database before conflict detection
        const localCount = await db.scoutingData.count();
        console.log('📊 Local database count BEFORE import:', localCount);

        // Detect conflicts
        debugLog('🔍 Starting conflict detection...');
        const conflictStartTime = performance.now();
        const conflictResult = await detectConflicts(newDataWithIds);
        const conflictEndTime = performance.now();
        debugLog(`⏱️ Conflict detection took ${(conflictEndTime - conflictStartTime).toFixed(2)}ms`);

        console.log('📊 Conflict detection results:', {
            autoImport: conflictResult.autoImport.length,
            autoReplace: conflictResult.autoReplace.length,
            batchReview: conflictResult.batchReview.length,
            conflicts: conflictResult.conflicts.length
        });

        const results = { added: 0, replaced: 0, conflictsToReview: 0 };

        // Auto-import: Save new entries
        if (conflictResult.autoImport.length > 0) {
            for (const entry of conflictResult.autoImport) {
                await saveScoutingEntry(entry);
            }
            results.added = conflictResult.autoImport.length;
        }

        if (conflictResult.autoReplace.length > 0) {
            for (const entry of conflictResult.autoReplace) {
                // ScoutingEntryBase has flat structure - fields are directly on entry
                const matchNumber = entry.matchNumber;
                const teamNumber = entry.teamNumber;
                const alliance = entry.allianceColor;
                const eventKey = entry.eventKey;

                const existing = await db.scoutingData
                    .toArray()
                    .then((entries: ScoutingEntryBase[]) => entries.find(e =>
                        e.matchNumber === matchNumber &&
                        e.teamNumber === teamNumber &&
                        e.allianceColor === alliance &&
                        e.eventKey === eventKey
                    ));

                if (existing) {
                    await db.scoutingData.delete(existing.id);
                }
                await saveScoutingEntry(entry);
            }
            results.replaced = conflictResult.autoReplace.length;
        }

        // Batch review: Let user decide on duplicates
        if (conflictResult.batchReview.length > 0) {
            debugLog('📋 Showing batch review dialog for duplicates');
            setBatchReviewEntries(conflictResult.batchReview);
            setPendingConflicts(conflictResult.conflicts);
            setShowBatchDialog(true);

            toast.success(
                `Imported ${results.added} new entries, ` +
                `Replaced ${results.replaced} existing entries. ` +
                `${conflictResult.batchReview.length} duplicates need review.`
            );
            return { needsUserAction: true };
        }

        // Conflicts: Store for user resolution
        if (conflictResult.conflicts.length > 0) {
            debugLog('⚠️ Showing conflict resolution dialog');
            results.conflictsToReview = conflictResult.conflicts.length;
            setCurrentConflicts(conflictResult.conflicts);
            setCurrentConflictIndex(0);
            setConflictResolutions(new Map());

            toast.success(
                `Imported ${results.added} new entries, ` +
                `Replaced ${results.replaced} existing entries. ` +
                `${results.conflictsToReview} conflicts need review.`
            );

            setShowConflictDialog(true);
            return { needsUserAction: true };
        }

        // No conflicts - success
        console.log(`✅ SUCCESS: Imported ${scoutName}'s data (${newDataWithIds.length} entries) into database`);

        // Check if everything was skipped as duplicates
        const totalProcessed = results.added + results.replaced + results.conflictsToReview;
        const skippedCount = newDataWithIds.length - totalProcessed;

        if (skippedCount > 0 && totalProcessed === 0) {
            toast.info(`All ${skippedCount} entries from ${scoutName} already exist (skipped as duplicates)`);
        } else if (skippedCount > 0) {
            toast.success(`Import complete! ${results.added} new, ${results.replaced} replaced, ${skippedCount} duplicates skipped.`);
        } else {
            toast.success(`Import complete! ${results.added} new entries, ${results.replaced} entries replaced.`);
        }

        return { needsUserAction: false };
    }, [setBatchReviewEntries, setPendingConflicts, setShowBatchDialog, setCurrentConflicts, setCurrentConflictIndex, setConflictResolutions, setShowConflictDialog]);

    // Auto-import effect
    useEffect(() => {
        // Only import new data that hasn't been imported yet
        if (receivedData.length > importedDataCount) {
            debugLog('✅ Condition met, starting import...');
            const latest = receivedData[receivedData.length - 1];

            // Guard against undefined
            if (!latest) {
                setImportedDataCount(receivedData.length);
                return;
            }

            // Check if this is a special message type (not actual data to import)
            const messageData = latest.data as { type?: string; dataType?: string; entries?: ScoutingEntryBase[] };

            if (messageData.type === 'declined') {
                toast.error(`${latest.scoutName} declined the data request`);
                setImportedDataCount(receivedData.length);
                return;
            }

            if (messageData.type === 'push-declined') {
                const dataTypeLabel = messageData.dataType || 'data';
                toast.warning(`${latest.scoutName} declined pushed ${dataTypeLabel}`);
                setImportedDataCount(receivedData.length);
                return;
            }

            if (messageData.type === 'pushed') {
                // This is a push confirmation for history tracking only, not actual received data
                // Just update the counter and skip import
                debugLog(`✅ Push confirmation logged for ${latest.scoutName}`);
                setImportedDataCount(receivedData.length);
                return;
            }

            // Now we know it's actual data, check what type it is
            const receivedDataObj = latest.data;
            const receivedDataType = (latest as { dataType?: string }).dataType;

            console.log(`✅ Received data from ${latest.scoutName}, type: ${receivedDataType}:`, receivedDataObj);
            console.log('Received data size:', getSafeJsonSize(receivedDataObj), 'characters');

            // Clear requesting state for this scout
            const scoutId = connectedScouts.find(s => s.name === latest.scoutName)?.id;
            if (scoutId) {
                setRequestingScouts(prev => {
                    const next = new Set(prev);
                    next.delete(scoutId);
                    return next;
                });
            }

            // Import data into database based on type
            const importData = async () => {
                debugLog(`📥 Attempting to import ${receivedDataType} data from ${latest.scoutName}...`);
                try {
                    // Handle different data types
                    if (receivedDataType === 'scout') {
                        const scoutData = receivedDataObj as { scouts?: unknown[]; predictions?: unknown[]; achievements?: unknown[] };
                        const importedCount = await importScoutProfiles(scoutData);

                        if (importedCount > 0) {
                            toast.success(`Imported ${importedCount} scout profile items from ${latest.scoutName}`);
                        } else {
                            toast.warning(`No scout profile data to import from ${latest.scoutName}`);
                        }
                        setImportedDataCount(receivedData.length);
                        return;
                    }

                    if (receivedDataType === 'match') {
                        await importMatchData(receivedDataObj as { matches?: unknown[] }, latest.scoutName);
                        setImportedDataCount(receivedData.length);
                        return;
                    }

                    if (receivedDataType === 'pit-scouting') {
                        await importPitScoutingData(receivedDataObj as { entries?: unknown[] }, latest.scoutName);
                        setImportedDataCount(receivedData.length);
                        return;
                    }

                    if (receivedDataType === 'pit-assignments') {
                        const currentScout = localStorage.getItem('currentScout') || '';
                        if (!currentScout.trim()) {
                            toast.error('Select a scout profile before importing pit assignments');
                            setImportedDataCount(receivedData.length);
                            return;
                        }

                        const result = importPitAssignmentsPayload(
                            receivedDataObj as PitAssignmentTransferPayload,
                            currentScout,
                            'merge',
                        );

                        if (result.strategy === 'cancel') {
                            toast.info(`Skipped pit assignments from ${latest.scoutName}`);
                        } else {
                            toast.success(`Imported ${result.importedCount} pit assignments from ${latest.scoutName}`);
                        }

                        setImportedDataCount(receivedData.length);
                        return;
                    }

                    // Handle scouting data and combined
                    const scoutingDataObj = receivedDataObj as {
                        entries?: ScoutingEntryBase[];
                        scoutProfiles?: { scouts?: unknown[]; predictions?: unknown[] }
                    };

                    const newDataWithIds = scoutingDataObj.entries;

                    if (!newDataWithIds) {
                        console.error('No valid entries found in received data');
                        toast.error(`Invalid data structure from ${latest.scoutName}`);
                        setImportedDataCount(receivedData.length);
                        return;
                    }

                    // If this is combined data, also import scout profiles
                    if (receivedDataType === 'combined' && scoutingDataObj.scoutProfiles) {
                        const profileCount = await importScoutProfiles(scoutingDataObj.scoutProfiles);
                        console.log(`✅ Combined data: imported ${profileCount} profile items`);
                    }

                    // Import scouting entries
                    const result = await importScoutingData(newDataWithIds, latest.scoutName);
                    if (!result.needsUserAction) {
                        setImportedDataCount(receivedData.length);
                    } else {
                        setImportedDataCount(receivedData.length);
                    }
                } catch (err) {
                    console.error(`❌ FAILED to import data from ${latest.scoutName}:`, err);
                    setErrorMessage(`Failed to import data from ${latest.scoutName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    setShowErrorDialog(true);
                }
            };

            importData();
        }
    }, [
        receivedData,
        importedDataCount,
        connectedScouts,
        setImportedDataCount,
        setRequestingScouts,
        importScoutProfiles,
        importMatchData,
        importPitScoutingData,
        importScoutingData,
        setErrorMessage,
        setShowErrorDialog,
    ]);
}
