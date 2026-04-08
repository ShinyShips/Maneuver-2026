/**
 * FieldCanvas Component
 * 
 * Pure canvas-based visualization of path waypoints and drawing.
 * Renders path lines, waypoint markers, labels, and in-progress drawing.
 */

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
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

const PATH_LINE_ALPHA = 0.45;
const PATH_BORDER_ALPHA = 0.55;

const hexToRgba = (hexColor: string, alpha: number): string => {
    const hex = hexColor.replace('#', '');
    const normalized = hex.length === 3
        ? hex.split('').map((char) => char + char).join('')
        : hex;

    if (normalized.length !== 6) return hexColor;

    const value = Number.parseInt(normalized, 16);
    if (Number.isNaN(value)) return hexColor;

    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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
        replayDrawProgress,
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

    const getActionAlliance = useCallback((waypoint: PathWaypoint): 'red' | 'blue' => {
        const displayAlliance = (waypoint as PathWaypoint & { displayAlliance?: 'red' | 'blue' }).displayAlliance;
        return displayAlliance ?? alliance;
    }, [alliance]);

    const getActionGroupId = useCallback((waypoint: PathWaypoint): string | null => {
        const groupId = (waypoint as PathWaypoint & { displayGroupId?: string }).displayGroupId;
        return groupId ?? null;
    }, []);

    // Mirror X and Y for red alliance (data is stored in blue perspective)
    const getVisualX = useCallback((canonicalX: number, waypointAlliance: 'red' | 'blue' = alliance) =>
        (waypointAlliance === 'red' ? 1 - canonicalX : canonicalX), [alliance]);
    const getVisualY = useCallback((canonicalY: number, waypointAlliance: 'red' | 'blue' = alliance) =>
        (waypointAlliance === 'red' ? 1 - canonicalY : canonicalY), [alliance]);

    // Get color for waypoint type
    const getWaypointColor = useCallback((type: PathWaypoint['type']): string => {
        switch (type) {
            case 'score': return COLORS.score;
            case 'collect': return COLORS.collect;
            case 'climb': return COLORS.climb;
            case 'traversal': return COLORS.traversal;
            case 'pass': return COLORS.pass;
            case 'foul': return COLORS.foul;
            default: return COLORS.default;
        }
    }, []);

    const getWaypointPathColor = useCallback((type: PathWaypoint['type']): string => {
        switch (type) {
            case 'score': return hexToRgba(COLORS.score, PATH_LINE_ALPHA);
            case 'collect': return hexToRgba(COLORS.collect, PATH_LINE_ALPHA);
            case 'pass': return hexToRgba(COLORS.pass, PATH_LINE_ALPHA);
            default: return getWaypointColor(type);
        }
    }, [getWaypointColor]);

    const getPolylineLength = useCallback((points: { x: number; y: number }[]): number => {
        if (points.length < 2) return 0;

        let length = 0;
        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1]!;
            const current = points[index]!;
            length += Math.hypot(current.x - previous.x, current.y - previous.y);
        }

        return length;
    }, []);

    const drawPolyline = useCallback((
        ctx: CanvasRenderingContext2D,
        points: { x: number; y: number }[],
        waypointAlliance: 'red' | 'blue',
        maxLength?: number
    ) => {
        if (points.length < 2) return;

        const totalLength = getPolylineLength(points);
        if (totalLength <= 0) return;

        const drawLength = typeof maxLength === 'number'
            ? Math.max(0, Math.min(maxLength, totalLength))
            : totalLength;

        if (drawLength <= 0) return;

        const start = points[0]!;
        ctx.beginPath();
        ctx.moveTo(getVisualX(start.x, waypointAlliance) * ctx.canvas.width, getVisualY(start.y, waypointAlliance) * ctx.canvas.height);

        let remaining = drawLength;
        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1]!;
            const current = points[index]!;
            const segmentLength = Math.hypot(current.x - previous.x, current.y - previous.y);

            if (segmentLength <= 0) continue;

            if (remaining >= segmentLength) {
                ctx.lineTo(getVisualX(current.x, waypointAlliance) * ctx.canvas.width, getVisualY(current.y, waypointAlliance) * ctx.canvas.height);
                remaining -= segmentLength;
                continue;
            }

            const t = remaining / segmentLength;
            const partialX = previous.x + (current.x - previous.x) * t;
            const partialY = previous.y + (current.y - previous.y) * t;
            ctx.lineTo(getVisualX(partialX, waypointAlliance) * ctx.canvas.width, getVisualY(partialY, waypointAlliance) * ctx.canvas.height);
            remaining = 0;
            break;
        }

        ctx.stroke();
    }, [getPolylineLength, getVisualX, getVisualY]);

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
        const replayProgress = typeof replayDrawProgress === 'number'
            ? Math.max(0, Math.min(1, replayDrawProgress))
            : null;

        // Draw path lines
        if (actions.length > 0) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([]);

            const shouldUsePathBorder = (type: PathWaypoint['type']): boolean => (
                type === 'score' || type === 'pass' || type === 'collect'
            );

            const replaySegments: Array<{
                points: { x: number; y: number }[];
                color: string;
                length: number;
                withBorder: boolean;
                alliance: 'red' | 'blue';
            }> = [];

            if (drawConnectedPaths) {
                for (let i = 1; i < actions.length; i++) {
                    const prev = actions[i - 1];
                    const curr = actions[i];
                    if (!prev || !curr) continue;
                    if (getActionGroupId(prev) !== getActionGroupId(curr)) continue;

                    const currentAlliance = getActionAlliance(curr);

                    const startPoint = (prev.pathPoints && prev.pathPoints.length > 0)
                        ? prev.pathPoints[prev.pathPoints.length - 1]!
                        : prev.position;

                    if (curr.pathPoints && curr.pathPoints.length > 0) {
                        const pathStart = curr.pathPoints[0]!;
                        replaySegments.push({
                            points: [startPoint, pathStart],
                            color: currentAlliance === 'red' ? COLORS.red : COLORS.blue,
                            length: getPolylineLength([startPoint, pathStart]),
                            withBorder: false,
                            alliance: currentAlliance,
                        });

                        replaySegments.push({
                            points: curr.pathPoints,
                            color: getWaypointPathColor(curr.type),
                            length: getPolylineLength(curr.pathPoints),
                            withBorder: shouldUsePathBorder(curr.type),
                            alliance: currentAlliance,
                        });
                    } else {
                        const straight = [startPoint, curr.position];
                        replaySegments.push({
                            points: straight,
                            color: currentAlliance === 'red' ? COLORS.red : COLORS.blue,
                            length: getPolylineLength(straight),
                            withBorder: false,
                            alliance: currentAlliance,
                        });
                    }
                }
            } else {
                actions.forEach((action) => {
                    if (!action.pathPoints || action.pathPoints.length === 0) return;
                    const currentAlliance = getActionAlliance(action);
                    replaySegments.push({
                        points: action.pathPoints,
                        color: getWaypointPathColor(action.type),
                        length: getPolylineLength(action.pathPoints),
                        withBorder: shouldUsePathBorder(action.type),
                        alliance: currentAlliance,
                    });
                });
            }

            const totalReplayLength = replaySegments.reduce((sum, segment) => sum + segment.length, 0);
            let remainingLength = replayProgress === null
                ? Number.POSITIVE_INFINITY
                : totalReplayLength * replayProgress;

            replaySegments.forEach((segment) => {
                if (segment.length <= 0) return;
                if (remainingLength <= 0) return;

                const pathLineWidth = Math.max(2, 4 * scaleFactor);
                if (segment.withBorder) {
                    ctx.strokeStyle = `rgba(0, 0, 0, ${PATH_BORDER_ALPHA})`;
                    ctx.lineWidth = pathLineWidth + Math.max(1, 1.5 * scaleFactor);
                    const borderMaxLength = replayProgress === null
                        ? undefined
                        : Math.min(segment.length, remainingLength);
                    drawPolyline(ctx, segment.points, segment.alliance, borderMaxLength);
                }

                ctx.strokeStyle = segment.color;
                ctx.lineWidth = pathLineWidth;

                const maxLengthForSegment = replayProgress === null
                    ? undefined
                    : Math.min(segment.length, remainingLength);

                drawPolyline(ctx, segment.points, segment.alliance, maxLengthForSegment);

                if (replayProgress !== null) {
                    remainingLength -= segment.length;
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
            const waypointAlliance = getActionAlliance(waypoint);
            const x = getVisualX(waypoint.position.x, waypointAlliance) * canvas.width;
            const y = getVisualY(waypoint.position.y, waypointAlliance) * canvas.height;
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
            const x = getVisualX(pendingWaypoint.position.x, alliance) * canvas.width;
            const y = getVisualY(pendingWaypoint.position.y, alliance) * canvas.height;
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
                    if (idx === 0) ctx.moveTo(getVisualX(pt.x, alliance) * canvas.width, getVisualY(pt.y, alliance) * canvas.height);
                    else ctx.lineTo(getVisualX(pt.x, alliance) * canvas.width, getVisualY(pt.y, alliance) * canvas.height);
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

    }, [actions, width, height, alliance, drawingPoints, pendingWaypoint, isFieldRotated, isSelectingScore, isSelectingPass, isSelectingCollect, drawConnectedPaths, drawingZoneBounds, replayDrawProgress, drawPolyline, getActionAlliance, getActionGroupId, getPolylineLength, getVisualX, getVisualY, getWaypointColor, getWaypointPathColor]);

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
