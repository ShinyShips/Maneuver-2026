import { Badge } from "maneuver-2026";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Badge>Rank 4</Badge>
      <Badge variant="secondary">Qualified</Badge>
      <Badge variant="destructive">Eliminated</Badge>
      <Badge variant="outline">Needs Repair</Badge>
    </div>
  );
}

export function MatchStatus() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Badge variant="secondary">Scheduled</Badge>
      <Badge>In Progress</Badge>
      <Badge variant="outline">Final</Badge>
      <Badge variant="destructive">No Show</Badge>
    </div>
  );
}

export function TeamTags() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Team 3314</span>
        <Badge variant="secondary">Alliance Captain</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Team 118</span>
        <Badge variant="outline">Pit Scouted</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Team 254</span>
        <Badge variant="destructive">Broke Down</Badge>
      </div>
    </div>
  );
}
