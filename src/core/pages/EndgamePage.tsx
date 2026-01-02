import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import { Textarea } from "@/core/components/ui/textarea";
import { Label } from "@/core/components/ui/label";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { db } from "@/core/db/database";
import { StatusToggles } from "@/game-template/components";
import { gameDataTransformation } from "@/game-template/transformation";
import { clearScoutingLocalStorage } from "@/core/lib/utils";

const EndgamePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const states = location.state;

  const [robotStatus, setRobotStatus] = useState(() => {
    const saved = localStorage.getItem("endgameRobotStatus");
    return saved ? JSON.parse(saved) : {};
  });
  const [comment, setComment] = useState("");

  const updateRobotStatus = (updates: Partial<any>) => {
    setRobotStatus((prev: any) => {
      const newStatus = { ...prev, ...updates };
      localStorage.setItem("endgameRobotStatus", JSON.stringify(newStatus));
      return newStatus;
    });
    toast.success("Status updated");
  };

  const getActionsFromLocalStorage = (phase: string) => {
    const saved = localStorage.getItem(`${phase}StateStack`);
    return saved ? JSON.parse(saved) : [];
  };

  const getRobotStatusFromLocalStorage = (phase: string) => {
    const saved = localStorage.getItem(`${phase}RobotStatus`);
    return saved ? JSON.parse(saved) : {};
  };

  const handleSubmit = async () => {
    try {
      const autoActions = getActionsFromLocalStorage("auto");
      const teleopActions = getActionsFromLocalStorage("teleop");
      const autoRobotStatus = getRobotStatusFromLocalStorage("auto");
      const teleopRobotStatus = getRobotStatusFromLocalStorage("teleop");

      // Extract match data from states
      const eventKey = states?.inputs?.eventName || localStorage.getItem("eventName") || "";
      const matchNumberStr = states?.inputs?.matchNumber || "";
      const matchType = states?.inputs?.matchType || "qm";
      const teamNumberStr = states?.inputs?.selectTeam || "";
      const allianceColor = states?.inputs?.alliance || "red";
      
      // Build matchKey based on matchType
      let matchKey: string;
      let matchNumber: number;
      
      if (matchType === "qm") {
        // Qualification match: qm24
        matchKey = `qm${matchNumberStr}`;
        matchNumber = parseInt(matchNumberStr) || 0;
      } else if (matchType === "sf") {
        // Semifinal: user enters "1" → becomes "sf1m1"
        matchKey = `sf${matchNumberStr}m1`;
        matchNumber = parseInt(matchNumberStr) || 0;
      } else if (matchType === "f") {
        // Final: user enters "2" → becomes "f1m2"
        matchKey = `f1m${matchNumberStr}`;
        matchNumber = parseInt(matchNumberStr) || 0;
      } else {
        // Fallback
        matchKey = `qm${matchNumberStr}`;
        matchNumber = parseInt(matchNumberStr) || 0;
      }

      // Transform action arrays to counter fields using game-specific transformation
      const transformedGameData = gameDataTransformation.transformActionsToCounters({
        autoActions,
        teleopActions,
        autoRobotStatus,
        teleopRobotStatus,
        endgameRobotStatus: robotStatus,
        startPosition: states?.inputs?.startPosition,
      });

      // Create the scouting entry with proper structure matching ScoutingEntryBase from /src/types/
      // Using Record to bypass type checking since database still uses old structure
      const scoutingEntry: Record<string, unknown> = {
        id: `${eventKey}::${matchKey}::${teamNumberStr}::${allianceColor}`,
        scoutName: states?.inputs?.scoutName || "",
        teamNumber: parseInt(teamNumberStr) || 0,
        matchNumber: matchNumber || 0,
        eventKey: eventKey,
        matchKey: matchKey,
        allianceColor: allianceColor as 'red' | 'blue',
        timestamp: Date.now(),
        gameData: transformedGameData, // Store transformed counter fields (not action arrays)
        comments: comment, // Comments comes last - final field in match timeline
      };

      // Save to database (cast to any since we're using new structure but database expects old)
      await db.scoutingData.put(scoutingEntry as never);

      // Clear action stacks and robot status
      clearScoutingLocalStorage();

      // Update match counter
      const currentMatchNumber = localStorage.getItem("currentMatchNumber") || "1";
      const nextMatchNumber = (parseInt(currentMatchNumber) + 1).toString();
      localStorage.setItem("currentMatchNumber", nextMatchNumber);

      toast.success("Match data saved successfully!");

      // Navigate back to game-start
      navigate("/game-start");
    } catch (error) {
      console.error("Error saving match data:", error);
      toast.error("Error saving match data");
    }
  };

  const handleBack = () => {
    navigate("/teleop-scoring", {
      state: {
        ...states,
        endgameData: {
          robotStatus,
          comment,
        },
      },
    });
  };

  return (
    <div className="h-full w-full flex flex-col items-center px-4 pt-6 pb-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold pb-4">Endgame</h1>
      </div>
      <div className="flex flex-col items-center gap-6 max-w-2xl w-full h-full min-h-0 pb-4">
        {/* Match Info */}
        {states?.inputs && (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-lg">Match Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {states.inputs.eventName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event:</span>
                  <span className="font-medium">{states.inputs.eventName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Match:</span>
                <span className="font-medium">{states.inputs.matchNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alliance:</span>
                <Badge
                  variant={states.inputs.alliance === "red" ? "destructive" : "default"}
                  className={
                    states.inputs.alliance === "blue"
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }
                >
                  {states.inputs.alliance?.charAt(0).toUpperCase() +
                    states.inputs.alliance?.slice(1)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Team:</span>
                <span className="font-medium">{states.inputs.selectTeam}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto Actions:</span>
                <Badge variant="outline">{states?.autoStateStack?.length || 0}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Teleop Actions:</span>
                <Badge variant="outline">{states?.teleopStateStack?.length || 0}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Endgame Robot Status Section */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-lg">Endgame Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusToggles
              phase="endgame"
              status={robotStatus}
              onStatusUpdate={updateRobotStatus}
            />
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card className="w-full flex-1">
          <CardHeader>
            <CardTitle className="text-lg">Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="comment">Additional Notes</Label>
              <Textarea
                id="comment"
                placeholder="Enter any additional observations or notes about the match..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-24"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 w-full pb-8">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex-1 h-12 text-lg"
          >
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-2 h-12 text-lg font-semibold"
            style={{
              backgroundColor: "#16a34a",
              color: "white",
            }}
          >
            Submit Match Data
            <ArrowRight className="ml-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EndgamePage;
