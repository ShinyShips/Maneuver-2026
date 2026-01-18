/**
 * QR Data Transfer Page
 * Framework component - game-agnostic
 * 
 * Uses fountain codes for reliable QR-based data transfer.
 * Supports multiple data types with conflict resolution.
 */

import { useState, useCallback } from "react";
import { Button } from "@/core/components/ui/button";
import { Separator } from "@/core/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { UniversalFountainGenerator } from "@/core/components/data-transfer/UniversalFountainGenerator";
import { UniversalFountainScanner } from "@/core/components/data-transfer/UniversalFountainScanner";
import { exportScoutingData } from "@/core/db/database";
import { loadPitScoutingData } from "@/core/lib/pitScoutingUtils";
import { pitDB } from "@/core/db/database";
import { gamificationDB } from "@/game-template/gamification/database";
import { handleScoutingDataUpload } from "@/core/lib/uploadHandlers/scoutingDataUploadHandler";
import { useConflictResolution } from "@/core/hooks/useConflictResolution";
import ConflictResolutionDialog from "@/core/components/data-transfer/ConflictResolutionDialog";
import { BatchConflictDialog } from "@/core/components/data-transfer/BatchConflictDialog";
import type { ScoutingEntryBase } from "@/core/types/scouting-entry";
import type { ConflictInfo } from "@/core/lib/scoutingDataUtils";
import { toast } from "sonner";

type DataType = 'scouting' | 'match' | 'scout' | 'combined' | 'pit-scouting';

interface DataTypeConfig {
    loadData: () => Promise<unknown>;
    saveData: (data: unknown) => Promise<void>;
    validateData: (data: unknown) => boolean;
    getDataSummary: (data: unknown) => string;
    title: string;
    description: string;
    noDataMessage: string;
    completionMessage: string;
    expectedPacketType: string;
}

const QRDataTransferPage = () => {
    const [mode, setMode] = useState<'select' | 'generate' | 'scan'>('select');
    const [dataType, setDataType] = useState<DataType>('scouting');

    // Batch review state (for scouting data conflicts)
    const [showBatchDialog, setShowBatchDialog] = useState(false);
    const [batchReviewEntries, setBatchReviewEntries] = useState<ScoutingEntryBase[]>([]);
    const [pendingConflicts, setPendingConflicts] = useState<ConflictInfo[]>([]);

    // Use conflict resolution hook
    const {
        showConflictDialog,
        setShowConflictDialog,
        currentConflicts,
        setCurrentConflicts,
        currentConflictIndex,
        setCurrentConflictIndex,
        setConflictResolutions,
        handleConflictResolution: handleConflictResolutionBase,
        handleBatchResolve: handleBatchResolveBase,
        handleUndo,
        canUndo,
        handleBatchReviewDecision: handleBatchReviewDecisionBase
    } = useConflictResolution();

    // Wrapper for conflict resolution
    const handleConflictResolution = async (action: 'replace' | 'skip') => {
        await handleConflictResolutionBase(action);

        // Check if all conflicts are resolved
        if (currentConflictIndex >= currentConflicts.length - 1) {
            // Go back to select mode after all conflicts resolved
            setMode('select');
        }
    };

    // Wrapper for batch resolve
    const handleBatchResolve = async (action: 'replace' | 'skip') => {
        await handleBatchResolveBase(action);
        setMode('select');
    };

    // Wrapper for batch review decision
    const handleBatchReviewDecision = async (decision: 'replace-all' | 'skip-all' | 'review-each') => {
        const result = await handleBatchReviewDecisionBase(batchReviewEntries, pendingConflicts, decision);

        if (!result.hasMoreConflicts) {
            setShowBatchDialog(false);
            setBatchReviewEntries([]);
            setPendingConflicts([]);
            setMode('select');
        } else {
            // Move to individual conflict dialog
            setShowBatchDialog(false);
        }
    };

    // Save scouting data with conflict detection
    const saveScoutingDataWithConflicts = useCallback(async (data: unknown) => {
        const scoutingData = data as { entries?: ScoutingEntryBase[]; version?: string; exportedAt?: number };

        if (!scoutingData.entries || !Array.isArray(scoutingData.entries)) {
            toast.error("Invalid scouting data format");
            return;
        }

        // Use smart-merge mode with conflict detection
        const result = await handleScoutingDataUpload(
            {
                entries: scoutingData.entries,
                version: scoutingData.version || '3.0-maneuver-core',
                exportedAt: scoutingData.exportedAt || Date.now()
            },
            'smart-merge'
        );

        // Check if there are batch review entries first
        if (result.hasBatchReview && result.batchReviewEntries) {
            setBatchReviewEntries(result.batchReviewEntries);
            setPendingConflicts(result.conflicts || []);
            setShowBatchDialog(true);
            return;
        }

        // Check if there are conflicts to resolve
        if (result.hasConflicts && result.conflicts) {
            setCurrentConflicts(result.conflicts);
            setCurrentConflictIndex(0);
            setConflictResolutions(new Map());
            setShowConflictDialog(true);
            return;
        }

        // No conflicts - success, go back to select
        setMode('select');
    }, [setCurrentConflicts, setCurrentConflictIndex, setConflictResolutions, setShowConflictDialog]);

    // Configuration for each data type
    const dataTypeConfigs: Record<DataType, DataTypeConfig> = {
        'scouting': {
            loadData: async () => {
                return await exportScoutingData();
            },
            saveData: saveScoutingDataWithConflicts,
            validateData: (data: unknown): boolean => {
                const scoutingData = data as { entries?: unknown[] };
                return !!(scoutingData.entries && Array.isArray(scoutingData.entries));
            },
            getDataSummary: (data: unknown) => {
                const scoutingData = data as { entries?: unknown[] };
                return `${scoutingData.entries?.length || 0} scouting entries`;
            },
            title: 'Scouting Data',
            description: 'Transfer match scouting data between devices',
            noDataMessage: 'No scouting data found. Scout some matches first!',
            completionMessage: 'Scouting data imported successfully!',
            expectedPacketType: 'scouting_fountain_packet'
        },
        'pit-scouting': {
            loadData: async () => {
                const data = await loadPitScoutingData();
                // Strip images for QR transfer to keep payload small
                const textOnlyEntries = data.entries.map(entry => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { robotPhoto, ...rest } = entry;
                    return rest;
                });

                return {
                    entries: textOnlyEntries,
                    version: '3.0-maneuver-core',
                    exportedAt: Date.now()
                };
            },
            saveData: async (data: unknown) => {
                const pitData = data as { entries?: unknown[] };
                if (pitData.entries && Array.isArray(pitData.entries)) {
                    await pitDB.pitScoutingData.bulkPut(pitData.entries as never[]);
                    toast.success(`Successfully imported ${pitData.entries.length} pit scouting entries`);
                }
            },
            validateData: (data: unknown): boolean => {
                const pitData = data as { entries?: unknown[] };
                return !!(pitData.entries && Array.isArray(pitData.entries));
            },
            getDataSummary: (data: unknown) => {
                const pitData = data as { entries?: unknown[] };
                return `${pitData.entries?.length || 0} pit scouting entries (text only, no images)`;
            },
            title: 'Pit Scouting Data',
            description: 'Transfer pit scouting data (text only, no images)',
            noDataMessage: 'No pit scouting data found. Complete some pit scouting first!',
            completionMessage: 'Pit scouting data imported successfully!',
            expectedPacketType: 'pit-scouting_fountain_packet'
        },
        'match': {
            loadData: async () => {
                const matchDataStr = localStorage.getItem('matchData');
                const matches = matchDataStr ? JSON.parse(matchDataStr) : [];
                return { matches };
            },
            saveData: async (data: unknown) => {
                const matchData = data as { matches?: unknown[] };
                if (matchData.matches && Array.isArray(matchData.matches)) {
                    localStorage.setItem('matchData', JSON.stringify(matchData.matches));
                    toast.success(`Successfully imported ${matchData.matches.length} matches`);
                }
            },
            validateData: (data: unknown): boolean => {
                const matchData = data as { matches?: unknown[] };
                return !!(matchData.matches && Array.isArray(matchData.matches));
            },
            getDataSummary: (data: unknown) => {
                const matchData = data as { matches?: unknown[] };
                return `${matchData.matches?.length || 0} matches`;
            },
            title: 'Match Schedule',
            description: 'Transfer match schedule data between devices',
            noDataMessage: 'No match data found. Load a schedule first!',
            completionMessage: 'Match schedule imported successfully!',
            expectedPacketType: 'match_fountain_packet'
        },
        'scout': {
            loadData: async () => {
                const scouts = await gamificationDB.scouts.toArray();
                const predictions = await gamificationDB.predictions.toArray();
                const achievements = await gamificationDB.scoutAchievements.toArray();
                return { scouts, predictions, achievements };
            },
            saveData: async (data: unknown) => {
                const profileData = data as { scouts?: unknown[]; predictions?: unknown[]; achievements?: unknown[] };
                let scoutCount = 0;
                if (profileData.scouts) {
                    for (const scout of profileData.scouts) {
                        await gamificationDB.scouts.put(scout as never);
                        scoutCount++;
                    }
                }
                if (profileData.predictions) {
                    for (const prediction of profileData.predictions) {
                        await gamificationDB.predictions.put(prediction as never);
                    }
                }
                if (profileData.achievements) {
                    for (const achievement of profileData.achievements) {
                        await gamificationDB.scoutAchievements.put(achievement as never);
                    }
                }
                toast.success(`Successfully imported ${scoutCount} scout profiles`);
            },
            validateData: (data: unknown): boolean => {
                const profileData = data as { scouts?: unknown[] };
                return !!(profileData.scouts && Array.isArray(profileData.scouts));
            },
            getDataSummary: (data: unknown) => {
                const profileData = data as { scouts?: unknown[]; predictions?: unknown[] };
                return `${profileData.scouts?.length || 0} scouts, ${profileData.predictions?.length || 0} predictions`;
            },
            title: 'Scout Profiles',
            description: 'Transfer scout profiles and achievements',
            noDataMessage: 'No scout profiles found. Create some scout profiles first!',
            completionMessage: 'Scout profiles imported successfully!',
            expectedPacketType: 'scout_fountain_packet'
        },
        'combined': {
            loadData: async () => {
                const scoutingData = await exportScoutingData();
                const scouts = await gamificationDB.scouts.toArray();
                const predictions = await gamificationDB.predictions.toArray();
                return {
                    entries: scoutingData.entries,
                    scoutProfiles: { scouts, predictions },
                    metadata: {
                        exportedAt: new Date().toISOString(),
                        version: '3.0-maneuver-core'
                    }
                };
            },
            saveData: async (data: unknown) => {
                const combinedData = data as {
                    entries?: ScoutingEntryBase[];
                    scoutProfiles?: { scouts?: unknown[]; predictions?: unknown[] };
                };

                // Handle scouting entries with conflict detection
                if (combinedData.entries && Array.isArray(combinedData.entries)) {
                    // Use smart-merge for scouting data portion
                    const result = await handleScoutingDataUpload(
                        {
                            entries: combinedData.entries,
                            version: '3.0-maneuver-core',
                            exportedAt: Date.now()
                        },
                        'smart-merge'
                    );

                    if (result.hasBatchReview && result.batchReviewEntries) {
                        setBatchReviewEntries(result.batchReviewEntries);
                        setPendingConflicts(result.conflicts || []);
                        setShowBatchDialog(true);
                    } else if (result.hasConflicts && result.conflicts) {
                        setCurrentConflicts(result.conflicts);
                        setCurrentConflictIndex(0);
                        setConflictResolutions(new Map());
                        setShowConflictDialog(true);
                    }
                }

                // Scout profiles don't need conflict detection - just merge
                if (combinedData.scoutProfiles?.scouts) {
                    for (const scout of combinedData.scoutProfiles.scouts) {
                        await gamificationDB.scouts.put(scout as never);
                    }
                }
                if (combinedData.scoutProfiles?.predictions) {
                    for (const prediction of combinedData.scoutProfiles.predictions) {
                        await gamificationDB.predictions.put(prediction as never);
                    }
                }
            },
            validateData: (data: unknown): boolean => {
                const combinedData = data as { entries?: unknown[] };
                return !!(combinedData.entries && Array.isArray(combinedData.entries));
            },
            getDataSummary: (data: unknown) => {
                const combinedData = data as {
                    entries?: unknown[];
                    scoutProfiles?: { scouts?: unknown[]; predictions?: unknown[] };
                };
                const entryCount = combinedData.entries?.length || 0;
                const scoutCount = combinedData.scoutProfiles?.scouts?.length || 0;
                return `${entryCount} entries, ${scoutCount} scout profiles`;
            },
            title: 'Combined Data',
            description: 'Transfer scouting data and scout profiles together',
            noDataMessage: 'No data found. Scout some matches or create profiles first!',
            completionMessage: 'Combined data imported successfully!',
            expectedPacketType: 'combined_fountain_packet'
        }
    };

    const config = dataTypeConfigs[dataType];

    // Memoize loadData to prevent unnecessary re-renders
    const loadData = useCallback(() => config.loadData(), [config]);
    const saveData = useCallback((data: unknown) => config.saveData(data), [config]);
    const validateData = useCallback((data: unknown) => config.validateData(data), [config]);
    const getDataSummary = useCallback((data: unknown) => config.getDataSummary(data), [config]);

    if (mode === 'generate') {
        return (
            <UniversalFountainGenerator
                onBack={() => setMode('select')}
                onSwitchToScanner={() => setMode('scan')}
                dataType={dataType}
                loadData={loadData}
                title={config.title}
                description={config.description}
                noDataMessage={config.noDataMessage}
            />
        );
    }

    if (mode === 'scan') {
        return (
            <>
                <UniversalFountainScanner
                    onBack={() => setMode('select')}
                    onSwitchToGenerator={() => setMode('generate')}
                    dataType={dataType}
                    expectedPacketType={config.expectedPacketType}
                    saveData={saveData}
                    validateData={validateData}
                    getDataSummary={getDataSummary}
                    title={config.title}
                    description={config.description}
                    completionMessage={config.completionMessage}
                />

                {/* Conflict Resolution Dialogs */}
                <BatchConflictDialog
                    isOpen={showBatchDialog}
                    entries={batchReviewEntries}
                    onResolve={handleBatchReviewDecision}
                />

                <ConflictResolutionDialog
                    open={showConflictDialog}
                    onOpenChange={setShowConflictDialog}
                    conflict={currentConflicts[currentConflictIndex] || null}
                    currentIndex={currentConflictIndex}
                    totalConflicts={currentConflicts.length}
                    onResolve={handleConflictResolution}
                    onBatchResolve={handleBatchResolve}
                    onUndo={handleUndo}
                    canUndo={canUndo}
                />
            </>
        );
    }

    return (
        <>
            <div className="h-screen w-full flex flex-col items-center px-4 pt-12 pb-24">
                <div className="flex flex-col items-start gap-4 max-w-md w-full">
                    <h1 className="text-2xl font-bold">QR Data Transfer</h1>
                    <p className="text-muted-foreground">
                        Transfer large data files using fountain codes. Scan packets in any order until reconstruction is complete. Note: Pit scouting transfers include text data only - use JSON transfer for images.
                    </p>

                    {/* Data Type Selection */}
                    <Card className="w-full">
                        <CardHeader>
                            <CardTitle className="text-lg">Select Data Type</CardTitle>
                            <CardDescription>
                                Choose what type of data you want to transfer
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select value={dataType} onValueChange={(value: DataType) => setDataType(value)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select data type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="combined">Combined (Scouting + Profiles)</SelectItem>
                                    <SelectItem value="scouting">Scouting Data</SelectItem>
                                    <SelectItem value="pit-scouting">Pit Scouting Data (no images)</SelectItem>
                                    <SelectItem value="match">Match Schedule Data</SelectItem>
                                    <SelectItem value="scout">Scout Profiles</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col gap-4 w-full">
                        <Button
                            onClick={() => setMode('generate')}
                            className="w-full h-16 text-xl"
                        >
                            Generate Fountain Codes
                        </Button>

                        <div className="flex items-center gap-4">
                            <Separator className="flex-1" />
                            <span className="text-sm text-muted-foreground">OR</span>
                            <Separator className="flex-1" />
                        </div>

                        <Button
                            onClick={() => setMode('scan')}
                            variant="outline"
                            className="w-full h-16 text-xl"
                        >
                            Scan Fountain Codes
                        </Button>
                    </div>

                    <div className="text-xs text-muted-foreground text-start space-y-1">
                        <p>• Codes can be scanned in any order</p>
                        <p>• No need to receive all codes</p>
                        <p>• Automatic reconstruction when enough data is received</p>
                        <p>• Smart merge with conflict detection for scouting data</p>
                        <p>• Use JSON or Wifi Data Transfer for robot photos</p>
                    </div>
                </div>
            </div>

            {/* Conflict Resolution Dialogs (also available from select mode) */}
            <BatchConflictDialog
                isOpen={showBatchDialog}
                entries={batchReviewEntries}
                onResolve={handleBatchReviewDecision}
            />

            <ConflictResolutionDialog
                open={showConflictDialog}
                onOpenChange={setShowConflictDialog}
                conflict={currentConflicts[currentConflictIndex] || null}
                currentIndex={currentConflictIndex}
                totalConflicts={currentConflicts.length}
                onResolve={handleConflictResolution}
                onBatchResolve={handleBatchResolve}
                onUndo={handleUndo}
                canUndo={canUndo}
            />
        </>
    );
};

export default QRDataTransferPage;
