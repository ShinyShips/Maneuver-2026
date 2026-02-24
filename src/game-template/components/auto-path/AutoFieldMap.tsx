/**
 * Auto Field Map Component
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
import { useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/core/hooks/use-mobile";
import { cn } from "@/core/lib/utils";
import { loadPitScoutingByTeamAndEvent } from "@/core/db/database";
import { submitMatchData } from "@/core/lib/submitMatch";
import { useGame } from "@/core/contexts/GameContext";
import { toast } from "sonner";
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
    ShotTypePopup,
    usePathDrawing,
    FieldCanvas,
    type FieldCanvasRef,
} from "@/game-template/components/field-map";

// Context hooks
import { AutoPathProvider, useAutoScoring } from "@/game-template/contexts";
import { actions as schemaActions } from "@/game-template/game-schema";
import { formatDurationSecondsLabel } from "@/game-template/duration";
import { AUTO_PHASE_DURATION_MS } from "@/game-template/constants";
import {
    GAME_SCOUT_OPTION_KEYS,
    getEffectiveScoutOptions,
} from "@/game-template/scout-options";
import { CORE_SCOUT_OPTION_KEYS } from "@/core/components/GameStartComponents/ScoutOptionsSheet";

// Local sub-components
import { AutoActionLog } from "./components/AutoActionLog";
import { AutoStartConfirmation } from "./components/AutoStartConfirmation";
import { PostClimbProceed } from "@/game-template/components";




// =============================================================================
// RE-EXPORT TYPES FOR CONSUMERS
// =============================================================================

// Re-export types for backward compatibility with existing consumers
export type { PathActionType, ZoneType, PathWaypoint };

const START_KEY_LABELS: Record<'trench1' | 'bump1' | 'hub' | 'bump2' | 'trench2', string> = {
    trench1: 'Left Trench',
    bump1: 'Left Bump',
    hub: 'Hub',
    bump2: 'Right Bump',
    trench2: 'Right Trench',
};

const MOVING_SHOT_MIN_PATH_LENGTH = 0.05;
const AUTO_SWITCH_ONCE_STORAGE_PREFIX = 'autoSwitchToTeleopDone';
const AUTO_CUE_TARGET_MS = 20000;

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



export interface AutoFieldMapProps {
    onAddAction: (action: any) => void;
    actions: PathWaypoint[];
    scoutOptions?: Record<string, boolean>;
    onUndo?: () => void;
    canUndo?: boolean;
    startPosition?: number;
    matchNumber?: string | number;
    matchType?: 'qm' | 'sf' | 'f';
    teamNumber?: string | number;
    onBack?: () => void;
    onProceed?: (finalActions?: PathWaypoint[]) => void;
    enableNoShow?: boolean;
    recordingMode?: boolean;
    preferredStartKey?: 'trench1' | 'bump1' | 'hub' | 'bump2' | 'trench2';
    headerLabel?: string;
    headerInputSlot?: React.ReactNode;
    recordingActionSlot?: React.ReactNode;
}

// =============================================================================
// WRAPPER COMPONENT - Provides Context
// =============================================================================

export function AutoFieldMap(props: AutoFieldMapProps) {
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
            enableNoShow={props.enableNoShow}
        >
            <AutoFieldMapContent
                scoutOptions={props.scoutOptions}
                recordingMode={props.recordingMode}
                preferredStartKey={props.preferredStartKey}
                headerLabel={props.headerLabel}
                headerInputSlot={props.headerInputSlot}
                recordingActionSlot={props.recordingActionSlot}
            />
        </AutoPathProvider>
    );
}

// =============================================================================
// CONTENT COMPONENT - Uses Context
// =============================================================================

function AutoFieldMapContent({
    scoutOptions,
    recordingMode = false,
    preferredStartKey,
    headerLabel,
    headerInputSlot,
    recordingActionSlot,
}: {
    scoutOptions?: Record<string, boolean>;
    recordingMode?: boolean;
    preferredStartKey?: 'trench1' | 'bump1' | 'hub' | 'bump2' | 'trench2';
    headerLabel?: string;
    headerInputSlot?: React.ReactNode;
    recordingActionSlot?: React.ReactNode;
}) {
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
        enableNoShow,
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
        climbLocation,
        setClimbLocation,
        canvasDimensions,
        containerRef,
        isSelectingScore,
        setIsSelectingScore,
        isSelectingPass,
        setIsSelectingPass,
        isSelectingCollect,
        setIsSelectingCollect,
    } = useAutoScoring();

    const navigate = useNavigate();
    const location = useLocation();
    const { transformation } = useGame();
    const autoSwitchOnceStorageKey = useMemo(() => {
        const eventKey = location.state?.inputs?.eventKey ?? 'unknown-event';
        const matchType = location.state?.inputs?.matchType ?? 'qm';
        const matchNumber = location.state?.inputs?.matchNumber ?? 'unknown-match';
        const teamNumber = location.state?.inputs?.selectTeam ?? 'unknown-team';
        return `${AUTO_SWITCH_ONCE_STORAGE_PREFIX}:${eventKey}:${matchType}:${matchNumber}:${teamNumber}`;
    }, [
        location.state?.inputs?.eventKey,
        location.state?.inputs?.matchType,
        location.state?.inputs?.matchNumber,
        location.state?.inputs?.selectTeam,
    ]);

    const fieldCanvasRef = useRef<FieldCanvasRef>(null);
    const autoScreenEnteredAtRef = useRef(Date.now());
    const hasAutoAdvancedRef = useRef(false);
    const startSeedInFlightRef = useRef(false);
    const canvasRef = useMemo(() => ({
        get current() { return fieldCanvasRef.current?.canvas ?? null; }
    }), []) as React.RefObject<HTMLCanvasElement>;

    const stuckTimeoutRef = useRef<any>(null);

    // Local state (UI-only, not shared)
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentZone, setCurrentZone] = useState<ZoneType>('allianceZone');
    const [robotCapacity, setRobotCapacity] = useState<number | undefined>();
    const [actionLogOpen, setActionLogOpen] = useState(false);
    const [pendingShotTypeWaypoint, setPendingShotTypeWaypoint] = useState<PathWaypoint | null>(null);
    const [autoElapsedMs, setAutoElapsedMs] = useState(0);
    const [elapsedSinceStartConfirmationMs, setElapsedSinceStartConfirmationMs] = useState(0);

    // Broken down state - persisted with localStorage
    const [brokenDownStart, setBrokenDownStart] = useState<number | null>(() => {
        const saved = localStorage.getItem('autoBrokenDownStart');
        return saved ? parseInt(saved, 10) : null;
    });
    const [totalBrokenDownTime, setTotalBrokenDownTime] = useState<number>(() => {
        const saved = localStorage.getItem('autoBrokenDownTime');
        return saved ? parseInt(saved, 10) : 0;
    });
    const isBrokenDown = brokenDownStart !== null;

    const isMobile = useIsMobile();
    const effectiveScoutOptions = getEffectiveScoutOptions(scoutOptions);
    const startAutoCueFromStartConfirmation =
        effectiveScoutOptions[CORE_SCOUT_OPTION_KEYS.startAutoCueFromStartConfirmation] !== false;
    const startAutoCueFromAutoScreenEntry =
        effectiveScoutOptions[CORE_SCOUT_OPTION_KEYS.startAutoCueFromAutoScreenEntry] === true;
    const autoAdvanceToTeleopAfter20s =
        effectiveScoutOptions[CORE_SCOUT_OPTION_KEYS.autoAdvanceToTeleopAfter20s] === true;
    const firstConfirmedStartTimestamp = useMemo(() => {
        const firstStartAction = actions.find((action) => action.type === 'start');
        return typeof firstStartAction?.timestamp === 'number'
            ? firstStartAction.timestamp
            : null;
    }, [actions]);
    const autoCueTimerStartTimestamp = startAutoCueFromAutoScreenEntry
        ? autoScreenEnteredAtRef.current
        : ((startAutoCueFromStartConfirmation || autoAdvanceToTeleopAfter20s) ? firstConfirmedStartTimestamp : null);
    const autoCueCountdownSeconds = autoCueTimerStartTimestamp === null
        ? null
        : Math.max(0, Math.ceil((AUTO_CUE_TARGET_MS - autoElapsedMs) / 1000));
    const shouldPulseAutoBorder = autoElapsedMs >= AUTO_CUE_TARGET_MS;
    const shouldAutoAdvanceToTeleop = autoAdvanceToTeleopAfter20s && elapsedSinceStartConfirmationMs >= AUTO_CUE_TARGET_MS;
    const disableHubFuelScoringPopup =
        effectiveScoutOptions[GAME_SCOUT_OPTION_KEYS.disableHubFuelScoringPopup] === true;
    const disablePassingPopup =
        effectiveScoutOptions[GAME_SCOUT_OPTION_KEYS.disablePassingPopup] === true;
    const disablePathDrawingTapOnly =
        effectiveScoutOptions[GAME_SCOUT_OPTION_KEYS.disableAutoPathDrawingTapOnly] === true;

    // Load pit scouting data for fuel capacity
    useEffect(() => {
        const loadPitData = async () => {
            if (!teamNumber) return;

            const parsedTeamNumber = Number(teamNumber);
            if (!Number.isFinite(parsedTeamNumber) || parsedTeamNumber <= 0) return;

            try {
                const eventKey = localStorage.getItem('eventKey') || '';
                const pitData = await loadPitScoutingByTeamAndEvent(parsedTeamNumber, eventKey);
                if (pitData && pitData.gameData) {
                    setRobotCapacity(pitData.gameData.fuelCapacity as number);
                }
            } catch (error) {
                console.error('Failed to load pit scouting data:', error);
            }
        };
        loadPitData();
    }, [teamNumber]);

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
        if (isMobile && !recordingMode) {
            setIsFullscreen(true);
            return;
        }
        if (recordingMode) {
            setIsFullscreen(false);
        }
    }, [isMobile, recordingMode]);

    useEffect(() => {
        if (autoCueTimerStartTimestamp === null) {
            setAutoElapsedMs(0);
            return;
        }

        const updateElapsed = () => {
            const elapsed = Date.now() - autoCueTimerStartTimestamp;
            setAutoElapsedMs(Math.min(Math.max(elapsed, 0), AUTO_PHASE_DURATION_MS));
        };

        updateElapsed();
        const intervalId = window.setInterval(updateElapsed, 250);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [autoCueTimerStartTimestamp]);

    useEffect(() => {
        if (firstConfirmedStartTimestamp === null) {
            hasAutoAdvancedRef.current = false;
            setElapsedSinceStartConfirmationMs(0);
            return;
        }

        const updateElapsed = () => {
            const elapsed = Date.now() - firstConfirmedStartTimestamp;
            setElapsedSinceStartConfirmationMs(Math.min(Math.max(elapsed, 0), AUTO_PHASE_DURATION_MS));
        };

        updateElapsed();
        const intervalId = window.setInterval(updateElapsed, 250);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [firstConfirmedStartTimestamp]);

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

    // Calculate total score from actions (not just fuel count)
    const totalScore = actions.reduce((sum, action) => {
        // Find matching action in schema
        const schemaAction = Object.entries(schemaActions).find(([key, def]) => {
            if (def.pathType !== action.type) return false;

            // For climb, match autoClimb
            if (action.type === 'climb' && action.action === 'climb-success') {
                return key === 'autoClimb';
            }

            // For collect, match by pathAction
            if (action.type === 'collect' && 'pathAction' in def && def.pathAction) {
                return def.pathAction === action.action;
            }

            // For score, count fuel points
            if (action.type === 'score') {
                return key === 'fuelScored';
            }

            return true;
        });

        if (schemaAction) {
            const [, def] = schemaAction;
            const points = def.points.auto || 0;

            // For fuel scoring, multiply by fuel count
            if (action.type === 'score' && action.fuelDelta) {
                return sum + (points * Math.abs(action.fuelDelta));
            }

            // For other actions, just add the points
            return sum + points;
        }

        return sum;
    }, 0);

    const totalFuelScored = actions
        .filter(a => a.type === 'score')
        .reduce((sum, a) => sum + Math.abs(a.fuelDelta || 0), 0);

    const totalFuelPassed = actions
        .filter(a => a.type === 'pass')
        .reduce((sum, a) => sum + Math.abs(a.fuelDelta || 0), 0);





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

    // Seed start position in recording mode based on requested pit start location
    useEffect(() => {
        if (!recordingMode || !preferredStartKey) return;

        if (actions.length > 0) {
            startSeedInFlightRef.current = false;
            return;
        }

        if (startSeedInFlightRef.current) {
            return;
        }

        if (actions.length === 0) {
            const startElement = FIELD_ELEMENTS[preferredStartKey];
            if (!startElement) return;

            startSeedInFlightRef.current = true;
            addWaypoint('start', preferredStartKey, { x: startElement.x, y: startElement.y });
            setSelectedStartKey(null);
            toast.info(`Starting position set to ${START_KEY_LABELS[preferredStartKey]}. Choose the next auto action.`);
        }
    }, [recordingMode, preferredStartKey, actions.length, addWaypoint, setSelectedStartKey]);

    const handleBrokenDownToggle = () => {
        if (brokenDownStart) {
            // Robot is back up - accumulate the time
            const duration = Date.now() - brokenDownStart;
            const newTotal = totalBrokenDownTime + duration;
            setTotalBrokenDownTime(newTotal);
            localStorage.setItem('autoBrokenDownTime', String(newTotal));
            setBrokenDownStart(null);
            localStorage.removeItem('autoBrokenDownStart');
        } else {
            // Robot is breaking down - start tracking time
            const now = Date.now();
            setBrokenDownStart(now);
            localStorage.setItem('autoBrokenDownStart', String(now));
        }
    };

    const handleElementClick = (elementKey: string) => {
        const element = FIELD_ELEMENTS[elementKey as keyof typeof FIELD_ELEMENTS];
        if (!element) return;
        let clearedPersistentStuck = false;

        // If user taps a different target while "Stuck?" is showing, treat it as dismissal
        if (!recordingMode && stuckElementKey && stuckElementKey !== elementKey) {
            if (stuckTimeoutRef.current) {
                clearTimeout(stuckTimeoutRef.current);
                stuckTimeoutRef.current = null;
            }
            setStuckElementKey(null);
        }

        // 1. Handle Persistent Stuck Resolution
        if (!recordingMode && stuckStarts[elementKey]) {
            const startTime = stuckStarts[elementKey]!;
            const obstacleType = elementKey.includes('trench') ? 'trench' : 'bump';
            const stuckDuration = Math.min(Date.now() - startTime, AUTO_PHASE_DURATION_MS);

            // Create unstuck waypoint with duration for analytics (matches teleop pattern)
            onAddAction({
                id: generateId(),
                type: 'unstuck',
                action: `unstuck-${obstacleType}`,
                position: { x: element.x, y: element.y },
                timestamp: Date.now(),
                duration: stuckDuration,
                obstacleType: obstacleType as 'trench' | 'bump',
                amountLabel: formatDurationSecondsLabel(stuckDuration),
            });

            setStuckStarts(prev => {
                const next = { ...prev };
                delete next[elementKey];
                return next;
            });
            return;
        }

        // 1b. If stuck on another obstacle, auto-resolve it and continue with the newly tapped action
        if (!recordingMode && isAnyStuck) {
            const now = Date.now();
            Object.entries(stuckStarts).forEach(([stuckKey, startTime]) => {
                if (!startTime || typeof startTime !== 'number') return;

                const obstacleType = stuckKey.includes('trench') ? 'trench' : 'bump';
                const stuckElement = FIELD_ELEMENTS[stuckKey as keyof typeof FIELD_ELEMENTS];
                const stuckDuration = Math.min(now - startTime, AUTO_PHASE_DURATION_MS);

                onAddAction({
                    id: generateId(),
                    type: 'unstuck',
                    action: `unstuck-${obstacleType}`,
                    position: stuckElement ? { x: stuckElement.x, y: stuckElement.y } : { x: 0, y: 0 },
                    timestamp: now,
                    duration: stuckDuration,
                    obstacleType: obstacleType as 'trench' | 'bump',
                    amountLabel: formatDurationSecondsLabel(stuckDuration),
                });
            });

            setStuckStarts({});
            clearedPersistentStuck = true;
        }

        // 2. Handle Potential Stuck Promotion (Second tap within 5s)
        if (!recordingMode && stuckElementKey === elementKey) {
            if (stuckTimeoutRef.current) {
                clearTimeout(stuckTimeoutRef.current);
                stuckTimeoutRef.current = null;
            }
            setStuckElementKey(null);
            setStuckStarts(prev => ({ ...prev, [elementKey]: Date.now() }));
            return;
        }

        // Block clicks while any popup is active or robot is stuck elsewhere or broken down
        if (pendingWaypoint || pendingShotTypeWaypoint || isSelectingScore || isSelectingPass || isSelectingCollect || selectedStartKey || (!clearedPersistentStuck && isAnyStuck) || isBrokenDown) {
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
                setClimbLocation(undefined);
                break;
            }
            case 'trench1':
            case 'trench2':
            case 'bump1':
            case 'bump2': {
                const type = elementKey.includes('trench') ? 'trench' : 'bump';
                addWaypoint('traversal', type, position);

                // Enter potential stuck ("Stuck?") phase for 5s
                if (!recordingMode) {
                    if (stuckTimeoutRef.current) clearTimeout(stuckTimeoutRef.current);
                    setStuckElementKey(elementKey);
                    stuckTimeoutRef.current = setTimeout(() => {
                        setStuckElementKey(null);
                        stuckTimeoutRef.current = null;
                    }, 5000);
                }
                break;
            }
            case 'pass':
            case 'pass_alliance':
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
        const shouldUsePath = isDrag && !disablePathDrawingTapOnly;
        const pos = points[0]!;

        if (isSelectingScore) {
            const inferredShotType = shouldUsePath
                ? (getPathLength(points) >= MOVING_SHOT_MIN_PATH_LENGTH ? 'onTheMove' : 'stationary')
                : 'stationary';

            const waypoint: PathWaypoint = {
                id: generateId(),
                type: 'score',
                action: shouldUsePath ? 'shoot-path' : 'hub',
                position: pos,
                fuelDelta: disableHubFuelScoringPopup ? 0 : -8, // Default, finalized in amount selection unless popup disabled
                amountLabel: disableHubFuelScoringPopup ? undefined : '...',
                timestamp: Date.now(),
                pathPoints: shouldUsePath ? points : undefined,
                shotType: inferredShotType,
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
                position: pos,
                fuelDelta: 0,
                amountLabel: disablePassingPopup ? undefined : '...',
                timestamp: Date.now(),
                pathPoints: shouldUsePath ? points : undefined,
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
        } else if (isSelectingCollect) {
            // Collect still immediate as per plan or consolidate too? 
            // The user said: "I don't think we need to track it for collect, we really only care about how many they scored"
            // So I'll keep collect immediate for speed, but use the unified structure.
            if (shouldUsePath) {
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

    // Undo wrapper that also clears active broken down state
    const handleUndo = () => {
        if (brokenDownStart) {
            setBrokenDownStart(null);
        }
        if (onUndo) {
            onUndo();
        }
    };

    // Handle no-show submission
    const handleNoShow = async () => {
        await submitMatchData({
            inputs: location.state?.inputs,
            transformation,
            noShow: true,
            onSuccess: () => navigate('/game-start'),
        });
    };

    const proceedToTeleop = useCallback(() => {
        if (!onProceed) return;

        const stuckEntries = Object.entries(stuckStarts);
        const finalActions = [...actions];
        const now = Date.now();
        const nextStuckStarts: Record<string, number> = {};

        for (const [elementKey, startTime] of stuckEntries) {
            if (startTime && typeof startTime === 'number') {
                const obstacleType = elementKey.includes('trench') ? 'trench' : 'bump';
                const element = FIELD_ELEMENTS[elementKey as keyof typeof FIELD_ELEMENTS];
                const duration = Math.min(now - startTime, AUTO_PHASE_DURATION_MS);

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
                nextStuckStarts[elementKey] = now;
            }
        }

        if (stuckEntries.length > 0) {
            setStuckStarts(nextStuckStarts);
        }

        if (brokenDownStart) {
            const duration = Date.now() - brokenDownStart;
            const finalTotal = totalBrokenDownTime + duration;
            localStorage.setItem('autoBrokenDownTime', String(finalTotal));
        }

        onProceed(finalActions);
    }, [
        onProceed,
        stuckStarts,
        actions,
        generateId,
        setStuckStarts,
        brokenDownStart,
        totalBrokenDownTime,
    ]);

    useEffect(() => {
        if (recordingMode || hasAutoAdvancedRef.current) return;
        if (!shouldAutoAdvanceToTeleop) return;
        if (sessionStorage.getItem(autoSwitchOnceStorageKey) === 'true') return;

        const isBusyWithAction =
            pendingWaypoint !== null ||
            pendingShotTypeWaypoint !== null ||
            isSelectingScore ||
            isSelectingPass ||
            isSelectingCollect ||
            selectedStartKey !== null ||
            showPostClimbProceed ||
            hookDrawingPoints.length > 0;

        if (isBusyWithAction) return;

        hasAutoAdvancedRef.current = true;
        sessionStorage.setItem(autoSwitchOnceStorageKey, 'true');
        toast.info("Switching to Teleop");
        proceedToTeleop();
    }, [
        recordingMode,
        shouldAutoAdvanceToTeleop,
        autoSwitchOnceStorageKey,
        pendingWaypoint,
        pendingShotTypeWaypoint,
        isSelectingScore,
        isSelectingPass,
        isSelectingCollect,
        selectedStartKey,
        showPostClimbProceed,
        hookDrawingPoints,
        proceedToTeleop,
    ]);

    // ==========================================================================
    // RENDER
    // ==========================================================================

    const content = (
        <div className={cn("flex flex-col gap-2", isFullscreen && "h-full")}>
            {/* Header */}
            <FieldHeader
                phase="auto"
                headerLabel={headerLabel}
                headerInputSlot={headerInputSlot}
                stats={recordingMode ? [] : [
                    { label: 'Scored', value: totalFuelScored, color: 'green' },
                    { label: 'Passed', value: totalFuelPassed, color: 'purple' },
                ]}
                hideStats={recordingMode}
                customActionSlot={recordingMode ? recordingActionSlot : undefined}
                currentZone={recordingMode ? null : currentZone}
                isFullscreen={isFullscreen}
                onFullscreenToggle={() => setIsFullscreen(!isFullscreen)}
                actionLogSlot={recordingMode ? undefined : <AutoActionLog actions={actions} totalScore={totalScore} open={actionLogOpen} onOpenChange={setActionLogOpen} />}
                onActionLogOpen={recordingMode ? undefined : () => setActionLogOpen(true)}
                matchNumber={recordingMode ? undefined : matchNumber}
                matchType={matchType}
                teamNumber={recordingMode ? undefined : teamNumber}
                alliance={alliance}
                isFieldRotated={isFieldRotated}
                canUndo={canUndo}
                onUndo={handleUndo}
                onBack={onBack}
                onProceed={recordingMode ? undefined : proceedToTeleop}
                highlightProceed={shouldPulseAutoBorder}
                proceedCountdownSeconds={autoCueCountdownSeconds}
                toggleFieldOrientation={toggleFieldOrientation}
                isBrokenDown={isBrokenDown}
                onBrokenDownToggle={recordingMode ? undefined : handleBrokenDownToggle}
                onNoShow={enableNoShow !== false ? handleNoShow : undefined}
                hideOverflowMenu={recordingMode}
                prominentFullscreenControl={recordingMode}
            />

            {/* Field with Overlay Buttons */}
            <div
                ref={containerRef}
                className={cn(
                    "relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 select-none",
                    "w-full aspect-2/1",
                    isFullscreen ? "max-h-[85vh] m-auto" : "h-auto",
                    shouldPulseAutoBorder && "border-green-500 animate-pulse",
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
                    onPointerMove={disablePathDrawingTapOnly ? undefined : handleDrawMove}
                    onPointerUp={handleDrawEnd}
                />

                {/* Overlay Buttons */}
                {!pendingShotTypeWaypoint && !isSelectingScore && !isSelectingPass && !isSelectingCollect && (
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
                                            isStuck={recordingMode ? false : isPersistentStuck}
                                            isPotentialStuck={recordingMode ? false : stuckElementKey === key}
                                            isDisabled={isPopupActive || (isAnyStuck && !isPersistentStuck)}
                                        />
                                    );
                                })}
                            </>
                        )}
                    </div>
                )}

                {/* Score Selection Overlay */}
                {isSelectingScore && !pendingShotTypeWaypoint && (
                    <div className={cn("absolute inset-0 z-30 flex items-end justify-center pb-4 pointer-events-none", isFieldRotated && "rotate-180")}>
                        <Card className="pointer-events-auto bg-background/95 backdrop-blur-sm border-green-500/50 shadow-2xl py-2 px-3 flex flex-row items-center gap-4">
                            <Badge variant="default" className="bg-green-600">SCORING MODE</Badge>
                            <span className="text-sm font-medium">
                                {disablePathDrawingTapOnly ? 'Tap where the robot scored' : 'Tap or draw where the robot scored'}
                            </span>
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
                {isSelectingPass && !pendingShotTypeWaypoint && (
                    <div className={cn("absolute inset-0 z-30 flex items-end justify-center pb-4 pointer-events-none", isFieldRotated && "rotate-180")}>
                        <Card className="pointer-events-auto bg-background/95 backdrop-blur-sm border-purple-500/50 shadow-2xl py-2 px-3 flex flex-row items-center gap-4">
                            <Badge variant="default" className="bg-purple-600">PASSING MODE</Badge>
                            <span className="text-sm font-medium">
                                {disablePathDrawingTapOnly ? 'Tap where the robot passed from' : 'Tap or draw where the robot passed from'}
                            </span>
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
                {isSelectingCollect && !pendingShotTypeWaypoint && (
                    <div className={cn("absolute inset-0 z-30 flex items-end justify-center pb-4 pointer-events-none", isFieldRotated && "rotate-180")}>
                        <Card className="pointer-events-auto bg-background/95 backdrop-blur-sm border-yellow-500/50 shadow-2xl py-2 px-3 flex flex-row items-center gap-4">
                            <Badge variant="default" className="bg-yellow-600">COLLECT MODE</Badge>
                            <span className="text-sm font-medium">
                                {disablePathDrawingTapOnly ? 'Tap where the robot collected' : 'Tap or draw where the robot collected'}
                            </span>
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
                        onProceed={proceedToTeleop}
                        onStay={() => setShowPostClimbProceed(false)}
                        nextPhaseName="Teleop"
                        highlightProceed={shouldPulseAutoBorder}
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


                {/* Post-Action Amount Selection Overlay */}
                {pendingWaypoint && (
                    <PendingWaypointPopup
                        pendingWaypoint={pendingWaypoint}
                        accumulatedFuel={accumulatedFuel}
                        fuelHistory={fuelHistory}
                        climbResult={climbResult}
                        isFieldRotated={isFieldRotated}
                        alliance={alliance}
                        robotCapacity={robotCapacity}
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
                        climbWithLocation={true}
                        climbLocation={climbLocation}
                        onClimbLocationSelect={setClimbLocation}
                        allowClimbFail={!recordingMode}
                        skipClimbOutcomeSelection={recordingMode}
                        onConfirm={(selectedClimbStartTimeSecRemaining) => {
                            let delta = 0;
                            let label = '';
                            let action = pendingWaypoint.action;

                            if (pendingWaypoint.type === 'climb') {
                                action = climbResult === 'success' ? 'climb-success' : 'climb-fail';
                                const locationLabel = climbLocation === 'side'
                                    ? 'Side'
                                    : climbLocation === 'middle'
                                        ? 'Middle'
                                        : '';
                                label = `${locationLabel} ${climbResult === 'success' ? 'Succeeded' : 'Failed'}`.trim();
                            } else {
                                delta = pendingWaypoint.type === 'score' || pendingWaypoint.type === 'pass' ? -accumulatedFuel : 0;
                                label = pendingWaypoint.type === 'score' ? `+${accumulatedFuel}` : `Pass (${accumulatedFuel})`;
                            }

                            const finalized: PathWaypoint = {
                                ...pendingWaypoint,
                                fuelDelta: delta,
                                amountLabel: label,
                                action: action,
                                climbLocation: pendingWaypoint.type === 'climb' ? climbLocation : undefined,
                                climbStartTimeSecRemaining: pendingWaypoint.type === 'climb'
                                    ? selectedClimbStartTimeSecRemaining ?? null
                                    : undefined,
                            };
                            onAddAction(finalized);
                            setPendingWaypoint(null);
                            setAccumulatedFuel(0);
                            setFuelHistory([]);
                            setClimbResult(null);
                            setClimbLocation(undefined);

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
                            setClimbLocation(undefined);
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
