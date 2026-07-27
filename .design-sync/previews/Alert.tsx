import { Alert, AlertTitle, AlertDescription } from "maneuver-2026";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export function Default() {
  return (
    <Alert className="w-96">
      <CheckCircle2 />
      <AlertTitle>Sync complete</AlertTitle>
      <AlertDescription>
        12 new matches imported from the scouting tablet.
      </AlertDescription>
    </Alert>
  );
}

export function Destructive() {
  return (
    <Alert variant="destructive" className="w-96">
      <AlertTriangle />
      <AlertTitle>Failed to submit scouting data</AlertTitle>
      <AlertDescription>
        Check your connection and try again before leaving the match.
      </AlertDescription>
    </Alert>
  );
}
