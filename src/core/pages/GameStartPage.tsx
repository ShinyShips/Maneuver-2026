import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Badge } from "@/core/components/ui/badge";
import { Alert } from "@/core/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { toast } from "sonner";
import GameStartSelectTeam from "@/core/components/GameStartComponents/GameStartSelectTeam";
import { EventNameSelector } from "@/core/components/GameStartComponents/EventNameSelector";
import {
  CORE_SCOUT_OPTION_KEYS,
  ScoutOptionsSheet,
} from "@/core/components/GameStartComponents/ScoutOptionsSheet";
import { createMatchPrediction, getPredictionForMatch } from "@/core/lib/scoutGamificationUtils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useWorkflowNavigation } from "@/core/hooks/useWorkflowNavigation";
import { useScout } from "@/core/contexts/ScoutContext";
import { useGame } from "@/core/contexts/GameContext";
import type { ScoutOptionsState } from "@/types";

const SCOUT_OPTIONS_STORAGE_KEY = "scoutOptions";

const DEFAULT_SCOUT_OPTIONS: ScoutOptionsState = {
  [CORE_SCOUT_OPTION_KEYS.placeholderOptionA]: false,
  [CORE_SCOUT_OPTION_KEYS.placeholderOptionB]: false,
};

const GameStartPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const states = location.state;
  const { ui } = useGame();
  const { getNextRoute, isConfigValid } = useWorkflowNavigation();
  const { currentScout } = useScout();

  // Debug log when currentScout changes
  useEffect(() => {
    console.log('📋 GameStartPage: currentScout =', currentScout);
  }, [currentScout]);

  // Detect re-scout mode from location.state - use useMemo to recalculate when location.state changes
  const rescoutData = useMemo(() => states?.rescout, [states]);
  const isRescoutMode = rescoutData?.isRescout || false;
  const rescoutMatch = rescoutData?.matchNumber;
  const rescoutTeam = rescoutData?.teamNumber;
  const rescoutAlliance = rescoutData?.alliance;
  const rescoutEventKey = rescoutData?.eventKey;
  const rescoutTeams = useMemo(() => rescoutData?.teams || [], [rescoutData?.teams]);
  const currentTeamIndex = rescoutData?.currentTeamIndex || 0;

  const parsePlayerStation = () => {
    const playerStation = localStorage.getItem("playerStation");
    if (!playerStation) return { alliance: "", teamPosition: 0 };

    if (playerStation === "lead") {
      return { alliance: "", teamPosition: 0 };
    }

    const parts = playerStation.split("-");
    if (parts.length === 2 && parts[1]) {
      const alliance = parts[0];
      const position = parseInt(parts[1]);
      return { alliance, teamPosition: position };
    }

    return { alliance: "", teamPosition: 0 };
  };

  const stationInfo = parsePlayerStation();

  const getInitialMatchNumber = () => {
    if (states?.inputs?.matchNumber) {
      return states.inputs.matchNumber;
    }

    const storedMatchNumber = localStorage.getItem("currentMatchNumber");
    return storedMatchNumber || "1";
  };

  const [alliance, setAlliance] = useState(
    states?.inputs?.alliance || stationInfo.alliance || ""
  );
  const [matchNumber, setMatchNumber] = useState(getInitialMatchNumber());
  const [matchType, setMatchType] = useState<"qm" | "sf" | "f">("qm");
  const [debouncedMatchNumber, setDebouncedMatchNumber] = useState(matchNumber);
  const [selectTeam, setSelectTeam] = useState(() => {
    // Check rescout data first for single team mode
    if (rescoutData?.teamNumber) {
      return rescoutData.teamNumber;
    }
    // Check rescout data for batch mode
    if (rescoutData?.teams && rescoutData.teams.length > 0) {
      const currentIndex = rescoutData.currentTeamIndex || 0;
      return rescoutData.teams[currentIndex] || "";
    }
    // Fall back to inputs or empty
    return states?.inputs?.selectTeam || "";
  });
  const [eventKey, setEventKey] = useState(
    states?.inputs?.eventKey || localStorage.getItem("eventKey") || ""
  );
  const [predictedWinner, setPredictedWinner] = useState<"red" | "blue" | "none">("none");
  const [scoutOptions, setScoutOptions] = useState<ScoutOptionsState>(() => {
    const stored = localStorage.getItem(SCOUT_OPTIONS_STORAGE_KEY);
    if (!stored) return DEFAULT_SCOUT_OPTIONS;

    try {
      const parsed = JSON.parse(stored) as ScoutOptionsState;
      return {
        ...DEFAULT_SCOUT_OPTIONS,
        ...parsed,
      };
    } catch {
      return DEFAULT_SCOUT_OPTIONS;
    }
  });

  // Debounce matchNumber for team selection
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedMatchNumber(matchNumber);
    }, 500);
    return () => clearTimeout(timeout);
  }, [matchNumber]);

  // Effect to save match number to localStorage when it changes
  useEffect(() => {
    if (matchNumber) {
      localStorage.setItem("currentMatchNumber", matchNumber);
    }
  }, [matchNumber]);

  // Effect to load existing prediction when match/event changes
  useEffect(() => {
    const loadExistingPrediction = async () => {
      if (currentScout && eventKey && matchNumber) {
        try {
          const existingPrediction = await getPredictionForMatch(currentScout, eventKey, matchNumber);
          if (existingPrediction) {
            setPredictedWinner(existingPrediction.predictedWinner);
          } else {
            setPredictedWinner("none");
          }
        } catch (error) {
          console.error("Error loading existing prediction:", error);
          setPredictedWinner("none");
        }
      }
    };

    loadExistingPrediction();
  }, [matchNumber, eventKey, currentScout]);

  useEffect(() => {
    localStorage.setItem(SCOUT_OPTIONS_STORAGE_KEY, JSON.stringify(scoutOptions));
  }, [scoutOptions]);

  // Effect to pre-fill fields when in re-scout mode
  useEffect(() => {
    if (isRescoutMode) {
      if (rescoutMatch) {
        setMatchNumber(rescoutMatch);
      }
      if (rescoutAlliance) {
        setAlliance(rescoutAlliance as 'red' | 'blue');
      }
      if (rescoutEventKey) {
        setEventKey(rescoutEventKey);
      }

      // Single team or batch mode
      if (rescoutTeam) {
        setSelectTeam(rescoutTeam);
      } else if (rescoutTeams.length > 0 && currentTeamIndex < rescoutTeams.length) {
        const teamToScout = rescoutTeams[currentTeamIndex];
        setSelectTeam(teamToScout);
      }
    }
  }, [isRescoutMode, rescoutMatch, rescoutTeam, rescoutAlliance, rescoutEventKey, rescoutTeams, currentTeamIndex]);

  // Function to handle prediction changes and save them immediately
  const handlePredictionChange = async (newPrediction: "red" | "blue" | "none") => {
    setPredictedWinner(newPrediction);

    if (newPrediction !== "none" && currentScout && eventKey && matchNumber) {
      try {
        await createMatchPrediction(currentScout, eventKey, matchNumber, newPrediction);
        toast.success(`Prediction updated: ${newPrediction} alliance to win`);
      } catch (error) {
        console.error("Error saving prediction:", error);
        toast.error("Failed to save prediction");
      }
    }
  };

  const handleScoutOptionChange = (key: string, value: boolean) => {
    setScoutOptions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const validateInputs = () => {
    // Check workflow config is valid
    if (!isConfigValid) {
      toast.error("Workflow configuration error: At least one scouting page must be enabled");
      return false;
    }

    const inputs = {
      matchNumber,
      alliance,
      selectTeam,
      scoutName: currentScout,
      eventKey,
    };
    const hasNull = Object.values(inputs).some((val) => !val || val === "");

    if (!currentScout) {
      toast.error("Please select a scout from the sidebar first");
      return false;
    }

    if (!eventKey) {
      toast.error("Please set an event name/code first");
      return false;
    }

    if (hasNull) {
      toast.error("Fill In All Fields To Proceed");
      return false;
    }
    return true;
  };

  const handleStartScouting = async () => {
    if (!validateInputs()) return;

    // Save prediction if one was made
    if (predictedWinner !== "none" && currentScout && eventKey && matchNumber) {
      try {
        await createMatchPrediction(currentScout, eventKey, matchNumber, predictedWinner);
        toast.success(`Prediction saved: ${predictedWinner} alliance to win`);
      } catch (error) {
        console.error("Error saving prediction:", error);
        toast.error("Failed to save prediction");
      }
    }

    // Save inputs to localStorage (similar to ProceedBackButton logic)
    localStorage.setItem("matchNumber", matchNumber);
    localStorage.setItem("selectTeam", selectTeam);
    localStorage.setItem("alliance", alliance);
    localStorage.setItem(SCOUT_OPTIONS_STORAGE_KEY, JSON.stringify(scoutOptions));

    localStorage.setItem("autoStateStack", JSON.stringify([]));
    localStorage.setItem("teleopStateStack", JSON.stringify([]));

    const nextRoute = getNextRoute('gameStart') || '/auto-scoring';
    navigate(nextRoute, {
      state: {
        inputs: {
          matchNumber,
          matchType,
          alliance,
          scoutName: currentScout,
          selectTeam,
          eventKey,
          scoutOptions,
        },
        ...(isRescoutMode && {
          rescout: {
            isRescout: true,
            matchNumber: rescoutMatch,
            teamNumber: rescoutTeams.length > 0 ? rescoutTeams[currentTeamIndex] : rescoutTeam,
            alliance: rescoutAlliance,
            eventKey: rescoutEventKey,
            teams: rescoutTeams,
            currentTeamIndex,
          },
        }),
      },
    });
  };

  const handleGoBack = () => {
    navigate("/");
  };


  const handleMatchNumberChange = (value: string) => {
    setMatchNumber(value);
  };

  useEffect(() => {
    if (!matchNumber) return;
    const timeout = setTimeout(() => {
      localStorage.setItem("currentMatchNumber", matchNumber);
    }, 500);
    return () => clearTimeout(timeout);
  }, [matchNumber]);

  return (
    <div className="min-h-screen pt-12 w-full flex flex-col items-center px-4 pb-24 2xl:pb-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold pb-4">Game Start</h1>
      </div>
      <div className="flex flex-col items-center gap-6 max-w-2xl w-full flex-1 pb-8 md:pb-4">

        {!currentScout && (
          <Card className="w-full border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span className="text-sm text-amber-700">
                  Please select a scout from the sidebar before starting
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Re-scout mode banner */}
        {isRescoutMode && (
          <Alert className="flex border-amber-500 bg-amber-50 dark:bg-amber-950/20 py-3">
            <div className="flex items-center gap-3 w-full">
              <RefreshCw className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Re-scouting:</span> <strong>{rescoutEventKey && `${rescoutEventKey} `}</strong> Match <strong>{rescoutMatch}</strong> for Team <strong>{rescoutTeams.length > 0 ? rescoutTeams[currentTeamIndex] : rescoutTeam}</strong>
                {rescoutTeams.length > 0 && (
                  <span className="ml-2 opacity-75">
                    ({currentTeamIndex + 1}/{rescoutTeams.length})
                  </span>
                )}
              </div>
            </div>
          </Alert>
        )}

        {/* Main Form Card */}
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-xl">Match Information</CardTitle>
                {currentScout && (
                  <p className="text-sm text-muted-foreground">
                    Scouting as:{" "}
                    <span className="font-medium">{currentScout}</span>
                  </p>
                )}
              </div>

              <ScoutOptionsSheet
                options={scoutOptions}
                onOptionChange={handleScoutOptionChange}
                customContent={ui.ScoutOptionsContent}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">

            <div className="space-y-2">
              <Label>Event Name/Code</Label>
              <div className={isRescoutMode ? "opacity-50 pointer-events-none" : ""}>
                <EventNameSelector
                  currentEventKey={eventKey}
                  onEventKeyChange={setEventKey}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Event name will be included in all scouting data for this session
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="match-number">Match Number</Label>
                <span className="text-xs text-muted-foreground">
                  Auto-increments after each match
                </span>
              </div>
              <div className="flex gap-2">
                <Select
                  value={matchType}
                  onValueChange={(value) => setMatchType(value as "qm" | "sf" | "f")}
                  disabled={isRescoutMode}
                >
                  <SelectTrigger className="w-24 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qm">Qual</SelectItem>
                    <SelectItem value="sf">Semi</SelectItem>
                    <SelectItem value="f">Final</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="match-number"
                  type="number"
                  inputMode="numeric"
                  placeholder={matchType === "qm" ? "e.g., 24" : matchType === "sf" ? "e.g., 1" : "e.g., 1"}
                  value={matchNumber}
                  onChange={(e) => handleMatchNumberChange(e.target.value)}
                  className={`text-lg flex-1 h-12 ${isRescoutMode ? 'bg-muted cursor-not-allowed' : ''}`}
                  disabled={isRescoutMode}
                />
              </div>
              {matchType === "sf" && (
                <p className="text-xs text-muted-foreground">
                  Enter semifinal # (1-13) → Creates sf#m1
                </p>
              )}
              {matchType === "f" && (
                <p className="text-xs text-muted-foreground">
                  Enter match # (1-3) → Creates f1m#
                </p>
              )}
            </div>

            {/* Alliance Selection with Buttons */}
            <div className="space-y-2">
              <Label>Alliance</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={alliance === "red" ? "default" : "outline"}
                  onClick={() => setAlliance("red")}
                  disabled={isRescoutMode}
                  className={`h-12 text-lg font-semibold ${alliance === "red"
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                    } ${isRescoutMode ? 'cursor-not-allowed' : ''}`}
                >
                  <Badge
                    variant={alliance === "red" ? "secondary" : "destructive"}
                    className={`w-3 h-3 p-0 mr-2 ${alliance === "red" ? "bg-white" : "bg-red-500"}`}
                  />
                  Red Alliance
                </Button>
                <Button
                  variant={alliance === "blue" ? "default" : "outline"}
                  onClick={() => setAlliance("blue")}
                  disabled={isRescoutMode}
                  className={`h-12 text-lg font-semibold ${alliance === "blue"
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                    } ${isRescoutMode ? 'cursor-not-allowed' : ''}`}
                >
                  <Badge
                    variant={alliance === "blue" ? "secondary" : "default"}
                    className={`w-3 h-3 p-0 mr-2 ${alliance === "blue" ? "bg-white" : "bg-blue-500"}`}
                  />
                  Blue Alliance
                </Button>
              </div>
            </div>

            {/* Alliance Prediction Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Alliance Prediction (Optional)</Label>
                <span className="text-xs text-muted-foreground">
                  {isRescoutMode ? "Locked during re-scout" : "Earn points for correct predictions"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={predictedWinner === "red" ? "default" : "outline"}
                  onClick={() => handlePredictionChange("red")}
                  disabled={isRescoutMode}
                  className={`h-10 text-sm font-medium ${predictedWinner === "red"
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                    }`}
                >
                  Red Wins
                </Button>
                <Button
                  variant={predictedWinner === "blue" ? "default" : "outline"}
                  onClick={() => handlePredictionChange("blue")}
                  disabled={isRescoutMode}
                  className={`h-10 text-sm font-medium ${predictedWinner === "blue"
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                    }`}
                >
                  Blue Wins
                </Button>
                <Button
                  variant={predictedWinner === "none" ? "default" : "outline"}
                  onClick={() => handlePredictionChange("none")}
                  disabled={isRescoutMode}
                  className="h-10 text-sm font-medium"
                >
                  No Prediction
                </Button>
              </div>
              {predictedWinner !== "none" && (
                <p className="text-xs text-muted-foreground">
                  Predicting <span className="font-medium capitalize">{predictedWinner} Alliance</span> will win this match
                </p>
              )}
            </div>

            {/* Team Selection */}
            <div className="space-y-2">
              <Label>Team Selection</Label>
              <div className={isRescoutMode ? "opacity-50 pointer-events-none" : ""}>
                <GameStartSelectTeam
                  defaultSelectTeam={selectTeam}
                  setSelectTeam={setSelectTeam}
                  selectedMatch={debouncedMatchNumber}
                  selectedAlliance={alliance}
                  selectedEventKey={eventKey}
                  preferredTeamPosition={stationInfo.teamPosition}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 w-full">
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="flex-1 h-12 text-lg"
          >
            Back
          </Button>
          <Button
            onClick={handleStartScouting}
            className="flex-2 h-12 text-lg font-semibold"
            disabled={
              isRescoutMode
                ? false  // In re-scout mode, fields are pre-filled so always allow
                : (!matchNumber || !alliance || !selectTeam || !currentScout || !eventKey)
            }
          >
            Start Scouting
          </Button>
        </div>

        {/* Status Indicator */}
        {matchNumber && alliance && selectTeam && currentScout && eventKey && (
          <Card className="w-full border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-600">Ready</Badge>
                <span className="text-sm text-green-700 dark:text-green-300">
                  {eventKey} • Match {matchNumber} •{" "}
                  {alliance.charAt(0).toUpperCase() + alliance.slice(1)} Alliance
                  • Team {selectTeam} • {currentScout}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bottom spacing for mobile */}
        <div className="h-8 md:h-6" />
      </div>
    </div>
  );
};

export default GameStartPage;
