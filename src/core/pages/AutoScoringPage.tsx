import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { ScoringSections, StatusToggles } from "@/game-template/components";
import { useWorkflowNavigation } from "@/core/hooks/useWorkflowNavigation";
import { submitMatchData } from "@/core/lib/submitMatch";
import { useGame } from "@/core/contexts/GameContext";
import { workflowConfig } from "@/game-template/game-schema";

const AutoScoringPage = () => {
  const { transformation } = useGame();
  const location = useLocation();
  const navigate = useNavigate();
  const states = location.state;
  const { getNextRoute, getPrevRoute, isLastPage } = useWorkflowNavigation();
  const isSubmitPage = isLastPage('autoScoring');

  const getSavedState = () => {
    const saved = localStorage.getItem("autoStateStack");
    return saved ? JSON.parse(saved) : [];
  };

  const getSavedStatus = () => {
    const saved = localStorage.getItem("autoRobotStatus");
    return saved ? JSON.parse(saved) : {};
  };

  const getSavedHistory = () => {
    const saved = localStorage.getItem("autoUndoHistory");
    return saved ? JSON.parse(saved) : [];
  };

  const [scoringActions, setScoringActions] = useState(getSavedState());
  const [robotStatus, setRobotStatus] = useState(getSavedStatus());
  const [undoHistory, setUndoHistory] = useState(getSavedHistory());

  // Save state to localStorage whenever actions change
  useEffect(() => {
    localStorage.setItem("autoStateStack", JSON.stringify(scoringActions));
  }, [scoringActions]);

  // Save robot status to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("autoRobotStatus", JSON.stringify(robotStatus));
  }, [robotStatus]);

  // Save undo history to localStorage
  useEffect(() => {
    localStorage.setItem("autoUndoHistory", JSON.stringify(undoHistory));
  }, [undoHistory]);

  const addScoringAction = (action: any) => {
    const newAction = { ...action, timestamp: Date.now() };
    setScoringActions((prev: any) => [...prev, newAction]);
    // Add to undo history
    setUndoHistory((prev: any) => [...prev, { type: 'action', data: newAction }]);
  };

  const updateRobotStatus = (updates: Partial<any>) => {
    // Save current state to undo history BEFORE updating
    setUndoHistory((history: any) => [...history, { type: 'status', data: robotStatus }]);
    // Update the status
    setRobotStatus((prev: any) => ({ ...prev, ...updates }));
  };

  const undoLastAction = () => {
    if (undoHistory.length === 0) {
      toast.error("No actions to undo");
      return;
    }

    const lastChange = undoHistory[undoHistory.length - 1];

    if (lastChange.type === 'action') {
      // Undo scoring action
      setScoringActions((prev: any) => prev.slice(0, -1));
    } else if (lastChange.type === 'status') {
      // Restore previous status
      setRobotStatus(lastChange.data);
    }

    // Remove from undo history
    setUndoHistory((prev: any) => prev.slice(0, -1));
  };

  const handleBack = () => {
    const prevRoute = getPrevRoute('autoScoring') || '/auto-start';
    navigate(prevRoute, {
      state: {
        inputs: states?.inputs,
        ...(states?.rescout && { rescout: states.rescout }),
      },
    });
  };

  const handleProceed = async () => {
    if (isSubmitPage) {
      // This is the last page - submit match data
      const success = await submitMatchData({
        inputs: states?.inputs,
        transformation,
        onSuccess: () => navigate('/game-start'),
      });
      if (!success) return;
    } else {
      const nextRoute = getNextRoute('autoScoring') || '/teleop-scoring';
      navigate(nextRoute, {
        state: {
          inputs: states?.inputs,
          autoStateStack: scoringActions,
          autoRobotStatus: robotStatus,
          ...(states?.rescout && { rescout: states.rescout }),
        },
      });
    }
  };

  return (
    <div className="h-full flex flex-col items-center pt-12 pb-24 px-4 2xl:pb-6">
      <div className="w-full max-w-7xl">
        <h1 className="text-2xl font-bold pb-4">Autonomous</h1>
      </div>
      <div className="flex flex-col-reverse lg:flex-row items-start gap-0 lg:gap-6 max-w-7xl w-full h-full min-h-0">

        {/* Main Scoring Section */}
        <div className="w-full lg:flex-1 space-y-4 min-h-0 overflow-y-auto">

          {/* Game-Specific Scoring Sections */}
          <ScoringSections
            phase="auto"
            onAddAction={addScoringAction}
            actions={scoringActions}
            onUndo={undoLastAction}
            canUndo={undoHistory.length > 0}
            matchNumber={states?.inputs?.matchNumber}
            matchType={states?.inputs?.matchType}
            teamNumber={states?.inputs?.selectTeam}
            onBack={handleBack}
            onProceed={handleProceed}
          />

          {/* Action Buttons - Mobile Only */}
          <div className="flex lg:hidden gap-4 w-full">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1 h-12 text-lg"
            >
              Back
            </Button>
            <Button
              onClick={handleProceed}
              className={`flex-2 h-12 text-lg font-semibold ${isSubmitPage ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              {isSubmitPage ? 'Submit Match Data' : 'Continue to Teleop'}
              <ArrowRight className="ml-0.5" />
            </Button>
          </div>
        </div>

        {/* Info and Controls Sidebar */}
        <div className="flex flex-col gap-4 w-full lg:w-80 pb-4 lg:pb-0 min-h-0">
          {/* Info and Controls Sidebar */}
          <div className="flex flex-col gap-4 w-full lg:w-80 pb-4 lg:pb-0 min-h-0">

            {/* Match Info Card */}
            {states?.inputs && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Autonomous</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Match:</span>
                    <span className="font-medium">{states.inputs.matchNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team:</span>
                    <span className="font-medium">{states.inputs.selectTeam}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actions:</span>
                    <Badge variant="outline">{scoringActions.length}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Actions */}
            <Card className="h-64">
              <CardHeader>
                <CardTitle className="text-lg">Recent Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 h-40 overflow-y-auto pb-2">
                  {undoHistory.slice(-8).reverse().map((change: any, index: number) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {change.type === 'action' ? (
                          <>
                            {change.data.actionType || change.data.type || 'Action'}
                            {change.data.pieceType && ` - ${change.data.pieceType}`}
                            {change.data.location && ` @ ${change.data.location}`}
                            {change.data.level && ` (${change.data.level})`}
                          </>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400">Status Change</span>
                        )}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        #{undoHistory.length - index}
                      </Badge>
                    </div>
                  ))}
                  {undoHistory.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No actions recorded yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Robot Status Card */}
            {workflowConfig.pages.showAutoStatus && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Robot Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusToggles
                    phase="auto"
                    status={robotStatus}
                    onStatusUpdate={updateRobotStatus}
                  />
                </CardContent>
              </Card>
            )}

            {/* Undo Button */}
            <Button
              variant="outline"
              onClick={undoLastAction}
              disabled={undoHistory.length === 0}
              className="w-full"
            >
              Undo Last Change
            </Button>

            {/* Action Buttons - Desktop Only */}
            <div className="hidden lg:flex gap-4 w-full">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1 h-12 text-lg"
              >
                Back
              </Button>
              <Button
                onClick={handleProceed}
                className={`flex-2 h-12 text-lg font-semibold ${isSubmitPage ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                {isSubmitPage ? 'Submit Match Data' : 'Continue to Teleop'}
                <ArrowRight className="ml-0.5" />
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AutoScoringPage;
