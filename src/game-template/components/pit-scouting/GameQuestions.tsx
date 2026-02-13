/**
 * 2026 REBUILT Pit Scouting Questions
 * 
 * Game-specific questions focused on robot capabilities that cannot be determined
 * from watching matches:
 * - Physical specifications (height, trench capability)
 * - Capacity and intake methods
 * - Strategic preferences (starting positions, roles)
 * - Autonomous and endgame capabilities
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Label } from "@/core/components/ui/label";
import { Input } from "@/core/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";

interface GameSpecificQuestionsProps {
  gameData?: Record<string, unknown>;
  onGameDataChange: (data: Record<string, unknown>) => void;
}

const START_POSITIONS = ['Left Trench', 'Left Bump', 'Hub', 'Right Bump', 'Right Trench'];
const ROLES = ['Cycler', 'Clean Up', 'Passer', 'Thief', 'Defense'];

export function GameSpecificQuestions({ gameData = {}, onGameDataChange }: GameSpecificQuestionsProps) {
  const handleChange = (key: string, value: unknown) => {
    onGameDataChange({ ...gameData, [key]: value });
  };

  const handleMultiSelectChange = (key: string, value: string, checked: boolean) => {
    const current = (gameData[key] as string[]) || [];
    const updated = checked
      ? [...current, value]
      : current.filter(v => v !== value);
    handleChange(key, updated);
  };

  const getRank = (key: string, value: string) => {
    const selected = (gameData[key] as string[]) || [];
    const index = selected.indexOf(value);
    return index >= 0 ? index + 1 : null;
  };

  return (
    <div className="space-y-4">
      {/* Physical Specifications */}
      <Card>
        <CardHeader>
          <CardTitle>Physical Specifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maxLength">Robot Max Length (inches, with any extension)</Label>
            <Input
              id="maxLength"
              type="number"
              placeholder="e.g., 30"
              value={(gameData.maxLength as number) || ''}
              onChange={(e) => handleChange('maxLength', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxWidth">Robot Max Width (inches, with any extension)</Label>
            <Input
              id="maxWidth"
              type="number"
              placeholder="e.g., 28"
              value={(gameData.maxWidth as number) || ''}
              onChange={(e) => handleChange('maxWidth', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxHeight">Robot Max Height (inches)</Label>
            <Input
              id="maxHeight"
              type="number"
              placeholder="e.g., 22"
              value={(gameData.maxHeight as number) || ''}
              onChange={(e) => handleChange('maxHeight', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={gameData.canGoUnderTrench ? "default" : "outline"}
              onClick={() => handleChange('canGoUnderTrench', !gameData.canGoUnderTrench)}
              className="flex-1"
            >
              Can go under trench (22.25" clearance)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fuel Handling */}
      <Card>
        <CardHeader>
          <CardTitle>Fuel Handling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fuelCapacity">Fuel Capacity (max pieces held)</Label>
            <Input
              id="fuelCapacity"
              type="number"
              placeholder="e.g., 8"
              value={(gameData.fuelCapacity as number) || ''}
              onChange={(e) => handleChange('fuelCapacity', parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={gameData.canOutpostPickup ? "default" : "outline"}
              onClick={() => handleChange('canOutpostPickup', !gameData.canOutpostPickup)}
              className="flex-1"
            >
              Can pickup from outpost chute
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={gameData.canPassToCorral ? "default" : "outline"}
              onClick={() => handleChange('canPassToCorral', !gameData.canPassToCorral)}
              className="flex-1"
            >
              Can pass fuel to corral
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Strategic Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Strategic Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Click options in priority order. Click a selected option again to unrank it.</p>
          <div className="space-y-2">
            <Label>Preferred Starting Positions (ranked by click order)</Label>
            <div className="grid grid-cols-2 gap-2">
              {START_POSITIONS.map((position) => (
                (() => {
                  const rank = getRank('preferredStartPositions', position);
                  const isSelected = rank !== null;
                  return (
                <Button
                  key={position}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => 
                    handleMultiSelectChange('preferredStartPositions', position, 
                      !isSelected)
                  }
                  className="h-auto py-3"
                >
                  {isSelected ? `${rank}. ${position}` : position}
                </Button>
                  );
                })()
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preferred Role - Active Shift (ranked by click order)</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((role) => (
                (() => {
                  const rank = getRank('preferredActiveRoles', role);
                  const isSelected = rank !== null;
                  return (
                <Button
                  key={`active-${role}`}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => 
                    handleMultiSelectChange('preferredActiveRoles', role, 
                      !isSelected)
                  }
                  className="h-auto py-3"
                >
                  {isSelected ? `${rank}. ${role}` : role}
                </Button>
                  );
                })()
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preferred Role - Inactive Shift (ranked by click order)</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((role) => (
                (() => {
                  const rank = getRank('preferredInactiveRoles', role);
                  const isSelected = rank !== null;
                  return (
                <Button
                  key={`inactive-${role}`}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => 
                    handleMultiSelectChange('preferredInactiveRoles', role, 
                      !isSelected)
                  }
                  className="h-auto py-3"
                >
                  {isSelected ? `${rank}. ${role}` : role}
                </Button>
                  );
                })()
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Autonomous & Endgame */}
      <Card>
        <CardHeader>
          <CardTitle>Autonomous & Endgame</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={gameData.canAutoClimbL1 ? "default" : "outline"}
              onClick={() => handleChange('canAutoClimbL1', !gameData.canAutoClimbL1)}
              className="flex-1"
            >
              Can climb Level 1 in auto
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetClimbLevel">Target Endgame Climb Level</Label>
            <Select
              value={(gameData.targetClimbLevel as string) || 'none'}
              onValueChange={(value) => handleChange('targetClimbLevel', value)}
            >
              <SelectTrigger id="targetClimbLevel">
                <SelectValue placeholder="Select climb level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="level1">Level 1 (10 pts)</SelectItem>
                <SelectItem value="level2">Level 2 (20 pts)</SelectItem>
                <SelectItem value="level3">Level 3 (30 pts)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
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
