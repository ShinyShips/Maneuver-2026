/**
 * FieldCanvas Component
 * 
 * Pure canvas-based visualization of path waypoints and drawing.
 * Renders path lines, waypoint markers, labels, and in-progress drawing.
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { PathWaypoint, FieldCanvasProps } from './types';

// =============================================================================
// COLOR CONSTANTS
// =============================================================================

const COLORS = {
    red: '#ef4444',
    blue: '#3b82f6',
    score: '#22c55e',
    pass: '#9333ea',
    collect: '#eab308',
    climb: '#a855f7',
    traversal: '#06b6d4',
    foul: '#ef4444',
    default: '#888888',
    white: '#ffffff',
    amber: '#f59e0b',
};

// =============================================================================
// COMPONENT
// =============================================================================

export interface FieldCanvasRef {
    canvas: HTMLCanvasElement | null;
}

export const FieldCanvas = forwardRef<FieldCanvasRef, FieldCanvasProps>(function FieldCanvas(
    {
        actions,
        pendingWaypoint,
        drawingPoints = [],
        alliance,
        isFieldRotated = false,
        width,
        height,
        isSelectingScore = false,
        isSelectingPass = false,
        isSelectingCollect = false,
        drawConnectedPaths = true,
        drawingZoneBounds,
        onPointerDown,
        onPointerMove,
        onPointerUp,
    },
    ref
) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
        canvas: canvasRef.current,
    }));

    // Mirror X and Y for red alliance (data is stored in blue perspective)
    const getVisualX = (canonicalX: number) => (alliance === 'red' ? 1 - canonicalX : canonicalX);
    const getVisualY = (canonicalY: number) => (alliance === 'red' ? 1 - canonicalY : canonicalY);

    // Get color for waypoint type
    const getWaypointColor = (type: PathWaypoint['type']): string => {
        switch (type) {
            case 'score': return COLORS.score;
            case 'collect': return COLORS.collect;
            case 'climb': return COLORS.climb;
            case 'traversal': return COLORS.traversal;
            case 'pass': return COLORS.pass;
            case 'foul': return COLORS.foul;
            default: return COLORS.default;
        }
    };

    // Main drawing effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || width === 0) return;

        const rect = canvas.getBoundingClientRect();
        console.log('[FieldCanvas] Drawing waypoints:', {
            actionsCount: actions.length,
            canvasInternalSize: { width, height },
            canvasDisplaySize: { width: rect.width, height: rect.height },
            scaleMismatch: { x: width / rect.width, y: height / rect.height },
            alliance,
            isFieldRotated,
            actions: actions.map(a => ({ type: a.type, action: a.action, pos: a.position }))
        });

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scaleFactor = canvas.width / 1000;
        const allianceColor = alliance === 'red' ? COLORS.red : COLORS.blue;

        // Helper to draw segment between two points
        const drawSegment = (p1: { x: number; y: number }, p2: PathWaypoint) => {
            const actionColor = getWaypointColor(p2.type);

            if (p2.pathPoints && p2.pathPoints.length > 0) {
                // 1. Draw connecting line from prev to start of path (Alliance Color)
                ctx.beginPath();
                ctx.strokeStyle = allianceColor;
                ctx.lineWidth = Math.max(2, 4 * scaleFactor);
                ctx.moveTo(getVisualX(p1.x) * canvas.width, getVisualY(p1.y) * canvas.height);
                const pathStart = p2.pathPoints[0];
                if (pathStart) {
                    ctx.lineTo(getVisualX(pathStart.x) * canvas.width, getVisualY(pathStart.y) * canvas.height);
                }
                ctx.stroke();

                // 2. Draw free-form path (Action Color)
                ctx.beginPath();
                ctx.strokeStyle = actionColor;
                ctx.lineWidth = Math.max(2, 4 * scaleFactor);
                p2.pathPoints.forEach((pt, idx) => {
                    if (idx === 0) ctx.moveTo(getVisualX(pt.x) * canvas.width, getVisualY(pt.y) * canvas.height);
                    else ctx.lineTo(getVisualX(pt.x) * canvas.width, getVisualY(pt.y) * canvas.height);
                });
                ctx.stroke();
            } else {
                // Draw straight line (Alliance Color)
                ctx.beginPath();
                ctx.strokeStyle = allianceColor;
                ctx.lineWidth = Math.max(2, 4 * scaleFactor);
                ctx.moveTo(getVisualX(p1.x) * canvas.width, getVisualY(p1.y) * canvas.height);
                ctx.lineTo(getVisualX(p2.position.x) * canvas.width, getVisualY(p2.position.y) * canvas.height);
                ctx.stroke();
            }
        };

        // Helper to draw standalone path (for Teleop - paths without connection to previous)
        const drawStandalonePath = (waypoint: PathWaypoint) => {
            if (!waypoint.pathPoints || waypoint.pathPoints.length === 0) return;

            const actionColor = getWaypointColor(waypoint.type);
            ctx.beginPath();
            ctx.strokeStyle = actionColor;
            ctx.lineWidth = Math.max(2, 4 * scaleFactor);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            waypoint.pathPoints.forEach((pt, idx) => {
                if (idx === 0) ctx.moveTo(getVisualX(pt.x) * canvas.width, getVisualY(pt.y) * canvas.height);
                else ctx.lineTo(getVisualX(pt.x) * canvas.width, getVisualY(pt.y) * canvas.height);
            });
            ctx.stroke();
        };

        // Draw path lines
        if (actions.length > 0) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([]);

            // Draw segments between waypoints (for connected paths like Auto)
            // Skip this for Teleop to avoid cluttered connecting lines
            if (drawConnectedPaths) {
                for (let i = 1; i < actions.length; i++) {
                    const prev = actions[i - 1];
                    const curr = actions[i];
                    if (prev && curr) {
                        // Start point is either the end of the previous path or the previous position
                        const startPoint = (prev.pathPoints && prev.pathPoints.length > 0)
                            ? prev.pathPoints[prev.pathPoints.length - 1]!
                            : prev.position;
                        drawSegment(startPoint, curr);
                    }
                }
            }

            // Draw standalone paths for each action (always - for all paths)
            actions.forEach((action) => {
                if (action.pathPoints && action.pathPoints.length > 0) {
                    drawStandalonePath(action);
                }
            });
        }

        // Draw zone boundary outline when in drawing mode
        if (drawingZoneBounds && (isSelectingScore || isSelectingPass || isSelectingCollect)) {
            const zoneColor = isSelectingScore ? COLORS.score : isSelectingPass ? COLORS.pass : COLORS.collect;

            // Transform zone bounds for alliance mirroring
            const visualXMin = getVisualX(drawingZoneBounds.xMin);
            const visualXMax = getVisualX(drawingZoneBounds.xMax);
            const visualYMin = getVisualY(drawingZoneBounds.yMin);
            const visualYMax = getVisualY(drawingZoneBounds.yMax);

            // Ensure min/max are correct after mirroring
            const xMin = Math.min(visualXMin, visualXMax);
            const xMax = Math.max(visualXMin, visualXMax);
            const yMin = Math.min(visualYMin, visualYMax);
            const yMax = Math.max(visualYMin, visualYMax);

            const zoneX = xMin * canvas.width;
            const zoneY = yMin * canvas.height;
            const zoneW = (xMax - xMin) * canvas.width;
            const zoneH = (yMax - yMin) * canvas.height;

            // Draw semi-transparent fill
            ctx.fillStyle = zoneColor;
            ctx.globalAlpha = 0.1;
            ctx.fillRect(zoneX, zoneY, zoneW, zoneH);

            // Draw dashed border
            ctx.beginPath();
            ctx.strokeStyle = zoneColor;
            ctx.lineWidth = Math.max(2, 3 * scaleFactor);
            ctx.setLineDash([8 * scaleFactor, 4 * scaleFactor]);
            ctx.globalAlpha = 0.8;
            ctx.rect(zoneX, zoneY, zoneW, zoneH);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;
        }

        // Draw temporary path being drawn
        if (drawingPoints.length > 1) {
            ctx.beginPath();

            // Determine color based on current mode
            let color = COLORS.amber;
            if (isSelectingScore) color = COLORS.score;
            else if (isSelectingPass) color = COLORS.pass;
            else if (isSelectingCollect) color = COLORS.collect;

            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(2, 4 * scaleFactor);
            ctx.setLineDash([5 * scaleFactor, 5 * scaleFactor]); // Dashed for temp

            const start = drawingPoints[0];
            if (start) {
                ctx.moveTo(getVisualX(start.x) * canvas.width, getVisualY(start.y) * canvas.height);
                for (let i = 1; i < drawingPoints.length; i++) {
                    const pt = drawingPoints[i];
                    if (pt) {
                        ctx.lineTo(getVisualX(pt.x) * canvas.width, getVisualY(pt.y) * canvas.height);
                    }
                }
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        const markerRadius = Math.max(8, 12 * scaleFactor);
        const markerFont = `bold ${Math.max(8, 11 * scaleFactor)}px sans-serif`;
        const labelFont = `bold ${Math.max(7, 10 * scaleFactor)}px sans-serif`;
        const labelOffset = markerRadius + (8 * scaleFactor);

        // Draw waypoint markers (filter out actions without positions like defense/steal)
        actions.filter(wp => wp.position).forEach((waypoint, index) => {
            const x = getVisualX(waypoint.position.x) * canvas.width;
            const y = getVisualY(waypoint.position.y) * canvas.height;
            const color = getWaypointColor(waypoint.type);

            ctx.beginPath();
            ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = COLORS.white;
            ctx.lineWidth = Math.max(1, 2 * scaleFactor);
            ctx.stroke();

            // Draw waypoint number - counter-rotate if field is rotated
            ctx.save();
            if (isFieldRotated) {
                ctx.translate(x, y);
                ctx.rotate(Math.PI);
                ctx.translate(-x, -y);
            }
            ctx.fillStyle = COLORS.white;
            ctx.font = markerFont;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((index + 1).toString(), x, y);
            ctx.restore();

            // Draw amount label if present
            if (waypoint.amountLabel) {
                const text = waypoint.amountLabel;
                ctx.font = labelFont;
                const metrics = ctx.measureText(text);
                const textWidth = metrics.width;
                const textHeight = Math.max(8, 11 * scaleFactor);

                const px = 6 * scaleFactor;
                const py = 2 * scaleFactor;
                const bubbleW = textWidth + (px * 2);
                const bubbleH = textHeight + (py * 2);

                const labelY = isFieldRotated ? y + labelOffset : y - labelOffset;
                const bx = x - bubbleW / 2;
                const by = labelY - bubbleH / 2;

                // Draw background bubble
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(bx, by, bubbleW, bubbleH, 4 * scaleFactor);
                } else {
                    ctx.rect(bx, by, bubbleW, bubbleH);
                }
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = COLORS.white;
                ctx.lineWidth = Math.max(1, 1 * scaleFactor);
                ctx.stroke();

                // Draw text - counter-rotate if rotated
                ctx.save();
                if (isFieldRotated) {
                    ctx.translate(x, labelY);
                    ctx.rotate(Math.PI);
                    ctx.translate(-x, -labelY);
                }
                ctx.fillStyle = COLORS.white;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, x, labelY);
                ctx.restore();
            }
        });

        // Draw pending waypoint (ghost)
        if (pendingWaypoint) {
            const x = getVisualX(pendingWaypoint.position.x) * canvas.width;
            const y = getVisualY(pendingWaypoint.position.y) * canvas.height;
            const color = pendingWaypoint.type === 'score' ? COLORS.score : COLORS.pass;

            ctx.save();
            ctx.globalAlpha = 0.6;

            // Draw path if drag
            if (pendingWaypoint.pathPoints) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 4;
                ctx.setLineDash([5, 5]);
                pendingWaypoint.pathPoints.forEach((pt, idx) => {
                    if (idx === 0) ctx.moveTo(getVisualX(pt.x) * canvas.width, getVisualY(pt.y) * canvas.height);
                    else ctx.lineTo(getVisualX(pt.x) * canvas.width, getVisualY(pt.y) * canvas.height);
                });
                ctx.stroke();
            }

            // Draw marker
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = COLORS.white;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Pulse effect
            ctx.beginPath();
            ctx.arc(x, y, 15 + Math.sin(Date.now() / 200) * 5, 0, Math.PI * 2);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        }

    }, [actions, width, height, alliance, drawingPoints, pendingWaypoint, isFieldRotated, isSelectingScore, isSelectingPass, isSelectingCollect, drawConnectedPaths, drawingZoneBounds]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 w-full h-full pointer-events-auto touch-none"
            style={{ touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        />
    );
});
