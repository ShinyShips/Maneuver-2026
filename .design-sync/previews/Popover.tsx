import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Badge,
} from "maneuver-2026";

export function TeamQuickInfo() {
  return (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Team 3314</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Team 3314 — Mechanical Mustangs</p>
          <p className="text-sm text-muted-foreground">
            Rank 4 of 42 · 18 matches scouted
          </p>
          <div className="flex gap-2 pt-1">
            <Badge variant="secondary">Qualified</Badge>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
