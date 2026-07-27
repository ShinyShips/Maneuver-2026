import { Textarea, Label } from "maneuver-2026";

export function Default() {
  return (
    <div className="flex flex-col gap-2 p-4 w-80">
      <Label htmlFor="notes">Scouting notes</Label>
      <Textarea
        id="notes"
        placeholder="Fast cycle times, strong defense in endgame"
      />
    </div>
  );
}

export function WithValue() {
  return (
    <div className="flex flex-col gap-2 p-4 w-80">
      <Label htmlFor="notes-filled">Match observations</Label>
      <Textarea
        id="notes-filled"
        defaultValue="Consistent 2-coral autos, climbed deep in every match. Occasionally fouled while defending near the reef."
      />
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex flex-col gap-2 p-4 w-80">
      <Label htmlFor="notes-disabled">Notes (submitted)</Label>
      <Textarea
        id="notes-disabled"
        defaultValue="Robot broke down in Q42, unable to complete scouting for this match."
        disabled
      />
    </div>
  );
}
