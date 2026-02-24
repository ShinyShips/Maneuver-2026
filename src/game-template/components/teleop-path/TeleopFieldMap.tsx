/**
 * Teleop Field Map Component
 * 
 * Field-based scoring interface for Teleop period.
 * Uses zone overlays for manual zone selection with shoot/pass paths.
 * 
 * Key differences from Auto:
 * - No connected movement path - only shoot/pass paths are standalone
 * - Zone selection via overlay tap (not traversal actions)
 * - Climb includes level selection (L1/L2/L3) + success/fail
 * - Defense and Steal actions in opponent zone
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/core/components/ui/button';
import { cn } from '@/core/lib/utils';
import { loadPitScoutingByTeamAndEvent } from '@/core/db/database';

import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/core/hooks/use-mobile';
import fieldImage from '@/game-template/assets/2026-field.png';

// Import shared field-map components
import {
    type PathWaypoint,
    type ZoneType,

    FIELD_ELEMENTS,
    ZONE_BOUNDS,
    usePathDrawing,
    FieldCanvas,
    FieldButton,
    FieldHeader,
    getVisibleElements,
    ZoneOverlay,
    PendingWaypointPopup,
    ShotTypePopup,
} from '../field-map';

// Context hooks
import { TeleopPathProvider, useTeleopScoring } from '@/game-template/contexts';
import { formatDurationSecondsLabel } from '@/game-template/duration';
import { TELEOP_PHASE_DURATION_MS } from '@/game-template/constants';
import {
    GAME_SCOUT_OPTION_KEYS,
    getEffectiveScoutOptions,
} from '@/game-template/scout-options';

// Local sub-components
import { TeleopActionLog } from './components/TeleopActionLog';
import { PostClimbProceed } from '../scoring/PostClimbProceed';


// =============================================================================
// TYPES
// =============================================================================

export interface TeleopFieldMapProps {
    onAddAction: (action: PathWaypoint) => void;
    actions: PathWaypoint[];
    onUndo?: () => void;
    canUndo?: boolean;
    matchNumber?: string | number;
    matchType?: 'qm' | 'sf' | 'f';
    teamNumber?: string | number;
    onBack?: () => void;
    onProceed?: (finalActions?: PathWaypoint[]) => void;
}

const MOVING_SHOT_MIN_PATH_LENGTH = 0.05;

const getPathLength = (points: { x: number; y: number }[]): number => {
    if (points.length < 2) return 0;

    let length = 0;
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1]!;
        const current = points[index]!;
        const deltaX = current.x - previous.x;
        const deltaY = current.y - previous.y;
        length += Math.hypot(deltaX, deltaY);
    }

    return length;
};

// =============================================================================
// WRAPPER COMPONENT - Provides Context
// =============================================================================

export function TeleopFieldMap(props: TeleopFieldMapProps) {
    const location = useLocation();
    const alliance = location.state?.inputs?.alliance || 'blue';

    return (
        <TeleopPathProvider
            actions={props.actions}
            onAddAction={props.onAddAction}
            onUndo={props.onUndo}
            canUndo={props.canUndo}
            alliance={alliance}
            matchNumber={props.matchNumber}
            matchType={props.matchType}
            teamNumber={props.teamNumber}
            onBack={props.onBack}
            onProceed={props.onProceed}
        >
            <TeleopFieldMapContent />
        </TeleopPathProvider>
    );
}

// =============================================================================
// CONTENT COMPONENT - Uses Context
// =============================================================================

function TeleopFieldMapContent() {
    // Get all state from context
    const {
        // From ScoringContext
        actions,
        onAddAction,
        onUndo,
        canUndo,
        pendingWaypoint,
        setPendingWaypoint,
        accumulatedFuel,
        setAccumulatedFuel,
        fuelHistory,
        setFuelHistory,
        resetFuel,
        stuckStarts,
        setStuckStarts,
        isAnyStuck,
        isFieldRotated,
        toggleFieldOrientation,
        alliance,
        matchNumber,
        matchType,
        teamNumber,
        onBack,
        onProceed,
        generateId,
        // From TeleopPathContext
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
        canvasDimensions,
        containerRef,
        isSelectingScore,
        setIsSelectingScore,
        isSelectingPass,
        setIsSelectingPass,
    } = useTeleopScoring();

    const fieldCanvasRef = useRef<{ canvas: HTMLCanvasElement | null }>({ canvas: null });

    // Create a ref-like object for usePathDrawing that accesses the canvas element
    const canvasRef = useMemo(() => ({
        get current() { return fieldCanvasRef.current?.canvas ?? null; }
    }), []) as React.RefObject<HTMLCanvasElement>;

    const isMobile = useIsMobile();
    const effectiveScoutOptions = getEffectiveScoutOptions();
    const disableHubFuelScoringPopup =
        effectiveScoutOptions[GAME_SCOUT_OPTION_KEYS.disableHubFuelScoringPopup] === true;
    const disablePassingPopup =
        effectiveScoutOptions[GAME_SCOUT_OPTION_KEYS.disablePassingPopup] === true;
    const disablePathDrawingTapOnly =
        effectiveScoutOptions[GAME_SCOUT_OPTION_KEYS.disableTeleopPathDrawingTapOnly] === true;

    // Local state (UI-only)
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [robotCapacity, setRobotCapacity] = useState<number | undefined>();
    const [actionLogOpen, setActionLogOpen] = useState(false);
    const [pendingShotTypeWaypoint, setPendingShotTypeWaypoint] = useState<PathWaypoint | null>(null);

    // Broken down state - persisted with localStorage
    const [brokenDownStart, setBrokenDownStart] = useState<number | null>(() => {
        const saved = localStorage.getItem('teleopBrokenDownStart');
        return saved ? parseInt(saved, 10) : null;
    });
    const [totalBrokenDownTime, setTotalBrokenDownTime] = useState<number>(() => {
        const saved = localStorage.getItem('teleopBrokenDownTime');
        return saved ? parseInt(saved, 10) : 0;
    });
    const isBrokenDown = brokenDownStart !== null;

    // Load pit scouting data for fuel capacity
    useEffect(() => {
        const loadPitData = async () => {
            if (!teamNumber) return;
            try {
                const eventKey = localStorage.getItem('eventKey') || '';
                const pitData = await loadPitScoutingByTeamAndEvent(Number(teamNumber), eventKey);
                if (pitData && pitData.gameData) {
                    setRobotCapacity(pitData.gameData.fuelCapacity as number);
                }
            } catch (error) {
                console.error('Failed to load pit scouting data:', error);
            }
        };
        loadPitData();
    }, [teamNumber]);

    // Reset fuel accumulation when entering Teleop (component mounts)
    useEffect(() => {
        resetFuel();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset fuel when any pending waypoint is cleared
    useEffect(() => {
        if (!pendingWaypoint) {
            resetFuel();
        }
    }, [pendingWaypoint, resetFuel]);

    // Path drawing hook - constrain to active zone bounds
    const currentZoneBounds = activeZone ? ZONE_BOUNDS[activeZone] : undefined;
    const {
        drawingPoints,
        handleDrawStart,
        handleDrawMove,
        handleDrawEnd,
        resetDrawing,
    } = usePathDrawing({
        canvasRef,
        isFieldRotated,
        alliance,
        isEnabled: isSelectingScore || isSelectingPass,
        onDrawComplete: (points) => handleDrawComplete(points),
        zoneBounds: currentZoneBounds,
    });

    // Auto-fullscreen on mobile
    useEffect(() => {
        if (isMobile) {
            setIsFullscreen(true);
        }
    }, [isMobile]);

    // Calculate totals
    const totalFuelScored = actions
        .filter(a => a.type === 'score')
        .reduce((sum, a) => sum + Math.abs(a.fuelDelta || 0), 0);

    const totalFuelPassed = actions
        .filter(a => a.type === 'pass')
        .reduce((sum, a) => sum + Math.abs(a.fuelDelta || 0), 0);

    // Defense and steal counted from actions array like everything else
    const totalDefense = actions.filter(a => a.type === 'defense').length;
    const totalSteal = actions.filter(a => a.type === 'steal').length;

    // ==========================================================================
    // HANDLERS
    // ==========================================================================

    const handleBrokenDownToggle = () => {
        if (brokenDownStart) {
            // Robot is back up - accumulate the time
            const duration = Date.now() - brokenDownStart;
            const newTotal = totalBrokenDownTime + duration;
            setTotalBrokenDownTime(newTotal);
            localStorage.setItem('teleopBrokenDownTime', String(newTotal));
            setBrokenDownStart(null);
            localStorage.removeItem('teleopBrokenDownStart');
        } else {
            // Robot is breaking down - start tracking time
            const now = Date.now();
            setBrokenDownStart(now);
            localStorage.setItem('teleopBrokenDownStart', String(now));
        }
    };

    const handleZoneClick = (zone: ZoneType) => {
        setActiveZone(zone);
    };

    const handleDrawComplete = useCallback((points: { x: number; y: number }[]) => {
        if (points.length === 0) return;

        const isDrag = points.length > 5;
        const shouldUsePath = isDrag && !disablePathDrawingTapOnly;
        const endPos = points[points.length - 1] || points[0]!;

        if (isSelectingScore) {
            const inferredShotType = shouldUsePath
                ? (getPathLength(points) >= MOVING_SHOT_MIN_PATH_LENGTH ? 'onTheMove' : 'stationary')
                : 'stationary';

            const waypoint: PathWaypoint = {
                id: generateId(),
                type: 'score',
                action: shouldUsePath ? 'shoot-path' : 'hub',
                position: endPos,
                fuelDelta: disableHubFuelScoringPopup ? 0 : 0,
                amountLabel: disableHubFuelScoringPopup ? undefined : '...',
                timestamp: Date.now(),
                pathPoints: shouldUsePath ? points : undefined,
                shotType: inferredShotType,
                zone: 'allianceZone',
            };
            if (disablePathDrawingTapOnly) {
                setPendingShotTypeWaypoint({
                    ...waypoint,
                    action: 'hub',
                    pathPoints: undefined,
                });
                setAccumulatedFuel(0);
                setFuelHistory([]);
                setPendingWaypoint(null);
            } else {
                if (disableHubFuelScoringPopup) {
                    onAddAction(waypoint);
                    setAccumulatedFuel(0);
                    setFuelHistory([]);
                    setPendingWaypoint(null);
                } else {
                    setAccumulatedFuel(0);
                    setFuelHistory([]);
                    setPendingWaypoint(waypoint);
                }
            }
            setIsSelectingScore(false);
        } else if (isSelectingPass) {
            const waypoint: PathWaypoint = {
                id: generateId(),
                type: 'pass',
                action: shouldUsePath ? 'pass-path' : 'partner',
                position: endPos,
                fuelDelta: 0,
                amountLabel: disablePassingPopup ? undefined : '...',
                timestamp: Date.now(),
                pathPoints: shouldUsePath ? points : undefined,
                zone: activeZone || 'neutralZone',
            };
            if (disablePassingPopup) {
                onAddAction(waypoint);
                setAccumulatedFuel(0);
                setFuelHistory([]);
                setPendingWaypoint(null);
            } else {
                setAccumulatedFuel(0);
                setFuelHistory([]);
                setPendingWaypoint(waypoint);
            }
            setIsSelectingPass(false);
        }
    }, [
        isSelectingScore,
        isSelectingPass,
        activeZone,
        generateId,
        setAccumulatedFuel,
        setFuelHistory,
        setPendingWaypoint,
        setIsSelectingScore,
        setIsSelectingPass,
        disableHubFuelScoringPopup,
        disablePassingPopup,
        disablePathDrawingTapOnly,
        onAddAction,
    ]);

    const handleShotTypeSelected = (shotType: 'onTheMove' | 'stationary') => {
        if (!pendingShotTypeWaypoint) return;

        const scoredWaypoint: PathWaypoint = {
            ...pendingShotTypeWaypoint,
            shotType,
        };

        if (disableHubFuelScoringPopup) {
            onAddAction(scoredWaypoint);
            setPendingWaypoint(null);
        } else {
            setPendingWaypoint(scoredWaypoint);
        }

        setPendingShotTypeWaypoint(null);
    };

    const handleElementClick = (elementKey: string) => {
        // Block if popup active or broken down
        if (pendingWaypoint || pendingShotTypeWaypoint || isSelectingScore || isSelectingPass || isBrokenDown) return;

        const element = FIELD_ELEMENTS[elementKey];
        if (!element) return;

        // Handle Stuck/Obstacle Toggles
        if (elementKey.includes('trench') || elementKey.includes('bump')) {
            const isCurrentlyStuck = !!stuckStarts[elementKey];
            const obstacleType = elementKey.includes('trench') ? 'trench' : 'bump';
            const obstacleZone: ZoneType = elementKey.includes('opponent') ? 'opponentZone' : 'allianceZone';

            if (isCurrentlyStuck) {
                // Clearing stuck state - record duration
                const startTime = stuckStarts[elementKey]!;
                const duration = Math.min(Date.now() - startTime, TELEOP_PHASE_DURATION_MS);

                onAddAction({
                    id: generateId(),
                    type: 'unstuck',
                    action: `unstuck-${obstacleType}`,
                    position: { x: element.x, y: element.y },
                    timestamp: Date.now(),
                    duration: duration,
                    obstacleType: obstacleType,
                    zone: obstacleZone
                });

                setStuckStarts(prev => {
                    const next = { ...prev };
                    delete next[elementKey];
                    return next;
                });
            } else {
                // Entering stuck state
                onAddAction({
                    id: generateId(),
                    type: 'stuck',
                    action: `stuck-${obstacleType}`,
                    position: { x: element.x, y: element.y },
                    timestamp: Date.now(),
                    obstacleType: obstacleType,
                    zone: obstacleZone
                });

                setStuckStarts(prev => ({
                    ...prev,
                    [elementKey]: Date.now()
                }));
            }
            return;
        }

        switch (elementKey) {
            case 'hub':
                setIsSelectingScore(true);
                break;
            case 'pass':
            case 'pass_alliance':
                setIsSelectingPass(true);
                break;
            case 'tower':
                // Open climb selector
                setPendingWaypoint({
                    id: generateId(),
                    type: 'climb',
                    action: 'attempt',
                    position: { x: element.x, y: element.y },
                    timestamp: Date.now(),
                    zone: 'allianceZone',
                });
                setClimbLevel(undefined);
                setClimbLocation(undefined);
                setClimbResult('success');
                break;
            case 'defense_alliance':
            case 'defense_neutral':
            case 'defense_opponent':
                // Defense - create minimal action (no waypoint needed)
                onAddAction({
                    id: generateId(),
                    type: 'defense',
                    timestamp: Date.now(),
                } as any);
                break;
            case 'pass_opponent':
                // Pass from opponent zone - same behavior as regular pass
                setIsSelectingPass(true);
                break;
            case 'steal':
                // Steal - create minimal action (no waypoint needed)
                onAddAction({
                    id: generateId(),
                    type: 'steal',
                    timestamp: Date.now(),
                } as any);
                break;
        }
    };

    const handleFuelSelect = (amount: number) => {
        setAccumulatedFuel(prev => prev + amount);
        setFuelHistory(prev => [...prev, amount]);
    };

    const handleFuelConfirm = () => {
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
    };

    const handleFuelCancel = () => {
        setPendingWaypoint(null);
        setAccumulatedFuel(0);
        setFuelHistory([]);
        setIsSelectingScore(false);
        setIsSelectingPass(false);
        resetDrawing();
    };

    const handleFuelUndo = () => {
        if (fuelHistory.length === 0) return;
        const lastAmount = fuelHistory[fuelHistory.length - 1]!;
        setAccumulatedFuel(prev => prev - lastAmount);
        setFuelHistory(prev => prev.slice(0, -1));
    };



    const handleClimbCancel = () => {
        setPendingWaypoint(null);
        setClimbLevel(undefined);
        setClimbLocation(undefined);
    };

    // Undo wrapper that also clears active broken down state
    const handleUndoWrapper = () => {
        if (brokenDownStart) {
            setBrokenDownStart(null);
        }
        if (onUndo) {
            onUndo();
        }
    };

    // ==========================================================================
    // GET VISIBLE ELEMENTS FOR ACTIVE ZONE
    // ==========================================================================

    // Use shared zone element config
    const visibleElements = getVisibleElements('teleop', activeZone);

    // ==========================================================================
    // RENDER
    // ==========================================================================

    const content = (
        <div className={cn("flex flex-col gap-2", isFullscreen && "h-full")}>
            {/* Header */}
            <FieldHeader
                phase="teleop"
                stats={[
                    { label: 'Scored', value: totalFuelScored, color: 'green' },
                    { label: 'Passed', value: totalFuelPassed, color: 'purple' },
                ]}
                currentZone={activeZone}
                isFullscreen={isFullscreen}
                onFullscreenToggle={() => setIsFullscreen(!isFullscreen)}
                actionLogSlot={<TeleopActionLog actions={actions} open={actionLogOpen} onOpenChange={setActionLogOpen} />}
                onActionLogOpen={() => setActionLogOpen(true)}
                matchNumber={matchNumber}
                matchType={matchType}
                teamNumber={teamNumber}
                alliance={alliance}
                isFieldRotated={isFieldRotated}
                canUndo={canUndo}
                onUndo={handleUndoWrapper}
                onBack={onBack}
                onProceed={() => {
                    // Capture any active stuck timers before proceeding
                    const stuckEntries = Object.entries(stuckStarts);
                    const finalActions = [...actions];
                    const now = Date.now();

                    for (const [elementKey, startTime] of stuckEntries) {
                        if (startTime && typeof startTime === 'number') {
                            const obstacleType = elementKey.includes('trench') ? 'trench' : 'bump';
                            const element = FIELD_ELEMENTS[elementKey];
                            const duration = Math.min(now - startTime, TELEOP_PHASE_DURATION_MS);

                            const unstuckWaypoint: PathWaypoint = {
                                id: generateId(),
                                type: 'unstuck',
                                action: `unstuck-${obstacleType}`,
                                position: element ? { x: element.x, y: element.y } : { x: 0, y: 0 },
                                timestamp: now,
                                duration,
                                obstacleType: obstacleType as 'trench' | 'bump',
                                amountLabel: formatDurationSecondsLabel(duration),
                            };

                            finalActions.push(unstuckWaypoint);
                        }
                    }

                    if (stuckEntries.length > 0) {
                        setStuckStarts({});
                    }

                    // Capture any active broken down time before proceeding
                    if (brokenDownStart) {
                        const duration = Date.now() - brokenDownStart;
                        const finalTotal = totalBrokenDownTime + duration;
                        localStorage.setItem('teleopBrokenDownTime', String(finalTotal));
                    }
                    if (onProceed) onProceed(finalActions);
                }}
                toggleFieldOrientation={toggleFieldOrientation}
                isBrokenDown={isBrokenDown}
                onBrokenDownToggle={handleBrokenDownToggle}
            />

            {/* Field Map */}
            <div className={cn("flex-1 relative", isFullscreen ? "h-full flex items-center justify-center" : "")}>
                {/* Container with 2:1 aspect ratio */}
                <div
                    ref={containerRef}
                    className={cn(
                        "relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 select-none",
                        "w-full aspect-[2/1]",
                        isFullscreen ? "max-h-[85vh] m-auto" : "h-auto"
                    )}
                    style={{
                        transform: isFieldRotated ? 'rotate(180deg)' : undefined,
                    }}
                >
                    {/* Field Background */}
                    <img
                        src={fieldImage}
                        alt="2026 Field"
                        className="w-full h-full object-fill"
                        style={{ opacity: 0.9 }}
                    />

                    {/* Canvas Layer */}
                    <FieldCanvas
                        ref={fieldCanvasRef}
                        actions={actions}
                        pendingWaypoint={pendingWaypoint}
                        drawingPoints={drawingPoints}
                        alliance={alliance}
                        isFieldRotated={isFieldRotated}
                        width={canvasDimensions.width}
                        height={canvasDimensions.height}
                        isSelectingScore={isSelectingScore}
                        isSelectingPass={isSelectingPass}
                        drawConnectedPaths={false}
                        drawingZoneBounds={currentZoneBounds}
                        onPointerDown={handleDrawStart}
                        onPointerMove={disablePathDrawingTapOnly ? undefined : handleDrawMove}
                        onPointerUp={handleDrawEnd}
                    />

                    {/* Zone Overlays - show inactive zones for quick switching */}
                    {!pendingWaypoint && !pendingShotTypeWaypoint && !isSelectingScore && !isSelectingPass && (
                        <>
                            <ZoneOverlay
                                zone="allianceZone"
                                isActive={activeZone === 'allianceZone'}
                                alliance={alliance}
                                isDisabled={isAnyStuck}
                                isFieldRotated={isFieldRotated}
                                onClick={() => handleZoneClick('allianceZone')}
                            />
                            <ZoneOverlay
                                zone="neutralZone"
                                isActive={activeZone === 'neutralZone'}
                                alliance={alliance}
                                isDisabled={isAnyStuck}
                                isFieldRotated={isFieldRotated}
                                onClick={() => handleZoneClick('neutralZone')}
                            />
                            <ZoneOverlay
                                zone="opponentZone"
                                isActive={activeZone === 'opponentZone'}
                                alliance={alliance}
                                isDisabled={isAnyStuck}
                                isFieldRotated={isFieldRotated}
                                onClick={() => handleZoneClick('opponentZone')}
                            />
                        </>
                    )}

                    {/* Field Buttons (only visible ones for this zone) */}
                    {activeZone && !pendingWaypoint && !isSelectingScore && !isSelectingPass && (
                        <>
                            {visibleElements.map((key) => {
                                let element = FIELD_ELEMENTS[key];
                                if (!element) return null;

                                // Override obstacle elements to always say "Stuck" in Teleop
                                if (key.includes('trench') || key.includes('bump')) {
                                    element = {
                                        ...element,
                                        name: 'Stuck'
                                    };
                                }

                                // Add counts for defense and steal buttons
                                let count: number | undefined = undefined;
                                if (key === 'defense_alliance' || key === 'defense_neutral' || key === 'defense_opponent') {
                                    count = totalDefense;
                                } else if (key === 'steal') {
                                    count = totalSteal;
                                }

                                return (
                                    <FieldButton
                                        key={key}
                                        elementKey={key}
                                        element={element}
                                        isVisible={true}
                                        isDisabled={isAnyStuck && !stuckStarts[key]}
                                        isStuck={!!stuckStarts[key]}
                                        count={count}
                                        onClick={handleElementClick}
                                        alliance={alliance}
                                        isFieldRotated={isFieldRotated}
                                        containerWidth={canvasDimensions.width}
                                    />
                                );
                            })}
                        </>
                    )}

                    {/* Score/Pass Mode Overlay */}
                    {!pendingShotTypeWaypoint && (isSelectingScore || isSelectingPass) && (
                        <div className={cn(
                            "absolute inset-x-0 top-0 z-20 flex items-center justify-center p-2",
                            "bg-gradient-to-b from-slate-900/90 to-transparent",
                            isFieldRotated && "bottom-0 top-auto rotate-180 bg-gradient-to-t"
                        )}>
                            <div className={cn(
                                "px-3 py-1.5 rounded-full font-bold text-sm",
                                isSelectingScore ? "bg-green-600/90 text-white" : "bg-purple-600/90 text-white"
                            )}>
                                {isSelectingScore
                                    ? (disablePathDrawingTapOnly ? 'Tap where robot scored' : 'Tap or draw to shoot')
                                    : (disablePathDrawingTapOnly ? 'Tap where robot passed' : 'Tap or draw pass path')}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleFuelCancel}
                                className="ml-2 text-red-400 hover:text-red-300"
                            >
                                Cancel
                            </Button>
                        </div>
                    )}

                    {/* Post-Action Popup (Fuel or Climb) */}
                    {pendingWaypoint && (
                        <PendingWaypointPopup
                            pendingWaypoint={pendingWaypoint}
                            accumulatedFuel={accumulatedFuel}
                            fuelHistory={fuelHistory}
                            isFieldRotated={isFieldRotated}
                            alliance={alliance}
                            robotCapacity={robotCapacity}
                            onFuelSelect={handleFuelSelect}
                            onFuelUndo={handleFuelUndo}
                            climbResult={climbResult}
                            onClimbResultSelect={(result) => setClimbResult(result)}
                            climbWithLevels={true}
                            climbLevel={climbLevel}
                            onClimbLevelSelect={(level) => setClimbLevel(level)}
                            climbLocation={climbLocation}
                            onClimbLocationSelect={(location) => setClimbLocation(location)}
                            onConfirm={pendingWaypoint.type === 'climb' ? (selectedClimbStartTimeSecRemaining) => {
                                if (climbLevel && climbLocation && climbResult) {
                                    const waypoint: PathWaypoint = {
                                        ...pendingWaypoint,
                                        action: `climbL${climbLevel}`,
                                        amountLabel: `${climbLocation === 'side' ? 'Side' : 'Middle'} L${climbLevel} ${climbResult === 'success' ? '✓' : '✗'}`,
                                        climbLevel,
                                        climbLocation,
                                        climbResult: climbResult,
                                        climbStartTimeSecRemaining: selectedClimbStartTimeSecRemaining ?? null,
                                    };
                                    onAddAction(waypoint);
                                    setPendingWaypoint(null);
                                    setClimbLevel(undefined);
                                    setClimbLocation(undefined);
                                    setClimbResult('success');
                                    // Show proceed dialog
                                    setShowPostClimbProceed(true);
                                }
                            } : handleFuelConfirm}
                            onCancel={pendingWaypoint.type === 'climb' ? handleClimbCancel : handleFuelCancel}
                        />
                    )}

                    {pendingShotTypeWaypoint && (
                        <ShotTypePopup
                            isFieldRotated={isFieldRotated}
                            onSelect={handleShotTypeSelected}
                            onCancel={() => {
                                setPendingShotTypeWaypoint(null);
                                setPendingWaypoint(null);
                                resetDrawing();
                            }}
                        />
                    )}

                    {/* Post-Climb Transition Overlay */}
                    {showPostClimbProceed && onProceed && (
                        <PostClimbProceed
                            isFieldRotated={isFieldRotated}
                            onProceed={onProceed}
                            onStay={() => setShowPostClimbProceed(false)}
                            nextPhaseName="Endgame"
                        />
                    )}
                </div>
            </div>
        </div>
    );

    // Wrap in fullscreen modal or return content directly
    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-[100] bg-background p-4 flex flex-col">
                {content}
            </div>
        );
    }

    return content;
}
