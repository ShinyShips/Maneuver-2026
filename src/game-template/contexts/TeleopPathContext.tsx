/**
 * TeleopPathContext - Teleop-specific state extending ScoringContext
 * 
 * Provides Teleop phase specific state:
 * - Active zone selection (allianceZone, neutralZone, opponentZone)
 * - Climb level selection (L1/L2/L3) + result
 * - Canvas dimensions for button positioning
 * - Drawing state
 */

import { createContext, useContext, useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useScoring, ScoringProvider, type ScoringProviderProps } from './ScoringContext';
import type { ZoneType, ClimbLevel, ClimbResult, ClimbLocation } from '../components/field-map';

// =============================================================================
// TYPES
// =============================================================================

export interface TeleopPathContextValue {
    // Zone selection
    activeZone: ZoneType | null;
    setActiveZone: (zone: ZoneType | null) => void;

    // Climb with level selection
    climbLevel: ClimbLevel | undefined;
    setClimbLevel: (level: ClimbLevel | undefined) => void;
    climbLocation: ClimbLocation | undefined;
    setClimbLocation: (location: ClimbLocation | undefined) => void;
    climbResult: ClimbResult;
    setClimbResult: (result: ClimbResult) => void;
    showPostClimbProceed: boolean;
    setShowPostClimbProceed: (show: boolean) => void;

    // Robot status (for toggles)
    robotStatus: any;
    updateRobotStatus: (updates: Partial<any>) => void;

    // Canvas dimensions
    canvasDimensions: { width: number; height: number };
    containerRef: React.RefObject<HTMLDivElement>;

    // Drawing state
    drawingPoints: { x: number; y: number }[];
    setDrawingPoints: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;

    // Score/Pass selection modes
    isSelectingScore: boolean;
    setIsSelectingScore: (selecting: boolean) => void;
    isSelectingPass: boolean;
    setIsSelectingPass: (selecting: boolean) => void;
}

export interface TeleopPathProviderProps extends Omit<ScoringProviderProps, 'children'> {
    children: ReactNode;
    robotStatus?: any;
    onRobotStatusUpdate?: (updates: Partial<any>) => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const TeleopPathContext = createContext<TeleopPathContextValue | null>(null);

export function useTeleopPath(): TeleopPathContextValue {
    const context = useContext(TeleopPathContext);
    if (!context) {
        throw new Error('useTeleopPath must be used within a TeleopPathProvider');
    }
    return context;
}

// Combined hook for convenience
export function useTeleopScoring() {
    const scoring = useScoring();
    const teleopPath = useTeleopPath();
    return { ...scoring, ...teleopPath };
}

// =============================================================================
// PROVIDER
// =============================================================================

export function TeleopPathProvider({
    children,
    robotStatus: robotStatusProp,
    onRobotStatusUpdate,
    ...scoringProps
}: TeleopPathProviderProps) {
    return (
        <ScoringProvider {...scoringProps}>
            <TeleopPathProviderInner
                robotStatus={robotStatusProp}
                onRobotStatusUpdate={onRobotStatusUpdate}
            >
                {children}
            </TeleopPathProviderInner>
        </ScoringProvider>
    );
}

function TeleopPathProviderInner({
    children,
    robotStatus: robotStatusProp = {},
    onRobotStatusUpdate
}: {
    children: ReactNode;
    robotStatus?: any;
    onRobotStatusUpdate?: (updates: Partial<any>) => void;
}) {
    // Access stuck state from ScoringContext to auto-select zone if stuck from Auto
    const { isAnyStuck } = useScoring();

    // Zone selection - auto-select alliance zone if robot is stuck (carried over from Auto)
    const [activeZone, setActiveZone] = useState<ZoneType | null>(() =>
        isAnyStuck ? 'allianceZone' : null
    );

    // Climb with level
    const [climbLevel, setClimbLevel] = useState<ClimbLevel | undefined>(undefined);
    const [climbLocation, setClimbLocation] = useState<ClimbLocation | undefined>(undefined);
    const [climbResult, setClimbResult] = useState<ClimbResult>('success');
    const [showPostClimbProceed, setShowPostClimbProceed] = useState(false);

    // Robot status - use prop if provided
    const robotStatus = robotStatusProp;
    const updateRobotStatus = onRobotStatusUpdate || (() => { });

    // Container ref for dimensions
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

    // Drawing state
    const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);

    // Selection modes
    const [isSelectingScore, setIsSelectingScore] = useState(false);
    const [isSelectingPass, setIsSelectingPass] = useState(false);

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

    const value: TeleopPathContextValue = useMemo(() => ({
        activeZone,
        setActiveZone,
        climbLevel,
        setClimbLevel,
        climbLocation,
        setClimbLocation,
        climbResult,
        setClimbResult,
        showPostClimbProceed,
        setShowPostClimbProceed,
        robotStatus,
        updateRobotStatus,
        canvasDimensions,
        containerRef,
        drawingPoints,
        setDrawingPoints,
        isSelectingScore,
        setIsSelectingScore,
        isSelectingPass,
        setIsSelectingPass,
    }), [
        activeZone,
        climbLevel,
        climbLocation,
        climbResult,
        showPostClimbProceed,
        robotStatus,
        canvasDimensions,
        drawingPoints,
        isSelectingScore,
        isSelectingPass,
    ]);

    return (
        <TeleopPathContext.Provider value={value}>
            {children}
        </TeleopPathContext.Provider>
    );
}
