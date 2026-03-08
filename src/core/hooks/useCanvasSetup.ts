import { useCallback, useEffect, useRef } from "react";
import { CANVAS_CONSTANTS } from "../lib/canvasConstants";
import { drawTeamNumbers } from "../lib/canvasUtils";

// Global reference for background image (no longer needed for erasing, but kept for compatibility)
let globalBackgroundImage: HTMLImageElement | null = null;

export const getGlobalBackgroundImage = () => globalBackgroundImage;
export const setGlobalBackgroundImage = (img: HTMLImageElement) => {
  globalBackgroundImage = img;
};

interface UseCanvasSetupProps {
  fieldImagePath: string;
  currentStageId: string;
  isFullscreen: boolean;
  hideControls: boolean;
  isMobile: boolean;
  // Multi-layer canvas refs
  backgroundCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  drawingCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  fullscreenRef: React.RefObject<HTMLDivElement | null>;
  selectedTeams?: (number | null)[];
  onCanvasReady?: () => void;
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
}

export const useCanvasSetup = ({
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
  selectedTeams = [],
  onCanvasReady,
  onDimensionsChange
}: UseCanvasSetupProps) => {
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const setupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setupCanvas = useCallback(() => {
    if (setupTimeoutRef.current) {
      clearTimeout(setupTimeoutRef.current);
    }

    // Use longer delay when transitioning out of fullscreen to let DOM settle
    const delay = 50;

    setupTimeoutRef.current = setTimeout(() => {
      const bgCanvas = backgroundCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const drawingCanvas = drawingCanvasRef.current;
      const container = isFullscreen ? fullscreenRef.current : containerRef.current;

      if (!bgCanvas || !overlayCanvas || !drawingCanvas || !container) return;

      const bgCtx = bgCanvas.getContext('2d');
      const overlayCtx = overlayCanvas.getContext('2d');
      const drawingCtx = drawingCanvas.getContext('2d');
      if (!bgCtx || !overlayCtx || !drawingCtx) return;

      const img = new Image();
      img.onload = () => {
        setGlobalBackgroundImage(img);

        let containerWidth, containerHeight;

        if (isFullscreen) {
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;


          const isControlsVisible = !hideControls;

          // Calculate reserved height based on UI components
          // Header (~60px) + Footer (~40px) = ~100px base
          let reservedHeight = isMobile
            ? 100 // Header + Footer
            : CANVAS_CONSTANTS.DESKTOP_RESERVED_HEIGHT_BASE;

          // Add controls height if visible
          if (isControlsVisible) {
            // Mobile controls (DrawingControls) take up vertical space
            // Desktop controls are often inline or absolute depending on layout, but let's keep existing logic for desktop
            reservedHeight += isMobile ? 80 : 100;
          }

          // Mobile: Use full width (almost)
          // Desktop: Reserve sidebar/padding
          const reservedWidth = isMobile ? 0 : 32;

          containerWidth = viewportWidth - reservedWidth;
          containerHeight = viewportHeight - reservedHeight;
        } else {
          const containerRect = container.getBoundingClientRect();
          const padding = 32;
          containerWidth = containerRect.width - padding;
          containerHeight = containerRect.height - padding;
        }

        const imgAspectRatio = img.width / img.height;
        const containerAspectRatio = containerWidth / containerHeight;

        let canvasWidth, canvasHeight;

        if (imgAspectRatio > containerAspectRatio) {
          canvasWidth = containerWidth;
          canvasHeight = containerWidth / imgAspectRatio;
        } else {
          canvasHeight = containerHeight;
          canvasWidth = containerHeight * imgAspectRatio;
        }

        // Report dimensions to parent for stacked canvas sizing
        if (onDimensionsChange) {
          onDimensionsChange({ width: canvasWidth, height: canvasHeight });
        }

        // Set up all three canvases with same dimensions
        [bgCanvas, overlayCanvas, drawingCanvas].forEach(canvas => {
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
        });

        backgroundImageRef.current = img;

        // LAYER 1: Draw field background (static)
        bgCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        // LAYER 2: Draw team number overlays
        overlayCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        drawTeamNumbers(overlayCtx, canvasWidth, canvasHeight, selectedTeams);

        // LAYER 3: Load saved drawings or start fresh
        drawingCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        const savedData = localStorage.getItem(`fieldStrategy_${currentStageId}`);
        if (savedData) {
          const savedImg = new Image();
          savedImg.onload = () => {
            drawingCtx.drawImage(savedImg, 0, 0, canvasWidth, canvasHeight);
            if (onCanvasReady) {
              requestAnimationFrame(() => onCanvasReady());
            }
          };
          savedImg.src = savedData;
        } else {
          if (onCanvasReady) {
            requestAnimationFrame(() => onCanvasReady());
          }
        }
      };
      img.src = fieldImagePath;
    }, delay);
  }, [fieldImagePath, currentStageId, isFullscreen, hideControls, isMobile, backgroundCanvasRef, overlayCanvasRef, drawingCanvasRef, containerRef, fullscreenRef, onCanvasReady, onDimensionsChange, selectedTeams]);

  // Re-draw overlay when teams change
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    drawTeamNumbers(ctx, overlayCanvas.width, overlayCanvas.height, selectedTeams);
  }, [selectedTeams, overlayCanvasRef]);

  useEffect(() => {
    setupCanvas();
    
    // Extra recalculation after exiting fullscreen to ensure container dimensions are correct
    if (!isFullscreen) {
      const timer = setTimeout(() => setupCanvas(), 200);
      return () => clearTimeout(timer);
    }

    const handleResize = () => {
      // Only recalculate on resize when IN fullscreen mode
      // When exiting fullscreen, the setupCanvas() call from isFullscreen change is sufficient
      if (isFullscreen) {
        setupCanvas();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (setupTimeoutRef.current) {
        clearTimeout(setupTimeoutRef.current);
      }
    };
  }, [setupCanvas, isFullscreen]);

  // Clear only the drawing layer
  const clearCanvas = useCallback(() => {
    const drawingCanvas = drawingCanvasRef.current;
    const ctx = drawingCanvas?.getContext('2d');
    if (!drawingCanvas || !ctx) return;

    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    localStorage.removeItem(`fieldStrategy_${currentStageId}`);
  }, [currentStageId, drawingCanvasRef]);

  return {
    backgroundImageRef,
    setupCanvas,
    clearCanvas
  };
};
