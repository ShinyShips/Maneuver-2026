import { Progress } from "maneuver-2026";

export function NotStarted() {
  return (
    <div className="flex flex-col gap-2 p-4 w-72">
      <div className="flex justify-between text-sm">
        <span>Match scouting completion</span>
        <span className="text-muted-foreground">0 / 42</span>
      </div>
      <Progress value={0} />
    </div>
  );
}

export function InProgress() {
  return (
    <div className="flex flex-col gap-2 p-4 w-72">
      <div className="flex justify-between text-sm">
        <span>Match scouting completion</span>
        <span className="text-muted-foreground">19 / 42</span>
      </div>
      <Progress value={45} />
    </div>
  );
}

export function Complete() {
  return (
    <div className="flex flex-col gap-2 p-4 w-72">
      <div className="flex justify-between text-sm">
        <span>Match scouting completion</span>
        <span className="text-muted-foreground">42 / 42</span>
      </div>
      <Progress value={100} />
    </div>
  );
}
