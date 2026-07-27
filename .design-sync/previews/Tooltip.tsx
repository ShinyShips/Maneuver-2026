import { Tooltip, TooltipTrigger, TooltipContent, Button } from "maneuver-2026";
import { Info } from "lucide-react";

export function StatInfo() {
  return (
    <div className="flex justify-center p-16">
      <Tooltip open>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Coral average info">
            <Info className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Average coral scored per match across qualification matches
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
