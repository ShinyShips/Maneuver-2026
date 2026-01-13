import { useState, useCallback } from "react";
import type { PitScoutingEntryBase, DrivetrainType, ProgrammingLanguage } from "@/types/database";
import {
  savePitScoutingEntry,
  loadPitScoutingByTeamAndEvent,
} from "@/core/db/database";
import { toast } from "sonner";

interface PitScoutingFormState {
  teamNumber: number | "";
  eventKey: string;
  scoutName: string;
  robotPhoto?: string;
  weight?: number;
  drivetrain?: DrivetrainType;
  programmingLanguage?: ProgrammingLanguage;
  notes?: string;
  gameData?: Record<string, unknown>;
}

interface UsePitScoutingFormReturn {
  // Form state
  formState: PitScoutingFormState;

  // Universal field setters
  setTeamNumber: (value: number | "") => void;
  setEventKey: (value: string) => void;
  setScoutName: (value: string) => void;
  setRobotPhoto: (value: string | undefined) => void;
  setWeight: (value: number | undefined) => void;
  setDrivetrain: (value: DrivetrainType | undefined) => void;
  setProgrammingLanguage: (value: ProgrammingLanguage | undefined) => void;
  setNotes: (value: string | undefined) => void;

  // Game data setter (for game-specific questions)
  setGameData: (data: Record<string, unknown> | undefined) => void;

  // Form actions
  validateForm: () => boolean;
  handleSubmit: () => Promise<boolean>;
  resetForm: () => void;
  loadExistingEntry: () => Promise<void>;

  // Loading state
  isLoading: boolean;
  existingEntryId?: string;
}

export function usePitScoutingForm(): UsePitScoutingFormReturn {
  const [formState, setFormState] = useState<PitScoutingFormState>({
    teamNumber: "",
    eventKey: localStorage.getItem("eventKey") || "",
    scoutName: localStorage.getItem("currentScout") || "",
    robotPhoto: undefined,
    weight: undefined,
    drivetrain: undefined,
    programmingLanguage: undefined,
    notes: undefined,
    gameData: undefined,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [existingEntryId, setExistingEntryId] = useState<string | undefined>(undefined);

  // Manual load function (opt-in instead of automatic)
  const loadExistingEntry = useCallback(async () => {
    if (!formState.teamNumber || typeof formState.teamNumber !== "number" || !formState.eventKey) {
      toast.error("Please enter a team number and event first");
      return;
    }

    setIsLoading(true);
    try {
      const existing = await loadPitScoutingByTeamAndEvent(
        formState.teamNumber,
        formState.eventKey
      );

      if (existing) {
        // Pre-fill form with existing data
        setFormState((prev) => ({
          ...prev,
          scoutName: existing.scoutName,
          robotPhoto: existing.robotPhoto,
          weight: existing.weight,
          drivetrain: existing.drivetrain,
          programmingLanguage: existing.programmingLanguage,
          notes: existing.notes,
          gameData: existing.gameData,
        }));
        setExistingEntryId(existing.id);
        toast.success("Loaded existing pit scouting data for this team");
      } else {
        toast.info("No existing data found for this team at this event");
      }
    } catch (error) {
      console.error("Error loading existing pit scouting entry:", error);
      toast.error("Failed to load existing data");
    } finally {
      setIsLoading(false);
    }
  }, [formState.teamNumber, formState.eventKey]);

  // Universal field setters
  const setTeamNumber = useCallback((value: number | "") => {
    setFormState((prev) => ({ ...prev, teamNumber: value }));
  }, []);

  const setEventKey = useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, eventKey: value }));
  }, []);

  const setScoutName = useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, scoutName: value }));
  }, []);

  const setRobotPhoto = useCallback((value: string | undefined) => {
    setFormState((prev) => ({ ...prev, robotPhoto: value }));
  }, []);

  const setWeight = useCallback((value: number | undefined) => {
    setFormState((prev) => ({ ...prev, weight: value }));
  }, []);

  const setDrivetrain = useCallback((value: DrivetrainType | undefined) => {
    setFormState((prev) => ({ ...prev, drivetrain: value }));
  }, []);

  const setProgrammingLanguage = useCallback(
    (value: ProgrammingLanguage | undefined) => {
      setFormState((prev) => ({ ...prev, programmingLanguage: value }));
    },
    []
  );

  const setNotes = useCallback((value: string | undefined) => {
    setFormState((prev) => ({ ...prev, notes: value }));
  }, []);

  const setGameData = useCallback((data: Record<string, unknown> | undefined) => {
    setFormState((prev) => ({ ...prev, gameData: data }));
  }, []);

  // Validation
  const validateForm = useCallback((): boolean => {
    if (formState.teamNumber === "" || typeof formState.teamNumber !== "number") {
      toast.error("Team number is required");
      return false;
    }

    if (!formState.eventKey.trim()) {
      toast.error("Event is required");
      return false;
    }

    if (!formState.scoutName.trim()) {
      toast.error("Scout name is required");
      return false;
    }

    return true;
  }, [formState.teamNumber, formState.eventKey, formState.scoutName]);

  // Submit handler
  const handleSubmit = useCallback(async (): Promise<boolean> => {
    if (!validateForm()) {
      return false;
    }

    setIsLoading(true);
    try {
      // Generate ID if new entry, otherwise use existing ID
      const id = existingEntryId || `pit-${formState.teamNumber}-${formState.eventKey}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const entry: PitScoutingEntryBase = {
        id,
        teamNumber: formState.teamNumber as number,
        eventKey: formState.eventKey,
        scoutName: formState.scoutName,
        timestamp: Date.now(),
        robotPhoto: formState.robotPhoto,
        weight: formState.weight,
        drivetrain: formState.drivetrain,
        programmingLanguage: formState.programmingLanguage,
        notes: formState.notes,
        gameData: formState.gameData ?? {}, // Default to empty object if undefined
      };

      await savePitScoutingEntry(entry);

      toast.success(
        existingEntryId
          ? "Pit scouting data updated successfully!"
          : "Pit scouting data saved successfully!"
      );

      return true;
    } catch (error) {
      console.error("Error saving pit scouting entry:", error);
      toast.error("Failed to save pit scouting data");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [formState, existingEntryId, validateForm]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormState({
      teamNumber: "",
      eventKey: localStorage.getItem("eventKey") || "",
      scoutName: localStorage.getItem("currentScout") || "",
      robotPhoto: undefined,
      weight: undefined,
      drivetrain: undefined,
      programmingLanguage: undefined,
      notes: undefined,
      gameData: undefined,
    });
    setExistingEntryId(undefined);
  }, []);

  return {
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
    validateForm,
    handleSubmit,
    resetForm,
    loadExistingEntry,
    isLoading,
    existingEntryId,
  };
}
