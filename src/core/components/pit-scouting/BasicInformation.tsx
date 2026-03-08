import { Label } from "@/core/components/ui/label";
import { Input } from "@/core/components/ui/input";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { EventNameSelector } from "@/core/components/GameStartComponents/EventNameSelector";
import { User, Hash, Calendar, FolderOpen } from "lucide-react";

interface BasicInformationProps {
  teamNumber: number | "";
  eventKey: string;
  scoutName: string;
  onTeamNumberChange: (value: number | "") => void;
  onEventKeyChange: (value: string) => void;
  onScoutNameChange: (value: string) => void;
  onLoadExisting?: () => void;
  isLoading?: boolean;
}

export function BasicInformation({
  teamNumber,
  eventKey,
  scoutName,
  onTeamNumberChange,
  onEventKeyChange,
  onScoutNameChange,
  onLoadExisting,
  isLoading = false,
}: BasicInformationProps) {
  const handleTeamNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
      onTeamNumberChange("");
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0) {
        onTeamNumberChange(numValue);
      }
    }
  };

  const canLoadExisting = teamNumber !== "" && eventKey !== "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </CardTitle>
          {onLoadExisting && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadExisting}
              disabled={isLoading || !canLoadExisting}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Load Existing
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Number Input */}
        <div className="space-y-2">
          <Label htmlFor="teamNumber" className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Team Number *
          </Label>
          <Input
            id="teamNumber"
            type="number"
            placeholder="e.g., 3314"
            value={teamNumber === "" ? "" : teamNumber}
            onChange={handleTeamNumberChange}
            min="1"
            step="1"
            required
            className="text-lg"
          />
        </div>

        {/* Event Selector */}
        <div className="space-y-2">
          <Label htmlFor="eventKey" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Event *
          </Label>
          <EventNameSelector
            currentEventKey={eventKey}
            onEventKeyChange={onEventKeyChange}
          />
        </div>

        {/* Scout Name Input */}
        <div className="space-y-2">
          <Label htmlFor="scoutName" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Scout Name *
          </Label>
          <Input
            id="scoutName"
            type="text"
            placeholder="Your name"
            value={scoutName}
            onChange={(e) => onScoutNameChange(e.target.value)}
            required
            className="text-lg"
          />
        </div>
      </CardContent>
    </Card>
  );
}
