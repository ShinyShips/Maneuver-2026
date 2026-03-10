import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/core/components/ui/alert";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";

interface EventDataClearCardProps {
  eventKeys: string[];
  onClearEventData: (eventKey: string) => Promise<void> | void;
}

export const EventDataClearCard = ({ eventKeys, onClearEventData }: EventDataClearCardProps) => {
  const [selectedEventKey, setSelectedEventKey] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const sortedEventKeys = useMemo(
    () => [...eventKeys].sort((a, b) => a.localeCompare(b)),
    [eventKeys]
  );

  const handleConfirmDelete = async () => {
    if (!selectedEventKey) return;

    setIsClearing(true);
    try {
      await onClearEventData(selectedEventKey);
      setShowConfirm(false);
      setSelectedEventKey("");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Delete Specific Event Data</CardTitle>
          <Badge variant={sortedEventKeys.length > 0 ? "default" : "secondary"}>
            {sortedEventKeys.length} events
          </Badge>
        </div>
        <CardDescription>
          Delete data for a single event while keeping all other event data on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedEventKey} onValueChange={setSelectedEventKey}>
          <SelectTrigger>
            <SelectValue placeholder={sortedEventKeys.length > 0 ? "Select an event" : "No events found"} />
          </SelectTrigger>
          <SelectContent>
            {sortedEventKeys.map((eventKey) => (
              <SelectItem key={eventKey} value={eventKey}>
                {eventKey}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!showConfirm ? (
          <Button
            variant="destructive"
            className="w-full"
            disabled={!selectedEventKey || isClearing}
            onClick={() => setShowConfirm(true)}
          >
            Delete Selected Event
          </Button>
        ) : (
          <div className="space-y-3">
            <Alert>
              <AlertTriangle className="h-5 w-5" color="red" />
              <AlertDescription>
                This will permanently delete all stored scouting and cached API data for <strong>{selectedEventKey}</strong>.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled={isClearing}
                onClick={handleConfirmDelete}
              >
                {isClearing ? "Deleting..." : "Yes, Delete Event"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isClearing}
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
