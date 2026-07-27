import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "maneuver-2026";
import { Users, PlusCircle, ScanLine, Download } from "lucide-react";

export function ScoutingPalette() {
  return (
    <div className="flex justify-center p-6">
      <Command className="w-96 rounded-lg border shadow-md">
        <CommandInput placeholder="Jump to a team, match, or action..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Teams">
            <CommandItem>
              <Users /> Team 3314 — Mechanical Mustangs
            </CommandItem>
            <CommandItem>
              <Users /> Team 254 — The Cheesy Poofs
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem>
              <PlusCircle /> New match scouting entry
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <ScanLine /> Scan QR transfer
            </CommandItem>
            <CommandItem>
              <Download /> Export scouting data (CSV)
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
