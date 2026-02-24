/**
 * Game-Specific Data Transformation - 2026 REBUILT
 * 
 * Transforms PathWaypoint data from AutoFieldMap into counter fields.
 * Full path is stored for visualization replay.
 * 
 * 2026 Path-Based Tracking:
 * - score: Fuel deposited at hub -> fuelScoredCount
 * - collect: Fuel collected -> fuelCollectedCount
 * - pass: Fuel passed to alliance zone -> fuelPassedCount
 * - traversal: Trench/bump usage -> trenchUsedCount, bumpUsedCount
 * - foul: Mid-line violation -> foulCommittedCount
 * 
 * DERIVED FROM: game-schema.ts
 */

import type { DataTransformation } from "@/types/game-interfaces";
import { toggles, getActionKeys } from "./game-schema";

/**
 * Generate default values for action counters
 * Only includes actions that are actually used in each phase
 */
function generateActionDefaults(phase: 'auto' | 'teleop'): Record<string, number> {
  const defaults: Record<string, number> = {};

  // Actions tracked in both phases
  const commonActions = ['fuelScored', 'fuelPassed', 'shotOnTheMove', 'shotStationary', 'trenchStuck', 'bumpStuck', 'brokenDown'];

  // Auto-only actions
  const autoOnlyActions = ['depotCollect', 'outpostCollect', 'foulCommitted'];

  // Teleop-only actions
  const teleopOnlyActions: string[] = ['steal'];

  const actionsToInclude = phase === 'auto'
    ? [...commonActions, ...autoOnlyActions]
    : [...commonActions, ...teleopOnlyActions];

  actionsToInclude.forEach(key => {
    defaults[`${key}Count`] = 0;
    // Initialize duration for actions that track time
    if (key.includes('Stuck') || key === 'brokenDown') {
      defaults[`${key}Duration`] = 0;
    }
  });

  return defaults;
}

/**
 * Generate default values for toggle fields
 */
function generateToggleDefaults(phase: 'auto' | 'teleop' | 'endgame'): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  const phaseToggles = toggles[phase];
  Object.keys(phaseToggles).forEach(key => {
    defaults[key] = false;
  });
  return defaults;
}

export const gameDataTransformation: DataTransformation = {
  transformActionsToCounters(matchData) {
    // Extract start position from explicit array (AutoStartPage) or from path data
    let startPosition: number | null = null;

    // First check explicit startPosition array (from AutoStartPage)
    if (matchData.startPosition && Array.isArray(matchData.startPosition)) {
      const selectedPosition = matchData.startPosition.findIndex((pos: boolean) => pos === true);
      if (selectedPosition >= 0) {
        startPosition = selectedPosition;
      }
    }

    // Extract start position from 'start' type waypoint in path
    // UI enforces start position selection before any other actions
    if (startPosition === null && matchData.autoActions && matchData.autoActions.length > 0) {
      const startWaypoint = matchData.autoActions.find((wp: any) => wp.type === 'start');

      if (startWaypoint && startWaypoint.action) {
        // Map field element keys to position indices
        // Order matches field layout from top to bottom
        const startPositionMap: Record<string, number> = {
          'trench1': 0,     // Upper trench
          'bump1': 1,       // Upper bump  
          'hub': 2,         // Center at hub
          'bump2': 3,       // Lower bump
          'trench2': 4,     // Lower trench
        };

        const mappedPosition = startPositionMap[startWaypoint.action];
        if (mappedPosition !== undefined) {
          startPosition = mappedPosition;
        }
      }
    }

    // Initialize with schema-derived defaults
    const result: Record<string, any> = {
      auto: {
        startPosition,
        // Path data for visualization/replay
        autoPath: [],
        // Note: alliance is stored at top-level scoutingEntry.allianceColor
        ...generateActionDefaults('auto'),
        ...generateToggleDefaults('auto'),
      },
      teleop: {
        ...generateActionDefaults('teleop'),
        ...generateToggleDefaults('teleop'),
      },
      endgame: {
        ...generateToggleDefaults('endgame'),
      },
    };

    // =========================================================================
    // Broken Down Time Tracking (from localStorage)
    // =========================================================================

    // Read broken down time from localStorage (set by field maps)
    const autoBrokenDownTime = localStorage.getItem('autoBrokenDownTime');
    const teleopBrokenDownTime = localStorage.getItem('teleopBrokenDownTime');

    if (autoBrokenDownTime) {
      const duration = parseInt(autoBrokenDownTime, 10);
      if (duration > 0) {
        result.auto.brokenDownCount = 1;
        result.auto.brokenDownDuration = duration;
      }
      // Clear after reading
      localStorage.removeItem('autoBrokenDownTime');
      localStorage.removeItem('autoBrokenDownStart');
    }

    if (teleopBrokenDownTime) {
      const duration = parseInt(teleopBrokenDownTime, 10);
      if (duration > 0) {
        result.teleop.brokenDownCount = 1;
        result.teleop.brokenDownDuration = duration;
      }
      // Clear after reading
      localStorage.removeItem('teleopBrokenDownTime');
      localStorage.removeItem('teleopBrokenDownStart');
    }

    // =========================================================================
    // Path-Based Tracking (AutoFieldMap waypoints)
    // =========================================================================

    // Store full path for visualization
    if (matchData.autoActions && Array.isArray(matchData.autoActions)) {
      result.auto.autoPath = matchData.autoActions;

      // Aggregate counters from path waypoints
      matchData.autoActions.forEach((wp: any) => {
        switch (wp.type) {
          case 'score':
            // fuelDelta is negative for deposits (robot loses fuel)
            result.auto.fuelScoredCount = (result.auto.fuelScoredCount || 0) + Math.abs(wp.fuelDelta || 0);
            if (wp.shotType === 'onTheMove') {
              result.auto.shotOnTheMoveCount = (result.auto.shotOnTheMoveCount || 0) + 1;
            } else if (wp.shotType === 'stationary') {
              result.auto.shotStationaryCount = (result.auto.shotStationaryCount || 0) + 1;
            }
            break;
          case 'collect':
            // Track by location (depot vs outpost)
            if (wp.action === 'depot') {
              result.auto.depotCollectCount = (result.auto.depotCollectCount || 0) + 1;
            } else if (wp.action === 'outpost') {
              result.auto.outpostCollectCount = (result.auto.outpostCollectCount || 0) + 1;
            }
            break;
          case 'pass':
            // fuelDelta is negative for passing (robot loses fuel)
            result.auto.fuelPassedCount = (result.auto.fuelPassedCount || 0) + Math.abs(wp.fuelDelta || 0);
            break;
          case 'traversal':
            // Boolean flags for trench/bump usage in auto
            if (wp.action === 'trench') {
              result.auto.autoTrench = true;
            } else if (wp.action === 'bump') {
              result.auto.autoBump = true;
            } else if (wp.action === 'trench-stuck') {
              // Legacy: traversal-stuck from old flow (no duration)
              result.auto.trenchStuckCount = (result.auto.trenchStuckCount || 0) + 1;
            } else if (wp.action === 'bump-stuck') {
              result.auto.bumpStuckCount = (result.auto.bumpStuckCount || 0) + 1;
            }
            break;
          case 'foul':
            result.auto.foulCommittedCount = (result.auto.foulCommittedCount || 0) + 1;
            break;
          case 'climb':
            if (typeof wp.climbStartTimeSecRemaining === 'number') {
              result.auto.autoClimbStartTimeSecRemaining = wp.climbStartTimeSecRemaining;
            }
            if (wp.climbLocation === 'side') {
              result.auto.autoClimbFromSide = true;
            } else if (wp.climbLocation === 'middle') {
              result.auto.autoClimbFromMiddle = true;
            }
            if (wp.action === 'climb-success') {
              result.auto.autoClimbL1 = true;
            }
            break;
          case 'unstuck':
            // Track stuck count and duration by obstacle type (new persistent stuck flow)
            if (wp.obstacleType === 'trench') {
              result.auto.trenchStuckCount = (result.auto.trenchStuckCount || 0) + 1;
              result.auto.trenchStuckDuration = (result.auto.trenchStuckDuration || 0) + (wp.duration || 0);
            } else if (wp.obstacleType === 'bump') {
              result.auto.bumpStuckCount = (result.auto.bumpStuckCount || 0) + 1;
              result.auto.bumpStuckDuration = (result.auto.bumpStuckDuration || 0) + (wp.duration || 0);
            }
            break;
          case 'broken-down':
            // Track broken down incidents
            result.auto.brokenDownCount = (result.auto.brokenDownCount || 0) + 1;
            result.auto.brokenDownDuration = (result.auto.brokenDownDuration || 0) + (wp.duration || 0);
            break;
          // 'start' and 'stuck' types don't increment counters here
        }
      });
    }

    // Process teleop actions (path-based tracking from TeleopFieldMap)
    if (matchData.teleopActions && Array.isArray(matchData.teleopActions)) {
      // Store full path for visualization
      result.teleop.teleopPath = matchData.teleopActions;

      matchData.teleopActions.forEach((wp: any) => {
        switch (wp.type) {
          case 'score':
            result.teleop.fuelScoredCount = (result.teleop.fuelScoredCount || 0) + Math.abs(wp.fuelDelta || 0);
            if (wp.shotType === 'onTheMove') {
              result.teleop.shotOnTheMoveCount = (result.teleop.shotOnTheMoveCount || 0) + 1;
            } else if (wp.shotType === 'stationary') {
              result.teleop.shotStationaryCount = (result.teleop.shotStationaryCount || 0) + 1;
            }
            break;
          case 'pass':
            result.teleop.fuelPassedCount = (result.teleop.fuelPassedCount || 0) + Math.abs(wp.fuelDelta || 0);
            break;
          case 'climb': {
            // Track climb level, location, and outcome in endgame section
            if (typeof wp.climbStartTimeSecRemaining === 'number') {
              result.teleop.teleopClimbStartTimeSecRemaining = wp.climbStartTimeSecRemaining;
            }
            const level = [1, 2, 3].includes(wp.climbLevel) ? wp.climbLevel : 1;
            if (wp.climbLocation === 'side') {
              result.endgame.climbFromSide = true;
            } else if (wp.climbLocation === 'middle') {
              result.endgame.climbFromMiddle = true;
            }
            if (wp.climbResult === 'success') {
              result.endgame[`climbL${level}`] = true;
            } else if (wp.climbResult === 'fail') {
              result.endgame.climbFailed = true;
            }
            break;
          }
          case 'defense':
            // Track defense by zone
            if (wp.zone === 'allianceZone') {
              result.teleop.defenseAllianceCount = (result.teleop.defenseAllianceCount || 0) + 1;
            } else if (wp.zone === 'neutralZone') {
              result.teleop.defenseNeutralCount = (result.teleop.defenseNeutralCount || 0) + 1;
            } else if (wp.zone === 'opponentZone') {
              result.teleop.defenseOpponentCount = (result.teleop.defenseOpponentCount || 0) + 1;
            }
            break;
          case 'steal':
            result.teleop.stealCount = (result.teleop.stealCount || 0) + 1;
            break;
          case 'unstuck':
            // Track stuck count and duration by obstacle type
            if (wp.obstacleType === 'trench') {
              result.teleop.trenchStuckCount = (result.teleop.trenchStuckCount || 0) + 1;
              result.teleop.trenchStuckDuration = (result.teleop.trenchStuckDuration || 0) + (wp.duration || 0);
            } else if (wp.obstacleType === 'bump') {
              result.teleop.bumpStuckCount = (result.teleop.bumpStuckCount || 0) + 1;
              result.teleop.bumpStuckDuration = (result.teleop.bumpStuckDuration || 0) + (wp.duration || 0);
            }
            break;
          case 'broken-down':
            // Track broken down incidents
            result.teleop.brokenDownCount = (result.teleop.brokenDownCount || 0) + 1;
            result.teleop.brokenDownDuration = (result.teleop.brokenDownDuration || 0) + (wp.duration || 0);
            break;
          // 'stuck' type is the start marker - we only count on 'unstuck' which has the duration
        }
      });
    }

    // =========================================================================
    // Legacy Support: Bulk counter data (from counter UI)
    // =========================================================================

    if (matchData.autoData) {
      const actionKeys = getActionKeys();
      actionKeys.forEach(key => {
        const countKey = `${key}Count`;
        if (matchData.autoData[countKey] !== undefined) {
          result.auto[countKey] = (result.auto[countKey] || 0) + matchData.autoData[countKey];
        }
      });
    }

    if (matchData.teleopData) {
      const actionKeys = getActionKeys();
      actionKeys.forEach(key => {
        const countKey = `${key}Count`;
        if (matchData.teleopData[countKey] !== undefined) {
          result.teleop[countKey] = (result.teleop[countKey] || 0) + matchData.teleopData[countKey];
        }
      });
    }

    // Copy robot status flags (from StatusToggles component)
    if (matchData.autoRobotStatus) Object.assign(result.auto, matchData.autoRobotStatus);
    if (matchData.teleopRobotStatus) Object.assign(result.teleop, matchData.teleopRobotStatus);
    if (matchData.endgameRobotStatus) Object.assign(result.endgame, matchData.endgameRobotStatus);

    // Copy any additional fields
    const additionalFields = { ...matchData };
    delete additionalFields.autoActions;
    delete additionalFields.teleopActions;
    delete additionalFields.autoData;
    delete additionalFields.teleopData;
    delete additionalFields.autoRobotStatus;
    delete additionalFields.teleopRobotStatus;
    delete additionalFields.endgameRobotStatus;
    delete additionalFields.startPosition;
    delete additionalFields.alliance;

    Object.assign(result, additionalFields);

    return result;
  }
};

export default gameDataTransformation;

/**
 * Game-specific gameData fields to exclude from CSV export.
 * These are large visualization/replay arrays not useful for spreadsheet analysis.
 */
export const csvExcludedFields: string[] = ['auto.autoPath', 'teleop.teleopPath'];

/**
 * Game-specific pit scouting gameData fields to exclude from CSV export.
 * These are large visualization/replay arrays not useful for spreadsheet analysis.
 */
export const pitCsvExcludedFields: string[] = ['reportedAutosByStart'];
