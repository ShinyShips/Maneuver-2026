/**
 * Auto Path Tracker Component
 * 
 * Guided path tracking for autonomous period that visualizes robot movements
 * on the field map. Action buttons overlay the field at their actual positions.
 * 
 * Features:
 * - Buttons positioned at actual field locations (hub, depot, outpost, etc.)
 * - State machine for guided action selection
 * - Canvas-based path visualization
 * - Expand to fullscreen mode
 * - Alliance-aware field mirroring
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/core/components/ui/button";
import { Card } from "@/core/components/ui/card";
import { Badge } from "@/core/components/ui/badge";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/core/hooks/use-mobile";
import { cn } from "@/core/lib/utils";
import fieldImage from "@/game-template/assets/2026-field.png";
import {
    FIELD_ELEMENTS,
    ZONE_BOUNDS,
    AUTO_START_KEYS,
    getVisibleElements,
    type PathActionType,
    type ZoneType,
    type PathWaypoint,
    FieldHeader,
    FieldButton,
    PendingWaypointPopup,
    usePathDrawing,
    FieldCanvas,
    type FieldCanvasRef,
} from "@/game-template/components/field-map";

// Context hooks
import { AutoPathProvider, useAutoScoring } from "@/game-template/contexts";

// Local sub-components
import { AutoActionLog } from "./components/AutoActionLog";
import { AutoStartConfirmation } from "./components/AutoStartConfirmation";
import { PostClimbProceed } from "@/game-template/components";




// =============================================================================
// RE-EXPORT TYPES FOR CONSUMERS
// =============================================================================

// Re-export types for backward compatibility with existing consumers
export type { PathActionType, ZoneType, PathWaypoint };



export interface AutoPathTrackerProps {
    onAddAction: (action: any) => void;
    actions: PathWaypoint[];
    onUndo?: () => void;
    canUndo?: boolean;
    startPosition?: number;
    matchNumber?: string | number;
    matchType?: 'qm' | 'sf' | 'f';
    teamNumber?: string | number;
    onBack?: () => void;
    onProceed?: () => void;
}

// =============================================================================
// WRAPPER COMPONENT - Provides Context
// =============================================================================

export function AutoPathTracker(props: AutoPathTrackerProps) {
    const location = useLocation();
    const alliance = location.state?.inputs?.alliance || 'blue';

    return (
        <AutoPathProvider
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
            <AutoPathTrackerContent />
        </AutoPathProvider>
    );
}

// =============================================================================
// CONTENT COMPONENT - Uses Context
// =============================================================================

function AutoPathTrackerContent() {
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
        // From AutoPathContext
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
        isSelectingScore,
        setIsSelectingScore,
        isSelectingPass,
        setIsSelectingPass,
        isSelectingCollect,
        setIsSelectingCollect,
    } = useAutoScoring();

    const fieldCanvasRef = useRef<FieldCanvasRef>(null);
    const canvasRef = useMemo(() => ({
        get current() { return fieldCanvasRef.current?.canvas ?? null; }
    }), []) as React.RefObject<HTMLCanvasElement>;

    const stuckTimeoutRef = useRef<any>(null);

    // Local state (UI-only, not shared)
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentZone, setCurrentZone] = useState<ZoneType>('allianceZone');

    const isMobile = useIsMobile();

    // Path drawing hook - use current zone bounds
    const currentZoneBounds = ZONE_BOUNDS[currentZone];
    const {
        drawingPoints: hookDrawingPoints,
        handleDrawStart,
        handleDrawMove,
        handleDrawEnd,
        resetDrawing,
    } = usePathDrawing({
        canvasRef,
        isFieldRotated,
        alliance,
        isEnabled: isSelectingScore || isSelectingPass || isSelectingCollect,
        onDrawComplete: (points) => handleInteractionEnd(points),
        zoneBounds: currentZoneBounds,
    });

    // Auto-fullscreen on mobile on mount
    useEffect(() => {
        if (isMobile) {
            setIsFullscreen(true);
        }
    }, [isMobile]);

    // Recalculate current zone whenever actions change (handles undo properly)
    useEffect(() => {
        // Start in alliance zone, toggle for each traversal action
        let zone: ZoneType = 'allianceZone';
        actions.forEach(action => {
            if (action.type === 'traversal') {
                zone = zone === 'allianceZone' ? 'neutralZone' : 'allianceZone';
            }
        });
        setCurrentZone(zone);
    }, [actions]);


    // Calculate totals from actions
    const totalFuelScored = actions
        .filter(a => a.type === 'score')
        .reduce((sum, a) => sum + Math.abs(a.fuelDelta || 0), 0);

    const totalScore = actions.reduce((sum, action) => {
        if (action.type === 'score' && action.fuelDelta) {
            return sum + Math.abs(action.fuelDelta) * 3; // 3 points per fuel
        } else if (action.type === 'climb' && action.action !== 'attempt') {
            return sum + 15; // Auto climb is 15 points
        }
        return sum;
    }, 0);





    // addWaypoint helper - wraps context's generateId with position handling
    const addWaypoint = useCallback((type: PathActionType, action: string, position: { x: number; y: number }, fuelDelta?: number, amountLabel?: string) => {
        const waypoint: PathWaypoint = {
            id: generateId(),
            type,
            action,
            position, // CSS handles mirroring, no need to mirror coordinates
            fuelDelta,
            amountLabel,
            timestamp: Date.now(),
        };
        onAddAction(waypoint);
    }, [onAddAction, generateId]);

    const handleElementClick = (elementKey: string) => {
        const element = FIELD_ELEMENTS[elementKey as keyof typeof FIELD_ELEMENTS];
        if (!element) return;

        // 1. Handle Persistent Stuck Resolution
        if (stuckStarts[elementKey]) {
            const startTime = stuckStarts[elementKey]!;
            const type = elementKey.includes('trench') ? 'trench' : 'bump';

            // Include duration in the waypoint for analytics
            const stuckDuration = Date.now() - startTime;
            addWaypoint('traversal', `${type}-stuck`, { x: element.x, y: element.y }, undefined, `${Math.round(stuckDuration / 1000)}s`);

            setStuckStarts(prev => {
                const next = { ...prev };
                delete next[elementKey];
                return next;
            });
            return;
        }

        // 2. Handle Potential Stuck Promotion (Second tap within 5s)
        if (stuckElementKey === elementKey) {
            if (stuckTimeoutRef.current) {
                clearTimeout(stuckTimeoutRef.current);
                stuckTimeoutRef.current = null;
            }
            setStuckElementKey(null);
            setStuckStarts(prev => ({ ...prev, [elementKey]: Date.now() }));
            return;
        }

        // Block clicks while any popup is active or robot is stuck elsewhere
        if (pendingWaypoint || isSelectingScore || isSelectingPass || isSelectingCollect || selectedStartKey || isAnyStuck) {
            return;
        }

        const position = { x: element.x, y: element.y };

        if (actions.length === 0) {
            const startKeys = ['trench1', 'bump1', 'hub', 'bump2', 'trench2'];
            if (startKeys.includes(elementKey)) {
                setSelectedStartKey(elementKey);
            }
            return;
        }

        switch (elementKey) {
            case 'hub':
                setIsSelectingScore(true);
                break;
            case 'depot':
            case 'outpost':
                addWaypoint('collect', elementKey, position, 8);
                break;
            case 'tower': {
                const waypoint: PathWaypoint = {
                    id: generateId(),
                    type: 'climb',
                    action: 'attempt',
                    position: position,
                    timestamp: Date.now(),
                };
                setPendingWaypoint(waypoint);
                setClimbResult('success');
                break;
            }
            case 'trench1':
            case 'trench2':
            case 'bump1':
            case 'bump2': {
                const type = elementKey.includes('trench') ? 'trench' : 'bump';
                addWaypoint('traversal', type, position);

                // Enter potential stuck ("Stuck?") phase for 5s
                if (stuckTimeoutRef.current) clearTimeout(stuckTimeoutRef.current);
                setStuckElementKey(elementKey);
                stuckTimeoutRef.current = setTimeout(() => {
                    setStuckElementKey(null);
                    stuckTimeoutRef.current = null;
                }, 5000);
                break;
            }
            case 'pass':
                setIsSelectingPass(true); // Enter pass position selection mode
                break;
            case 'collect_neutral':
            case 'collect_alliance':
                setIsSelectingCollect(true); // Enter collect position selection mode
                break;
            case 'opponent_foul':
                addWaypoint('foul', 'mid-line-penalty', position);
                break;
        }
    };

    // Consolidated interaction handler
    const handleInteractionEnd = (points: { x: number; y: number }[]) => {
        if (points.length === 0) return;

        const isDrag = points.length > 5; // Simple threshold to distinguish tap vs drag
        const pos = points[0]!;

        if (isSelectingScore) {
            const waypoint: PathWaypoint = {
                id: generateId(),
                type: 'score',
                action: isDrag ? 'shoot-path' : 'hub',
                position: pos,
                fuelDelta: -8, // Default, will be finalized in amount selection
                amountLabel: '...', // Placeholder until confirmed
                timestamp: Date.now(),
                pathPoints: isDrag ? points : undefined,
            };
            setAccumulatedFuel(0);
            setFuelHistory([]);
            setPendingWaypoint(waypoint);
            setIsSelectingScore(false);
        } else if (isSelectingPass) {
            const waypoint: PathWaypoint = {
                id: generateId(),
                type: 'pass',
                action: isDrag ? 'pass-path' : 'partner',
                position: pos,
                fuelDelta: 0,
                amountLabel: '...', // Placeholder until confirmed
                timestamp: Date.now(),
                pathPoints: isDrag ? points : undefined,
            };
            setAccumulatedFuel(0);
            setFuelHistory([]);
            setPendingWaypoint(waypoint);
            setIsSelectingPass(false);
        } else if (isSelectingCollect) {
            // Collect still immediate as per plan or consolidate too? 
            // The user said: "I don't think we need to track it for collect, we really only care about how many they scored"
            // So I'll keep collect immediate for speed, but use the unified structure.
            if (isDrag) {
                const waypoint: PathWaypoint = {
                    id: generateId(),
                    type: 'collect',
                    action: 'collect-path',
                    position: pos,
                    fuelDelta: 8,
                    timestamp: Date.now(),
                    pathPoints: points,
                };
                onAddAction(waypoint);
            } else {
                addWaypoint('collect', 'field', pos, 8);
            }
            setIsSelectingCollect(false);
        }
        resetDrawing();
    };






    // ==========================================================================
    // RENDER
    // ==========================================================================

    const content = (
        <div className={cn("flex flex-col gap-2", isFullscreen && "h-full")}>
            {/* Header */}
            <FieldHeader
                phase="auto"
                stats={[
                    { label: 'Scored', value: totalFuelScored, color: 'green' },
                    { label: 'Points', value: totalScore, color: 'slate' },
                ]}
                currentZone={currentZone}
                isFullscreen={isFullscreen}
                onFullscreenToggle={() => setIsFullscreen(!isFullscreen)}
                actionLogSlot={<AutoActionLog actions={actions} totalScore={totalScore} />}
                matchNumber={matchNumber}
                matchType={matchType}
                teamNumber={teamNumber}
                alliance={alliance}
                isFieldRotated={isFieldRotated}
                canUndo={canUndo}
                onUndo={onUndo}
                onBack={onBack}
                onProceed={onProceed}
                toggleFieldOrientation={toggleFieldOrientation}
            />

            {/* Field with Overlay Buttons */}
            <div
                ref={containerRef}
                className={cn(
                    "relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 select-none",
                    "w-full aspect-2/1",
                    isFullscreen ? "max-h-[85vh] m-auto" : "h-auto",
                    isFieldRotated && "rotate-180" // 180° rotation for field orientation preference
                )}
            >
                {/* Field Background */}
                <img
                    src={fieldImage}
                    alt="2026 Field"
                    className="w-full h-full object-fill"
                    style={{ opacity: 0.9 }}
                />

                {/* Drawing Canvas Layer */}
                <FieldCanvas
                    ref={fieldCanvasRef}
                    actions={actions}
                    pendingWaypoint={pendingWaypoint}
                    drawingPoints={hookDrawingPoints}
                    alliance={alliance}
                    isFieldRotated={isFieldRotated}
                    width={canvasDimensions.width}
                    height={canvasDimensions.height}
                    isSelectingScore={isSelectingScore}
                    isSelectingPass={isSelectingPass}
                    isSelectingCollect={isSelectingCollect}
                    drawConnectedPaths={true}
                    drawingZoneBounds={currentZoneBounds}
                    onPointerDown={handleDrawStart}
                    onPointerMove={handleDrawMove}
                    onPointerUp={handleDrawEnd}
                />

                {/* Overlay Buttons */}
                {!isSelectingScore && !isSelectingPass && !isSelectingCollect && (
                    <div className="absolute inset-0 z-10">
                        {actions.length === 0 ? (
                            <>
                                {AUTO_START_KEYS.map(key => (
                                    <FieldButton
                                        key={key}
                                        elementKey={key}
                                        element={FIELD_ELEMENTS[key]!}
                                        isVisible={true}
                                        onClick={handleElementClick}
                                        alliance={alliance}
                                        isFieldRotated={isFieldRotated}
                                        containerWidth={canvasDimensions.width}
                                        overrideX={0.28}
                                        isDisabled={!!(pendingWaypoint || isSelectingScore || isSelectingPass || isSelectingCollect || selectedStartKey)}
                                    />
                                ))}
                            </>
                        ) : (
                            <>
                                {getVisibleElements('auto', currentZone).map(key => {
                                    const isPersistentStuck = !!stuckStarts[key];
                                    const isPopupActive = !!(pendingWaypoint || isSelectingScore || isSelectingPass || isSelectingCollect || selectedStartKey);

                                    return (
                                        <FieldButton
                                            key={key}
                                            elementKey={key}
                                            element={FIELD_ELEMENTS[key]!}
                                            isVisible={true}
                                            onClick={handleElementClick}
                                            alliance={alliance}
                                            isFieldRotated={isFieldRotated}
                                            containerWidth={canvasDimensions.width}
                                            isStuck={isPersistentStuck}
                                            isPotentialStuck={stuckElementKey === key}
                                            isDisabled={isPopupActive || (isAnyStuck && !isPersistentStuck)}
                                        />
                                    );
                                })}
                            </>
                        )}
                    </div>
                )}

                {/* Score Selection Overlay */}
                {isSelectingScore && (
                    <div className={cn("absolute inset-0 z-30 flex items-end justify-center pb-4 pointer-events-none", isFieldRotated && "rotate-180")}>
                        <Card className="pointer-events-auto bg-background/95 backdrop-blur-sm border-green-500/50 shadow-2xl py-2 px-3 flex flex-row items-center gap-4">
                            <Badge variant="default" className="bg-green-600">SCORING MODE</Badge>
                            <span className="text-sm font-medium">Tap or draw where the robot scored</span>
                            <Button
                                onClick={(e) => { e.stopPropagation(); setIsSelectingScore(false); resetDrawing(); }}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-full"
                            >
                                ✕
                            </Button>
                        </Card>
                    </div>
                )}

                {/* Pass Selection Overlay */}
                {isSelectingPass && (
                    <div className={cn("absolute inset-0 z-30 flex items-end justify-center pb-4 pointer-events-none", isFieldRotated && "rotate-180")}>
                        <Card className="pointer-events-auto bg-background/95 backdrop-blur-sm border-purple-500/50 shadow-2xl py-2 px-3 flex flex-row items-center gap-4">
                            <Badge variant="default" className="bg-purple-600">PASSING MODE</Badge>
                            <span className="text-sm font-medium">Tap or draw where the robot passed from</span>
                            <Button
                                onClick={(e) => { e.stopPropagation(); setIsSelectingPass(false); resetDrawing(); }}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-full"
                            >
                                ✕
                            </Button>
                        </Card>
                    </div>
                )}

                {/* Collect Selection Overlay */}
                {isSelectingCollect && (
                    <div className={cn("absolute inset-0 z-30 flex items-end justify-center pb-4 pointer-events-none", isFieldRotated && "rotate-180")}>
                        <Card className="pointer-events-auto bg-background/95 backdrop-blur-sm border-yellow-500/50 shadow-2xl py-2 px-3 flex flex-row items-center gap-4">
                            <Badge variant="default" className="bg-yellow-600">COLLECT MODE</Badge>
                            <span className="text-sm font-medium">Tap or draw where the robot collected</span>
                            <Button
                                onClick={(e) => { e.stopPropagation(); setIsSelectingCollect(false); resetDrawing(); }}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-full"
                            >
                                ✕
                            </Button>
                        </Card>
                    </div>
                )}

                {/* Starting Position Confirmation Overlay */}
                {actions.length === 0 && selectedStartKey && (() => {
                    const startElement = FIELD_ELEMENTS[selectedStartKey];
                    const startPositionX = startElement ? startElement.x : 0.15;
                    return (
                        <AutoStartConfirmation
                            selectedStartKey={selectedStartKey}
                            alliance={alliance}
                            isFieldRotated={isFieldRotated}
                            startPositionX={startPositionX}
                            onConfirm={(key, pos) => {
                                addWaypoint('start', key, pos);
                                setSelectedStartKey(null);
                            }}
                            onCancel={() => setSelectedStartKey(null)}
                        />
                    );
                })()}


                {/* Post-Climb Transition Overlay */}
                {showPostClimbProceed && onProceed && (
                    <PostClimbProceed
                        isFieldRotated={isFieldRotated}
                        onProceed={onProceed}
                        onStay={() => setShowPostClimbProceed(false)}
                        nextPhaseName="Teleop"
                    />
                )}


                {/* Post-Action Amount Selection Overlay */}
                {pendingWaypoint && (
                    <PendingWaypointPopup
                        pendingWaypoint={pendingWaypoint}
                        accumulatedFuel={accumulatedFuel}
                        fuelHistory={fuelHistory}
                        climbResult={climbResult}
                        isFieldRotated={isFieldRotated}
                        alliance={alliance}
                        onFuelSelect={(value: number) => {
                            setAccumulatedFuel(prev => prev + value);
                            setFuelHistory(prev => [...prev, value]);
                        }}
                        onFuelUndo={() => {
                            if (fuelHistory.length === 0) return;
                            const lastDelta = fuelHistory[fuelHistory.length - 1]!;
                            setAccumulatedFuel(prev => Math.max(0, prev - lastDelta));
                            setFuelHistory(prev => prev.slice(0, -1));
                        }}
                        onClimbResultSelect={setClimbResult}
                        onConfirm={() => {
                            let delta = 0;
                            let label = '';
                            let action = pendingWaypoint.action;

                            if (pendingWaypoint.type === 'climb') {
                                action = climbResult === 'success' ? 'climb-success' : 'climb-fail';
                                label = climbResult === 'success' ? 'Succeeded' : 'Failed';
                            } else {
                                delta = pendingWaypoint.type === 'score' || pendingWaypoint.type === 'pass' ? -accumulatedFuel : 0;
                                label = pendingWaypoint.type === 'score' ? `+${accumulatedFuel}` : `Pass (${accumulatedFuel})`;
                            }

                            const finalized: PathWaypoint = {
                                ...pendingWaypoint,
                                fuelDelta: delta,
                                amountLabel: label,
                                action: action
                            };
                            onAddAction(finalized);
                            setPendingWaypoint(null);
                            setAccumulatedFuel(0);
                            setFuelHistory([]);
                            setClimbResult(null);

                            // Show transition popup after climb
                            if (finalized.type === 'climb' && onProceed) {
                                setShowPostClimbProceed(true);
                            }
                        }}
                        onCancel={() => {
                            setPendingWaypoint(null);
                            resetDrawing();
                            setAccumulatedFuel(0);
                            setFuelHistory([]);
                        }}
                    />
                )}



            </div>
        </div>
    );

    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-100 bg-background p-4 flex flex-col">
                {content}
            </div>
        );
    }

    return content;
}
