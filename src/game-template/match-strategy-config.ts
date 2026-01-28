/**
 * Match Strategy Page Configuration
 * 
 * Defines the structure and display of team statistics on the Match Strategy page.
 * This configuration makes the page year-agnostic by allowing customization of:
 * - Which stats to display in each phase (overall, auto, teleop, endgame)
 * - Stat labels and formatting
 * - Colors and display properties
 */

export interface MatchStrategyStatConfig {
    key: string;  // Path to stat in TeamStats object (e.g., "rawValues.totalFuel")
    label: string;  // Display label
    color?: string;  // Tailwind color class (e.g., "text-orange-600")
    format?: 'number' | 'percent';  // How to display the value
    decimals?: number;  // Number of decimal places (default: 1)
    aggregation?: 'average' | 'max' | 'p75' | 'sum';  // How to aggregate rawValues arrays (default: 'average')
}

export interface MatchStrategyPhaseConfig {
    id: string;  // Phase ID (overall, auto, teleop, endgame)
    label: string;  // Display label
    stats: MatchStrategyStatConfig[];  // Stats to display in this phase
    gridCols?: number;  // Number of grid columns (default: 3)
}

/**
 * Match Strategy Page Configuration
 * 
 * Customize this for each game year to display relevant stats.
 */
export const matchStrategyConfig: {
    phases: MatchStrategyPhaseConfig[];
    fieldLayout?: {
        TEAM_LABEL_FONT_SIZE_RATIO: number;
        BLUE_ALLIANCE_X_POSITION: number;
        RED_ALLIANCE_X_POSITION: number;
        TEAM_POSITION_TOP_Y: number;
        TEAM_POSITION_MIDDLE_Y: number;
        TEAM_POSITION_BOTTOM_Y: number;
    };
} = {
    phases: [
        {
            id: 'overall',
            label: 'Overall',
            gridCols: 3,
            stats: [
                {
                    key: 'avgTotalFuel',
                    label: 'Avg Fuel Scored',
                    color: 'text-orange-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average'
                },
                {
                    key: 'avgFuelPassed',
                    label: 'Avg Fuel Passed',
                    color: 'text-green-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average'
                },
                {
                    key: 'avgTotalPoints',
                    label: 'Avg Points',
                    color: 'text-blue-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average'
                }
            ]
        },
        {
            id: 'auto',
            label: 'Auto',
            gridCols: 4,
            stats: [
                {
                    key: 'avgAutoFuel',
                    label: 'Fuel Scored',
                    color: 'text-orange-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average'
                },
                {
                    key: 'avgAutoFuelPassed',
                    label: 'Fuel Passed',
                    color: 'text-green-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average'
                },
                {
                    key: 'autoClimbAttempts',
                    label: 'L1 Climbs',
                    color: 'text-purple-600',
                    format: 'number',
                    decimals: 0
                },
                {
                    key: 'autoClimbRate',
                    label: 'L1 Success',
                    color: 'text-blue-600',
                    format: 'percent',
                    decimals: 0
                }
            ]
        },
        {
            id: 'teleop',
            label: 'Teleop',
            gridCols: 4,
            stats: [
                {
                    key: 'avgTeleopFuel',
                    label: 'Fuel Scored',
                    color: 'text-orange-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average'
                },
                {
                    key: 'avgTeleopFuelPassed',
                    label: 'Fuel Passed',
                    color: 'text-green-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average'
                },
                {
                    key: 'primaryActiveRole',
                    label: 'Active Role',
                    color: 'text-blue-600'
                },
                {
                    key: 'primaryInactiveRole',
                    label: 'Inactive Role',
                    color: 'text-purple-600'
                }
            ]
        },
        {
            id: 'endgame',
            label: 'Endgame',
            gridCols: 4,
            stats: [
                {
                    key: 'endgame.climbRate',
                    label: 'Climb %',
                    color: 'text-purple-600',
                    format: 'percent',
                    decimals: 0
                },
                {
                    key: 'climbL1Rate',
                    label: 'L1 (10pts)',
                    color: 'text-green-600',
                    format: 'percent',
                    decimals: 0
                },
                {
                    key: 'climbL2Rate',
                    label: 'L2 (20pts)',
                    color: 'text-blue-600',
                    format: 'percent',
                    decimals: 0
                },
                {
                    key: 'climbL3Rate',
                    label: 'L3 (30pts)',
                    color: 'text-orange-600',
                    format: 'percent',
                    decimals: 0
                }
            ]
        }
    ],
    fieldLayout: {
        TEAM_LABEL_FONT_SIZE_RATIO: 0.02,
        BLUE_ALLIANCE_X_POSITION: 0.03, // Left edge
        RED_ALLIANCE_X_POSITION: 0.97,  // Right edge
        TEAM_POSITION_TOP_Y: 0.275,
        TEAM_POSITION_MIDDLE_Y: 0.505,
        TEAM_POSITION_BOTTOM_Y: 0.735,
    }
};

/**
 * Aggregate an array of values based on the specified method
 */
export function aggregateValues(
    values: number[],
    method: 'average' | 'max' | 'p75' | 'sum' = 'average'
): number {
    if (values.length === 0) return 0;

    switch (method) {
        case 'average': {
            const sum = values.reduce((acc, val) => acc + val, 0);
            return sum / values.length;
        }
        case 'max': {
            return Math.max(...values);
        }
        case 'p75': {
            const sorted = [...values].sort((a, b) => a - b);
            const index = Math.ceil(sorted.length * 0.75) - 1;
            return sorted[index] ?? 0;
        }
        case 'sum': {
            return values.reduce((acc, val) => acc + val, 0);
        }
        default:
            return 0;
    }
}

/**
 * Helper function to get a stat value from TeamStats object using a key path
 * Example: getStatValue(stats, "rawValues.totalFuel") => stats.rawValues.totalFuel
 * 
 * If the value is an array and aggregation is specified, it will aggregate the values.
 */
export function getStatValue(
    stats: any,
    keyPath: string,
    aggregation?: 'average' | 'max' | 'p75' | 'sum'
): number | string | undefined {
    const keys = keyPath.split('.');
    let value = stats;

    for (const key of keys) {
        if (value === null || value === undefined) return undefined;
        value = value[key];
    }

    // If value is an array and aggregation is specified, aggregate it
    if (Array.isArray(value) && aggregation) {
        return aggregateValues(value, aggregation);
    }

    return (typeof value === 'number' || typeof value === 'string') ? value : undefined;
}

/**
 * Format a stat value for display
 */
export function formatStatValue(
    value: number | string | undefined,
    format: 'number' | 'percent' = 'number',
    decimals: number = 1
): string {
    if (value === undefined || value === null) return '-';

    // If it's a string, return as-is
    if (typeof value === 'string') return value;

    const rounded = Number(value.toFixed(decimals));

    if (format === 'percent') {
        return `${rounded}%`;
    }

    return rounded.toString();
}
