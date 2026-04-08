import { createContext, useContext, type ReactNode } from 'react';
import type { PathWaypoint, PathActionType } from '../components/field-map';

export interface ScoringContextValue {
    actions: PathWaypoint[];
    onAddAction: (action: PathWaypoint) => void;
    onUndo?: () => void;
    canUndo: boolean;
    pendingWaypoint: PathWaypoint | null;
    setPendingWaypoint: (wp: PathWaypoint | null) => void;
    accumulatedFuel: number;
    setAccumulatedFuel: React.Dispatch<React.SetStateAction<number>>;
    fuelHistory: number[];
    setFuelHistory: React.Dispatch<React.SetStateAction<number[]>>;
    resetFuel: () => void;
    undoLastFuel: () => void;
    stuckStarts: Record<string, number>;
    setStuckStarts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    isAnyStuck: boolean;
    isFieldRotated: boolean;
    toggleFieldOrientation: () => void;
    alliance: 'red' | 'blue';
    matchNumber?: string | number;
    matchType?: 'qm' | 'sf' | 'f';
    teamNumber?: string | number;
    onBack?: () => void;
    onProceed?: (finalActions?: PathWaypoint[]) => void;
    enableNoShow?: boolean;
    generateId: () => string;
    addWaypoint: (type: PathActionType, action: string, position: { x: number; y: number }, extras?: Partial<PathWaypoint>) => void;
    totalFuelScored: number;
    totalFuelPassed: number;
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
    onProceed?: (finalActions?: PathWaypoint[]) => void;
    enableNoShow?: boolean;
}

export const ScoringContext = createContext<ScoringContextValue | null>(null);

export function useScoring(): ScoringContextValue {
    const context = useContext(ScoringContext);
    if (!context) {
        throw new Error('useScoring must be used within a ScoringProvider');
    }
    return context;
}