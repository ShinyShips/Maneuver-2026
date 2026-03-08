/**
 * AutoPathContext - Auto-specific state extending ScoringContext
 * 
 * Provides Auto phase specific state:
 * - Start position selection
 * - Potential stuck indicator (before confirming stuck)
 * - Post-climb proceed popup
 * - Canvas dimensions for button positioning
 * - Drawing state
 */

import { createContext, useContext, useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useScoring, ScoringProvider, type ScoringProviderProps } from './ScoringContext';

// =============================================================================
// TYPES
// =============================================================================

export interface AutoPathContextValue {
    // Start position selection
    selectedStartKey: string | null;
    setSelectedStartKey: (key: string | null) => void;

    // Potential stuck (before confirming)
    stuckElementKey: string | null;
    setStuckElementKey: (key: string | null) => void;

    // Post-climb popup
    showPostClimbProceed: boolean;
    setShowPostClimbProceed: (show: boolean) => void;

    // Climb result for pending waypoint
    climbResult: 'success' | 'fail' | null;
    setClimbResult: (result: 'success' | 'fail' | null) => void;

    // Canvas dimensions
    canvasDimensions: { width: number; height: number };
    containerRef: React.RefObject<HTMLDivElement>;

    // Drawing state
    drawingPoints: { x: number; y: number }[];
    setDrawingPoints: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;
    isDrawing: boolean;
    setIsDrawing: (drawing: boolean) => void;

    // Score/Pass/Collect selection modes
    isSelectingScore: boolean;
    setIsSelectingScore: (selecting: boolean) => void;
    isSelectingPass: boolean;
    setIsSelectingPass: (selecting: boolean) => void;
    isSelectingCollect: boolean;
    setIsSelectingCollect: (selecting: boolean) => void;
}

export interface AutoPathProviderProps extends Omit<ScoringProviderProps, 'children'> {
    children: ReactNode;
}

// =============================================================================
// CONTEXT
// =============================================================================

const AutoPathContext = createContext<AutoPathContextValue | null>(null);

export function useAutoPath(): AutoPathContextValue {
    const context = useContext(AutoPathContext);
    if (!context) {
        throw new Error('useAutoPath must be used within an AutoPathProvider');
    }
    return context;
}

// Combined hook for convenience
export function useAutoScoring() {
    const scoring = useScoring();
    const autoPath = useAutoPath();
    return { ...scoring, ...autoPath };
}

// =============================================================================
// PROVIDER
// =============================================================================

export function AutoPathProvider({
    children,
    ...scoringProps
}: AutoPathProviderProps) {
    return (
        <ScoringProvider {...scoringProps}>
            <AutoPathProviderInner>
                {children}
            </AutoPathProviderInner>
        </ScoringProvider>
    );
}

function AutoPathProviderInner({ children }: { children: ReactNode }) {
    // Start position selection
    const [selectedStartKey, setSelectedStartKey] = useState<string | null>(null);

    // Potential stuck indicator
    const [stuckElementKey, setStuckElementKey] = useState<string | null>(null);

    // Post-climb popup
    const [showPostClimbProceed, setShowPostClimbProceed] = useState(false);

    // Climb result
    const [climbResult, setClimbResult] = useState<'success' | 'fail' | null>(null);

    // Container ref for dimensions
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

    // Drawing state
    const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);

    // Selection modes
    const [isSelectingScore, setIsSelectingScore] = useState(false);
    const [isSelectingPass, setIsSelectingPass] = useState(false);
    const [isSelectingCollect, setIsSelectingCollect] = useState(false);

    // Update dimensions on resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setCanvasDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight,
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    const value: AutoPathContextValue = useMemo(() => ({
        selectedStartKey,
        setSelectedStartKey,
        stuckElementKey,
        setStuckElementKey,
        showPostClimbProceed,
        setShowPostClimbProceed,
        climbResult,
        setClimbResult,
        canvasDimensions,
        containerRef,
        drawingPoints,
        setDrawingPoints,
        isDrawing,
        setIsDrawing,
        isSelectingScore,
        setIsSelectingScore,
        isSelectingPass,
        setIsSelectingPass,
        isSelectingCollect,
        setIsSelectingCollect,
    }), [
        selectedStartKey,
        stuckElementKey,
        showPostClimbProceed,
        climbResult,
        canvasDimensions,
        drawingPoints,
        isDrawing,
        isSelectingScore,
        isSelectingPass,
        isSelectingCollect,
    ]);

    return (
        <AutoPathContext.Provider value={value}>
            {children}
        </AutoPathContext.Provider>
    );
}
