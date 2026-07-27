import { ScrollArea } from "maneuver-2026";

const scoutedTeams = [
  { team: 3314, name: "Mechanical Mustangs" },
  { team: 254, name: "The Cheesy Poofs" },
  { team: 1678, name: "Citrus Circuits" },
  { team: 118, name: "Robonauts" },
  { team: 2056, name: "OP Robotics" },
  { team: 1323, name: "MadTown Robotics" },
  { team: 5940, name: "BREAD" },
  { team: 6328, name: "Mechanical Advantage" },
  { team: 1690, name: "Orbit" },
  { team: 148, name: "Robowranglers" },
  { team: 195, name: "CyberKnights" },
  { team: 4414, name: "High Tide" },
  { team: 973, name: "Greybots" },
  { team: 3476, name: "Code Orange" },
  { team: 2910, name: "Jack in the Bot" },
  { team: 971, name: "Spartan Robotics" },
  { team: 33, name: "Killer Bees" },
  { team: 5406, name: "Celt-X" },
];

export function ScoutedTeamsList() {
  return (
    <ScrollArea orientation="vertical" className="h-72 w-72 rounded-md border">
      <div className="flex flex-col p-2">
        {scoutedTeams.map((t) => (
          <div
            key={t.team}
            className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm"
          >
            <span className="font-medium">{t.team}</span>
            <span className="truncate text-muted-foreground">{t.name}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
