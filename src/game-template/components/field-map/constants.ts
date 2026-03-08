/**
 * Field element positions and zone definitions
 * Positions are normalized 0-1, blue alliance perspective
 * Alliance zone on LEFT, traversal in middle, opponent on right
 */

import type { FieldElement, ZoneType } from './types';

// =============================================================================
// FIELD ELEMENTS (normalized 0-1, blue alliance perspective)
// width/height are optional - defaults to 48x48px (w-12 h-12)
// =============================================================================

export const FIELD_ELEMENTS: Record<string, FieldElement> = {
    // Alliance Zone elements (left side for blue)
    hub: { x: 0.31, y: 0.5, label: 'HUB_ICON', name: 'Hub', scaleWidth: 1 },
    depot: { x: 0.09, y: 0.29, label: 'DEPOT_ICON', name: 'Depot' },
    outpost: { x: 0.09, y: 0.87, label: 'OUTPOST_ICON', name: 'Outpost' },
    tower: { x: 0.1, y: 0.53, label: 'CLIMB_ICON', name: 'Climb' },

    // Traversal elements - bumps span wider area
    trench1: { x: 0.31, y: 0.13, label: 'TRENCH_ICON', name: 'Trench' },
    bump1: { x: 0.31, y: 0.32, label: 'BUMP_ICON', name: 'Bump', scaleHeight: 1.4 },
    bump2: { x: 0.31, y: 0.68, label: 'BUMP_ICON', name: 'Bump', scaleHeight: 1.4 },
    trench2: { x: 0.31, y: 0.87, label: 'TRENCH_ICON', name: 'Trench' },

    // Neutral Zone elements (center)
    pass: { x: 0.50, y: 0.5, label: 'PASS_ICON', name: 'Pass' },
    collect_neutral: { x: 0.5, y: 0.7, label: 'COLLECT_ICON', name: 'Collect' },

    // Alliance Zone extra collect
    collect_alliance: { x: 0.1, y: 0.7, label: 'COLLECT_ICON', name: 'Collect' },

    // Opponent Zone elements (foul)
    opponent_foul: { x: 0.60, y: 0.5, label: 'FOUL_ICON', name: 'Foul', scaleWidth: 1.5 },

    // Defense buttons (Teleop only - one per zone)
    defense_alliance: { x: 0.17, y: 0.15, label: 'DEFENSE_ICON', name: 'Defense' },
    defense_neutral: { x: 0.50, y: 0.15, label: 'DEFENSE_ICON', name: 'Defense' },
    defense_opponent: { x: 0.83, y: 0.15, label: 'DEFENSE_ICON', name: 'Defense' },

    // Pass buttons
    pass_alliance: { x: 0.17, y: 0.85, label: 'PASS_ICON', name: 'Pass' },
    pass_opponent: { x: 0.83, y: 0.5, label: 'PASS_ICON', name: 'Pass' },

    // Opponent Zone obstacles (Teleop only)
    trench_opponent1: { x: 0.69, y: 0.13, label: 'TRENCH_ICON', name: 'Trench' },
    bump_opponent1: { x: 0.69, y: 0.32, label: 'BUMP_ICON', name: 'Bump', scaleHeight: 1.4 },
    bump_opponent2: { x: 0.69, y: 0.68, label: 'BUMP_ICON', name: 'Bump', scaleHeight: 1.4 },
    trench_opponent2: { x: 0.69, y: 0.87, label: 'TRENCH_ICON', name: 'Trench' },

    // Steal action (Teleop only, opponent zone)
    steal: { x: 0.83, y: 0.85, label: 'STEAL_ICON', name: 'Steal' },
};

// =============================================================================
// ZONE BOUNDARIES (normalized 0-1, blue alliance perspective)
// Used for zone overlays and zone detection
// =============================================================================

export interface ZoneBounds {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

// Import zone definitions from game schema
import { zones } from '@/game-template/game-schema';

// Derive normalized bounds from game schema (640x480 canvas)
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

export const ZONE_BOUNDS: Record<ZoneType, ZoneBounds> = {
    allianceZone: {
        xMin: zones.allianceZone.bounds.x / CANVAS_WIDTH,
        xMax: (zones.allianceZone.bounds.x + zones.allianceZone.bounds.width) / CANVAS_WIDTH,
        yMin: zones.allianceZone.bounds.y / CANVAS_HEIGHT,
        yMax: (zones.allianceZone.bounds.y + zones.allianceZone.bounds.height) / CANVAS_HEIGHT,
    },
    neutralZone: {
        xMin: zones.neutralZone.bounds.x / CANVAS_WIDTH,
        xMax: (zones.neutralZone.bounds.x + zones.neutralZone.bounds.width) / CANVAS_WIDTH,
        yMin: zones.neutralZone.bounds.y / CANVAS_HEIGHT,
        yMax: (zones.neutralZone.bounds.y + zones.neutralZone.bounds.height) / CANVAS_HEIGHT,
    },
    opponentZone: {
        xMin: zones.opponentZone.bounds.x / CANVAS_WIDTH,
        xMax: (zones.opponentZone.bounds.x + zones.opponentZone.bounds.width) / CANVAS_WIDTH,
        yMin: zones.opponentZone.bounds.y / CANVAS_HEIGHT,
        yMax: (zones.opponentZone.bounds.y + zones.opponentZone.bounds.height) / CANVAS_HEIGHT,
    },
};

// =============================================================================
// ZONE COLORS
// =============================================================================

export const ZONE_COLORS: Record<ZoneType, { red: string; blue: string; overlay: string }> = {
    allianceZone: {
        red: 'bg-red-500/20',
        blue: 'bg-blue-500/20',
        overlay: 'border-2 border-dashed',
    },
    neutralZone: {
        red: 'bg-amber-500/10',
        blue: 'bg-amber-500/10',
        overlay: 'border-2 border-dashed border-amber-500/50',
    },
    opponentZone: {
        red: 'bg-blue-500/20', // Flip for red
        blue: 'bg-red-500/20', // Flip for blue
        overlay: 'border-2 border-dashed',
    },
};

// =============================================================================
// FUEL OPTIONS
// =============================================================================

/**
 * Generate fuel options with dynamic fractional values based on robot capacity
 * @param capacity Robot fuel capacity from pit scouting (defaults to 20 if not available)
 */
export function getFuelOptions(capacity: number = 20) {
    return [
        { label: '1', value: 1 },
        { label: '3', value: 3 },
        { label: '8', value: 8 },
        { label: '10', value: 10 },
        { label: '25', value: 25 },
        { label: '50', value: 50 },
        { label: '1/4', value: Math.round(capacity / 4) },
        { label: '1/2', value: Math.round(capacity / 2) },
        { label: '3/4', value: Math.round((capacity * 3) / 4) },
        { label: 'Full', value: capacity },
    ];
}

// Default fuel options for when capacity is unknown
export const FUEL_OPTIONS = getFuelOptions(20);

// =============================================================================
// CLIMB LEVELS
// =============================================================================

export const CLIMB_LEVELS = ['L1', 'L2', 'L3'] as const;

// =============================================================================
// AUTO START POSITIONS (in traversal zone)
// These overlap with traversal elements but have special meaning at match start
// =============================================================================

export const AUTO_START_KEYS = ['trench1', 'bump1', 'hub', 'bump2', 'trench2'] as const;

// =============================================================================
// PHASE-SPECIFIC ZONE ELEMENT VISIBILITY
// Centralized configuration for which elements are visible in each zone per phase
// =============================================================================

export const PHASE_ZONE_ELEMENTS: Record<
    'auto' | 'teleop',
    Partial<Record<ZoneType, string[]>>
> = {
    auto: {
        allianceZone: ['hub', 'depot', 'outpost', 'tower', 'collect_alliance', 'pass_alliance'],
        neutralZone: ['pass', 'collect_neutral', 'opponent_foul'],
        // Auto doesn't allow opponent zone access
    },
    teleop: {
        allianceZone: ['hub', 'tower', 'defense_alliance', 'pass_alliance'],
        neutralZone: ['pass', 'defense_neutral'],
        opponentZone: ['defense_opponent', 'pass_opponent', 'steal'],
    },
};

// Traversal elements (bumps/trenches) - phase-aware visibility
export const TRAVERSAL_ELEMENTS: Record<
    'auto' | 'teleop',
    Partial<Record<ZoneType, string[]>>
> = {
    auto: {
        allianceZone: ['trench1', 'bump1', 'bump2', 'trench2'],
        neutralZone: ['trench1', 'bump1', 'bump2', 'trench2'], // Hide opponent side in Auto
        opponentZone: [], // Restricted
    },
    teleop: {
        allianceZone: ['trench1', 'bump1', 'bump2', 'trench2'],
        neutralZone: ['trench1', 'bump1', 'bump2', 'trench2', 'trench_opponent1', 'bump_opponent1', 'bump_opponent2', 'trench_opponent2'],
        opponentZone: ['trench_opponent1', 'bump_opponent1', 'bump_opponent2', 'trench_opponent2'],
    },
};

// Helper to get visible elements for a phase and zone
export function getVisibleElements(phase: 'auto' | 'teleop', zone: ZoneType | null): string[] {
    if (!zone) return [];
    const phaseElements = PHASE_ZONE_ELEMENTS[phase][zone] || [];
    const traversalElements = TRAVERSAL_ELEMENTS[phase][zone] || [];
    return [...phaseElements, ...traversalElements];
}
