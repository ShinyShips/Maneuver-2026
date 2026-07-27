import { Input, Label } from "maneuver-2026";

export function Empty() {
  return (
    <div className="flex flex-col gap-2 p-4 w-72">
      <Label htmlFor="team-number-empty">Team number</Label>
      <Input id="team-number-empty" placeholder="e.g. 3314" />
    </div>
  );
}

export function WithValue() {
  return (
    <div className="flex flex-col gap-2 p-4 w-72">
      <Label htmlFor="team-number-value">Team number</Label>
      <Input id="team-number-value" defaultValue="3314" />
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex flex-col gap-2 p-4 w-72">
      <Label htmlFor="match-number-disabled">Match number</Label>
      <Input
        id="match-number-disabled"
        defaultValue="Qualification 42"
        disabled
      />
    </div>
  );
}

export function Invalid() {
  return (
    <div className="flex flex-col gap-2 p-4 w-72">
      <Label htmlFor="scout-initials-invalid">Scout initials</Label>
      <Input
        id="scout-initials-invalid"
        defaultValue="1"
        aria-invalid="true"
      />
      <p className="text-xs text-destructive">
        Enter 2-3 letters, not a number.
      </p>
    </div>
  );
}
