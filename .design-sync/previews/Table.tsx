import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "maneuver-2026";

const rows = [
  { team: 3314, name: "Mechanical Mustangs", auto: 6, teleop: 24, climb: "Deep" },
  { team: 254, name: "The Cheesy Poofs", auto: 8, teleop: 31, climb: "Deep" },
  { team: 1678, name: "Citrus Circuits", auto: 7, teleop: 27, climb: "Shallow" },
  { team: 118, name: "Robonauts", auto: 5, teleop: 19, climb: "None" },
];

export function ScoutingSummary() {
  return (
    <Table>
      <TableCaption>Match 42 — Qualification scouting summary</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Team</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Auto</TableHead>
          <TableHead className="text-right">Teleop</TableHead>
          <TableHead>Climb</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.team}>
            <TableCell className="font-medium">{r.team}</TableCell>
            <TableCell>{r.name}</TableCell>
            <TableCell className="text-right">{r.auto}</TableCell>
            <TableCell className="text-right">{r.teleop}</TableCell>
            <TableCell>{r.climb}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total teams scouted</TableCell>
          <TableCell className="text-right" colSpan={2}>
            {rows.length}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
