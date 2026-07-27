import { Label, Input, Checkbox } from "maneuver-2026";

export function FormField() {
  return (
    <div className="flex flex-col gap-2 p-4 w-72">
      <Label htmlFor="scout-name">Scout name</Label>
      <Input id="scout-name" placeholder="Jordan Lee" />
    </div>
  );
}

export function WithCheckbox() {
  return (
    <div className="flex items-center gap-2 p-4">
      <Checkbox id="climbed" defaultChecked />
      <Label htmlFor="climbed">Climbed successfully</Label>
    </div>
  );
}

export function DisabledField() {
  return (
    <div className="flex flex-col gap-2 p-4 w-72 group" data-disabled="true">
      <Label htmlFor="locked-team" className="group-data-[disabled=true]:opacity-50">
        Team number (locked)
      </Label>
      <Input id="locked-team" defaultValue="3314" disabled />
    </div>
  );
}
