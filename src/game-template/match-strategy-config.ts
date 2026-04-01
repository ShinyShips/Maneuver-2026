/**
 * Match Strategy Page Configuration
 * 
 * Defines the structure and display of team statistics on the Match Strategy page.
 * This configuration makes the page year-agnostic by allowing customization of:
 * - Which stats to display in each phase (overall, auto, teleop, endgame)
 * - Stat labels and formatting
 * - Colors and display properties
 */

import type { TeamStats } from "@/core/types/team-stats";

export type MatchStrategyDisplayMode = 'scouted' | 'scaled' | 'copr' | 'epa' | 'opr';

interface MatchStrategyValueOverride {
    key?: string;
    label?: string;
    color?: string;
    format?: 'number' | 'percent';
    decimals?: number;
    aggregation?: 'average' | 'max' | 'p75' | 'sum';
    hidden?: boolean;
}

interface MatchStrategyValueConfig {
    color?: string;
    format?: 'number' | 'percent';
    decimals?: number;
    aggregation?: 'average' | 'max' | 'p75' | 'sum';
    modes?: Partial<Record<MatchStrategyDisplayMode, MatchStrategyValueOverride>>;
}

export interface MatchStrategyResolvedValueConfig {
    key: string;
    label: string;
    color?: string;
    format?: 'number' | 'percent';
    decimals?: number;
    aggregation?: 'average' | 'max' | 'p75' | 'sum';
}

export interface MatchStrategyStatConfig extends MatchStrategyValueConfig {
    key: string;  // Path to stat in TeamStats object (e.g., "rawValues.totalFuel")
    label: string;  // Display label
}

export interface MatchStrategySummaryConfig extends MatchStrategyValueConfig {
    key: string;
    label: string;
}

export interface MatchStrategyPhaseConfig {
    id: string;  // Phase ID (overall, auto, teleop, endgame)
    label: string;  // Display label
    stats: MatchStrategyStatConfig[];  // Stats to display in this phase
    extraStatsByMode?: Partial<Record<MatchStrategyDisplayMode, MatchStrategyStatConfig[]>>;
    gridCols?: number;  // Number of grid columns (default: 3)
    summary?: MatchStrategySummaryConfig;
}

export const matchStrategyDisplayModes: Array<{ id: MatchStrategyDisplayMode; label: string }> = [
    { id: 'scouted', label: 'Scouted' },
    { id: 'scaled', label: 'Scaled' },
    { id: 'copr', label: 'cOPR' },
    { id: 'epa', label: 'EPA' },
    { id: 'opr', label: 'OPR' },
];

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
            summary: {
                key: 'overall.avgTotalPoints',
                label: 'Total Points',
                modes: {
                    scaled: { key: 'avgScaledTotalFuel', label: 'Total Fuel' },
                    copr: { key: 'coprTotalPoints', label: 'Total Points' },
                    epa: { key: 'statboticsTotalPoints', label: 'Total Points' },
                    opr: { key: 'fuelTotalOPR', label: 'Fuel Total OPR' },
                },
            },
            stats: [
                {
                    key: 'avgTotalFuel',
                    label: 'Avg Fuel Scored',
                    color: 'text-orange-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average',
                    modes: {
                        scaled: { key: 'avgScaledTotalFuel', label: 'Scaled Fuel' },
                        copr: { key: 'coprTotalPoints', label: 'cOPR Points' },
                        epa: { key: 'statboticsTotalFuel', label: 'Total Fuel' },
                        opr: { key: 'fuelTotalOPR', label: 'Fuel Total OPR' },
                    }
                },
                {
                    key: 'avgFuelPassed',
                    label: 'Avg Fuel Passed',
                    color: 'text-green-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average',
                    modes: {
                        scaled: { hidden: true },
                        copr: { key: 'coprTotalTowerPoints', label: 'Tower Points' },
                        epa: { key: 'statboticsTotalTower', label: 'Tower Points' },
                        opr: { hidden: true },
                    }
                },
                {
                    key: 'avgTotalPoints',
                    label: 'Avg Points',
                    color: 'text-blue-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average',
                    modes: {
                        scaled: { hidden: true },
                        epa: { key: 'statboticsTotalPoints', label: 'Total Points' },
                        opr: { hidden: true },
                    }
                },
                {
                    key: 'brokeDownCount',
                    label: 'Breakdowns',
                    color: 'text-red-600',
                    format: 'number',
                    decimals: 0
                },
                {
                    key: 'noShowCount',
                    label: 'No Shows',
                    color: 'text-orange-600',
                    format: 'number',
                    decimals: 0
                }
            ]
        },
        {
            id: 'auto',
            label: 'Auto',
            gridCols: 4,
            summary: {
                key: 'auto.avgPoints',
                label: 'Auto Points',
                modes: {
                    scaled: { key: 'avgScaledAutoFuel', label: 'Auto Fuel' },
                    copr: { key: 'coprTotalAutoPoints', label: 'Auto Points' },
                    epa: { key: 'statboticsAutoPoints', label: 'Auto Points' },
                    opr: { key: 'fuelAutoOPR', label: 'Fuel OPR' },
                },
            },
            stats: [
                {
                    key: 'avgAutoFuel',
                    label: 'Fuel Scored',
                    color: 'text-orange-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average',
                    modes: {
                        scaled: { key: 'avgScaledAutoFuel', label: 'Scaled Fuel' },
                        copr: { key: 'coprTotalAutoPoints', label: 'Auto Points' },
                        epa: { key: 'statboticsAutoFuel', label: 'Fuel' },
                        opr: { key: 'fuelAutoOPR', label: 'Fuel OPR' },
                    }
                },
                {
                    key: 'avgAutoFuelPassed',
                    label: 'Fuel Passed',
                    color: 'text-green-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average',
                    modes: {
                        scaled: { hidden: true },
                        copr: { key: 'coprAutoTowerPoints', label: 'Tower Points' },
                        epa: { key: 'statboticsAutoTower', label: 'Tower Points' },
                        opr: { hidden: true },
                    }
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
            summary: {
                key: 'teleop.avgPoints',
                label: 'Teleop Points',
                modes: {
                    scaled: { key: 'avgScaledTeleopFuel', label: 'Teleop Fuel' },
                    copr: { key: 'coprTotalTeleopPoints', label: 'Teleop Points' },
                    epa: { key: 'statboticsTeleopPoints', label: 'Teleop Points' },
                    opr: { key: 'fuelTeleopOPR', label: 'Fuel OPR' },
                },
            },
            stats: [
                {
                    key: 'avgTeleopFuel',
                    label: 'Fuel Scored',
                    color: 'text-orange-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average',
                    modes: {
                        scaled: { key: 'avgScaledTeleopFuel', label: 'Scaled Fuel' },
                        copr: { key: 'coprTotalTeleopPoints', label: 'Teleop Points' },
                        epa: { key: 'statboticsTeleopTotalFuel', label: 'Teleop + Endgame Fuel' },
                        opr: { key: 'fuelTeleopOPR', label: 'Fuel OPR' },
                    }
                },
                {
                    key: 'avgTeleopFuelPassed',
                    label: 'Fuel Passed',
                    color: 'text-green-600',
                    format: 'number',
                    decimals: 1,
                    aggregation: 'average',
                    modes: {
                        scaled: { hidden: true },
                        epa: { key: 'statboticsTeleopPoints', label: 'Teleop Points', color: 'text-blue-600' },
                        opr: { hidden: true },
                    }
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
            extraStatsByMode: {
                copr: [
                    {
                        key: 'coprEndgameTowerPoints',
                        label: 'Tower Points',
                        color: 'text-sky-600',
                        format: 'number',
                        decimals: 1,
                    }
                ],
                epa: [
                    {
                        key: 'statboticsEndgameTower',
                        label: 'Tower Points',
                        color: 'text-emerald-600',
                        format: 'number',
                        decimals: 1,
                    }
                ],
            },
            summary: {
                key: 'endgame.avgPoints',
                label: 'Endgame Points',
                modes: {
                    scaled: { hidden: true },
                    copr: { key: 'coprEndgameTowerPoints', label: 'Tower Points' },
                    epa: { key: 'statboticsEndgameTower', label: 'Tower Points' },
                    opr: { hidden: true },
                },
            },
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

function resolveValueConfig<T extends { key: string; label: string } & MatchStrategyValueConfig>(
    config: T,
    displayMode: MatchStrategyDisplayMode
): MatchStrategyResolvedValueConfig | null {
    const override = config.modes?.[displayMode];
    if (override?.hidden) {
        return null;
    }

    const key = override?.key ?? config.key;
    if (!key) {
        return null;
    }

    return {
        key,
        label: override?.label ?? config.label,
        color: override?.color ?? config.color,
        format: override?.format ?? config.format,
        decimals: override?.decimals ?? config.decimals,
        aggregation: override?.aggregation ?? config.aggregation,
    };
}

export function getMatchStrategyPhaseConfig(phaseId: string): MatchStrategyPhaseConfig | undefined {
    return matchStrategyConfig.phases.find((phase) => phase.id === phaseId);
}

export function getVisibleMatchStrategyStats(
    phaseId: string,
    displayMode: MatchStrategyDisplayMode
): MatchStrategyResolvedValueConfig[] {
    const phaseConfig = getMatchStrategyPhaseConfig(phaseId);
    if (!phaseConfig) {
        return [];
    }

    const baseStats = phaseConfig.stats
        .map((statConfig) => resolveValueConfig(statConfig, displayMode))
        .filter((statConfig): statConfig is MatchStrategyResolvedValueConfig => statConfig !== null);

    const modeExtraStats = (phaseConfig.extraStatsByMode?.[displayMode] ?? [])
        .map((statConfig) => resolveValueConfig(statConfig, displayMode))
        .filter((statConfig): statConfig is MatchStrategyResolvedValueConfig => statConfig !== null);

    return [...baseStats, ...modeExtraStats];
}

export function getMatchStrategySummary(
    phaseId: string,
    displayMode: MatchStrategyDisplayMode
): MatchStrategyResolvedValueConfig | null {
    const phaseConfig = getMatchStrategyPhaseConfig(phaseId);
    if (!phaseConfig?.summary) {
        return null;
    }

    return resolveValueConfig(phaseConfig.summary, displayMode);
}

export function getAvailableMatchStrategyDisplayModes(options: {
    teamStats: TeamStats[];
    hasScaledData: boolean;
    hasCoprData: boolean;
    hasEpaData: boolean;
    hasOprData: boolean;
}): MatchStrategyDisplayMode[] {
    const modes: MatchStrategyDisplayMode[] = [];

    if (options.teamStats.length > 0) {
        modes.push('scouted');
    }

    if (options.hasScaledData) {
        modes.push('scaled');
    }

    if (options.hasCoprData) {
        modes.push('copr');
    }

    if (options.hasEpaData) {
        modes.push('epa');
    }

    if (options.hasOprData) {
        modes.push('opr');
    }

    return modes;
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
