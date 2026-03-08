import { toast } from "sonner";
import { 
  loadScoutingData, 
  saveScoutingData, 
  detectConflicts,
  type ConflictInfo
} from "@/core/lib/scoutingDataUtils";
import type { ScoutingEntryBase } from "@/types/scouting-entry";

export type UploadMode = "append" | "overwrite" | "smart-merge";

interface RawScoutingData {
  entries: ScoutingEntryBase[];
}

// Return type for async upload operations that may have conflicts
export interface UploadResult {
  hasConflicts: boolean;
  hasBatchReview?: boolean;
  batchReviewEntries?: ScoutingEntryBase[];
  conflicts?: ConflictInfo[];
  autoProcessed?: {
    added: number;
    replaced: number;
  };
}

export const handleScoutingDataUpload = async (jsonData: unknown, mode: UploadMode): Promise<UploadResult> => {
  // Validate scouting data structure - expecting ScoutingEntryBase format
  let newEntries: ScoutingEntryBase[] = [];
  
  if (
    typeof jsonData === "object" &&
    jsonData !== null &&
    "entries" in jsonData &&
    Array.isArray((jsonData as RawScoutingData).entries)
  ) {
    newEntries = (jsonData as RawScoutingData).entries;
  } else {
    toast.error("Invalid scouting data format. Expected { entries: ScoutingEntryBase[] }");
    return { hasConflicts: false };
  }
  
  if (newEntries.length === 0) {
    toast.error("No valid scouting data found");
    return { hasConflicts: false };
  }
  
  // Handle different modes
  if (mode === "overwrite") {
    // Clear all existing data and save new data
    await saveScoutingData(newEntries);
    toast.success(`Overwritten with ${newEntries.length} scouting entries`);
    return { hasConflicts: false };
  }
  
  if (mode === "append") {
    // Add all new entries, replacing any with matching IDs
    // Use case: Combining data from multiple scouts or uploading corrections
    const existingScoutingData = await loadScoutingData();
    const combined = [...existingScoutingData, ...newEntries];
    await saveScoutingData(combined);
    toast.success(
      `Uploaded ${newEntries.length} entries (${existingScoutingData.length} existing). Total: ${combined.length} before deduplication.`
    );
    return { hasConflicts: false };
  }
  
  if (mode === "smart-merge") {
    // Use field-based conflict detection for reliable cross-device matching
    const conflictResult = await detectConflicts(newEntries);
    
    const { db } = await import('@/core/db/database');
    
    const results = { added: 0, replaced: 0 };
    
    // Auto-import: Save new entries
    if (conflictResult.autoImport.length > 0) {
      await db.scoutingData.bulkPut(conflictResult.autoImport as never[]);
      results.added = conflictResult.autoImport.length;
    }
    
    // Auto-replace: Delete old entries and save new ones
    if (conflictResult.autoReplace.length > 0) {
      for (const entry of conflictResult.autoReplace) {
        // Find and delete existing entry by ID
        const existingEntries = (await db.scoutingData.toArray()) as unknown as ScoutingEntryBase[];
        const existing = existingEntries.find(e => 
          e.matchNumber === entry.matchNumber &&
          e.teamNumber === entry.teamNumber &&
          e.allianceColor === entry.allianceColor &&
          e.eventKey === entry.eventKey
        );
        
        if (existing) {
          await db.scoutingData.delete(existing.id);
        }
        
        // Save new entry
        await db.scoutingData.put(entry as never);
      }
      results.replaced = conflictResult.autoReplace.length;
    }
    
    // Handle conflicts: Return them for user to resolve via dialog
    if (conflictResult.conflicts.length > 0 || conflictResult.batchReview.length > 0) {
      // Show initial toast about auto-processed entries
      if (results.added > 0 || results.replaced > 0) {
        const batchMessage = conflictResult.batchReview.length > 0 ? ` ${conflictResult.batchReview.length} duplicates need review.` : '';
        const conflictMessage = conflictResult.conflicts.length > 0 ? ` ${conflictResult.conflicts.length} conflicts need review.` : '';
        toast.success(
          `Imported ${results.added} new entries, ` +
          `Replaced ${results.replaced} existing entries.` +
          batchMessage + conflictMessage
        );
      }
      
      // Return batch review first if present, otherwise conflicts
      if (conflictResult.batchReview.length > 0) {
        return {
          hasConflicts: false,
          hasBatchReview: true,
          batchReviewEntries: conflictResult.batchReview,
          conflicts: conflictResult.conflicts.length > 0 ? conflictResult.conflicts : undefined,
          autoProcessed: results
        };
      }
      
      return {
        hasConflicts: true,
        conflicts: conflictResult.conflicts,
        autoProcessed: results
      };
    }
    
    // No conflicts - show completion message
    const totalExisting = await db.scoutingData.count();
    
    toast.success(
      `Smart merge complete! ${results.added} new entries added, ${results.replaced} entries replaced (Total: ${totalExisting})`
    );
    return { hasConflicts: false, autoProcessed: results };
  }
  
  return { hasConflicts: false };
};

// Apply conflict resolutions after user makes decisions
export const applyConflictResolutions = async (
  conflicts: ConflictInfo[],
  resolutions: Map<string, 'replace' | 'skip'>
): Promise<{ replaced: number; skipped: number }> => {
  const { db } = await import('@/core/db/database');
  let replaced = 0;
  let skipped = 0;
  
  for (const conflict of conflicts) {
    const conflictKey = `${conflict.local.matchNumber}-${conflict.local.teamNumber}-${conflict.local.eventKey}`;
    const decision = resolutions.get(conflictKey);
    
    if (decision === 'replace') {
      // Delete old entry and save new one
      console.log('Replacing entry:', {
        conflictKey,
        incomingData: conflict.incoming,
        localId: conflict.local.id
      });
      await db.scoutingData.delete(conflict.local.id);
      await db.scoutingData.put(conflict.incoming as never);
      replaced++;
    } else {
      // Skip - keep local, do nothing
      skipped++;
    }
  }
  
  return { replaced, skipped };
};
