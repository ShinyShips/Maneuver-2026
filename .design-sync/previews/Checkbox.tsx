import { Checkbox, Label } from "maneuver-2026";

export function States() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Checkbox id="unchecked" />
        <Label htmlFor="unchecked">Defense played</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="checked" defaultChecked />
        <Label htmlFor="checked">Climbed successfully</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="disabled" disabled />
        <Label htmlFor="disabled">Broke down (unavailable)</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="disabled-checked" disabled defaultChecked />
        <Label htmlFor="disabled-checked">Was captain (locked)</Label>
      </div>
    </div>
  );
}
