/**
 * 2026 Game-Specific Scoring Sections Component
 * 
 * Auto phase: Uses AutoPathTracker for guided path visualization
 * Teleop phase: Uses bulk counter UI (to be implemented)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { AutoPathTracker } from "@/game-template/components/auto-path";

interface ScoringSectionsProps {
  phase: 'auto' | 'teleop';
  onAddAction: (action: any) => void;
  actions: any[];
  status?: any;
  onUndo?: () => void;
  canUndo?: boolean;
  onBack?: () => void;
  onProceed?: () => void;
  matchNumber?: string | number;
  matchType?: 'qm' | 'sf' | 'f';
  teamNumber?: string | number;
}

export function ScoringSections({
  phase,
  onAddAction,
  actions = [],
  status: _status, // TODO: Use for teleop defense zone toggle
  onUndo,
  canUndo = false,
  matchNumber,
  matchType,
  teamNumber,
  onBack,
  onProceed,
}: ScoringSectionsProps) {

  // ==========================================================================
  // AUTO PHASE: Path Tracker
  // ==========================================================================
  if (phase === 'auto') {
    return (
      <AutoPathTracker
        onAddAction={onAddAction}
        actions={actions}
        onUndo={onUndo}
        canUndo={canUndo}
        matchNumber={matchNumber}
        matchType={matchType}
        teamNumber={teamNumber}
        onBack={onBack}
        onProceed={onProceed}
      />
    );
  }

  // ==========================================================================
  // TELEOP PHASE: Bulk Counter UI (placeholder for now)
  // ==========================================================================

  // Example: Count how many times each action has been performed
  const action1Count = actions.filter(a => a.actionType === 'action1').length;
  const action2Count = actions.filter(a => a.actionType === 'action2').length;
  const action3Count = actions.filter(a => a.actionType === 'action3').length;
  const action4Count = actions.filter(a => a.actionType === 'action4').length;

  return (
    <div className="space-y-4">
      {/* Placeholder Notice */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <h3 className="font-semibold text-sm">Teleop Scoring UI Coming Soon</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Teleop bulk counter UI will be implemented. For now, see placeholder buttons below.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Example Scoring Section 1 */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring Section 1</CardTitle>
          <p className="text-sm text-muted-foreground">
            Example: Replace with game-specific scoring
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onAddAction({
                actionType: 'action1',
                phase
              })}
              variant="outline"
              className="h-16 flex flex-col items-center justify-center gap-1"
            >
              <span>Action 1</span>
              {action1Count > 0 && (
                <span className="text-xs text-muted-foreground">({action1Count})</span>
              )}
            </Button>
            <Button
              onClick={() => onAddAction({
                actionType: 'action2',
                phase
              })}
              variant="outline"
              className="h-16 flex flex-col items-center justify-center gap-1"
            >
              <span>Action 2</span>
              {action2Count > 0 && (
                <span className="text-xs text-muted-foreground">({action2Count})</span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Example Scoring Section 2 */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring Section 2</CardTitle>
          <p className="text-sm text-muted-foreground">
            Example: Replace with game-specific scoring
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button
              onClick={() => onAddAction({
                actionType: 'action3',
                phase
              })}
              variant="outline"
              className="w-full h-12 flex items-center justify-between px-4"
            >
              <span>Action 3</span>
              {action3Count > 0 && (
                <span className="text-sm font-semibold bg-primary/10 px-2 py-1 rounded">
                  {action3Count}
                </span>
              )}
            </Button>
            <Button
              onClick={() => onAddAction({
                actionType: 'action4',
                phase
              })}
              variant="outline"
              className="w-full h-12 flex items-center justify-between px-4"
            >
              <span>Action 4</span>
              {action4Count > 0 && (
                <span className="text-sm font-semibold bg-primary/10 px-2 py-1 rounded">
                  {action4Count}
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
