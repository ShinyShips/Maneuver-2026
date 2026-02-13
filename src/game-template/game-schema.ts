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
        showAutoStatus: boolean;    // Show robot status card on Auto page
        showTeleopStatus: boolean;  // Show robot status card on Teleop page
        showEndgameStatus: boolean; // Show robot status card on Endgame page
    };
}

export const workflowConfig: WorkflowConfig = {
    pages: {
        autoStart: false,      // Starting position selection page
        autoScoring: true,    // Auto period scoring (required)
        teleopScoring: true,  // Teleop period scoring (required)
        endgame: true,        // Endgame page with status toggles & submit
        showAutoStatus: true,    // Show robot status on Auto (set false to hide)
        showTeleopStatus: false,  // Show robot status on Teleop
        showEndgameStatus: true, // Show robot status on Endgame
    },
};

export type WorkflowPage = keyof WorkflowConfig['pages'];

// Pages that have actual routes (excludes visibility flags)
export type WorkflowRoutePage = 'autoStart' | 'autoScoring' | 'teleopScoring' | 'endgame';

// =============================================================================
// ZONE DEFINITIONS (for field overlay UI)
// =============================================================================

/**
 * Field zones for zone-aware scoring UI.
 * Coordinates are based on a 640x480 canvas (matches field image aspect ratio).
 * Zone boundaries align with trench bars at x=0.31 and x=0.69 (198px and 442px).
 */
export const zones = {
    allianceZone: {
        label: "Alliance Zone",
        description: "Score fuel, collect from depot/outpost",
        color: "rgba(34, 197, 94, 0.4)", // Green
        bounds: { x: 0, y: 0, width: 198, height: 480 },
        actions: ['score', 'pass'] as const,
    },
    neutralZone: {
        label: "Neutral Zone",
        description: "Collect from pile, pass to partner",
        color: "rgba(234, 179, 8, 0.4)", // Yellow
        bounds: { x: 198, y: 0, width: 244, height: 480 },
        actions: ['pass'] as const,
    },
    opponentZone: {
        label: "Opponent Zone",
        description: "Defense, collect from hub exit",
        color: "rgba(239, 68, 68, 0.4)", // Red
        bounds: { x: 442, y: 0, width: 198, height: 480 },
        actions: ['defense'] as const,
    },
} as const;

export type ZoneKey = keyof typeof zones;

// =============================================================================
// ACTION DEFINITIONS (Path-Based Tracking)
// =============================================================================

/**
 * Actions tracked from AutoFieldMap waypoints.
 * Each action has a pathType that maps to PathWaypoint.type.
 */
export const actions = {
    // Fuel scoring at Hub (pathType: 'score')
    fuelScored: {
        label: "Fuel Scored",
        description: "Fuel deposited into alliance HUB",
        points: { auto: 1, teleop: 1 },
        pathType: 'score',
    },
    // Collection from depot (pathType: 'collect', action: 'depot')
    depotCollect: {
        label: "Depot Collection",
        description: "Collected from depot",
        points: { auto: 0, teleop: 0 },
        pathType: 'collect',
        pathAction: 'depot',
    },
    // Collection from outpost (pathType: 'collect', action: 'outpost')
    outpostCollect: {
        label: "Outpost Collection",
        description: "Collected from outpost",
        points: { auto: 0, teleop: 0 },
        pathType: 'collect',
        pathAction: 'outpost',
    },
    // Fuel passed to alliance zone (pathType: 'pass')
    fuelPassed: {
        label: "Fuel Passed",
        description: "Fuel passed to alliance zone",
        points: { auto: 0, teleop: 0 },
        pathType: 'pass',
    },
    // Foul (pathType: 'foul')
    foulCommitted: {
        label: "Foul",
        description: "Crossed mid-line into opponent zone",
        points: { auto: 0, teleop: 0 },
        pathType: 'foul',
    },
    // Auto climb (pathType: 'climb', action: 'climb-success')
    autoClimb: {
        label: "Auto Climb L1",
        description: "Climbed to Level 1 during Auto",
        points: { auto: 15, teleop: 0 },
        pathType: 'climb',
        pathAction: 'climb-success',
    },
    // Teleop climbs (pathType: 'climb', climbLevel: 1/2/3, climbResult: 'success')
    climbL1: {
        label: "Climb Level 1",
        description: "Off carpet/tower base",
        points: { auto: 0, teleop: 10 },
        pathType: 'climb',
        climbLevel: 1,
    },
    climbL2: {
        label: "Climb Level 2",
        description: "Bumpers above Low Rung",
        points: { auto: 0, teleop: 20 },
        pathType: 'climb',
        climbLevel: 2,
    },
    climbL3: {
        label: "Climb Level 3",
        description: "Bumpers above Mid Rung",
        points: { auto: 0, teleop: 30 },
        pathType: 'climb',
        climbLevel: 3,
    },
    // Defense (pathType: 'defense')
    defense: {
        label: "Defense",
        description: "Played defense on opponent",
        points: { auto: 0, teleop: 0 },
        pathType: 'defense',
    },
    // Steal (pathType: 'steal')
    steal: {
        label: "Steal",
        description: "Stole fuel from opponent zone",
        points: { auto: 0, teleop: 0 },
        pathType: 'steal',
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
        // Auto toggles (currently empty - all tracking is path-based)
    },
    teleop: {
        // Teleop toggles (currently empty - all tracking is path-based)
    },
    endgame: {
        // Active Phase Role toggles (multi-select, group: "roleActive")
        roleActiveCleanUp: {
            label: "Clean Up",
            description: "Collected fuel from the Alliance Zone and Scored",
            group: "roleActive",
        },
        roleActivePasser: {
            label: "Passer",
            description: "Passed fuel to alliance partners",
            group: "roleActive",
        },
        roleActiveDefense: {
            label: "Defense",
            description: "Played defensive role",
            group: "roleActive",
        },
        roleActiveCycler: {
            label: "Cycler",
            description: "Scored fuel repeatedly, going from the Neutral Zone to the Alliance Zone",
            group: "roleActive",
        },
        roleActiveThief: {
            label: "Thief",
            description: "Stole fuel from opponent zone",
            group: "roleActive",
        },

        // Inactive Phase Role toggles (multi-select, group: "roleInactive")
        roleInactiveCleanUp: {
            label: "Clean Up",
            description: "Collected fuel from the Alliance Zone and Scored",
            group: "roleInactive",
        },
        roleInactivePasser: {
            label: "Passer",
            description: "Passed fuel to alliance partners",
            group: "roleInactive",
        },
        roleInactiveDefense: {
            label: "Defense",
            description: "Played defensive role",
            group: "roleInactive",
        },
        roleInactiveCycler: {
            label: "Cycler",
            description: "Scored fuel repeatedly, going from the Neutral Zone to the Alliance Zone",
            group: "roleInactive",
        },
        roleInactiveThief: {
            label: "Thief",
            description: "Stole fuel from opponent zone",
            group: "roleInactive",
        },

        // Passing zones (multi-select, group: "passingZone")
        passedToAllianceFromNeutral: {
            label: "Neutral → Alliance",
            description: "Passed fuel from neutral zone to alliance zone",
            group: "passingZone",
        },
        passedToAllianceFromOpponent: {
            label: "Opponent → Alliance",
            description: "Passed fuel from opponent zone to alliance zone",
            group: "passingZone",
        },
        passedToNeutral: {
            label: "Opponent → Neutral Zone",
            description: "Passed fuel from opponent zone to neutral zone",
            group: "passingZone",
        },

        // Teleop traversal confirmation (post-match)
        usedTrenchInTeleop: {
            label: "Used Trench in Teleop",
            description: "Robot used the trench during teleop",
            group: "teleopTraversal",
        },
        usedBumpInTeleop: {
            label: "Used Bump in Teleop",
            description: "Robot used the bump during teleop",
            group: "teleopTraversal",
        },

        // Qualitative accuracy (mutually exclusive, group: "accuracy")
        accuracyAll: {
            label: "All (>90%)",
            description: "Hit almost all shots",
            group: "accuracy",
        },
        accuracyMost: {
            label: "Most (75%)",
            description: "Hit most shots",
            group: "accuracy",
        },
        accuracySome: {
            label: "Some (50%)",
            description: "Hit about half of shots",
            group: "accuracy",
        },
        accuracyFew: {
            label: "Few (25%)",
            description: "Hit few shots",
            group: "accuracy",
        },
        accuracyLittle: {
            label: "Little (<25%)",
            description: "Missed most shots",
            group: "accuracy",
        },

        // Corral usage (independent)
        usedCorral: {
            label: "Used Corral",
            description: "Robot put fuel into the Corral",
            group: "Corral",
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
    // Point totals (use rawValues for user-selectable aggregation)
    points: {
        "rawValues.totalPoints": { label: "Total Points", visible: true, numeric: true },
        "rawValues.autoPoints": { label: "Auto Points", visible: true, numeric: true },
        "rawValues.teleopPoints": { label: "Teleop Points", visible: true, numeric: true },
        "rawValues.endgamePoints": { label: "Endgame Points", visible: true, numeric: true },
    },
    // Overall stats (use rawValues for user-selectable aggregation)
    overall: {
        "rawValues.totalFuel": { label: "Fuel Scored", visible: true, numeric: true },
        "rawValues.totalFuelPassed": { label: "Fuel Passed", visible: false, numeric: true },
    },
    // Auto stats (use rawValues for user-selectable aggregation)
    auto: {
        "rawValues.autoFuel": { label: "Auto Fuel", visible: true, numeric: true },
        "autoClimbRate": { label: "Auto Climb %", visible: true, numeric: true, percentage: true },
        "rawValues.autoTrenchStuckDuration": { label: "Auto Trench Stuck", visible: false, numeric: true },
        "rawValues.autoBumpStuckDuration": { label: "Auto Bump Stuck", visible: false, numeric: true },
    },
    // Teleop stats (use rawValues for user-selectable aggregation)
    teleop: {
        "rawValues.teleopFuel": { label: "Teleop Fuel", visible: true, numeric: true },
        "rawValues.teleopFuelPassed": { label: "Teleop Passed", visible: false, numeric: true },
        "teleop.defenseRate": { label: "Defense %", visible: false, numeric: true, percentage: true },
        "rawValues.teleopTrenchStuckDuration": { label: "Trench Stuck (s)", visible: true, numeric: true },
        "rawValues.teleopBumpStuckDuration": { label: "Bump Stuck (s)", visible: true, numeric: true },
    },
    // Endgame stats (climb rates are percentages, keep as-is)
    endgame: {
        "endgame.climbL1Rate": { label: "L1 Climb %", visible: false, numeric: true, percentage: true },
        "endgame.climbL2Rate": { label: "L2 Climb %", visible: true, numeric: true, percentage: true },
        "endgame.climbL3Rate": { label: "L3 Climb %", visible: true, numeric: true, percentage: true },
        "endgame.climbSuccessRate": { label: "Climb Success %", visible: true, numeric: true, percentage: true },
        "endgame.usedTrenchInTeleopRate": { label: "Used Trench %", visible: false, numeric: true, percentage: true },
        "endgame.usedBumpInTeleopRate": { label: "Used Bump %", visible: false, numeric: true, percentage: true },
        "endgame.passedToAllianceFromNeutralRate": { label: "Neutral → Alliance %", visible: false, numeric: true, percentage: true },
        "endgame.passedToAllianceFromOpponentRate": { label: "Opponent → Alliance %", visible: false, numeric: true, percentage: true },
        "endgame.passedToNeutralRate": { label: "Opponent → Neutral %", visible: false, numeric: true, percentage: true },
    },
} as const;

/**
 * Strategy presets for quick column selection
 */
export const strategyPresets: Record<string, string[]> = {
    essential: ["teamNumber", "matchCount", "rawValues.totalPoints", "rawValues.totalFuel", "endgame.climbSuccessRate"],
    auto: ["teamNumber", "matchCount", "rawValues.autoPoints", "rawValues.autoFuel", "autoClimbRate"],
    teleop: ["teamNumber", "matchCount", "rawValues.teleopPoints", "rawValues.teleopFuel", "rawValues.teleopFuelPassed"],
    endgame: ["teamNumber", "matchCount", "rawValues.endgamePoints", "endgame.climbL1Rate", "endgame.climbL2Rate", "endgame.climbL3Rate"],
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
    return 'points' in toggle ? (toggle.points as number) : 0;
}

/**
 * Get auto toggle point value (for auto climb)
 */
export function getAutoTogglePoints(_toggleKey: AutoToggleKey): number {
    // Auto toggles are currently empty; return 0 until toggle definitions include points
    return 0;
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
