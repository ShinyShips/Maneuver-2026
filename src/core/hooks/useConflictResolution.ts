import { useState } from "react";
import { toast } from "sonner";
import type { ConflictInfo } from "@/core/lib/scoutingDataUtils";
import type { ScoutingEntryBase } from "@/types/scouting-entry";
import { computeChangedFields } from "@/core/lib/scoutingDataUtils";

// Debug logging helper - only logs in development
const DEBUG = import.meta.env.DEV;
const debugLog = (...args: unknown[]) => {
  if (DEBUG) console.log(...args);
};

export const useConflictResolution = () => {
  // Conflict resolution state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [currentConflicts, setCurrentConflicts] = useState<ConflictInfo[]>([]);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, 'replace' | 'skip'>>(new Map());
  const [resolutionHistory, setResolutionHistory] = useState<Array<{ index: number; action: 'replace' | 'skip' }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate conflict key from conflict info
  const getConflictKey = (conflict: ConflictInfo): string => {
    return `${conflict.local.matchNumber}-${conflict.local.teamNumber}-${conflict.local.eventKey}`;
  };

  // Handle individual conflict resolution
  const handleConflictResolution = async (action: 'replace' | 'skip') => {
    const currentConflict = currentConflicts[currentConflictIndex];
    if (!currentConflict) return;

    // Store the decision (using event, match, team as key)
    const conflictKey = getConflictKey(currentConflict);
    const updatedResolutions = new Map(conflictResolutions).set(conflictKey, action);
    setConflictResolutions(updatedResolutions);

    // Add to history
    setResolutionHistory(prev => [...prev, { index: currentConflictIndex, action }]);

    // Move to next conflict or finish
    if (currentConflictIndex < currentConflicts.length - 1) {
      setCurrentConflictIndex(currentConflictIndex + 1);
    } else {
      // All conflicts resolved, apply decisions with the updated map
      await applyConflictResolutions(updatedResolutions);
    }
  };

  // Apply all conflict resolutions
  const applyConflictResolutions = async (resolutionsMap?: Map<string, 'replace' | 'skip'>) => {
    const { db } = await import('@/core/db/database');
    
    const resolutions = resolutionsMap || conflictResolutions;
    let replaced = 0;
    let kept = 0;

    for (const conflict of currentConflicts) {
      const conflictKey = getConflictKey(conflict);
      const decision = resolutions.get(conflictKey);

      if (decision === 'replace') {
        // Delete old entry and save new one directly (don't use saveScoutingEntry - it wraps in legacy format)
        console.log('🔄 Replacing entry:', {
          conflictKey,
          incomingStructure: conflict.incoming,
          hasGameData: 'gameData' in conflict.incoming,
          hasData: 'data' in conflict.incoming,
          localId: conflict.local.id
        });
        await db.scoutingData.delete(conflict.local.id);
        await db.scoutingData.put(conflict.incoming as never);
        replaced++;
      } else if (decision === 'skip') {
        // Keep existing entry, do nothing
        kept++;
      }
    }

    toast.success(
      `Conflict resolution complete! ${replaced} entries replaced, ${kept} entries kept.`
    );

    // Reset state
    setShowConflictDialog(false);
    setCurrentConflicts([]);
    setCurrentConflictIndex(0);
    setConflictResolutions(new Map());
    setResolutionHistory([]);
  };

  // Batch resolve all remaining conflicts
  const handleBatchResolve = async (action: 'replace' | 'skip') => {
    setIsProcessing(true);
    
    try {
      // Apply action to all remaining conflicts
      const newResolutions = new Map(conflictResolutions);
      for (let i = currentConflictIndex; i < currentConflicts.length; i++) {
        const conflict = currentConflicts[i];
        if (!conflict) continue; // Skip if undefined
        const key = getConflictKey(conflict);
        newResolutions.set(key, action);
      }
      setConflictResolutions(newResolutions);

      // Apply immediately
      const { db } = await import('@/core/db/database');
      let replaced = 0;
      let skipped = 0;

      const remainingCount = currentConflicts.length - currentConflictIndex;
      debugLog(`🔄 Batch ${action}ing ${remainingCount} conflicts...`);

      for (let i = currentConflictIndex; i < currentConflicts.length; i++) {
        const conflict = currentConflicts[i];
        if (!conflict) continue; // Skip if undefined
        const conflictKey = getConflictKey(conflict);
        const decision = newResolutions.get(conflictKey);

        if (decision === 'replace') {
          await db.scoutingData.delete(conflict.local.id);
          await db.scoutingData.put(conflict.incoming as never);
          replaced++;
        } else {
          skipped++;
        }
        
        // Log progress for large batches
        if (i % 50 === 0 && i > currentConflictIndex) {
          debugLog(`📊 Progress: ${i - currentConflictIndex}/${remainingCount} conflicts processed`);
        }
      }

      debugLog(`✅ Batch operation complete: ${replaced} replaced, ${skipped} skipped`);

      toast.success(
        `Batch operation complete! ${replaced} entries replaced, ${skipped} entries kept.`
      );

      // Reset state
      setShowConflictDialog(false);
      setCurrentConflicts([]);
      setCurrentConflictIndex(0);
      setConflictResolutions(new Map());
      setResolutionHistory([]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Undo last conflict resolution
  const handleUndo = () => {
    if (resolutionHistory.length === 0) return;

    const lastResolution = resolutionHistory[resolutionHistory.length - 1];
    if (!lastResolution) return; // Extra safety check

    // Remove last resolution from map
    const lastConflict = currentConflicts[lastResolution.index];
    if (!lastConflict) return; // Skip if conflict not found
    const conflictKey = getConflictKey(lastConflict);
    const newResolutions = new Map(conflictResolutions);
    newResolutions.delete(conflictKey);
    setConflictResolutions(newResolutions);

    // Remove from history
    setResolutionHistory(prev => prev.slice(0, -1));

    // Go back to that conflict
    setCurrentConflictIndex(lastResolution.index);
  };

  // Handle batch review decision (for duplicate entries)
  const handleBatchReviewDecision = async (
    batchReviewEntries: ScoutingEntryBase[],
    pendingConflicts: ConflictInfo[],
    decision: 'replace-all' | 'skip-all' | 'review-each'
  ) => {
    setIsProcessing(true);
    
    try {
      const { db } = await import('@/core/db/database');
      
      if (decision === 'replace-all') {
        debugLog(`🔄 Batch replacing ${batchReviewEntries.length} duplicate entries...`);
        let replaced = 0;
        for (let i = 0; i < batchReviewEntries.length; i++) {
        const entry = batchReviewEntries[i];
        if (!entry) continue; // Skip if undefined
        const matchNumber = entry.matchNumber;
        const teamNumber = entry.teamNumber;
        const alliance = entry.allianceColor;
        const eventKey = entry.eventKey;
        
        const existing = await db.scoutingData
          .toArray()
          .then(entries => entries.find((e: any) => 
            e.matchNumber === matchNumber &&
            e.teamNumber === teamNumber &&
            e.allianceColor === alliance &&
            e.eventKey === eventKey
          ));
        
        if (existing) {
          await db.scoutingData.delete(existing.id);
        }
        await db.scoutingData.put(entry as never);
        replaced++;
        
        // Log progress for large batches
        if (i % 50 === 0 && i > 0) {
          debugLog(`📊 Progress: ${i}/${batchReviewEntries.length} entries replaced`);
        }
      }
      debugLog(`✅ Batch replace complete: ${replaced} entries replaced`);
      toast.success(`Replaced ${replaced} entries with incoming data`);
      
      // Check if there are pending conflicts after batch
      if (pendingConflicts.length > 0) {
        setCurrentConflicts(pendingConflicts);
        setCurrentConflictIndex(0);
        setConflictResolutions(new Map());
        setShowConflictDialog(true);
        return { hasMoreConflicts: true };
      }
      
      return { hasMoreConflicts: false };
      
    } else if (decision === 'skip-all') {
      toast.success(`Kept ${batchReviewEntries.length} local entries unchanged`);
      
      // Check if there are pending conflicts after batch
      if (pendingConflicts.length > 0) {
        setCurrentConflicts(pendingConflicts);
        setCurrentConflictIndex(0);
        setConflictResolutions(new Map());
        setShowConflictDialog(true);
        return { hasMoreConflicts: true };
      }
      
      return { hasMoreConflicts: false };
      
    } else if (decision === 'review-each') {
      // Convert batch entries to conflicts for individual review
      const { db } = await import('@/core/db/database');
      const batchConflicts: ConflictInfo[] = await Promise.all(
        batchReviewEntries.map(async (entry) => {
          const matchNumber = entry.matchNumber;
          const teamNumber = entry.teamNumber;
          const eventKey = entry.eventKey;
          
          // Find existing local entry
          const local = await db.scoutingData
            .toArray()
            .then((entries: any[]) => entries.find((e: any) => 
              e.matchNumber === matchNumber &&
              e.teamNumber === teamNumber &&
              e.eventKey === eventKey
            ));
          
          const changedFields = local
            ? computeChangedFields(local as ScoutingEntryBase, entry)
            : [];
          
          return {
            incoming: entry,
            local: local as ScoutingEntryBase,
            conflictType: 'corrected-vs-uncorrected' as const,
            isNewerIncoming: false,
            changedFields
          };
        })
      );
      
      // Add pending conflicts after batch conflicts
      const allConflicts = [...batchConflicts, ...pendingConflicts];
      setCurrentConflicts(allConflicts);
      setCurrentConflictIndex(0);
      setConflictResolutions(new Map());
      setShowConflictDialog(true);
      
      return { hasMoreConflicts: true };
    }
    
    return { hasMoreConflicts: false };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    // State
    showConflictDialog,
    setShowConflictDialog,
    currentConflicts,
    setCurrentConflicts,
    currentConflictIndex,
    setCurrentConflictIndex,
    conflictResolutions,
    setConflictResolutions,
    resolutionHistory,
    setResolutionHistory,
    isProcessing,
    
    // Actions
    handleConflictResolution,
    handleBatchResolve,
    handleUndo,
    applyConflictResolutions,
    handleBatchReviewDecision,
    
    // Computed
    canUndo: resolutionHistory.length > 0,
    currentConflict: currentConflicts[currentConflictIndex],
    hasMoreConflicts: currentConflictIndex < currentConflicts.length - 1,
  };
};
