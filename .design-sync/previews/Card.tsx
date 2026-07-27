import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from "maneuver-2026";

export function TeamSummary() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Team 3314 — Mechanical Mustangs</CardTitle>
        <CardDescription>Rank 4 · 18 matches scouted</CardDescription>
        <CardAction>
          <Badge variant="secondary">Qualified</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Averages 12.4 coral scored per match with a 92% climb success rate.
          Strong auto-start consistency across the last 6 matches.
        </p>
      </CardContent>
      <CardFooter className="border-t">
        <Button variant="outline" size="sm">
          View match history
        </Button>
      </CardFooter>
    </Card>
  );
}

export function Simple() {
  return (
    <Card className="w-72">
      <CardHeader>
        <CardTitle>Pit Scouting</CardTitle>
        <CardDescription>Team 254 · Bay 12</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Swerve drive, 4-bar coral intake, ground and human-player pickup.
        </p>
      </CardContent>
    </Card>
  );
}
