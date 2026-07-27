import { Button } from "maneuver-2026";
import { Plus, Trash2, Loader2 } from "lucide-react";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Button variant="default">Save Match</Button>
      <Button variant="destructive">Delete Scout</Button>
      <Button variant="outline">Cancel</Button>
      <Button variant="secondary">Skip Match</Button>
      <Button variant="ghost">Dismiss</Button>
      <Button variant="link">View details</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add team">
        <Plus />
      </Button>
    </div>
  );
}

export function States() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Button>
        <Plus /> Add Team
      </Button>
      <Button variant="destructive">
        <Trash2 /> Remove
      </Button>
      <Button disabled>
        <Loader2 className="animate-spin" /> Submitting…
      </Button>
      <Button disabled variant="outline">
        Disabled
      </Button>
    </div>
  );
}
