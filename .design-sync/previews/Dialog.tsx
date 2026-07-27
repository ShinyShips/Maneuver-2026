import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Label,
  Input,
  Textarea,
} from "maneuver-2026";

export function EditMatchNotes() {
  return (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Match Notes</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Match Notes</DialogTitle>
          <DialogDescription>
            Match 42 · Qualification · Team 3314
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="auto-notes">Auto notes</Label>
            <Input
              id="auto-notes"
              defaultValue="Left start line, scored 1 coral on L4"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="teleop-notes">Teleop notes</Label>
            <Textarea
              id="teleop-notes"
              rows={3}
              defaultValue="Consistent cycles to L3, played defense in closing 20s, no fouls observed."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
