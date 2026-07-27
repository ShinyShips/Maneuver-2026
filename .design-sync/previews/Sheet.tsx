import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Button,
  Badge,
} from "maneuver-2026";

export function TeamDetailPanel() {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">View Team 3314</Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex h-full flex-col">
        <SheetHeader>
          <SheetTitle>Team 3314 — Mechanical Mustangs</SheetTitle>
          <SheetDescription>Rank 4 of 42 · 18 matches scouted</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 px-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Qualified</Badge>
            <Badge variant="outline">Defense Bot</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Avg. auto coral</span>
            <span className="font-medium">3.2</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Avg. teleop coral</span>
            <span className="font-medium">9.8</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Climb success rate</span>
            <span className="font-medium">92%</span>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline">Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
