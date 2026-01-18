import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import { Textarea } from "@/core/components/ui/textarea";
import { Label } from "@/core/components/ui/label";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { useGame } from "@/core/contexts/GameContext";
import { useWorkflowNavigation } from "@/core/hooks/useWorkflowNavigation";
import { submitMatchData } from "@/core/lib/submitMatch";
import { workflowConfig } from "@/game-template/game-schema";

const EndgamePage = () => {
  const { ui, transformation } = useGame();
  const { StatusToggles } = ui;
  const location = useLocation();
  const navigate = useNavigate();
  const states = location.state;
  const { getPrevRoute } = useWorkflowNavigation();

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

  const handleSubmit = async () => {
    // Save endgame status to localStorage so submitMatch can access it
    localStorage.setItem("endgameRobotStatus", JSON.stringify(robotStatus));

    await submitMatchData({
      inputs: states?.inputs,
      transformation,
      comment,
      onSuccess: () => navigate('/game-start'),
    });
  };

  const handleBack = () => {
    const prevRoute = getPrevRoute('endgame') || '/teleop-scoring';
    navigate(prevRoute, {
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
    <div className="h-full w-full flex flex-col items-center px-4 pt-12 pb-24">
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
              {states.inputs.eventKey && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event:</span>
                  <span className="font-medium">{states.inputs.eventKey}</span>
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
        {workflowConfig.pages.showEndgameStatus && (
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
        )}

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
