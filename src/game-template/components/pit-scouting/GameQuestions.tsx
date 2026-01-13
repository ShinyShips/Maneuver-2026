/**
 * Game-Specific Pit Scouting Questions Component
 * 
 * This component allows teams to add game-specific questions to the pit scouting form.
 * It receives the current game data and a callback to update it.
 * 
 * HOW TO CUSTOMIZE FOR YOUR GAME YEAR:
 * ====================================
 * 
 * 1. Define what game-specific data you want to collect
 * 2. Create form inputs for each piece of data
 * 3. Use the onGameDataChange callback to update the form state
 * 4. Data is automatically saved to the database with the pit scouting entry
 * 
 * EXAMPLE QUESTIONS:
 * 
 * For 2025 Reefscape:
 * - Can score coral? (checkbox)
 * - Can score algae? (checkbox)
 * - Can climb? (checkbox)
 * - Preferred scoring location? (dropdown)
 * 
 * For 2024 Crescendo:
 * - Can score in amp? (checkbox)
 * - Can score in speaker? (checkbox)
 * - Autonomous capabilities? (checkboxes)
 * - Climb capability? (dropdown)
 * 
 * INTERFACE:
 * - gameData: Record<string, unknown> - Current game-specific data
 * - onGameDataChange: (data: Record<string, unknown>) => void - Update callback
 * 
 * USAGE EXAMPLE:
 * ```tsx
 * // Single field update
 * const handleCheckboxChange = (checked: boolean) => {
 *   onGameDataChange({ ...gameData, canScoreCoral: checked });
 * };
 * 
 * // Multiple field updates
 * const handleMultipleChanges = () => {
 *   onGameDataChange({ 
 *     ...gameData, 
 *     canScoreCoral: true,
 *     canScoreAlgae: false,
 *     preferredLocation: 'reef'
 *   });
 * };
 * 
 * // Using a helper function (recommended for cleaner code)
 * const updateField = (key: string, value: unknown) => {
 *   onGameDataChange({ ...gameData, [key]: value });
 * };
 * ```
 * 
 * DATA STORAGE:
 * Game data is stored in the pit scouting entry as:
 * {
 *   teamNumber: 3314,
 *   eventKey: "2025week1",
 *   // ... universal fields ...
 *   gameData: {
 *     canScoreCoral: true,
 *     canScoreAlgae: false,
 *     // ... your custom fields ...
 *   }
 * }
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface GameSpecificQuestionsProps {
  gameData?: Record<string, unknown>;
  onGameDataChange: (data: Record<string, unknown>) => void;
}

/**
 * Default/Placeholder Game-Specific Questions Component
 * 
 * This is a simple placeholder that shows teams where to implement their
 * year-specific pit scouting questions.
 * 
 * Replace this entire component with your game-specific implementation.
 */
export function GameSpecificQuestions({
  gameData = {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onGameDataChange: _onGameDataChange,
}: GameSpecificQuestionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Game-Specific Questions</CardTitle>
        <p className="text-sm text-muted-foreground">
          Add questions specific to your game year
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Game-Specific Implementation Needed</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Replace this component with your game year's pit scouting questions.
              See the JSDoc comments in this file for implementation guidance.
            </p>
          </div>
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md max-w-sm">
            <p className="font-mono">gameData: {JSON.stringify(gameData, null, 2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/*
EXAMPLE IMPLEMENTATION FOR A REAL GAME YEAR:

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Label } from "@/core/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";

interface GameSpecificQuestionsProps {
  gameData?: Record<string, unknown>;
  onGameDataChange: (data: Record<string, unknown>) => void;
}

export function GameSpecificQuestions({ gameData = {}, onGameDataChange }: GameSpecificQuestionsProps) {
  const handleChange = (key: string, value: unknown) => {
    onGameDataChange({ ...gameData, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>2025 Reefscape Capabilities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Scoring Capabilities</h4>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="canScoreCoral"
              checked={gameData.canScoreCoral as boolean}
              onCheckedChange={(checked) => handleChange('canScoreCoral', checked)}
            />
            <Label htmlFor="canScoreCoral">Can score coral pieces</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="canScoreAlgae"
              checked={gameData.canScoreAlgae as boolean}
              onCheckedChange={(checked) => handleChange('canScoreAlgae', checked)}
            />
            <Label htmlFor="canScoreAlgae">Can score algae pieces</Label>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-sm">Endgame</h4>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="canClimb"
              checked={gameData.canClimb as boolean}
              onCheckedChange={(checked) => handleChange('canClimb', checked)}
            />
            <Label htmlFor="canClimb">Can climb at endgame</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="preferredScoring">Preferred Scoring Location</Label>
          <Select
            value={gameData.preferredScoring as string}
            onValueChange={(value) => handleChange('preferredScoring', value)}
          >
            <SelectTrigger id="preferredScoring">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reef_low">Reef (Low)</SelectItem>
              <SelectItem value="reef_high">Reef (High)</SelectItem>
              <SelectItem value="processor">Processor</SelectItem>
              <SelectItem value="barge">Barge</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
*/
