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

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/core/components/ui/card";
import { Badge } from "@/core/components/ui/badge";
import { Maximize2, Minimize2, Undo2, Check, X, List, History as HistoryIcon, ChevronLeft, ArrowRight, Target, TrainFrontTunnel, Triangle, ArrowUpNarrowWide, Fuel, Warehouse, Inbox, TriangleAlert, HandCoins } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/core/components/ui/sheet";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/core/hooks/use-mobile";
import { cn } from "@/core/lib/utils";
import fieldImage from "@/game-template/assets/2026-field.png";

// =============================================================================
// TYPES
// =============================================================================

export type PathActionType =
    | 'start'      // Initial position from Auto Start
    | 'traversal'  // Moving between zones (trench/bump)
    | 'score'      // Scoring at hub (free-form position)
    | 'collect'    // Collecting from depot/outpost
    | 'pass'       // Passing to partner in neutral zone
    | 'climb'      // Climb attempt
    | 'foul';      // Mid-line foul or other penalty

export type ZoneType = 'allianceZone' | 'neutralZone';

export interface PathWaypoint {
    id: string;
    type: PathActionType;
    action: string;
    position: { x: number; y: number }; // Normalized 0-1
    fuelDelta?: number;
    amountLabel?: string; // e.g., "1/2 hopper", "Full", "+3"
    timestamp: number;
    pathPoints?: { x: number; y: number }[]; // For free-form paths
}

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
// FIELD ELEMENT POSITIONS (normalized 0-1, blue alliance perspective)
// Alliance zone on LEFT, traversal in middle, opponent on right
// width/height are optional - defaults to 48x48px (w-12 h-12)
// =============================================================================

interface FieldElement {
    x: number;
    y: number;
    label: string;
    name: string;
    scaleWidth?: number;  // Multiplier for base size
    scaleHeight?: number; // Multiplier for base size
}

const FIELD_ELEMENTS: Record<string, FieldElement> = {
    // Alliance Zone elements (left side for blue)
    hub: { x: 0.31, y: 0.5, label: 'HUB_ICON', name: 'Hub', scaleWidth: 1 },
    depot: { x: 0.09, y: 0.29, label: 'DEPOT_ICON', name: 'Depot' },
    outpost: { x: 0.09, y: 0.87, label: 'OUTPOST_ICON', name: 'Outpost' },
    tower: { x: 0.1, y: 0.53, label: 'CLIMB_ICON', name: 'Climb' },

    // Traversal elements - bumps span wider area
    trench1: { x: 0.31, y: 0.13, label: 'TRENCH_ICON', name: 'Trench' },
    bump1: { x: 0.31, y: 0.32, label: 'BUMP_ICON', name: 'Bump', scaleHeight: 1.4 },
    bump2: { x: 0.31, y: 0.68, label: 'BUMP_ICON', name: 'Bump', scaleHeight: 1.4 },
    trench2: { x: 0.31, y: 0.87, label: 'TRENCH_ICON', name: 'Trench' },

    // Neutral Zone elements (center)
    pass: { x: 0.50, y: 0.5, label: 'PASS_ICON', name: 'Pass', scaleWidth: 1.5 },
    collect_neutral: { x: 0.5, y: 0.7, label: 'COLLECT_ICON', name: 'Collect' },

    // Alliance Zone extra collect
    collect_alliance: { x: 0.1, y: 0.7, label: 'COLLECT_ICON', name: 'Collect' },

    // Opponent Zone elements (foul)
    opponent_foul: { x: 0.60, y: 0.5, label: 'FOUL_ICON', name: 'Foul', scaleWidth: 1.5 },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function AutoPathTracker({
    onAddAction,
    actions = [],
    onUndo,
    canUndo = false,
    matchNumber,
    matchType,
    teamNumber,
    onBack,
    onProceed
}: AutoPathTrackerProps) {
    const location = useLocation();
    const alliance = location.state?.inputs?.alliance || 'blue';
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // State
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentZone, setCurrentZone] = useState<ZoneType>('allianceZone');
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
    const [isSelectingScore, setIsSelectingScore] = useState(false);
    const [isSelectingPass, setIsSelectingPass] = useState(false);
    const [isSelectingCollect, setIsSelectingCollect] = useState(false);
    const [selectedStartKey, setSelectedStartKey] = useState<string | null>(null);
    const [accumulatedFuel, setAccumulatedFuel] = useState<number>(0);
    const [fuelHistory, setFuelHistory] = useState<number[]>([]);
    const [pendingWaypoint, setPendingWaypoint] = useState<PathWaypoint | null>(null);
    const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
    const [climbResult, setClimbResult] = useState<'success' | 'fail' | null>(null);

    const isMobile = useIsMobile();

    // Auto-fullscreen on mobile on mount
    useEffect(() => {
        if (isMobile) {
            setIsFullscreen(true);
        }
    }, [isMobile]);

    // Calculate totals from actions
    const totalFuelScored = actions
        .filter(a => a.type === 'score')
        .reduce((sum, a) => sum + Math.abs(a.fuelDelta || 0), 0);


    // ==========================================================================
    // CANVAS SETUP
    // ==========================================================================

    // Reliable dimension tracking matching the 2:1 aspect ratio container
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateDimensions = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (width === 0 || height === 0) return;

            // Set internal resolution 1:1 with CSS pixels
            setCanvasDimensions({ width, height });
        };

        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(container);
        updateDimensions();

        return () => resizeObserver.disconnect();
    }, [isFullscreen]);

    // Draw path on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || canvasDimensions.width === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scaleFactor = canvas.width / 1000;

        // Draw path lines
        if (actions.length > 0) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([]);

            // Helper to draw segment
            const drawSegment = (p1: { x: number, y: number }, p2: PathWaypoint) => {
                const allianceColor = alliance === 'red' ? '#ef4444' : '#3b82f6';

                // Determine action color
                let actionColor = allianceColor;
                if (p2.type === 'score') actionColor = '#22c55e';
                else if (p2.type === 'pass') actionColor = '#9333ea';
                else if (p2.type === 'collect') actionColor = '#eab308';

                if (p2.pathPoints && p2.pathPoints.length > 0) {
                    // 1. Draw connecting line from prev to start of path (Alliance Color)
                    ctx.beginPath();
                    ctx.strokeStyle = allianceColor;
                    ctx.lineWidth = Math.max(2, 4 * scaleFactor);
                    ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                    const pathStart = p2.pathPoints[0];
                    if (pathStart) {
                        ctx.lineTo(pathStart.x * canvas.width, pathStart.y * canvas.height);
                    }
                    ctx.stroke();

                    // 2. Draw free-form path (Action Color)
                    ctx.beginPath();
                    ctx.strokeStyle = actionColor;
                    ctx.lineWidth = Math.max(2, 4 * scaleFactor);
                    p2.pathPoints.forEach((pt, idx) => {
                        if (idx === 0) ctx.moveTo(pt.x * canvas.width, pt.y * canvas.height);
                        else ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
                    });
                    ctx.stroke();
                } else {
                    // Draw straight line (Alliance Color)
                    ctx.beginPath();
                    ctx.strokeStyle = allianceColor;
                    ctx.lineWidth = Math.max(2, 4 * scaleFactor);
                    ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                    ctx.lineTo(p2.position.x * canvas.width, p2.position.y * canvas.height);
                    ctx.stroke();
                }
            };

            // Draw segments between waypoints
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

        // Draw temporary path being drawn
        if (drawingPoints.length > 1) {
            ctx.beginPath();

            // Determine color based on current mode
            let color = '#f59e0b'; // Default amber
            if (isSelectingScore) color = '#22c55e';
            else if (isSelectingPass) color = '#9333ea';
            else if (isSelectingCollect) color = '#eab308';

            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(2, 4 * scaleFactor);
            ctx.setLineDash([5 * scaleFactor, 5 * scaleFactor]); // Dashed line for temporary path

            const start = drawingPoints[0];
            if (start) {
                ctx.moveTo(start.x * canvas.width, start.y * canvas.height);

                for (let i = 1; i < drawingPoints.length; i++) {
                    const pt = drawingPoints[i];
                    if (pt) {
                        ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
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

        // Draw waypoint markers
        actions.forEach((waypoint, index) => {
            const x = waypoint.position.x * canvas.width;
            const y = waypoint.position.y * canvas.height;

            let color = '#888888';
            if (waypoint.type === 'score') color = '#22c55e';
            else if (waypoint.type === 'collect') color = '#eab308';
            else if (waypoint.type === 'climb') color = '#a855f7';
            else if (waypoint.type === 'traversal') color = '#06b6d4';
            else if (waypoint.type === 'pass') color = '#9333ea';
            else if (waypoint.type === 'foul') color = '#ef4444'; // Red for foul

            ctx.beginPath();
            ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1, 2 * scaleFactor);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = markerFont;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((index + 1).toString(), x, y);

            // Draw amount label if present
            if (waypoint.amountLabel) {
                const text = waypoint.amountLabel;
                ctx.font = labelFont;
                const metrics = ctx.measureText(text);
                const textWidth = metrics.width;
                const textHeight = Math.max(8, 11 * scaleFactor); // Base font size used for height calculation

                const px = 6 * scaleFactor; // Horizontal padding
                const py = 2 * scaleFactor; // Vertical padding
                const bubbleW = textWidth + (px * 2);
                const bubbleH = textHeight + (py * 2);

                const bx = x - bubbleW / 2;
                const by = y - labelOffset - bubbleH / 2;

                // Draw background bubble
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(bx, by, bubbleW, bubbleH, 4 * scaleFactor);
                } else {
                    ctx.rect(bx, by, bubbleW, bubbleH);
                }
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = Math.max(1, 1 * scaleFactor);
                ctx.stroke();

                // Draw white text over bubble
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, x, y - labelOffset);
            }
        });

        // Draw pending waypoint (ghost)
        if (pendingWaypoint) {
            const x = pendingWaypoint.position.x * canvas.width;
            const y = pendingWaypoint.position.y * canvas.height;
            const color = pendingWaypoint.type === 'score' ? '#22c55e' : '#9333ea';

            ctx.save();
            ctx.globalAlpha = 0.6;

            // Draw path if drag
            if (pendingWaypoint.pathPoints) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 4;
                ctx.setLineDash([5, 5]);
                pendingWaypoint.pathPoints.forEach((pt, idx) => {
                    if (idx === 0) ctx.moveTo(pt.x * canvas.width, pt.y * canvas.height);
                    else ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
                });
                ctx.stroke();
            }

            // Draw marker
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Pulse effect for pending
            ctx.beginPath();
            ctx.arc(x, y, 15 + Math.sin(Date.now() / 200) * 5, 0, Math.PI * 2);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        }

    }, [actions, canvasDimensions, alliance, drawingPoints, pendingWaypoint]);

    // ==========================================================================
    // ACTION HANDLERS
    // ==========================================================================

    const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    }, [onAddAction, alliance]);

    const handleElementClick = (elementKey: string) => {
        const element = FIELD_ELEMENTS[elementKey as keyof typeof FIELD_ELEMENTS];
        if (!element) return;

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
                addWaypoint('traversal', 'trench', position);
                setCurrentZone(currentZone === 'allianceZone' ? 'neutralZone' : 'allianceZone');
                break;
            case 'bump1':
            case 'bump2':
                addWaypoint('traversal', 'bump', position);
                setCurrentZone(currentZone === 'allianceZone' ? 'neutralZone' : 'allianceZone');
                break;
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
        setDrawingPoints([]);
    };

    // Drawing handlers for shoot-while-moving paths
    const handleDrawStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isSelectingScore && !isSelectingPass && !isSelectingCollect) return;

        e.preventDefault();
        e.stopPropagation();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setDrawingPoints([{ x, y }]);
        canvas.setPointerCapture(e.pointerId);
    };

    const handleDrawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (drawingPoints.length === 0) return;

        e.preventDefault();
        e.stopPropagation();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setDrawingPoints(prev => [...prev, { x, y }]);
    };

    const handleDrawEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (drawingPoints.length === 0) return;

        e.preventDefault();
        e.stopPropagation();

        const canvas = canvasRef.current;
        if (canvas) canvas.releasePointerCapture(e.pointerId);

        handleInteractionEnd(drawingPoints);
    };

    // ==========================================================================
    // RENDER FIELD ELEMENT BUTTON
    // ==========================================================================

    const renderFieldButton = (
        elementKey: string,
        element: FieldElement,
        isVisible: boolean,
        overrideX?: number
    ) => {
        const x = (overrideX !== undefined ? overrideX : element.x) * 100;
        const y = element.y * 100;

        // Proportional scaling based on container width
        // Base size is ~5% of container width for standard buttons
        const baseSize = canvasDimensions.width * 0.055;
        const buttonSize = Math.max(28, Math.min(baseSize, 55)); // Clamp between 28px and 55px
        const fontSize = buttonSize * 0.45;
        const labelSize = buttonSize * 0.2;

        const width = buttonSize * (element.scaleWidth || 1);
        const height = buttonSize * (element.scaleHeight || 1);

        return (
            <button
                key={elementKey}
                onClick={() => handleElementClick(elementKey)}
                className={cn(
                    "absolute transform -translate-x-1/2 -translate-y-1/2 rounded-xl",
                    "flex flex-col items-center justify-center",
                    "transition-all duration-200",
                    "border shadow-lg",
                    isVisible
                        ? "bg-slate-800/90 border-slate-500 hover:bg-slate-700 hover:scale-105 hover:border-white"
                        : "bg-slate-900/50 border-slate-700/50 opacity-30 cursor-not-allowed",
                )}
                style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: `${width}px`,
                    height: `${height}px`,
                }}
                disabled={!isVisible}
            >
                {elementKey === selectedStartKey && (
                    <div className="absolute inset-0 border-2 border-blue-400 rounded-xl animate-pulse" />
                )}
                {element.label === 'HUB_ICON' ? (
                    <Target style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="text-green-500" />
                ) : element.label === 'TRENCH_ICON' ? (
                    <TrainFrontTunnel style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="text-amber-400" />
                ) : element.label === 'BUMP_ICON' ? (
                    <Triangle style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="fill-slate-400 text-slate-400" />
                ) : element.label === 'CLIMB_ICON' ? (
                    <ArrowUpNarrowWide style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="text-purple-400" />
                ) : element.label === 'COLLECT_ICON' ? (
                    <Fuel style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="text-yellow-400" />
                ) : element.label === 'DEPOT_ICON' ? (
                    <Warehouse style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="text-emerald-400" />
                ) : element.label === 'OUTPOST_ICON' ? (
                    <Inbox style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="text-orange-400" />
                ) : element.label === 'FOUL_ICON' ? (
                    <TriangleAlert style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="text-red-500" />
                ) : element.label === 'PASS_ICON' ? (
                    <HandCoins style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="text-purple-400" />
                ) : (
                    <span style={{ fontSize: `${fontSize}px` }}>{element.label}</span>
                )}
                <span
                    className="text-slate-300 font-medium leading-none mt-0.5"
                    style={{ fontSize: `${labelSize}px` }}
                >
                    {element.name}
                </span>
            </button>
        );
    };

    const renderFuelSelector = (isLarge: boolean = false) => {
        const options = ['1', '3', '8', '10', '25', '50', '1/4', '1/2', '3/4', 'Full'];

        const handleOptionClick = (opt: string) => {
            let delta = 0;
            if (opt === '1/4') delta = 5;
            else if (opt === '1/2') delta = 10;
            else if (opt === '3/4') delta = 15;
            else if (opt === 'Full') delta = 20;
            else delta = parseInt(opt);

            setAccumulatedFuel(prev => prev + delta);
            setFuelHistory(prev => [...prev, delta]);
        };

        return (
            <div className={cn(
                "grid gap-1.5 items-center justify-center p-1 w-full",
                isLarge ? "grid-cols-4 gap-2 px-1" : "flex flex-wrap gap-1"
            )}>
                {options.map((opt) => (
                    <Button
                        key={opt}
                        variant="outline"
                        size={isLarge ? "lg" : "sm"}
                        onClick={(e) => { e.stopPropagation(); handleOptionClick(opt); }}
                        className={cn(
                            "font-bold transition-all",
                            isLarge && "h-10 w-full text-xs md:text-sm rounded-lg",
                        )}
                    >
                        {opt.includes('/') || opt === 'Full' ? opt : `+${opt}`}
                    </Button>
                ))}
            </div>
        );
    };

    // ==========================================================================
    // RENDER
    // ==========================================================================

    const content = (
        <div className={cn("flex flex-col gap-2", isFullscreen && "h-full")}>
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isFullscreen && (
                        <div className="flex items-center gap-1.5 shrink-0">
                            {onBack && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onBack}
                                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                            )}
                            <span className="text-sm mr-2 font-bold text-slate-200">
                                Autonomous
                            </span>
                        </div>
                    )}

                    {/* Match Info - Condensed for mobile */}
                    {(matchNumber || teamNumber) && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-md border border-slate-700/50 shrink-0">
                            {matchNumber && (
                                <span className="text-[10px] md:text-xs font-bold text-slate-400">
                                    {(() => {
                                        const num = matchNumber.toString();
                                        if (!matchType || matchType === 'qm') return `qm${num}`;
                                        if (matchType === 'sf') return `sf${num}m1`;
                                        if (matchType === 'f') return `f1m${num}`;
                                        return num;
                                    })()}
                                </span>
                            )}
                            {matchNumber && teamNumber && <div className="w-[1px] h-3 bg-slate-700" />}
                            {teamNumber && (
                                <span className="text-[10px] md:text-xs font-bold text-blue-400">
                                    {teamNumber}
                                </span>
                            )}
                        </div>
                    )}

                    <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] md:text-xs font-medium shrink-0",
                        currentZone === 'allianceZone'
                            ? (alliance === 'red' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300')
                            : 'bg-yellow-500/20 text-yellow-300'
                    )}>
                        {currentZone === 'allianceZone' ? 'Alliance' : 'Neutral'}
                    </span>

                    <div className="flex items-center gap-1 sm:gap-2 ml-auto">
                        <Badge variant="secondary" className="bg-green-600/20 text-green-400 border-green-500/30 text-[10px] md:text-xs px-1.5 py-0">
                            Hub: {totalFuelScored}
                        </Badge>
                        <Badge variant="secondary" className="bg-slate-800/50 text-slate-300 border-slate-700/50 text-[10px] md:text-xs px-1.5 py-0">
                            Actions: {actions.length}
                        </Badge>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* Action List Sheet */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-800">
                                <List className="h-4 w-4" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] sm:w-[400px] z-[110]">
                            <SheetHeader className="pb-4">
                                <SheetTitle className="flex items-center justify-between w-full pr-6">
                                    <div className="flex items-center gap-2">
                                        <HistoryIcon className="h-5 w-5" />
                                        <span>History</span>
                                    </div>
                                    <Badge variant="outline" className="text-xs font-mono">
                                        Score: {totalFuelScored}
                                    </Badge>
                                </SheetTitle>
                            </SheetHeader>
                            <ScrollArea className="h-[calc(100vh-100px)] pr-4">
                                <div className="space-y-3">
                                    {actions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-8">No actions recorded yet.</p>
                                    ) : (
                                        [...actions].reverse().map((action, idx) => (
                                            <div key={action.id} className="flex flex-col gap-1 p-3 rounded-lg bg-accent/50 border border-border">
                                                <div className="flex items-center justify-between">
                                                    <Badge variant="outline" className="text-[10px] font-mono">
                                                        #{actions.length - idx}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-sm text-foreground">
                                                        {action.type.toUpperCase()}
                                                    </span>
                                                    {action.amountLabel && (
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {action.amountLabel}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground italic">
                                                    {action.action}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </SheetContent>
                    </Sheet>

                    {onUndo && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onUndo}
                            disabled={!canUndo}
                            className={cn("h-8 w-8 hover:bg-slate-800", canUndo && "text-red-400 animate-in fade-in zoom-in duration-300")}
                        >
                            <Undo2 className="h-4 w-4" />
                        </Button>
                    )}

                    <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="h-8 w-8 hover:bg-slate-800">
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>

                    {isFullscreen && onProceed && (
                        <Button
                            onClick={onProceed}
                            className="h-8 px-3 ml-1 text-[11px] font-bold tracking-tight gap-1"
                        >
                            <span className="hidden sm:inline">Telop</span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Field with Overlay Buttons */}
            <div
                ref={containerRef}
                className={cn(
                    "relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 select-none",
                    "w-full aspect-[2/1]",
                    isFullscreen ? "max-h-[85vh] m-auto" : "h-auto"
                )}
            >
                {/* Field Background */}
                <img
                    src={fieldImage}
                    alt="2026 Field"
                    className={cn(
                        "w-full h-full object-fill",
                        alliance === 'red' && "rotate-180" // 180° rotation for red alliance
                    )}
                    style={{ opacity: 0.9 }}
                />

                {/* Drawing Canvas */}
                <canvas
                    ref={canvasRef}
                    width={canvasDimensions.width}
                    height={canvasDimensions.height}
                    className={cn(
                        "absolute inset-0 select-none transition-opacity duration-200 opacity-100",
                        (isSelectingScore || isSelectingPass || isSelectingCollect) ? "cursor-crosshair z-20 pointer-events-auto" : "pointer-events-none z-0"
                    )}
                    onPointerDown={handleDrawStart}
                    onPointerMove={handleDrawMove}
                    onPointerUp={handleDrawEnd}
                    onPointerCancel={handleDrawEnd}
                    style={{
                        touchAction: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                    }}
                />

                {/* Overlay Buttons */}
                {!isSelectingScore && !isSelectingPass && !isSelectingCollect && (
                    <div className="absolute inset-0 z-10">
                        {actions.length === 0 ? (
                            <>
                                {renderFieldButton('trench1', FIELD_ELEMENTS.trench1!, true, 0.28)}
                                {renderFieldButton('bump1', FIELD_ELEMENTS.bump1!, true, 0.28)}
                                {renderFieldButton('hub', FIELD_ELEMENTS.hub!, true, 0.28)}
                                {renderFieldButton('bump2', FIELD_ELEMENTS.bump2!, true, 0.28)}
                                {renderFieldButton('trench2', FIELD_ELEMENTS.trench2!, true, 0.28)}
                            </>
                        ) : (
                            <>
                                {/* Alliance Zone elements */}
                                {renderFieldButton('hub', FIELD_ELEMENTS.hub!, currentZone === 'allianceZone')}
                                {renderFieldButton('depot', FIELD_ELEMENTS.depot!, currentZone === 'allianceZone')}
                                {renderFieldButton('outpost', FIELD_ELEMENTS.outpost!, currentZone === 'allianceZone')}
                                {renderFieldButton('tower', FIELD_ELEMENTS.tower!, currentZone === 'allianceZone')}
                                {renderFieldButton('collect_alliance', FIELD_ELEMENTS.collect_alliance!, currentZone === 'allianceZone')}

                                {/* Traversal elements - always visible */}
                                {renderFieldButton('trench1', FIELD_ELEMENTS.trench1!, true)}
                                {renderFieldButton('bump1', FIELD_ELEMENTS.bump1!, true)}
                                {renderFieldButton('bump2', FIELD_ELEMENTS.bump2!, true)}
                                {renderFieldButton('trench2', FIELD_ELEMENTS.trench2!, true)}

                                {/* Neutral Zone elements */}
                                {renderFieldButton('pass', FIELD_ELEMENTS.pass!, currentZone === 'neutralZone')}
                                {renderFieldButton('collect_neutral', FIELD_ELEMENTS.collect_neutral!, currentZone === 'neutralZone')}
                                {renderFieldButton('opponent_foul', FIELD_ELEMENTS.opponent_foul!, currentZone === 'neutralZone')}
                            </>
                        )}
                    </div>
                )}

                {/* Score Selection Overlay */}
                {isSelectingScore && (
                    <div className="absolute inset-0 z-30 flex items-end justify-center pb-4 pointer-events-none">
                        <Card className="pointer-events-auto bg-background/95 backdrop-blur-sm border-green-500/50 shadow-2xl py-2 px-3 flex flex-row items-center gap-4">
                            <Badge variant="default" className="bg-green-600">SCORING MODE</Badge>
                            <span className="text-sm font-medium">Tap or draw where the robot scored</span>
                            <Button
                                onClick={(e) => { e.stopPropagation(); setIsSelectingScore(false); setDrawingPoints([]); }}
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
                    <div className="absolute inset-0 z-30 flex items-end justify-center pb-4 pointer-events-none">
                        <Card className="pointer-events-auto bg-background/95 backdrop-blur-sm border-purple-500/50 shadow-2xl py-2 px-3 flex flex-row items-center gap-4">
                            <Badge variant="default" className="bg-purple-600">PASSING MODE</Badge>
                            <span className="text-sm font-medium">Tap or draw where the robot passed from</span>
                            <Button
                                onClick={(e) => { e.stopPropagation(); setIsSelectingPass(false); setDrawingPoints([]); }}
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
                    <div className="absolute inset-0 z-30 flex items-end justify-center pb-4 pointer-events-none">
                        <Card className="pointer-events-auto bg-background/95 backdrop-blur-sm border-yellow-500/50 shadow-2xl py-2 px-3 flex flex-row items-center gap-4">
                            <Badge variant="default" className="bg-yellow-600">COLLECT MODE</Badge>
                            <span className="text-sm font-medium">Tap or draw where the robot collected</span>
                            <Button
                                onClick={(e) => { e.stopPropagation(); setIsSelectingCollect(false); setDrawingPoints([]); }}
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
                {actions.length === 0 && selectedStartKey && (
                    <div className="absolute inset-0 z-30 flex items-center justify-end pr-[10%] pointer-events-none">
                        <Card className="w-72 pointer-events-auto shadow-2xl border-primary/20">
                            <CardHeader className="text-center pb-2">
                                <CardTitle className="text-2xl font-bold">{FIELD_ELEMENTS[selectedStartKey]?.name}</CardTitle>
                            </CardHeader>
                            <CardFooter className="flex flex-col gap-2 pt-2">
                                <Button
                                    onClick={() => {
                                        const element = FIELD_ELEMENTS[selectedStartKey];
                                        if (element) {
                                            addWaypoint('start', selectedStartKey, { x: element.x, y: element.y });
                                            setSelectedStartKey(null);
                                        }
                                    }}
                                    className="w-full h-12 text-base font-bold"
                                >
                                    Confirm Start
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                )}

                {/* Post-Action Amount Selection Overlay (Opponent Side) */}
                {pendingWaypoint && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center md:justify-end md:pr-[5%] pointer-events-none p-2">
                        <Card className="w-full max-w-sm h-fit max-h-[95%] pointer-events-auto shadow-xl flex flex-col border-border/50 bg-background/98 backdrop-blur-sm overflow-hidden gap-2">
                            <CardHeader className="pb-1 shrink-0">
                                <div className="flex items-center justify-center gap-3">
                                    <Badge variant="outline" className={cn(
                                        "font-bold px-2 py-0.5 shrink-0",
                                        pendingWaypoint.type === 'score' ? "text-green-500 border-green-500/50" :
                                            pendingWaypoint.type === 'climb' ? "text-blue-500 border-blue-500/50" :
                                                "text-purple-500 border-purple-500/50"
                                    )}>
                                        {pendingWaypoint.type.toUpperCase()}
                                    </Badge>
                                    <CardTitle className="text-lg font-bold tracking-tight">
                                        {pendingWaypoint.type === 'climb' ? 'Climb Outcome' :
                                            accumulatedFuel > 0 ? `Total: +${accumulatedFuel}` : 'Select Amount'}
                                    </CardTitle>
                                </div>
                            </CardHeader>

                            <CardContent className="overflow-y-auto px-2 shrink min-h-0">
                                {pendingWaypoint.type === 'climb' ? (
                                    <div className="grid grid-cols-2 gap-4 p-2">
                                        <Button
                                            variant={climbResult === 'success' ? 'default' : 'outline'}
                                            onClick={() => setClimbResult('success')}
                                            className={cn(
                                                "h-20 flex flex-col gap-1 items-center justify-center border-2 transition-all rounded-xl",
                                                climbResult === 'success' && "bg-blue-600 hover:bg-blue-700 border-blue-400 text-white shadow-lg"
                                            )}
                                        >
                                            <Check className="h-6 w-6 font-bold" />
                                            <span className="font-bold text-sm">SUCCESS</span>
                                        </Button>
                                        <Button
                                            variant={climbResult === 'fail' ? 'default' : 'outline'}
                                            onClick={() => setClimbResult('fail')}
                                            className={cn(
                                                "h-20 flex flex-col gap-1 items-center justify-center border-2 transition-all rounded-xl",
                                                climbResult === 'fail' && "bg-red-600 hover:bg-red-700 border-red-400 text-white shadow-lg"
                                            )}
                                        >
                                            <X className="h-6 w-6 font-bold" />
                                            <span className="font-bold text-sm">FAIL</span>
                                        </Button>
                                    </div>
                                ) : (
                                    renderFuelSelector(true)
                                )}
                            </CardContent>

                            <CardFooter className="flex flex-row items-center justify-between gap-3 border-t shrink-0 !pt-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-full border-2"
                                    onClick={() => { setPendingWaypoint(null); setDrawingPoints([]); setAccumulatedFuel(0); setFuelHistory([]); }}
                                >
                                    <X className="h-6 w-6 text-muted-foreground" />
                                </Button>

                                <div className="flex flex-row gap-3">
                                    {pendingWaypoint.type !== 'climb' && (
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-12 w-12 rounded-full border-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (fuelHistory.length === 0) return;
                                                const lastDelta = fuelHistory[fuelHistory.length - 1]!;
                                                setAccumulatedFuel(prev => Math.max(0, prev - lastDelta));
                                                setFuelHistory(prev => prev.slice(0, -1));
                                            }}
                                            disabled={fuelHistory.length === 0}
                                        >
                                            <Undo2 className="h-6 w-6" />
                                        </Button>
                                    )}

                                    <Button
                                        size="icon"
                                        onClick={() => {
                                            let delta = 0;
                                            let label = '';
                                            let action = pendingWaypoint.action;

                                            if (pendingWaypoint.type === 'climb') {
                                                action = climbResult === 'success' ? 'climb-success' : 'climb-fail';
                                                label = climbResult === 'success' ? 'Succeeded' : 'Failed';
                                            } else {
                                                delta = pendingWaypoint.type === 'score' ? -accumulatedFuel : 0;
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
                                        }}
                                        className={cn(
                                            "h-12 w-12 rounded-full border-2 flex items-center justify-center",
                                            pendingWaypoint.type === 'score' ? "bg-green-600 hover:bg-green-700 border-green-500/50 shadow-lg" :
                                                pendingWaypoint.type === 'climb' ? "bg-blue-600 hover:bg-blue-700 border-blue-500/50 shadow-lg" :
                                                    "bg-purple-600 hover:bg-purple-700 border-purple-500/50 shadow-lg"
                                        )}
                                    >
                                        <Check className="h-7 w-7" />
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    </div>
                )}


            </div>
        </div>
    );

    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-[100] bg-background p-4 flex flex-col">
                {content}
            </div>
        );
    }

    return content;
}
