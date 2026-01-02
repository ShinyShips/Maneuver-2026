
// DEPRECATED: This header is 2025-specific and should not be used in core framework
// CSV export now dynamically generates headers from actual data structure
// For 2025-specific reference, see: src/game-template/tba/tbaMatchData2025.ts
// TODO: Remove this entirely or move to maneuver-2025 implementation
export const SCOUTING_DATA_HEADER = [
  "id","matchNumber","alliance","scoutName","selectTeam",
  "startPoses0","startPoses1","startPoses2","startPoses3","startPoses4","startPoses5",
  "autoCoralPlaceL1Count","autoCoralPlaceL2Count","autoCoralPlaceL3Count","autoCoralPlaceL4Count","autoCoralPlaceDropMissCount",
  "autoCoralPickPreloadCount","autoCoralPickStationCount","autoCoralPickMark1Count","autoCoralPickMark2Count","autoCoralPickMark3Count",
  "autoAlgaePlaceNetShot","autoAlgaePlaceProcessor","autoAlgaePlaceDropMiss","autoAlgaePlaceRemove",
  "autoAlgaePickReefCount","autoAlgaePickMark1Count","autoAlgaePickMark2Count","autoAlgaePickMark3Count",
  "autoPassedStartLine",
  "teleopCoralPlaceL1Count","teleopCoralPlaceL2Count","teleopCoralPlaceL3Count","teleopCoralPlaceL4Count","teleopCoralPlaceDropMissCount",
  "teleopCoralPickStationCount","teleopCoralPickCarpetCount",
  "teleopAlgaePlaceNetShot","teleopAlgaePlaceProcessor","teleopAlgaePlaceDropMiss","teleopAlgaePlaceRemove",
  "teleopAlgaePickReefCount","teleopAlgaePickCarpetCount",
  "shallowClimbAttempted","deepClimbAttempted","parkAttempted","climbFailed","playedDefense","brokeDown","comment"
];
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function convertArrayOfArraysToCSV(data: (string | number)[][]): string {
  return data
    .map((row) =>
      row
        .map((item) =>
          typeof item === "string"
            ? `"${item.replace(/"/g, '""')}"`
            : item
        )
        .join(",")
    )
    .join("\n");
}

export const convertTeamRole = (value: string | null) => {
      switch (value) {
        case "lead":
          return "Lead";
        case "red-1":
          return "Red 1";
        case "red-2":
          return "Red 2";
        case "red-3":
          return "Red 3";
        case "blue-1":
          return "Blue 1";
        case "blue-2":
          return "Blue 2";
        case "blue-3":
          return "Blue 3";
      }
      return "Role";
    };

/**
 * Clears all scouting session data from localStorage
 * This includes actions, robot status, and undo history for all phases
 * 
 * Use this when:
 * - Match is successfully submitted (EndgamePage)
 * - User confirms abandoning a match (NavigationConfirmDialog)
 * - Resetting scouting state
 */
export function clearScoutingLocalStorage() {
  localStorage.removeItem("autoStateStack");
  localStorage.removeItem("teleopStateStack");
  localStorage.removeItem("autoRobotStatus");
  localStorage.removeItem("teleopRobotStatus");
  localStorage.removeItem("endgameRobotStatus");
  localStorage.removeItem("autoUndoHistory");
  localStorage.removeItem("teleopUndoHistory");
}
