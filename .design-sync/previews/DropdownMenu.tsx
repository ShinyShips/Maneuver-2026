import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Button,
} from "maneuver-2026";
import { MoreVertical, Pencil, Eye, Trash2 } from "lucide-react";

export function TeamRowActions() {
  return (
    <div className="flex justify-center p-16">
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Team 3314 actions">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Team 3314 — Mechanical Mustangs</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Pencil /> Edit team info
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Eye /> View match history
            <DropdownMenuShortcut>⌘M</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2 /> Remove from event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
