/**
 * GAME SCHEMA - 2026 FRC GAME (REBUILT)
 * 
 * This file defines ALL game-specific configuration in one place.
 * 
 * 2026 GAME OVERVIEW:
 * - Primary: Score FUEL (6" foam balls) into HUB
 * - Secondary: Climb TOWER (3 levels)
 * - New: Auto climbing for bonus points
 * - Hub active/inactive shifts throughout match
 * - Uses bulk counters (+1, +5, +10) due to high fuel volume
 * 
 * Everything else is automatically derived:
 * - transformation.ts → uses schema to generate defaults
 * - scoring.ts → uses schema for point calculations
 * - calculations.ts → uses schema for stat aggregations
 * - strategy-config.ts → uses schema to generate columns
 */

// =============================================================================
// WORKFLOW CONFIGURATION
// =============================================================================

/**
 * Configure which pages are included in the scouting workflow.
 * Set to `false` to skip a page entirely.
 */
export interface WorkflowConfig {
    pages: {
        autoStart: boolean;
        autoScoring: boolean;
        teleopScoring: boolean;
        endgame: boolean;
        showAutoStatus: boolean;
        showTeleopStatus: boolean;
        showEndgameStatus: boolean;
    };
}

export const workflowConfig: WorkflowConfig = {
    pages: {
        autoStart: false,      // Starting position selection page
        autoScoring: true,    // Auto period scoring (required)
        teleopScoring: true,  // Teleop period scoring (required)
        endgame: true,        // Endgame page with climb selection & submit
        showAutoStatus: false, // Hide robot status on Auto (requested)
        showTeleopStatus: true,
        showEndgameStatus: true,
    },
};

export type WorkflowPage = keyof WorkflowConfig['pages'];

// =============================================================================
// ZONE DEFINITIONS (for field overlay UI)
// =============================================================================

/**
 * Field zones for zone-aware scoring UI.
 * Coordinates are based on a 640x480 canvas (matches field image aspect ratio).
 */
export const zones = {
    allianceZone: {
        label: "Alliance Zone",
        description: "Score fuel, collect from depot/outpost",
        color: "rgba(34, 197, 94, 0.4)", // Green
        bounds: { x: 0, y: 0, width: 160, height: 480 },
        actions: ['score', 'pass'] as const,
    },
    neutralZone: {
        label: "Neutral Zone",
        description: "Collect from pile, pass to partner",
        color: "rgba(234, 179, 8, 0.4)", // Yellow
        bounds: { x: 160, y: 0, width: 320, height: 480 },
        actions: ['pass'] as const,
    },
    opponentZone: {
        label: "Opponent Zone",
        description: "Defense, collect from hub exit",
        color: "rgba(239, 68, 68, 0.4)", // Red
        bounds: { x: 480, y: 0, width: 160, height: 480 },
        actions: ['defense'] as const,
    },
} as const;

export type ZoneKey = keyof typeof zones;

// =============================================================================
// ACTION DEFINITIONS (Bulk Counter Approach)
// =============================================================================

/**
 * Actions tracked with bulk counters (+1, +5, +10).
 * High fuel volume makes individual tracking impractical.
 * Data can be calibrated against TBA after matches.
 */
export const actions = {
    // Fuel scoring - tracked in Alliance Zone
    fuelScored: {
        label: "Fuel Scored",
        description: "Fuel deposited into alliance HUB",
        points: { auto: 1, teleop: 1 },
        increments: [1, 5, 10],
        zone: 'allianceZone',
    },
    // Fuel passed - tracked in any zone for coordination
    fuelPassed: {
        label: "Fuel Passed",
        description: "Fuel passed to alliance partner or corral",
        points: { auto: 0, teleop: 0 },
        increments: [1, 5, 10],
        zone: 'any',
    },
} as const;

// =============================================================================
// TOGGLE DEFINITIONS
// =============================================================================

/**
 * Toggles are boolean status indicators for each phase.
 * They are used in StatusToggles component and stored in robot status.
 */
export const toggles = {
    auto: {
        // Auto mobility/status
        leftStartZone: {
            label: "Left Start Zone",
            description: "Robot moved out of starting zone during Auto",
        },
        // Auto climb (new for 2026!)
        autoClimbL1: {
            label: "Auto Climb L1",
            description: "Climbed to Level 1 during Auto (15 pts)",
            points: 15,
        },
    },
    teleop: {
        // Teleop status toggles
        playedDefense: {
            label: "Played Defense",
            description: "Robot played significant defense",
        },
        underTrench: {
            label: "Used Trench",
            description: "Robot went under the trench (< 22.25\")",
        },
        overBump: {
            label: "Used Bump",
            description: "Robot went over the bump ramps",
        },
    },
    endgame: {
        // Tower climb levels (mutually exclusive - group: "climb")
        climbL1: {
            label: "Level 1",
            description: "Off carpet/tower base (10 pts teleop)",
            points: 10,
            group: "climb",
        },
        climbL2: {
            label: "Level 2",
            description: "Bumpers above Low Rung (20 pts)",
            points: 20,
            group: "climb",
        },
        climbL3: {
            label: "Level 3",
            description: "Bumpers above Mid Rung (30 pts)",
            points: 30,
            group: "climb",
        },
        // Status toggles (independent)
        climbFailed: {
            label: "Climb Failed",
            description: "Attempted climb but failed",
            points: 0,
            group: "status",
        },
        noClimb: {
            label: "No Attempt",
            description: "Did not attempt to climb",
            points: 0,
            group: "status",
        },
    },
} as const;

// =============================================================================
// STRATEGY DISPLAY CONFIGURATION
// =============================================================================

/**
 * Strategy columns define what's shown in the Strategy Overview table.
 * Uses dot notation to reference nested stat values.
 */
export const strategyColumns = {
    // Team info (always visible)
    teamInfo: {
        teamNumber: { label: "Team", visible: true, numeric: false },
        eventKey: { label: "Event", visible: true, numeric: false },
        matchCount: { label: "Matches", visible: true, numeric: true },
    },
    // Point totals
    points: {
        totalPoints: { label: "Total Pts", visible: true, numeric: true },
        autoPoints: { label: "Auto Pts", visible: true, numeric: true },
        teleopPoints: { label: "Teleop Pts", visible: true, numeric: true },
        endgamePoints: { label: "Endgame Pts", visible: true, numeric: true },
    },
    // Overall stats
    overall: {
        "overall.avgFuelScored": { label: "Avg Fuel", visible: true, numeric: true },
        "overall.avgFuelPassed": { label: "Avg Passed", visible: false, numeric: true },
        "overall.totalPiecesScored": { label: "Total Fuel", visible: false, numeric: true },
    },
    // Auto stats
    auto: {
        "auto.avgPoints": { label: "Auto Avg", visible: false, numeric: true },
        "auto.avgFuelScored": { label: "Auto Fuel", visible: true, numeric: true },
        "auto.mobilityRate": { label: "Mobility %", visible: true, numeric: true, percentage: true },
        "auto.autoClimbRate": { label: "Auto Climb %", visible: true, numeric: true, percentage: true },
    },
    // Teleop stats
    teleop: {
        "teleop.avgPoints": { label: "Teleop Avg", visible: false, numeric: true },
        "teleop.avgFuelScored": { label: "Teleop Fuel", visible: true, numeric: true },
        "teleop.avgFuelPassed": { label: "Teleop Passed", visible: false, numeric: true },
        "teleop.defenseRate": { label: "Defense %", visible: false, numeric: true, percentage: true },
    },
    // Endgame stats
    endgame: {
        "endgame.avgPoints": { label: "Endgame Avg", visible: false, numeric: true },
        "endgame.climbL1Rate": { label: "L1 Climb %", visible: false, numeric: true, percentage: true },
        "endgame.climbL2Rate": { label: "L2 Climb %", visible: true, numeric: true, percentage: true },
        "endgame.climbL3Rate": { label: "L3 Climb %", visible: true, numeric: true, percentage: true },
        "endgame.climbSuccessRate": { label: "Climb Success %", visible: true, numeric: true, percentage: true },
    },
} as const;

/**
 * Strategy presets for quick column selection
 */
export const strategyPresets: Record<string, string[]> = {
    essential: ["teamNumber", "matchCount", "totalPoints", "overall.avgFuelScored", "endgame.climbSuccessRate"],
    auto: ["teamNumber", "matchCount", "autoPoints", "auto.avgFuelScored", "auto.autoClimbRate", "auto.mobilityRate"],
    teleop: ["teamNumber", "matchCount", "teleopPoints", "teleop.avgFuelScored", "teleop.avgFuelPassed"],
    endgame: ["teamNumber", "matchCount", "endgamePoints", "endgame.climbL1Rate", "endgame.climbL2Rate", "endgame.climbL3Rate"],
    basic: ["teamNumber", "eventKey", "matchCount"],
};

// =============================================================================
// TBA VALIDATION MAPPINGS
// =============================================================================

/**
 * Mapping types for TBA validation.
 * - 'count': Direct numeric comparison
 * - 'countMatching': Count occurrences matching a specific value
 * - 'boolean': True/false comparison
 */
export type TBAMappingType = 'count' | 'countMatching' | 'boolean';

/**
 * Maps game actions/toggles to TBA score breakdown fields for validation.
 * This allows the validation system to compare scouted data against TBA data.
 * 
 * NOTE: TBA paths will need to be updated once 2026 API schema is published.
 */
export const tbaValidation = {
    /**
     * Validation categories group related fields for display
     */
    categories: [
        { key: 'auto-fuel', label: 'Auto Fuel', phase: 'auto' as const },
        { key: 'teleop-fuel', label: 'Teleop Fuel', phase: 'teleop' as const },
        { key: 'endgame', label: 'Endgame Climb', phase: 'endgame' as const },
        { key: 'mobility', label: 'Auto Mobility', phase: 'auto' as const },
    ],

    /**
     * Action mappings - maps scouting action keys to TBA breakdown fields
     * TODO: Update with actual 2026 TBA breakdown paths when available
     */
    actionMappings: {
        // Fuel scoring
        fuelScored: {
            tbaPath: 'autoFuelPoints', // Placeholder - update for 2026
            type: 'count' as TBAMappingType,
            category: 'auto-fuel',
        },
    },

    /**
     * Toggle mappings - maps scouting toggles to TBA breakdown fields
     */
    toggleMappings: {
        // Auto mobility
        leftStartZone: {
            tbaPath: ['autoLineRobot1', 'autoLineRobot2', 'autoLineRobot3'],
            type: 'countMatching' as TBAMappingType,
            matchValue: 'Yes',
            category: 'mobility',
        },
        // Endgame climb levels
        climbL1: {
            tbaPath: ['endGameRobot1', 'endGameRobot2', 'endGameRobot3'],
            type: 'countMatching' as TBAMappingType,
            matchValue: 'Level1',
            category: 'endgame',
        },
        climbL2: {
            tbaPath: ['endGameRobot1', 'endGameRobot2', 'endGameRobot3'],
            type: 'countMatching' as TBAMappingType,
            matchValue: 'Level2',
            category: 'endgame',
        },
        climbL3: {
            tbaPath: ['endGameRobot1', 'endGameRobot2', 'endGameRobot3'],
            type: 'countMatching' as TBAMappingType,
            matchValue: 'Level3',
            category: 'endgame',
        },
    },
} as const;

// =============================================================================
// TYPE EXPORTS (derived from schema)
// =============================================================================

export type ActionKey = keyof typeof actions;
export type AutoToggleKey = keyof typeof toggles.auto;
export type TeleopToggleKey = keyof typeof toggles.teleop;
export type EndgameToggleKey = keyof typeof toggles.endgame;

// TBA Validation types
export type ValidationCategoryKey = typeof tbaValidation.categories[number]['key'];
export type ActionMappingKey = keyof typeof tbaValidation.actionMappings;
export type ToggleMappingKey = keyof typeof tbaValidation.toggleMappings;


// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all action keys
 */
export function getActionKeys(): ActionKey[] {
    return Object.keys(actions) as ActionKey[];
}

/**
 * Get action point value for a phase
 * Returns 0 if the action doesn't have points for that phase
 */
export function getActionPoints(actionKey: ActionKey, phase: 'auto' | 'teleop'): number {
    const action = actions[actionKey];
    const points = action.points as Record<string, number>;
    return points[phase] ?? 0;
}

/**
 * Get endgame toggle point value
 */
export function getEndgamePoints(toggleKey: EndgameToggleKey): number {
    const toggle = toggles.endgame[toggleKey];
    return 'points' in toggle ? toggle.points : 0;
}

/**
 * Get auto toggle point value (for auto climb)
 */
export function getAutoTogglePoints(toggleKey: AutoToggleKey): number {
    const toggle = toggles.auto[toggleKey];
    return 'points' in toggle ? toggle.points : 0;
}

/**
 * Get all zones
 */
export function getZones(): typeof zones {
    return zones;
}

/**
 * Get zone by key
 */
export function getZone(zoneKey: ZoneKey) {
    return zones[zoneKey];
}

/**
 * Generate flat columns array for strategy config
 */
export function generateStrategyColumns(): Array<{
    key: string;
    label: string;
    category: string;
    visible: boolean;
    numeric: boolean;
    percentage?: boolean;
}> {
    const columns: Array<{
        key: string;
        label: string;
        category: string;
        visible: boolean;
        numeric: boolean;
        percentage?: boolean;
    }> = [];

    Object.entries(strategyColumns).forEach(([category, cols]) => {
        Object.entries(cols).forEach(([key, config]) => {
            columns.push({
                key,
                label: config.label,
                category: category.charAt(0).toUpperCase() + category.slice(1),
                visible: config.visible,
                numeric: config.numeric,
                percentage: 'percentage' in config ? config.percentage : undefined,
            });
        });
    });

    return columns;
}

// =============================================================================
// TBA VALIDATION HELPER FUNCTIONS
// =============================================================================

/**
 * Get all validation categories
 */
export function getValidationCategories() {
    return tbaValidation.categories;
}

/**
 * Get TBA mapping for an action
 */
export function getActionMapping(actionKey: ActionMappingKey) {
    return tbaValidation.actionMappings[actionKey];
}

/**
 * Get TBA mapping for a toggle
 */
export function getToggleMapping(toggleKey: ToggleMappingKey) {
    return tbaValidation.toggleMappings[toggleKey];
}

/**
 * Get all action keys that have TBA mappings
 */
export function getAllMappedActionKeys(): ActionMappingKey[] {
    return Object.keys(tbaValidation.actionMappings) as ActionMappingKey[];
}

/**
 * Get all toggle keys that have TBA mappings
 */
export function getAllMappedToggleKeys(): ToggleMappingKey[] {
    return Object.keys(tbaValidation.toggleMappings) as ToggleMappingKey[];
}

/**
 * Get actions/toggles for a specific validation category
 */
export function getMappingsForCategory(categoryKey: ValidationCategoryKey) {
    const actions = Object.entries(tbaValidation.actionMappings)
        .filter(([, mapping]) => mapping.category === categoryKey)
        .map(([key]) => ({ key, type: 'action' as const }));

    const toggles = Object.entries(tbaValidation.toggleMappings)
        .filter(([, mapping]) => mapping.category === categoryKey)
        .map(([key]) => ({ key, type: 'toggle' as const }));

    return [...actions, ...toggles];
}

// =============================================================================
// GAME CONSTANTS (for reference)
// =============================================================================

export const gameConstants = {
    // Match timing
    autoDuration: 20,        // seconds
    teleopDuration: 140,     // seconds (2:20)
    totalDuration: 160,      // seconds (2:40)

    // Fuel
    totalFuel: 504,
    maxPreload: 8,
    depotFuel: 24,
    outpostFuel: 24,

    // Ranking point thresholds
    towerRPThreshold: 50,    // Tower points for 1 RP
    fuelRP1Threshold: 100,   // Fuel for first RP
    fuelRP2Threshold: 360,   // Fuel for second RP (cumulative)

    // Robot restrictions
    maxWeight: 115,          // lbs
    maxPerimeter: 110,       // inches
    maxHeight: 30,           // inches
    maxExtension: 12,        // inches (one direction)
    trenchClearance: 22.25,  // inches
    bumpHeight: 6.5,         // inches

    // Hub dimensions
    hubHeight: 72,           // inches
    hubOpening: 41.7,        // inches (hexagonal)
} as const;
