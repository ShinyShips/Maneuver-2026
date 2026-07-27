import { Slider, Label } from "maneuver-2026";

export function Default() {
  return (
    <div className="flex flex-col gap-3 p-4 w-72">
      <Label>Defense rating</Label>
      <Slider defaultValue={[50]} max={100} step={1} />
    </div>
  );
}

export function ScoreFilter() {
  return (
    <div className="flex flex-col gap-3 p-4 w-72">
      <div className="flex justify-between text-sm">
        <Label>Minimum auto coral</Label>
        <span className="text-muted-foreground">4+</span>
      </div>
      <Slider defaultValue={[4]} min={0} max={12} step={1} />
    </div>
  );
}

export function Range() {
  return (
    <div className="flex flex-col gap-3 p-4 w-72">
      <div className="flex justify-between text-sm">
        <Label>Alliance rank range</Label>
        <span className="text-muted-foreground">3 - 7</span>
      </div>
      <Slider defaultValue={[3, 7]} min={1} max={8} step={1} />
    </div>
  );
}
