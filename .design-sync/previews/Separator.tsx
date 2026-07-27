import { Separator } from "maneuver-2026";

export function TeamSummarySections() {
  return (
    <div className="p-4 w-80">
      <div>
        <h4 className="text-sm font-semibold">Team 3314 — Mechanical Mustangs</h4>
        <p className="text-sm text-muted-foreground">Rank 4 · 18 matches scouted</p>
      </div>
      <Separator className="my-4" />
      <div>
        <h4 className="text-sm font-semibold">Auto</h4>
        <p className="text-sm text-muted-foreground">Leaves start line, 2 coral avg.</p>
      </div>
      <Separator className="my-4" />
      <div>
        <h4 className="text-sm font-semibold">Endgame</h4>
        <p className="text-sm text-muted-foreground">92% deep climb success rate</p>
      </div>
    </div>
  );
}

export function VerticalStats() {
  return (
    <div className="flex h-12 items-center gap-4 p-4">
      <div className="text-center">
        <div className="text-sm font-semibold">12.4</div>
        <div className="text-xs text-muted-foreground">Auto</div>
      </div>
      <Separator orientation="vertical" />
      <div className="text-center">
        <div className="text-sm font-semibold">24.1</div>
        <div className="text-xs text-muted-foreground">Teleop</div>
      </div>
      <Separator orientation="vertical" />
      <div className="text-center">
        <div className="text-sm font-semibold">92%</div>
        <div className="text-xs text-muted-foreground">Climb</div>
      </div>
    </div>
  );
}
