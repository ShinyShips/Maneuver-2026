/**
 * Field Canvas Component
 * 
 * Multi-layer canvas architecture for drawing strategy on the field image.
 * 
 * LAYERS (from bottom to top):
 * 1. Background Canvas - Field image (static, never modified)
 * 2. Overlay Canvas - Team numbers, auto paths (updated when teams change)
 * 3. Drawing Canvas - User drawings (only layer affected by erasing)
 * 
 * YEAR-AGNOSTIC: Accepts fieldImagePath as prop for configurable field images.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useFullscreen } from "@/core/hooks/useFullscreen";
import { useIsMobile } from "@/core/hooks/use-mobile";
import { useCanvasDrawing } from "@/core/hooks/useCanvasDrawing";
import { useCanvasSetup } from "@/core/hooks/useCanvasSetup";
import { drawSelectedAutoRoutines, drawTeamNumbersAndSpots, getAutoRoutineSlotAtPoint } from "@/core/lib/canvasUtils";
import { FieldCanvasHeader } from "./FieldCanvasHeader";
import { MobileStageControls } from "./MobileStageControls";
import { DrawingControls } from "./DrawingControls";
import { FloatingControls } from "./FloatingControls";
import { Button } from "@/core/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { StrategyAutoRoutine, StrategyStageId, TeamStageSpots } from "@/core/hooks/useMatchStrategy";

interface TeamSlotSpotVisibility {
    showShooting: boolean;
    showPassing: boolean;
}

interface FieldCanvasProps {
    fieldImagePath: string;
    stageId?: string;
    onStageChange?: (newStageId: string) => void;
    selectedTeams?: (number | null)[];
    teamSlotSpotVisibility?: TeamSlotSpotVisibility[];
    getTeamSpots?: (teamNumber: number | null, stageId: StrategyStageId) => TeamStageSpots;
    selectedAutoRoutinesBySlot?: (StrategyAutoRoutine | null)[];
}

const MIN_REPLAY_DURATION_MS = 6000;
const MAX_REPLAY_DURATION_MS = 20000;
const MIN_LENGTH_FOR_SCALING = 0.15;
const MAX_LENGTH_FOR_SCALING = 2.2;

const getWaypointPathLength = (routine: StrategyAutoRoutine): number => {
    if (!Array.isArray(routine.actions) || routine.actions.length < 2) return 0;

    let totalLength = 0;
    let previousPoint: { x: number; y: number } | null = null;

    routine.actions.forEach((action) => {
        const currentPoint = action.position;
        const pathPoints = Array.isArray(action.pathPoints) && action.pathPoints.length >= 2
            ? action.pathPoints
            : null;

        if (pathPoints) {
            if (previousPoint) {
                const start = pathPoints[0]!;
                totalLength += Math.hypot(start.x - previousPoint.x, start.y - previousPoint.y);
            }

            for (let index = 1; index < pathPoints.length; index += 1) {
                const previous = pathPoints[index - 1]!;
                const current = pathPoints[index]!;
                totalLength += Math.hypot(current.x - previous.x, current.y - previous.y);
            }

            previousPoint = pathPoints[pathPoints.length - 1] ?? currentPoint;
            return;
        }

        if (previousPoint) {
            totalLength += Math.hypot(currentPoint.x - previousPoint.x, currentPoint.y - previousPoint.y);
        }

        previousPoint = currentPoint;
    });

    return totalLength;
};

const getScaledReplayDurationMs = (pathLength: number): number => {
    if (pathLength <= MIN_LENGTH_FOR_SCALING) return MIN_REPLAY_DURATION_MS;

    const ratio = Math.min(
        1,
        (pathLength - MIN_LENGTH_FOR_SCALING) / (MAX_LENGTH_FOR_SCALING - MIN_LENGTH_FOR_SCALING)
    );

    return Math.round(MIN_REPLAY_DURATION_MS + ratio * (MAX_REPLAY_DURATION_MS - MIN_REPLAY_DURATION_MS));
};

const FieldCanvas = ({
    fieldImagePath,
    stageId = "default",
    onStageChange,
    selectedTeams = [],
    teamSlotSpotVisibility = [],
    getTeamSpots,
    selectedAutoRoutinesBySlot = [],
}: FieldCanvasProps) => {
    // Canvas refs for the 3-layer architecture
    const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fullscreenRef = useRef<HTMLDivElement>(null);

    // Drawing state
    const [isErasing, setIsErasing] = useState(false);
    const [brushSize, setBrushSize] = useState(3);
    const [brushColor, setBrushColor] = useState('#ff0000');
    const { isFullscreen, setIsFullscreen } = useFullscreen();
    const [currentStageId, setCurrentStageId] = useState(stageId);
    const [hideControls, setHideControls] = useState(false);
    const [isolatedAutoSlot, setIsolatedAutoSlot] = useState<number | null>(null);
    const [isAutoReplayPlaying, setIsAutoReplayPlaying] = useState(false);
    const [autoReplayElapsedMs, setAutoReplayElapsedMs] = useState(0);
    const autoReplaySpeed = 2;
    const isMobile = useIsMobile();

    // Canvas dimensions (shared across all layers) - starts at 0 until image loads
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

    // Available stages
    const stages = useMemo(() => [
        { id: 'autonomous', label: 'Autonomous' },
        { id: 'teleop', label: 'Teleop' },
        { id: 'endgame', label: 'Endgame' }
    ], []);

    const currentStageIndex = Math.max(0, stages.findIndex(stage => stage.id === currentStageId));
    const currentStage = stages[currentStageIndex] || stages[0];

    const visibleAutoRoutines = useMemo(() => {
        if (currentStageId !== 'autonomous') return [];

        return selectedAutoRoutinesBySlot
            .map((routine, slotIndex) => ({ routine, slotIndex, team: selectedTeams[slotIndex] }))
            .filter(({ routine, team, slotIndex }) => {
                if (!routine || !team) return false;
                if (routine.teamNumber !== team) return false;
                if (isolatedAutoSlot !== null && isolatedAutoSlot !== slotIndex) return false;
                return Array.isArray(routine.actions) && routine.actions.length > 1;
            })
            .map(({ routine }) => routine!);
    }, [currentStageId, selectedAutoRoutinesBySlot, selectedTeams, isolatedAutoSlot]);

    const replayPathLength = useMemo(() => {
        if (visibleAutoRoutines.length === 0) return 0;
        return Math.max(...visibleAutoRoutines.map((routine) => getWaypointPathLength(routine)));
    }, [visibleAutoRoutines]);

    const replayDurationMs = useMemo(() => getScaledReplayDurationMs(replayPathLength), [replayPathLength]);
    const isAutoReplayInProgress = isAutoReplayPlaying || autoReplayElapsedMs > 0;
    const autoReplayProgress = currentStageId === 'autonomous' && visibleAutoRoutines.length > 0
        ? (isAutoReplayInProgress ? Math.min(1, autoReplayElapsedMs / replayDurationMs) : undefined)
        : undefined;

    // Update internal stage when prop changes
    useEffect(() => {
        if (!isFullscreen) {
            setCurrentStageId(stageId);
        }
    }, [stageId, isFullscreen]);

    useEffect(() => {
        if (currentStageId !== 'autonomous') {
            setIsolatedAutoSlot(null);
        }
    }, [currentStageId]);

    useEffect(() => {
        if (currentStageId !== 'autonomous') {
            setIsAutoReplayPlaying(false);
            setAutoReplayElapsedMs(0);
        }
    }, [currentStageId]);

    useEffect(() => {
        if (isolatedAutoSlot === null) return;
        const teamNumber = selectedTeams[isolatedAutoSlot];
        const routine = selectedAutoRoutinesBySlot[isolatedAutoSlot];
        if (!teamNumber || !routine) {
            setIsolatedAutoSlot(null);
        }
    }, [isolatedAutoSlot, selectedTeams, selectedAutoRoutinesBySlot]);

    useEffect(() => {
        setIsAutoReplayPlaying(false);
        setAutoReplayElapsedMs(0);
    }, [isolatedAutoSlot, selectedAutoRoutinesBySlot, selectedTeams]);

    useEffect(() => {
        if (!isAutoReplayPlaying || visibleAutoRoutines.length === 0 || currentStageId !== 'autonomous') return;

        const interval = window.setInterval(() => {
            setAutoReplayElapsedMs((previous) => Math.min(previous + 16 * autoReplaySpeed, replayDurationMs));
        }, 16);

        return () => window.clearInterval(interval);
    }, [isAutoReplayPlaying, visibleAutoRoutines.length, currentStageId, autoReplaySpeed, replayDurationMs]);

    useEffect(() => {
        if (isAutoReplayPlaying && autoReplayElapsedMs >= replayDurationMs) {
            setIsAutoReplayPlaying(false);
        }
    }, [isAutoReplayPlaying, autoReplayElapsedMs, replayDurationMs]);

    // Reset canvas dimensions when transitioning between fullscreen modes
    // This prevents overflow when exiting fullscreen before setupCanvas recalculates
    useEffect(() => {
        setCanvasDimensions({ width: 0, height: 0 });
    }, [isFullscreen]);

    // Canvas ready state for undo history
    const [canvasReady, setCanvasReady] = useState(false);
    const [isStageCanvasReady, setIsStageCanvasReady] = useState(false);
    const readyStageIdRef = useRef<string | null>(null);
    const handleCanvasReady = useCallback(() => {
        setCanvasReady(true);
        readyStageIdRef.current = currentStageId;
        setIsStageCanvasReady(true);
    }, [currentStageId]);

    useEffect(() => {
        readyStageIdRef.current = null;
        setIsStageCanvasReady(false);
    }, [currentStageId, isFullscreen]);

    // Canvas setup hook (now handles background + overlay layers)
    const { clearCanvas } = useCanvasSetup({
        fieldImagePath,
        currentStageId,
        isFullscreen,
        hideControls,
        isMobile,
        backgroundCanvasRef,
        overlayCanvasRef,
        drawingCanvasRef,
        containerRef,
        fullscreenRef,
        selectedTeams,
        teamSlotSpotVisibility,
        getTeamSpots,
        selectedAutoRoutinesBySlot,
        isolatedAutoSlot,
        autoReplayProgress,
        onCanvasReady: handleCanvasReady,
        onDimensionsChange: setCanvasDimensions
    });

    const handleCanvasTap = useCallback((point: { x: number; y: number }) => {
        if (currentStageId !== 'autonomous') return;

        const hitSlot = getAutoRoutineSlotAtPoint(
            point.x,
            point.y,
            canvasDimensions.width,
            canvasDimensions.height,
            selectedTeams,
            currentStageId as StrategyStageId,
            selectedAutoRoutinesBySlot,
        );

        if (hitSlot === null) {
            setIsolatedAutoSlot(null);
            return;
        }

        setIsolatedAutoSlot((prev) => (prev === hitSlot ? null : hitSlot));
    }, [currentStageId, canvasDimensions.width, canvasDimensions.height, selectedTeams, selectedAutoRoutinesBySlot]);

    const handleReplayPlayPause = useCallback(() => {
        if (currentStageId !== 'autonomous' || visibleAutoRoutines.length === 0) return;

        if (autoReplayElapsedMs >= replayDurationMs) {
            setAutoReplayElapsedMs(0);
            setIsAutoReplayPlaying(true);
            return;
        }

        setIsAutoReplayPlaying((previous) => !previous);
    }, [currentStageId, visibleAutoRoutines.length, autoReplayElapsedMs, replayDurationMs]);

    const handleReplayRestart = useCallback(() => {
        setAutoReplayElapsedMs(0);
        setIsAutoReplayPlaying(currentStageId === 'autonomous' && visibleAutoRoutines.length > 0);
    }, [currentStageId, visibleAutoRoutines.length]);

    // Save canvas function - composites all layers
    const saveCanvas = useCallback((showAlert = true) => {
        const bgCanvas = backgroundCanvasRef.current;
        const drawingCanvas = drawingCanvasRef.current;
        if (!bgCanvas || !drawingCanvas) return;

        // Create composite canvas
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = canvasDimensions.width;
        compositeCanvas.height = canvasDimensions.height;
        const ctx = compositeCanvas.getContext('2d');
        if (!ctx) return;

        // Draw all layers in order
        ctx.drawImage(bgCanvas, 0, 0);
        drawTeamNumbersAndSpots(
            ctx,
            canvasDimensions.width,
            canvasDimensions.height,
            selectedTeams,
            currentStageId as StrategyStageId,
            teamSlotSpotVisibility,
            getTeamSpots,
        );
        drawSelectedAutoRoutines(
            ctx,
            canvasDimensions.width,
            canvasDimensions.height,
            selectedTeams,
            currentStageId as StrategyStageId,
            selectedAutoRoutinesBySlot,
            isolatedAutoSlot,
            undefined,
        );
        ctx.drawImage(drawingCanvas, 0, 0);

        const dataURL = compositeCanvas.toDataURL('image/png');

        if (showAlert) {
            const link = document.createElement('a');
            link.download = `field-strategy-${currentStageId}-${new Date().toISOString().slice(0, 10)}.png`;
            link.href = dataURL;
            link.click();
        }

        // Auto-save drawing layer to localStorage, but never overwrite an existing
        // non-empty stage drawing with an empty canvas during stage transition races.
        const drawingCtx = drawingCanvas.getContext('2d', { willReadFrequently: true });
        const drawingKey = `fieldStrategy_${currentStageId}`;
        const existingDrawing = localStorage.getItem(drawingKey);
        let hasVisibleDrawing = false;

        if (drawingCtx && drawingCanvas.width > 0 && drawingCanvas.height > 0) {
            const imageData = drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
            const data = imageData.data;
            for (let index = 3; index < data.length; index += 4) {
                if ((data[index] ?? 0) > 0) {
                    hasVisibleDrawing = true;
                    break;
                }
            }
        }

        if (hasVisibleDrawing || !existingDrawing) {
            localStorage.setItem(drawingKey, drawingCanvas.toDataURL('image/png'));
        }
    }, [
        currentStageId,
        canvasDimensions,
        selectedTeams,
        teamSlotSpotVisibility,
        getTeamSpots,
        selectedAutoRoutinesBySlot,
        isolatedAutoSlot,
    ]);

    const replayStatusText = visibleAutoRoutines.length > 0
        ? `${Math.round((replayDurationMs / 1000) * 10) / 10}s replay`
        : 'No auto path selected';

    const replayControls = currentStageId === 'autonomous' ? (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{replayStatusText}</span>
            <Button
                variant="outline"
                size="sm"
                onClick={handleReplayPlayPause}
                disabled={visibleAutoRoutines.length === 0}
                className="h-8 gap-1"
            >
                {isAutoReplayPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isAutoReplayPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={handleReplayRestart}
                disabled={visibleAutoRoutines.length === 0}
                className="h-8 gap-1"
            >
                <RotateCcw className="h-3.5 w-3.5" />
                Restart
            </Button>
        </div>
    ) : null;

    // Canvas drawing hook - only operates on drawing layer
    const { canvasStyle, canvasEventHandlers, undo, canUndo, initializeHistory, saveToHistory } = useCanvasDrawing({
        canvasRef: drawingCanvasRef,
        brushSize,
        brushColor,
        isErasing,
        onSave: () => saveCanvas(false),
        onTap: handleCanvasTap,
        selectedTeams
    });

    // Persist strategy state when overlay content changes (auto routines, teams, spot toggles)
    // so an auto-only canvas is treated as saved even without freehand drawing.
    useEffect(() => {
        if (!isStageCanvasReady) return;
        if (readyStageIdRef.current !== currentStageId) return;
        if (canvasDimensions.width <= 0 || canvasDimensions.height <= 0) return;
        saveCanvas(false);
    }, [
        isStageCanvasReady,
        canvasDimensions.width,
        canvasDimensions.height,
        currentStageId,
        saveCanvas,
        selectedTeams,
        teamSlotSpotVisibility,
        selectedAutoRoutinesBySlot,
    ]);

    // Initialize undo history once when component mounts
    const historyInitializedRef = useRef(false);
    useEffect(() => {
        if (canvasReady && initializeHistory && !historyInitializedRef.current) {
            initializeHistory();
            historyInitializedRef.current = true;
        }
        // Reset canvasReady after saving to history
        if (canvasReady) {
            setCanvasReady(false);
        }
    }, [canvasReady, initializeHistory]);

    // Wrap clearCanvas to save to history before clearing
    const handleClearCanvas = useCallback(() => {
        // Save current state to history before clearing
        if (saveToHistory) {
            saveToHistory();
        }
        clearCanvas();
    }, [saveToHistory, clearCanvas]);

    // Handle fullscreen toggle
    const toggleFullscreen = useCallback(() => {
        if (!isFullscreen) {
            setIsFullscreen(true);
            document.body.style.overflow = 'hidden';
        } else {
            setIsFullscreen(false);
            document.body.style.overflow = 'auto';
            if (onStageChange && currentStageId !== stageId) {
                onStageChange(currentStageId);
            }
        }
    }, [isFullscreen, setIsFullscreen, onStageChange, currentStageId, stageId]);

    // Handle stage switching
    const switchStage = useCallback((direction: 'prev' | 'next') => {
        const currentIndex = stages.findIndex(stage => stage.id === currentStageId);
        let newIndex;

        if (direction === 'prev') {
            newIndex = currentIndex > 0 ? currentIndex - 1 : stages.length - 1;
        } else {
            newIndex = currentIndex < stages.length - 1 ? currentIndex + 1 : 0;
        }

        const newStage = stages[newIndex];
        if (!newStage) return;
        const newStageId = newStage.id;

        readyStageIdRef.current = null;
        setIsStageCanvasReady(false);
        saveCanvas(false);
        setCurrentStageId(newStageId);

        if (!isFullscreen && onStageChange) {
            onStageChange(newStageId);
        }
    }, [currentStageId, isFullscreen, onStageChange, stages, saveCanvas]);

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isFullscreen) return;

            if (e.key === 'Escape') {
                toggleFullscreen();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                switchStage('prev');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                switchStage('next');
            } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (canUndo) undo();
            }
        };

        if (isFullscreen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullscreen, switchStage, toggleFullscreen, canUndo, undo]);

    // Canvas container style for stacking - starts at 0 until image loads
    const hasValidDimensions = canvasDimensions.width > 0 && canvasDimensions.height > 0;
    const canvasContainerStyle: React.CSSProperties = {
        position: 'relative',
        width: hasValidDimensions ? `${canvasDimensions.width}px` : 'auto',
        height: hasValidDimensions ? `${canvasDimensions.height}px` : 'auto',
        maxWidth: '100%',
        maxHeight: '100%'
    };

    const layerStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
    };

    // Render stacked canvases
    const renderCanvasStack = () => (
        <div className="w-full h-full min-h-0 flex items-center justify-center">
            <div style={canvasContainerStyle} className="border border-gray-300 rounded-lg shadow-lg overflow-hidden max-w-full max-h-full">
                {/* Layer 1: Background (field image) - dimensions set by hook */}
                <canvas
                    ref={backgroundCanvasRef}
                    style={layerStyle}
                />
            {/* Layer 2: Overlays (team numbers) - dimensions set by hook */}
            <canvas
                ref={overlayCanvasRef}
                style={layerStyle}
            />
            {/* Layer 3: Drawings (user input) - dimensions set by hook */}
            <canvas
                ref={drawingCanvasRef}
                style={{
                    ...layerStyle,
                    ...canvasStyle,
                    cursor: 'crosshair',
                    touchAction: 'none'
                }}
                {...canvasEventHandlers}
            />
            </div>
        </div>
    );

    if (isFullscreen) {
        return (
            <div
                ref={fullscreenRef}
                className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col"
                style={{ touchAction: 'none', height: '100vh', width: '100vw' }}
            >
                <FieldCanvasHeader
                    currentStage={currentStage as any}
                    hideControls={hideControls}
                    onStageSwitch={switchStage}
                    onToggleFullscreen={toggleFullscreen}
                />

                <MobileStageControls
                    currentStage={currentStage as any}
                    currentStageIndex={currentStageIndex}
                    stages={stages}
                    onStageSwitch={switchStage}
                    isVisible={isMobile && !hideControls}
                />

                {(!hideControls || !isMobile) && (
                    <DrawingControls
                        isErasing={isErasing}
                        brushSize={brushSize}
                        brushColor={brushColor}
                        currentStageId={currentStageId}
                        isMobile={isMobile}
                        isFullscreen={isFullscreen}
                        canUndo={canUndo}
                        onToggleErasing={setIsErasing}
                        onBrushSizeChange={setBrushSize}
                        onBrushColorChange={setBrushColor}
                        onClearCanvas={handleClearCanvas}
                        onSaveCanvas={() => saveCanvas(true)}
                        onUndo={undo}
                        onToggleFullscreen={toggleFullscreen}
                        onToggleHideControls={() => setHideControls(!hideControls)}
                    />
                )}

                {replayControls && (
                    <div className="px-3 pb-2">
                        {replayControls}
                    </div>
                )}

                <div
                    className="flex-1 flex items-center justify-center p-2 md:p-4 bg-green-50 dark:bg-green-950/20 overflow-hidden relative"
                    style={{ touchAction: 'none' }}
                >
                    <FloatingControls
                        isVisible={hideControls && isMobile}
                        isErasing={isErasing}
                        onToggleControls={() => setHideControls(false)}
                        onStageSwitch={switchStage}
                        onToggleErasing={setIsErasing}
                        onClearCanvas={handleClearCanvas}
                    />

                    <div
                        className="w-full h-full flex items-center justify-center"
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                    >
                        {renderCanvasStack()}
                    </div>
                </div>

            </div>
        );
    }

    return (
        <div
            className="w-full h-full flex flex-col"
            data-stage={stageId}
            style={{ touchAction: 'pan-x pan-y' }}
        >
            <DrawingControls
                isErasing={isErasing}
                brushSize={brushSize}
                brushColor={brushColor}
                currentStageId={currentStageId}
                isMobile={isMobile}
                isFullscreen={isFullscreen}
                canUndo={canUndo}
                onToggleErasing={setIsErasing}
                onBrushSizeChange={setBrushSize}
                onBrushColorChange={setBrushColor}
                onClearCanvas={handleClearCanvas}
                onSaveCanvas={() => saveCanvas(true)}
                onUndo={undo}
                onToggleFullscreen={toggleFullscreen}
                onToggleHideControls={() => setHideControls(!hideControls)}
            />

            {replayControls && (
                <div className="mt-2 px-2 py-2 border rounded-md bg-background/60">
                    {replayControls}
                </div>
            )}

            <div
                ref={containerRef}
                className="flex-1 flex items-center justify-center border rounded-lg bg-green-50 dark:bg-green-950/20 min-h-0 p-4"
                style={{ touchAction: 'none' }}
            >
                <div
                    className="w-full h-full flex items-center justify-center"
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    {renderCanvasStack()}
                </div>
            </div>

            <div className="mt-2 px-2 py-1 text-xs text-muted-foreground border rounded-md bg-background/60">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-medium text-foreground">Key:</span>
                    <span>Slot 1: ▲ triangle</span>
                    <span>Slot 2: ● circle</span>
                    <span>Slot 3: ■ square</span>
                    <span>Filled = shooting</span>
                    <span>Outline = passing</span>
                </div>
            </div>
        </div>
    );
};

export default FieldCanvas;
