import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Alert, AlertDescription } from "@/core/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/core/components/ui/sheet";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { Badge } from "@/core/components/ui/badge";
import {
  BasicInformation,
  RobotPhotoSection,
  TechnicalSpecifications,
  AdditionalNotes,
  GameSpecificQuestionsPlaceholder,
} from "@/core/components/pit-scouting";
import { usePitScoutingForm } from "@/core/hooks/usePitScoutingForm";
import { useGame } from "@/core/contexts/GameContext";
import type { PitAssignment } from "@/core/lib/pitAssignmentTypes";
import {
  getPitAssignmentMeta,
  loadMyPitAssignments,
  markPitAssignmentCompleted,
} from "@/core/lib/pitAssignmentTransfer";
import { Save, AlertCircle, CheckCircle } from "lucide-react";

interface PitScoutingPageProps {
  /**
   * Optional: Callback when form is successfully submitted
   * Useful for game implementations to perform additional actions
   */
  onSubmitSuccess?: () => void;

  /**
   * Optional: Custom submit button text
   */
  submitButtonText?: string;
}

export function PitScoutingPage({
  onSubmitSuccess,
  submitButtonText = "Save Pit Scouting Data",
}: PitScoutingPageProps) {
  const { ui } = useGame();
  const PitScoutingQuestions = ui?.PitScoutingQuestions;
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [assignedTeams, setAssignedTeams] = useState<PitAssignment[]>([]);
  const [lastSyncedLabel, setLastSyncedLabel] = useState<string | null>(null);
  
  const {
    formState,
    setTeamNumber,
    setEventKey,
    setScoutName,
    setRobotPhoto,
    setWeight,
    setDrivetrain,
    setProgrammingLanguage,
    setNotes,
    setGameData,
    handleSubmit,
    loadExistingEntry,
    isLoading,
    existingEntryId,
  } = usePitScoutingForm();

  const completedAssignedCount = useMemo(
    () => assignedTeams.filter((assignment) => assignment.completed).length,
    [assignedTeams],
  );

  const refreshAssignedTeams = useCallback(() => {
    const fallbackScoutName = localStorage.getItem('currentScout') || '';
    const scoutName = formState.scoutName || fallbackScoutName;

    const fallbackEventKey =
      formState.eventKey ||
      localStorage.getItem('eventKey') ||
      localStorage.getItem('eventName') ||
      '';

    let eventKey = fallbackEventKey;

    if (!eventKey && scoutName) {
      const candidateEvents: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('pit_assignments_') && !key.startsWith('pit_assignments_meta_') && !key.startsWith('pit_assignments_mine_')) {
          candidateEvents.push(key.replace('pit_assignments_', ''));
        }
      }

      const eventWithAssignments = candidateEvents.find((candidateEventKey) =>
        loadMyPitAssignments(candidateEventKey, scoutName).length > 0
      );

      if (eventWithAssignments) {
        eventKey = eventWithAssignments;
      }
    }

    if (!eventKey || !scoutName) {
      setAssignedTeams([]);
      setLastSyncedLabel(null);
      return;
    }

    const myAssignments = loadMyPitAssignments(eventKey, scoutName)
      .sort((a, b) => Number(a.completed) - Number(b.completed) || a.teamNumber - b.teamNumber);
    setAssignedTeams(myAssignments);

    const meta = getPitAssignmentMeta(eventKey);
    if (meta) {
      setLastSyncedLabel(
        `Synced from ${meta.sourceScoutName} at ${new Date(meta.lastSyncedAt).toLocaleTimeString()}`
      );
    } else {
      setLastSyncedLabel(null);
    }
  }, [formState.eventKey, formState.scoutName]);

  useEffect(() => {
    refreshAssignedTeams();
  }, [refreshAssignedTeams]);

  useEffect(() => {
    const onVisibilityOrFocus = () => refreshAssignedTeams();
    const onStorage = (event: StorageEvent) => {
      if (event.key?.includes('pit_assignments_')) {
        refreshAssignedTeams();
      }
    };

    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshAssignedTeams]);

  const onSubmit = async () => {
    const success = await handleSubmit();
    if (success) {
      if (typeof formState.teamNumber === 'number' && formState.eventKey && formState.scoutName) {
        markPitAssignmentCompleted(formState.eventKey, formState.scoutName, formState.teamNumber);
      }
      refreshAssignedTeams();
      onSubmitSuccess?.();
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-12 pb-24">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Pit Scouting</h1>
        </div>

        {/* Existing Entry Alert */}
        {existingEntryId && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Editing existing pit scouting data for this team at this event
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State Alert */}
        {isLoading && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Loading data...</AlertDescription>
          </Alert>
        )}

        {/* Universal Pit Scouting Fields */}
        <BasicInformation
          teamNumber={formState.teamNumber}
          eventKey={formState.eventKey}
          scoutName={formState.scoutName}
          onTeamNumberChange={setTeamNumber}
          onEventKeyChange={setEventKey}
          onScoutNameChange={setScoutName}
          onLoadExisting={loadExistingEntry}
          isLoading={isLoading}
          onOpenAssignedTeams={() => setAssignmentsOpen(true)}
          assignedTeamsCount={assignedTeams.length}
          completedAssignedCount={completedAssignedCount}
        />

        <Sheet open={assignmentsOpen} onOpenChange={setAssignmentsOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>My Pit Assignments</SheetTitle>
              <SheetDescription>
                Quick-select assigned teams and track completion status.
              </SheetDescription>
            </SheetHeader>

            {lastSyncedLabel && (
              <p className="mt-3 text-xs text-muted-foreground">{lastSyncedLabel}</p>
            )}

            <ScrollArea className="mt-4 h-[calc(100vh-12rem)] pr-2">
              {assignedTeams.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No assignments found for this scout and event.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {assignedTeams.map((assignment) => {
                    const isCurrentTeam =
                      typeof formState.teamNumber === 'number' && formState.teamNumber === assignment.teamNumber;

                    return (
                      <button
                        key={assignment.id}
                        type="button"
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${isCurrentTeam ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
                          }`}
                        onClick={() => {
                          setTeamNumber(assignment.teamNumber);
                          setAssignmentsOpen(false);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Team {assignment.teamNumber}</span>
                          <Badge variant={assignment.completed ? 'default' : 'outline'}>
                            {assignment.completed ? 'Completed' : 'Assigned'}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <RobotPhotoSection
          robotPhoto={formState.robotPhoto}
          onRobotPhotoChange={setRobotPhoto}
        />

        <TechnicalSpecifications
          weight={formState.weight}
          drivetrain={formState.drivetrain}
          programmingLanguage={formState.programmingLanguage}
          onWeightChange={setWeight}
          onDrivetrainChange={setDrivetrain}
          onProgrammingLanguageChange={setProgrammingLanguage}
        />

        {/* Game-Specific Questions Slot */}
        {PitScoutingQuestions ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Game-Specific Questions</h2>
            <PitScoutingQuestions
              gameData={formState.gameData || {}}
              onGameDataChange={setGameData}
            />
          </div>
        ) : (
          <GameSpecificQuestionsPlaceholder />
        )}

        <AdditionalNotes notes={formState.notes} onNotesChange={setNotes} />


        {/* Submit Button */}
        <div className="mx-auto max-w-2xl">
          <Button
            onClick={onSubmit}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            <Save className="mr-2 h-5 w-5" />
            {submitButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
