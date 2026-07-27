import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "maneuver-2026";

export function ClimbResult() {
  return (
    <div className="flex justify-center p-16">
      <Select defaultValue="deep">
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select climb result" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No climb</SelectItem>
          <SelectItem value="park">Parked</SelectItem>
          <SelectItem value="shallow">Shallow cage</SelectItem>
          <SelectItem value="deep">Deep cage</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function AllianceOpen() {
  return (
    <div className="flex justify-center p-16">
      <Select defaultValue="red" defaultOpen>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Alliance color" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Alliance</SelectLabel>
            <SelectItem value="red">Red alliance</SelectItem>
            <SelectItem value="blue">Blue alliance</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
