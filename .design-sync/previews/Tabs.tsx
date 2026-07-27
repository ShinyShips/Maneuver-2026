import { Tabs, TabsList, TabsTrigger, TabsContent } from "maneuver-2026";

export function TeamDetail() {
  return (
    <Tabs defaultValue="overview" className="w-96">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="matches">Matches</TabsTrigger>
        <TabsTrigger value="pit">Pit Notes</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="flex flex-col gap-2 p-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Avg. auto coral</span>
          <span className="font-medium">3.2</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Avg. teleop coral</span>
          <span className="font-medium">9.8</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Climb success rate</span>
          <span className="font-medium">92%</span>
        </div>
      </TabsContent>
      <TabsContent value="matches" className="p-2 text-sm text-muted-foreground">
        18 matches scouted this event · last scouted Qualification 42.
      </TabsContent>
      <TabsContent value="pit" className="p-2 text-sm text-muted-foreground">
        Swerve drive, 4-bar coral intake, ground and human-player pickup.
      </TabsContent>
    </Tabs>
  );
}
