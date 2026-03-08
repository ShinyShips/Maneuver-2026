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
import { FieldCanvasHeader } from "./FieldCanvasHeader";
import { MobileStageControls } from "./MobileStageControls";
import { DrawingControls } from "./DrawingControls";
import { FloatingControls } from "./FloatingControls";

interface FieldCanvasProps {
    fieldImagePath: string;
    stageId?: string;
    onStageChange?: (newStageId: string) => void;
    selectedTeams?: (number | null)[];
}

const FieldCanvas = ({
    fieldImagePath,
    stageId = "default",
    onStageChange,
    selectedTeams = []
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

    // Update internal stage when prop changes
    useEffect(() => {
        if (!isFullscreen) {
            setCurrentStageId(stageId);
        }
    }, [stageId, isFullscreen]);

    // Reset canvas dimensions when transitioning between fullscreen modes
    // This prevents overflow when exiting fullscreen before setupCanvas recalculates
    useEffect(() => {
        setCanvasDimensions({ width: 0, height: 0 });
    }, [isFullscreen]);

    // Canvas ready state for undo history
    const [canvasReady, setCanvasReady] = useState(false);
    const handleCanvasReady = useCallback(() => {
        setCanvasReady(true);
    }, []);

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
        onCanvasReady: handleCanvasReady,
        onDimensionsChange: setCanvasDimensions
    });

    // Save canvas function - composites all layers
    const saveCanvas = useCallback((showAlert = true) => {
        const bgCanvas = backgroundCanvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        const drawingCanvas = drawingCanvasRef.current;
        if (!bgCanvas || !overlayCanvas || !drawingCanvas) return;

        // Create composite canvas
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = canvasDimensions.width;
        compositeCanvas.height = canvasDimensions.height;
        const ctx = compositeCanvas.getContext('2d');
        if (!ctx) return;

        // Draw all layers in order
        ctx.drawImage(bgCanvas, 0, 0);
        ctx.drawImage(overlayCanvas, 0, 0);
        ctx.drawImage(drawingCanvas, 0, 0);

        const dataURL = compositeCanvas.toDataURL('image/png');

        if (showAlert) {
            const link = document.createElement('a');
            link.download = `field-strategy-${currentStageId}-${new Date().toISOString().slice(0, 10)}.png`;
            link.href = dataURL;
            link.click();
        }

        // Auto-save drawing layer only to localStorage
        localStorage.setItem(`fieldStrategy_${currentStageId}`, drawingCanvas.toDataURL('image/png'));
    }, [currentStageId, canvasDimensions]);

    // Canvas drawing hook - only operates on drawing layer
    const { canvasStyle, canvasEventHandlers, undo, canUndo, initializeHistory, saveToHistory } = useCanvasDrawing({
        canvasRef: drawingCanvasRef,
        brushSize,
        brushColor,
        isErasing,
        onSave: () => saveCanvas(false),
        selectedTeams
    });

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

                <div className="shrink-0 p-2 md:p-4 border-t bg-background text-center text-xs md:text-sm text-muted-foreground">
                    <div className="flex flex-wrap justify-center gap-4">
                        {!isMobile && (
                            <>
                                <span>Press ESC to exit fullscreen</span>
                                <span>Use ← → arrows to switch stages</span>
                                <span>Ctrl+Z to undo</span>
                            </>
                        )}
                        {isMobile && (
                            <span>Tap Exit Fullscreen to return • Use Previous/Next to switch stages</span>
                        )}
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
        </div>
    );
};

export default FieldCanvas;
