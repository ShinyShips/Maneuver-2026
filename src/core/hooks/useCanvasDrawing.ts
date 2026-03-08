import { useState, useCallback, useRef } from "react";

// Maximum number of undo states to keep in history
const MAX_UNDO_HISTORY_LENGTH = 20;

interface Point {
  x: number;
  y: number;
}

interface UseCanvasDrawingProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  brushSize: number;
  brushColor: string;
  isErasing: boolean;
  onSave: () => void;
  selectedTeams?: (number | null)[]; // Kept for API compatibility, but no longer used
}

export const useCanvasDrawing = ({
  canvasRef,
  brushSize,
  brushColor,
  isErasing,
  onSave,
}: UseCanvasDrawingProps) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // History stores canvas states AFTER each stroke
  // history[0] = initial state
  // history[1] = after first stroke
  // etc.
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(0);

  const getPointFromEvent = useCallback((e: React.MouseEvent | React.PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, [canvasRef]);

  // Initialize history with current canvas state (call once after canvas is set up)
  const initializeHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Only initialize if history is empty
    if (historyRef.current.length > 0) return;

    const dataURL = canvas.toDataURL();
    historyRef.current = [dataURL];
    historyIndexRef.current = 0;
    setCanUndo(false);
  }, [canvasRef]);

  // Save current state AFTER a stroke completes
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Auto-initialize if needed
    if (historyRef.current.length === 0) {
      const dataURL = canvas.toDataURL();
      historyRef.current = [dataURL];
      historyIndexRef.current = 0;
      console.log('[SaveToHistory] Auto-initialized with first state, canvas size:', canvas.width, 'x', canvas.height);
    }

    const dataURL = canvas.toDataURL();

    // Check if canvas has any content (non-transparent pixels)
    const ctx = canvas.getContext('2d');
    const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData?.data.some((val, i) => i % 4 === 3 && val > 0) ?? false;
    console.log('[SaveToHistory] Saving state - has visible content:', hasContent, 'canvas size:', canvas.width, 'x', canvas.height);

    // Truncate any redo states (future states after current index)
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);

    // Add new state
    historyRef.current.push(dataURL);
    historyIndexRef.current = historyRef.current.length - 1;

    console.log('[SaveToHistory] History now has', historyRef.current.length, 'states, currentIndex:', historyIndexRef.current);

    // Limit history size
    if (historyRef.current.length > MAX_UNDO_HISTORY_LENGTH) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }

    setCanUndo(historyIndexRef.current > 0);
  }, [canvasRef]);

  const undo = useCallback(() => {
    // Need at least 2 states to undo (initial + at least one change)
    if (historyIndexRef.current <= 0 || historyRef.current.length < 2) {
      console.log('[Undo] Cannot undo - index:', historyIndexRef.current, 'length:', historyRef.current.length);
      return;
    }

    // Go back to previous state
    const oldIndex = historyIndexRef.current;
    historyIndexRef.current--;
    const previousState = historyRef.current[historyIndexRef.current];

    console.log('[Undo] Going from index', oldIndex, 'to', historyIndexRef.current, '- history length:', historyRef.current.length);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !previousState) {
      console.log('[Undo] Missing canvas, ctx, or previousState');
      return;
    }

    const img = new Image();
    img.onload = () => {
      console.log('[Undo] Image loaded, natural size:', img.naturalWidth, 'x', img.naturalHeight, 'canvas size:', canvas.width, 'x', canvas.height);
      // CRITICAL: Reset composite operation to source-over before drawing
      // After erasing, it stays at 'destination-out' which would erase instead of draw!
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw at canvas dimensions to handle any size differences
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setCanUndo(historyIndexRef.current > 0);
      onSave();
    };
    img.onerror = () => {
      console.log('[Undo] Image load failed');
      historyIndexRef.current++;
      setCanUndo(historyIndexRef.current > 0);
      console.warn("Undo failed: could not load image from history.");
    };
    img.src = previousState;
  }, [canvasRef, onSave]);

  const startDrawing = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if ('setPointerCapture' in e.currentTarget && e.currentTarget instanceof HTMLElement) {
      try {
        e.currentTarget.setPointerCapture((e as React.PointerEvent).pointerId);
      } catch {
        // Ignore
      }
    }

    setIsDrawing(true);
    const point = getPointFromEvent(e);
    setLastPoint(point);
  }, [getPointFromEvent]);

  const draw = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isDrawing || !lastPoint) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const currentPoint = getPointFromEvent(e);

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isErasing) {
      // SIMPLE ERASING: destination-out makes pixels transparent
      // Since drawing layer is isolated, this reveals the background/overlay layers beneath
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      // Normal drawing
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
    }

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    setLastPoint(currentPoint);
  }, [isDrawing, getPointFromEvent, isErasing, brushSize, brushColor, lastPoint, canvasRef]);

  const stopDrawing = useCallback((e?: React.MouseEvent | React.PointerEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();

      if ('releasePointerCapture' in e.currentTarget && e.currentTarget instanceof HTMLElement) {
        try {
          e.currentTarget.releasePointerCapture((e as React.PointerEvent).pointerId);
        } catch {
          // Ignore
        }
      }
    }

    if (isDrawing) {
      // Save state AFTER stroke completes
      saveToHistory();
      onSave();
    }
    setIsDrawing(false);
    setLastPoint(null);
  }, [isDrawing, onSave, saveToHistory]);

  const canvasStyle: React.CSSProperties = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    display: 'block',
    touchAction: 'none',
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent'
  };

  const canvasEventHandlers = {
    onMouseDown: startDrawing,
    onMouseMove: draw,
    onMouseUp: stopDrawing,
    onMouseLeave: stopDrawing,
    onPointerDown: startDrawing,
    onPointerMove: draw,
    onPointerUp: stopDrawing,
    onPointerLeave: stopDrawing,
    onPointerCancel: stopDrawing,
  };

  return {
    canvasStyle,
    canvasEventHandlers,
    isDrawing,
    undo,
    canUndo,
    initializeHistory,
    saveToHistory
  };
};
