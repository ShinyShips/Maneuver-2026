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
      toast.error(`No matching pit scouting entries found for ${result.notFound} teams. Please import pit scouting text data first, then add images.`);
    } else if (result.notFound > 0) {
      toast.warning(`Updated ${result.updated} teams with images. ${result.notFound} teams not found - ensure pit scouting entries exist first.`);
    } else {
      toast.success(`Successfully updated ${result.updated} teams with images!`);
    }
  } catch (error) {
    console.error('Error importing pit scouting images:', error);
    toast.error("Failed to import pit scouting images");
  }
};
