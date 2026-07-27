import { Kbd, KbdGroup } from "maneuver-2026";

export function QuickScoreShortcuts() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-6 text-sm">
        <span>Log coral scored (auto)</span>
        <KbdGroup>
          <Kbd>1</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-6 text-sm">
        <span>Log algae scored (teleop)</span>
        <KbdGroup>
          <Kbd>2</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-6 text-sm">
        <span>Mark defense played</span>
        <KbdGroup>
          <Kbd>Shift</Kbd>
          <Kbd>D</Kbd>
        </KbdGroup>
      </div>
    </div>
  );
}

export function CommandPalette() {
  return (
    <div className="flex items-center justify-between gap-6 p-4 text-sm w-72">
      <span>Jump to team search</span>
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </div>
  );
}

export function NavigationShortcuts() {
  return (
    <div className="flex items-center justify-between gap-6 p-4 text-sm w-72">
      <span>Next match in queue</span>
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>&rarr;</Kbd>
      </KbdGroup>
    </div>
  );
}
