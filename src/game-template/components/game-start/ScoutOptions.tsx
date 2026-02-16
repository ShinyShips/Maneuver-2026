import { Checkbox } from "@/core/components/ui/checkbox";
import type { ScoutOptionsContentProps } from "@/types";

const GAME_OPTION_KEYS = {
  placeholderGameOptionA: "placeholderGameOptionA",
  placeholderGameOptionB: "placeholderGameOptionB",
} as const;

export function GameSpecificScoutOptions({
  options,
  onOptionChange,
}: ScoutOptionsContentProps) {
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
        <Checkbox
          checked={options[GAME_OPTION_KEYS.placeholderGameOptionA] ?? false}
          onCheckedChange={(checked) =>
            onOptionChange(GAME_OPTION_KEYS.placeholderGameOptionA, checked === true)
          }
          className="mt-0.5"
        />
        <div>
          <p className="text-sm font-medium">Game placeholder option A</p>
          <p className="text-xs text-muted-foreground">
            Replace this with a game-specific scouting option.
          </p>
        </div>
      </label>

      <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
        <Checkbox
          checked={options[GAME_OPTION_KEYS.placeholderGameOptionB] ?? false}
          onCheckedChange={(checked) =>
            onOptionChange(GAME_OPTION_KEYS.placeholderGameOptionB, checked === true)
          }
          className="mt-0.5"
        />
        <div>
          <p className="text-sm font-medium">Game placeholder option B</p>
          <p className="text-xs text-muted-foreground">
            Replace this with a game-specific scouting option.
          </p>
        </div>
      </label>
    </div>
  );
}
