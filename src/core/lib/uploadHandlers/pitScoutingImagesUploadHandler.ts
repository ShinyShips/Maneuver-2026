import { toast } from "sonner";
import { importPitScoutingImagesOnly } from "@/core/lib/pitScoutingUtils";

export const handlePitScoutingImagesUpload = async (jsonData: unknown): Promise<void> => {
  if (!jsonData || typeof jsonData !== 'object') {
    toast.error("Invalid pit scouting images data format");
    return;
  }

  const data = jsonData as Record<string, unknown>;
  
  if (data.type !== 'pit-scouting-images-only' || !('entries' in data) || !Array.isArray(data.entries)) {
    toast.error("Invalid pit scouting images data format");
    return;
  }

  try {
    const result = await importPitScoutingImagesOnly(data as {
      type: string;
      entries: Array<{
        teamNumber: number;
        eventKey: string;
        robotPhoto: string;
        timestamp: number;
      }>;
    });
    
    if (result.updated === 0 && result.notFound > 0) {
      toast.error(`No pit scouting history found for ${result.notFound} teams. Import pit scouting data first, or add those teams manually before importing images.`);
    } else if (result.notFound > 0) {
      const seededMessage = result.seededFromPrevious > 0
        ? ` ${result.seededFromPrevious} ${result.seededFromPrevious === 1 ? 'entry was' : 'entries were'} seeded from the latest prior event.`
        : '';
      toast.warning(`Updated ${result.updated} teams with images.${seededMessage} ${result.notFound} teams still had no pit scouting history.`);
    } else {
      const seededMessage = result.seededFromPrevious > 0
        ? ` ${result.seededFromPrevious} ${result.seededFromPrevious === 1 ? 'entry was' : 'entries were'} seeded from the latest prior event.`
        : '';
      toast.success(`Successfully updated ${result.updated} teams with images!${seededMessage}`);
    }
  } catch (error) {
    console.error('Error importing pit scouting images:', error);
    toast.error("Failed to import pit scouting images");
  }
};
