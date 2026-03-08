import { Button } from "@/core/components/ui/button";
import { Alert, AlertDescription } from "@/core/components/ui/alert";
import {
  BasicInformation,
  RobotPhotoSection,
  TechnicalSpecifications,
  AdditionalNotes,
  GameSpecificQuestionsPlaceholder,
} from "@/core/components/pit-scouting";
import { usePitScoutingForm } from "@/core/hooks/usePitScoutingForm";
import { useGame } from "@/core/contexts/GameContext";
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

  const onSubmit = async () => {
    const success = await handleSubmit();
    if (success) {
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
        />

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
