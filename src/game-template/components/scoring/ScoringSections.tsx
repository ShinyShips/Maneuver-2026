/**
 * 2026 Game-Specific Scoring Sections Component
 * 
 * Auto phase: Uses AutoFieldMap for guided path visualization
 * Teleop phase: Uses TeleopFieldMap for zone-based field tracking
 */

import { AutoFieldMap } from "@/game-template/components/auto-path/AutoFieldMap";
import { TeleopFieldMap } from "@/game-template/components/teleop-path/TeleopFieldMap";

interface ScoringSectionsProps {
  phase: 'auto' | 'teleop';
  onAddAction: (action: any) => void; // Accepts action object
  actions: any[]; // Array of timestamped action objects
  scoutOptions?: Record<string, boolean>;
  onUndo?: () => void;
  canUndo?: boolean;
  // Navigation props (for full-screen implementations)
  matchNumber?: string | number;
  matchType?: 'qm' | 'sf' | 'f';
  teamNumber?: string | number;
  onBack?: () => void;
  onProceed?: () => void;
}

export function ScoringSections({
  phase,
  onAddAction,
  actions = [],
  scoutOptions,
  onUndo,
  canUndo = false,
  matchNumber,
  matchType,
  teamNumber,
  onBack,
  onProceed,
}: ScoringSectionsProps) {

  // ==========================================================================
  // AUTO PHASE: Field Map
  // ==========================================================================
  if (phase === 'auto') {
    return (
      <AutoFieldMap
        onAddAction={onAddAction}
        actions={actions}
        scoutOptions={scoutOptions}
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
  // TELEOP PHASE: Field Map with Zone Selection
  // ==========================================================================
  return (
    <TeleopFieldMap
      onAddAction={onAddAction}
      actions={actions}
      scoutOptions={scoutOptions}
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

