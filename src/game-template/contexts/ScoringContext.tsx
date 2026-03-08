/**
 * ScoringContext - Shared state for both Auto and Teleop scoring phases
 * 
 * This context provides common state that both AutoFieldMap and TeleopFieldMap need:
 * - Actions/waypoints
 * - Pending waypoint selection
 * - Fuel accumulation
 * - Stuck state tracking
 * - Field orientation and alliance
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { PathWaypoint, PathActionType } from '../components/field-map';

// =============================================================================
// TYPES
// =============================================================================

export interface ScoringContextValue {
    // Actions
    actions: PathWaypoint[];
    onAddAction: (action: PathWaypoint) => void;
    onUndo?: () => void;
    canUndo: boolean;

    // Pending waypoint
    pendingWaypoint: PathWaypoint | null;
    setPendingWaypoint: (wp: PathWaypoint | null) => void;

    // Fuel accumulation
    accumulatedFuel: number;
    setAccumulatedFuel: React.Dispatch<React.SetStateAction<number>>;
    fuelHistory: number[];
    setFuelHistory: React.Dispatch<React.SetStateAction<number[]>>;
    resetFuel: () => void;
    undoLastFuel: () => void;

    // Stuck state
    stuckStarts: Record<string, number>;
    setStuckStarts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    isAnyStuck: boolean;

    // Field state
    isFieldRotated: boolean;
    toggleFieldOrientation: () => void;
    alliance: 'red' | 'blue';

    // Match info
    matchNumber?: string | number;
    matchType?: 'qm' | 'sf' | 'f';
    teamNumber?: string | number;

    // Navigation
    onBack?: () => void;
    onProceed?: () => void;

    // Helpers
    generateId: () => string;
    addWaypoint: (type: PathActionType, action: string, position: { x: number; y: number }, extras?: Partial<PathWaypoint>) => void;

    // Derived calculations
    totalFuelScored: number;
    totalFuelPassed: number;

    // Fuel action handlers
    handleFuelSelect: (amount: number) => void;
    handleFuelConfirm: () => void;
    handleFuelCancel: (resetDrawing?: () => void) => void;
}

export interface ScoringProviderProps {
    children: ReactNode;
    actions: PathWaypoint[];
    onAddAction: (action: PathWaypoint) => void;
    onUndo?: () => void;
    canUndo?: boolean;
    alliance: 'red' | 'blue';
    matchNumber?: string | number;
    matchType?: 'qm' | 'sf' | 'f';
    teamNumber?: string | number;
    onBack?: () => void;
    onProceed?: () => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const ScoringContext = createContext<ScoringContextValue | null>(null);

export function useScoring(): ScoringContextValue {
    const context = useContext(ScoringContext);
    if (!context) {
        throw new Error('useScoring must be used within a ScoringProvider');
    }
    return context;
}

// =============================================================================
// PROVIDER
// =============================================================================

export function ScoringProvider({
    children,
    actions,
    onAddAction,
    onUndo,
    canUndo = false,
    alliance,
    matchNumber,
    matchType,
    teamNumber,
    onBack,
    onProceed,
}: ScoringProviderProps) {
    // Pending waypoint state
    const [pendingWaypoint, setPendingWaypoint] = useState<PathWaypoint | null>(null);

    // Fuel accumulation state
    const [accumulatedFuel, setAccumulatedFuel] = useState(0);
    const [fuelHistory, setFuelHistory] = useState<number[]>([]);

    // Stuck state - managed internally with localStorage for 2026 game
    const getStoredStuckState = () => {
        const saved = localStorage.getItem('teleopStuckStarts');
        return saved ? JSON.parse(saved) : {};
    };

    const [stuckStarts, setStuckStartsState] = useState<Record<string, number>>(getStoredStuckState);
    
    const setStuckStarts = useCallback((value: React.SetStateAction<Record<string, number>>) => {
        setStuckStartsState(prev => {
            const newValue = typeof value === 'function' ? value(prev) : value;
            localStorage.setItem('teleopStuckStarts', JSON.stringify(newValue));
            return newValue;
        });
    }, []);
    
    const isAnyStuck = Object.keys(stuckStarts).length > 0;

    // Field orientation (persisted in localStorage)
    const [isFieldRotated, setIsFieldRotated] = useState(() => {
        const saved = localStorage.getItem('fieldRotation');
        return saved === 'true';
    });

    const toggleFieldOrientation = useCallback(() => {
        setIsFieldRotated(prev => {
            const newValue = !prev;
            localStorage.setItem('fieldRotation', String(newValue));
            return newValue;
        });
    }, []);

    // Helpers
    const generateId = useCallback(() => {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    const resetFuel = useCallback(() => {
        setAccumulatedFuel(0);
        setFuelHistory([]);
    }, []);

    const undoLastFuel = useCallback(() => {
        if (fuelHistory.length === 0) return;
        const lastDelta = fuelHistory[fuelHistory.length - 1]!;
        setAccumulatedFuel(prev => Math.max(0, prev - lastDelta));
        setFuelHistory(prev => prev.slice(0, -1));
    }, [fuelHistory]);

    const addWaypoint = useCallback((
        type: PathActionType,
        action: string,
        position: { x: number; y: number },
        extras?: Partial<PathWaypoint>
    ) => {
        const waypoint: PathWaypoint = {
            id: generateId(),
            type,
            action,
            position,
            timestamp: Date.now(),
            ...extras,
        };
        onAddAction(waypoint);
    }, [generateId, onAddAction]);

    // Derived calculations
    const totalFuelScored = useMemo(() =>
        actions.filter(a => a.type === 'score').reduce((sum, a) => sum + Math.abs(a.fuelDelta || 0), 0),
        [actions]
    );

    const totalFuelPassed = useMemo(() =>
        actions.filter(a => a.type === 'pass').reduce((sum, a) => sum + Math.abs(a.fuelDelta || 0), 0),
        [actions]
    );

    // Fuel action handlers
    const handleFuelSelect = useCallback((amount: number) => {
        setAccumulatedFuel(prev => prev + amount);
        setFuelHistory(prev => [...prev, amount]);
    }, []);

    const handleFuelConfirm = useCallback(() => {
        if (!pendingWaypoint || accumulatedFuel === 0) return;

        const waypoint: PathWaypoint = {
            ...pendingWaypoint,
            fuelDelta: pendingWaypoint.type === 'score' ? -accumulatedFuel : accumulatedFuel,
            amountLabel: `${accumulatedFuel}`,
        };
        onAddAction(waypoint);
        setPendingWaypoint(null);
        setAccumulatedFuel(0);
        setFuelHistory([]);
    }, [pendingWaypoint, accumulatedFuel, onAddAction]);

    const handleFuelCancel = useCallback((resetDrawing?: () => void) => {
        setPendingWaypoint(null);
        setAccumulatedFuel(0);
        setFuelHistory([]);
        resetDrawing?.();
    }, []);

    const value: ScoringContextValue = {
        // Actions
        actions,
        onAddAction,
        onUndo,
        canUndo,

        // Pending waypoint
        pendingWaypoint,
        setPendingWaypoint,

        // Fuel
        accumulatedFuel,
        setAccumulatedFuel,
        fuelHistory,
        setFuelHistory,
        resetFuel,
        undoLastFuel,

        // Stuck
        stuckStarts,
        setStuckStarts,
        isAnyStuck,

        // Field
        isFieldRotated,
        toggleFieldOrientation,
        alliance,

        // Match info
        matchNumber,
        matchType,
        teamNumber,

        // Navigation
        onBack,
        onProceed,

        // Helpers
        generateId,
        addWaypoint,

        // Derived calculations
        totalFuelScored,
        totalFuelPassed,

        // Fuel action handlers
        handleFuelSelect,
        handleFuelConfirm,
        handleFuelCancel,
    };

    return (
        <ScoringContext.Provider value={value}>
            {children}
        </ScoringContext.Provider>
    );
}
