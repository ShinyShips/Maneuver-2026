import { GenericSelector } from "maneuver-2026";

export function AlliancePartnerPicker() {
  const options = ["none", "254", "1678", "2056", "3314"];

  return (
    <div className="w-64">
      <GenericSelector
        label="Alliance partner"
        value="1678"
        availableOptions={options}
        onValueChange={() => {}}
        placeholder="Select team"
        displayFormat={(val) => (val === "none" ? "No team" : `Team ${val}`)}
      />
    </div>
  );
}

export function EventTeamFilter() {
  const options = ["all", "3314", "254", "1678", "118", "2056"];

  return (
    <div className="w-64">
      <GenericSelector
        label="Filter by team"
        multiSelect
        values={["3314", "254"]}
        availableOptions={options}
        onValuesChange={() => {}}
        placeholder="Select teams"
        displayFormat={(val) => (val === "all" ? "All teams" : `Team ${val}`)}
      />
    </div>
  );
}
