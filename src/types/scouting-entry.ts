/**
 * ScoutingEntryBase
 * 
 * The base interface that all game-specific scouting entries must extend.
 * This defines the year-agnostic fields that the framework needs to function.
 * 
 * ID Format: "eventKey::matchKey::teamNumber::alliance"
 * Example: "2025mrcmp::qm24::10143::red"
 * 
 * STRUCTURE NOTE:
 * Base fields (id, scoutName, teamNumber, etc.) are stored at the ROOT level.
 * Game-specific fields are stored in a separate "gameData" object for clean separation.
 * Field order follows the match timeline: base info → gameData → comments (gathered last).
 * 
 * Example in database:
 * {
 *   "id": "2025mrcmp::qm100::3314::red",
 *   "scoutName": "Alice",
 *   "teamNumber": 3314,
 *   "matchNumber": 100,
 *   "eventKey": "2025mrcmp",
 *   "matchKey": "qm100",
 *   "allianceColor": "red",
 *   "timestamp": 1760480094754,
 *   "gameData": {
 *    // Game-specific fields go here, organized by phase
 *     "auto": {
 *       "startPosition": 2,
 *       "action1Count": 3
 *     },
 *     "teleop": {
 *       "action1Count": 5
 *     },
 *     "endgame": {
 *       "option1": true
 *     }
 *   },
 *   "comments": "Robot performed well",
 *   "isCorrected": true,
 *   "correctionCount": 1,
 *   "lastCorrectedAt": 1728849900000,
 *   "lastCorrectedBy": "Alice",
 * }
 */
export interface ScoutingEntryBase {
  /**
   * Unique identifier: eventKey::matchKey::teamNumber::alliance
   */
  id: string;

  /**
   * Name of the scout who recorded this entry
   */
  scoutName: string;

  /**
   * Team number being scouted
   */
  teamNumber: number;

  /**
   * Match number (numeric, extracted from matchKey for sorting)
   * Examples: 24, 1, 2
   */
  matchNumber: number;

  /**
   * TBA event key
   * Examples: "2025mrcmp", "2025casd"
   */
  eventKey: string;

  /**
   * TBA match key (REQUIRED for validation)
   * Format: "qm{n}" for quals, "sf{n}m{n}" for semis, "f1m{n}" for finals
   * Examples: "qm24", "sf1m1", "f1m2"
   */
  matchKey: string;

  /**
   * Alliance color: "red" or "blue"
   */
  allianceColor: 'red' | 'blue';

  /**
   * Timestamp when entry was created (Unix timestamp in milliseconds)
   */
  timestamp: number;

  /**
   * Game-specific data object
   * All year-specific fields are stored here for clean separation.
   * Organized by phase: auto → teleop → endgame
   */
  gameData: Record<string, unknown>;

  /**
   * Optional notes/comments from the scout
   * Gathered last in the match timeline (endgame page)
   */
  comments?: string;

  /**
   * Whether this entry has been corrected/edited after initial submission
   */
  isCorrected?: boolean;

  /**
   * Number of times this entry has been corrected
   */
  correctionCount?: number;

  /**
   * Timestamp of the last correction (Unix timestamp in milliseconds)
   */
  lastCorrectedAt?: number;

  /**
   * Name of the person who made the last correction
   */
  lastCorrectedBy?: string;

  /**
   * Notes about why the correction was made
   */
  correctionNotes?: string;
}
