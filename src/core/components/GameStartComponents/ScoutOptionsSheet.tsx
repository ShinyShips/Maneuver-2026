import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/core/components/ui/sheet";
import { Separator } from "@/core/components/ui/separator";
import type { ScoutOptionsContentProps, ScoutOptionsState } from "@/types";
import { Settings2 } from "lucide-react";
import type { ComponentType } from "react";

export const CORE_SCOUT_OPTION_KEYS = {
  placeholderOptionA: "placeholderOptionA",
  placeholderOptionB: "placeholderOptionB",
} as const;

interface ScoutOptionsSheetProps {
  options: ScoutOptionsState;
  onOptionChange: (key: string, value: boolean) => void;
  customContent?: ComponentType<ScoutOptionsContentProps>;
}

export function ScoutOptionsSheet({
  options,
  onOptionChange,
  customContent: CustomContent,
}: ScoutOptionsSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Scout Options
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Scout Options</SheetTitle>
          <SheetDescription>
            Configure scouting behavior before starting a match.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Core Options
            </h4>

            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
              <Checkbox
                checked={options[CORE_SCOUT_OPTION_KEYS.placeholderOptionA] ?? false}
                onCheckedChange={(checked) =>
                  onOptionChange(CORE_SCOUT_OPTION_KEYS.placeholderOptionA, checked === true)
                }
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium">Placeholder option A</p>
                <p className="text-xs text-muted-foreground">
                  Reserved for future core-level configuration. Implement real behavior in game repos.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
              <Checkbox
                checked={options[CORE_SCOUT_OPTION_KEYS.placeholderOptionB] ?? false}
                onCheckedChange={(checked) =>
                  onOptionChange(CORE_SCOUT_OPTION_KEYS.placeholderOptionB, checked === true)
                }
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium">Placeholder option B</p>
                <p className="text-xs text-muted-foreground">
                  Reserved for future core-level configuration. Implement real behavior in game repos.
                </p>
              </div>
            </label>
          </div>

          {CustomContent && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Game-Specific Options
                </h4>
                <CustomContent options={options} onOptionChange={onOptionChange} />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
