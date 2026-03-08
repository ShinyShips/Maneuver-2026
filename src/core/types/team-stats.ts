/**
 * Shared TeamStats type used across all pages (Strategy Overview, Match Strategy, etc.)
 * This is the output of the centralized calculateTeamStats function.
 */

export interface TeamStats {
    // Basic info
    teamNumber: number;
    eventKey: string;
    matchCount: number;

    // Aggregate scores
    totalPoints: number;
    autoPoints: number;
    teleopPoints: number;
    endgamePoints: number;

    // Overall phase stats
    overall: {
        avgTotalPoints: number;
        totalPiecesScored: number;
        avgGamePiece1: number;  // Generic: could be coral, notes, cargo, etc.
        avgGamePiece2: number;  // Generic: could be algae, cones, etc.
    };

    // Autonomous phase stats
    auto: {
        avgPoints: number;
        avgGamePiece1: number;
        avgGamePiece2: number;
        mobilityRate: number;  // Percentage
        startPositions: Array<{ position: string; percentage: number }>;
    };

    // Teleop phase stats
    teleop: {
        avgPoints: number;
        avgGamePiece1: number;
        avgGamePiece2: number;
    };

    // Endgame phase stats
    endgame: {
        avgPoints: number;
        climbRate: number;      // Generic climb success rate
        parkRate: number;       // Percentage
        // Game-specific climb types (optional)
        shallowClimbRate?: number;
        deepClimbRate?: number;
    };

    // Raw values for box plots and distribution charts
    rawValues?: {
        totalPoints: number[];
        autoPoints: number[];
        teleopPoints: number[];
        endgamePoints: number[];
        [key: string]: number[];  // Allow additional raw value arrays
    };

    // Allow additional game-specific fields
    [key: string]: any;
}

/**
 * TeamStats with ID for use in data tables
 */
export interface TeamStatsWithId extends TeamStats {
    id: string;  // Usually same as teamNumber
}
