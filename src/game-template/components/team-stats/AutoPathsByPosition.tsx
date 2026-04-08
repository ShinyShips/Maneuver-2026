/**
 * Auto Paths by Starting Position Component
 * 
 * Displays auto paths grouped by starting position for team analysis.
 * Uses the same field visualization as AutoFieldMap but in read-only mode.
 */

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Card } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { Checkbox } from '@/core/components/ui/checkbox';
import { useFieldOrientation } from '@/core/hooks/useFieldOrientation';
import { Maximize2, Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import type { MatchResult } from '@/game-template/analysis';
import { FieldCanvas, type FieldCanvasRef, FieldHeader, type PathWaypoint } from '@/game-template/components/field-map';
import fieldImage from '@/game-template/assets/2026-field.png';

const normalizeAlliance = (alliance: string | undefined): 'red' | 'blue' =>
    alliance?.toLowerCase().includes('red') ? 'red' : 'blue';

export interface AutoPathListItem {
    id: string;
    label: string;
    actions: PathWaypoint[];
    alliance?: 'red' | 'blue';
    metricText?: string;
    detailText?: string;
}

interface AutoPathsByPositionProps {
    matchResults: MatchResult[];
    alliance?: 'red' | 'blue';
    customItemsByPosition?: Record<number, AutoPathListItem[]>;
    listTitle?: string;
}

const START_POSITION_LABELS = ['Left Trench', 'Left Bump', 'Hub', 'Right Bump', 'Right Trench'];
const POSITION_KEYS = [0, 1, 2, 3, 4] as const;
type PositionIndex = (typeof POSITION_KEYS)[number];

const MIN_REPLAY_DURATION_MS = 6000;
const MAX_REPLAY_DURATION_MS = 20000;
const MIN_LENGTH_FOR_SCALING = 0.15;
const MAX_LENGTH_FOR_SCALING = 2.2;
const AUTO_REPLAY_SPEED = 2;

function getPolylineLength(points: { x: number; y: number }[]): number {
    if (points.length < 2) return 0;

    let length = 0;
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1]!;
        const current = points[index]!;
        length += Math.hypot(current.x - previous.x, current.y - previous.y);
    }

    return length;
}

function getAutoPathLength(actions: PathWaypoint[]): number {
    if (actions.length < 2) return 0;

    let totalLength = 0;
    for (let index = 1; index < actions.length; index += 1) {
        const previous = actions[index - 1];
        const current = actions[index];
        if (!previous || !current) continue;

        const startPoint = (previous.pathPoints && previous.pathPoints.length > 0)
            ? previous.pathPoints[previous.pathPoints.length - 1]!
            : previous.position;

        if (current.pathPoints && current.pathPoints.length > 0) {
            const pathStart = current.pathPoints[0]!;
            totalLength += getPolylineLength([startPoint, pathStart]);
            totalLength += getPolylineLength(current.pathPoints);
        } else {
            totalLength += getPolylineLength([startPoint, current.position]);
        }
    }

    return totalLength;
}

function getScaledReplayDurationMs(totalPathLength: number): number {
    if (totalPathLength <= MIN_LENGTH_FOR_SCALING) return MIN_REPLAY_DURATION_MS;

    const ratio = Math.min(
        1,
        (totalPathLength - MIN_LENGTH_FOR_SCALING) / (MAX_LENGTH_FOR_SCALING - MIN_LENGTH_FOR_SCALING)
    );

    return Math.round(MIN_REPLAY_DURATION_MS + ratio * (MAX_REPLAY_DURATION_MS - MIN_REPLAY_DURATION_MS));
}

export function AutoPathsByPosition({
    matchResults,
    alliance: _alliance = 'blue',
    customItemsByPosition,
    listTitle = 'Matches',
}: AutoPathsByPositionProps) {
    const { isFieldRotated } = useFieldOrientation();
    const [selectedPosition, setSelectedPosition] = useState<PositionIndex>(2); // Default to Hub
    const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [replayTargetId, setReplayTargetId] = useState<string | null>(null);
    const [isReplayPlaying, setIsReplayPlaying] = useState(false);
    const [replayElapsedMs, setReplayElapsedMs] = useState(0);
    const isCustomMode = !!customItemsByPosition;

    const containerRef = useRef<HTMLDivElement>(null);
    const fieldCanvasRef = useRef<FieldCanvasRef>(null);

    // Group matches by start position
    const matchesByPosition = useMemo(() => {
        if (customItemsByPosition) {
            return {
                0: customItemsByPosition[0] ?? [],
                1: customItemsByPosition[1] ?? [],
                2: customItemsByPosition[2] ?? [],
                3: customItemsByPosition[3] ?? [],
                4: customItemsByPosition[4] ?? [],
            };
        }

        const grouped: Record<PositionIndex, MatchResult[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
        matchResults.forEach(match => {
            const pos = match.startPosition;
            // Include all matches with valid start position, even if no path data
            if (pos >= 0 && pos <= 4) {
                grouped[pos as PositionIndex].push(match);
            }
        });
        return grouped;
    }, [matchResults, customItemsByPosition]);

    // Get matches for selected position
    const positionMatches = useMemo(() => 
        matchesByPosition[selectedPosition] || [],
        [matchesByPosition, selectedPosition]
    );

    const positionItems = useMemo<AutoPathListItem[]>(() => {
        if (isCustomMode) {
            return (positionMatches as AutoPathListItem[]).map((item) => ({
                ...item,
                actions: item.actions ?? [],
            }));
        }

        return (positionMatches as MatchResult[]).map((match) => {
            const normalizedAlliance = normalizeAlliance(match.alliance);

            return {
                id: match.matchNumber,
                label: `Match ${match.matchNumber}`,
                actions: ((match.autoPath ?? []) as PathWaypoint[]).map((waypoint) => ({
                    ...waypoint,
                    displayAlliance: normalizedAlliance,
                    displayGroupId: `auto-${match.matchNumber}`,
                })),
                alliance: normalizedAlliance,
                metricText: `${match.autoPoints} pts`,
                detailText: `${match.autoFuel} fuel scored${
                    match.autoPath && match.autoPath.length > 0 ? ` • ${match.autoPath.length} actions` : ' • No path data'
                }`,
            };
        });
    }, [positionMatches, isCustomMode]);

    // Get actions to display from selected matches
    const displayActions = useMemo(
        () => positionItems.filter((item) => selectedMatches.has(item.id)).flatMap((item) => item.actions || []),
        [positionItems, selectedMatches]
    );

    const replayTarget = useMemo(() => {
        if (!replayTargetId) return null;
        return positionItems.find((item) => item.id === replayTargetId) ?? null;
    }, [positionItems, replayTargetId]);

    const replayActions = useMemo(() => replayTarget?.actions ?? [], [replayTarget]);
    const replayPathLength = useMemo(() => getAutoPathLength(replayActions), [replayActions]);
    const replayDurationMs = useMemo(() => getScaledReplayDurationMs(replayPathLength), [replayPathLength]);
    const replayProgress = replayDurationMs > 0
        ? Math.min(1, replayElapsedMs / replayDurationMs)
        : 0;
    const isReplayInProgress = isReplayPlaying || replayElapsedMs > 0;

    const canvasActions = replayTarget ? replayActions : displayActions;
    const canvasReplayProgress = replayTarget && isReplayInProgress ? replayProgress : undefined;

    // Canvas dimensions - dynamically update based on container size
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 640, height: 320 });

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setCanvasDimensions({ width: rect.width, height: rect.width / 2 });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Toggle match selection
    const toggleMatch = (matchNumber: string) => {
        setSelectedMatches(prev => {
            const next = new Set(prev);
            if (next.has(matchNumber)) {
                next.delete(matchNumber);

                if (replayTargetId === matchNumber) {
                    const nextReplayTarget = next.values().next().value ?? null;
                    setReplayTargetId(nextReplayTarget);
                }
            } else {
                next.add(matchNumber);
                setReplayTargetId(matchNumber);
            }
            return next;
        });
    };

    // Select all matches for current position
    const selectAll = () => {
        const allIds = positionItems.map((item) => item.id);
        setSelectedMatches(new Set(allIds));
        setReplayTargetId(allIds[0] ?? null);
    };

    // Clear all selections
    const clearAll = () => {
        setSelectedMatches(new Set());
        setReplayTargetId(null);
    };

    const handleReplayPlayPause = useCallback(() => {
        if (!replayTarget || replayActions.length < 2) return;

        if (replayElapsedMs >= replayDurationMs) {
            setReplayElapsedMs(0);
            setIsReplayPlaying(true);
            return;
        }

        setIsReplayPlaying((previous) => !previous);
    }, [replayTarget, replayActions.length, replayElapsedMs, replayDurationMs]);

    const handleReplayRestart = useCallback(() => {
        setReplayElapsedMs(0);
        setIsReplayPlaying(!!replayTarget && replayActions.length >= 2);
    }, [replayTarget, replayActions.length]);

    useEffect(() => {
        if (!isReplayPlaying || !replayTarget || replayActions.length < 2) return;

        const interval = window.setInterval(() => {
            setReplayElapsedMs((previous) => Math.min(previous + 16 * AUTO_REPLAY_SPEED, replayDurationMs));
        }, 16);

        return () => window.clearInterval(interval);
    }, [isReplayPlaying, replayTarget, replayActions.length, replayDurationMs]);

    useEffect(() => {
        if (isReplayPlaying && replayElapsedMs >= replayDurationMs) {
            setIsReplayPlaying(false);
        }
    }, [isReplayPlaying, replayElapsedMs, replayDurationMs]);

    useEffect(() => {
        setReplayElapsedMs(0);
        setIsReplayPlaying(false);
    }, [replayTargetId, selectedPosition]);

    useEffect(() => {
        if (!replayTargetId) return;
        if (!positionItems.some((item) => item.id === replayTargetId)) {
            setReplayTargetId(null);
            setReplayElapsedMs(0);
            setIsReplayPlaying(false);
        }
    }, [positionItems, replayTargetId]);

    const replayControls = (
        <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button
                variant="ghost"
                size="sm"
                onClick={handleReplayPlayPause}
                disabled={!replayTarget || replayActions.length < 2}
                className="gap-1"
            >
                {isReplayPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isReplayPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleReplayRestart}
                disabled={!replayTarget || replayActions.length < 2}
                className="gap-1"
            >
                <RotateCcw className="h-3.5 w-3.5" />
                Restart
            </Button>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Position Selector */}
            <div className="flex flex-wrap gap-2">
                {POSITION_KEYS.map(pos => {
                    const count = matchesByPosition[pos]?.length || 0;
                    return (
                        <Button
                            key={pos}
                            variant={selectedPosition === pos ? 'default' : 'outline'}
                            onClick={() => {
                                setSelectedPosition(pos);
                                setSelectedMatches(new Set());
                                setReplayTargetId(null);
                            }}
                            className="flex items-center gap-2 p-4"
                        >
                            {START_POSITION_LABELS[pos]}
                            <Badge variant="secondary" className={cn(
                                'ml-1 min-w-7 rounded-lg border-border bg-muted px-2 py-0.5 text-sm font-semibold text-foreground tabular-nums',
                            )}>
                                {count}
                            </Badge>
                        </Button>
                    );
                })}
            </div>

            {isFullscreen ? (
                <div className="fixed inset-0 z-100 bg-background p-4 flex flex-col gap-2">
                    {/* Header */}
                    <FieldHeader
                        phase="auto"
                        stats={[
                            { label: START_POSITION_LABELS[selectedPosition] || 'Position', value: positionMatches.length, color: 'slate' },
                        ]}
                        isFullscreen={isFullscreen}
                        onFullscreenToggle={() => setIsFullscreen(false)}
                        alliance="blue"
                        isFieldRotated={isFieldRotated}
                        actionLogSlot={
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                {replayControls}
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={selectAll}
                                        disabled={positionMatches.length === 0}
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearAll}
                                        disabled={selectedMatches.size === 0}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>
                        }
                    />

                    {/* Field */}
                    <div
                        ref={containerRef}
                        className={cn(
                            "relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 select-none flex-1",
                            "w-full aspect-2/1"
                        )}
                    >
                        <div className={cn("absolute inset-0", isFieldRotated && "rotate-180")}>
                            <img
                                src={fieldImage}
                                alt="2026 Field"
                                className="w-full h-full object-fill"
                                style={{ opacity: 0.9 }}
                            />

                            <FieldCanvas
                                ref={fieldCanvasRef}
                                actions={canvasActions}
                                pendingWaypoint={null}
                                drawingPoints={[]}
                                alliance="blue"
                                isFieldRotated={isFieldRotated}
                                width={canvasDimensions.width}
                                height={canvasDimensions.height}
                                isSelectingScore={false}
                                isSelectingPass={false}
                                isSelectingCollect={false}
                                drawConnectedPaths={true}
                                drawingZoneBounds={undefined}
                                replayDrawProgress={canvasReplayProgress}
                            />
                        </div>

                        {canvasActions.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <p className="text-muted-foreground text-sm">
                                    {positionMatches.length === 0
                                        ? (isCustomMode ? 'No autos from this position' : 'No matches from this position')
                                        : (isCustomMode ? 'Select autos to view paths' : 'Select matches to view paths')}
                                </p>
                            </div>
                        )}

                        {replayTarget && replayActions.length < 2 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <p className="text-muted-foreground text-sm bg-background/80 px-3 py-1 rounded">
                                    Selected auto has insufficient path data for replay.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid md:grid-cols-[1fr_300px] gap-4">
                {/* Field Visualization */}
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">
                            {START_POSITION_LABELS[selectedPosition]} - Auto Paths
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {replayControls}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={selectAll}
                                disabled={positionMatches.length === 0}
                            >
                                Select All
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearAll}
                                disabled={selectedMatches.size === 0}
                            >
                                Clear
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsFullscreen(true)}
                            >
                                <Maximize2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Field Display */}
                    <div
                        ref={containerRef}
                        className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 w-full aspect-2/1"
                    >
                        <div className={cn("absolute inset-0", isFieldRotated && "rotate-180")}>
                            <img
                                src={fieldImage}
                                alt="2026 Field"
                                className="w-full h-full object-fill"
                                style={{ opacity: 0.9 }}
                            />

                            <FieldCanvas
                                ref={fieldCanvasRef}
                                actions={canvasActions}
                                pendingWaypoint={null}
                                drawingPoints={[]}
                                alliance="blue"
                                isFieldRotated={isFieldRotated}
                                width={canvasDimensions.width}
                                height={canvasDimensions.height}
                                isSelectingScore={false}
                                isSelectingPass={false}
                                isSelectingCollect={false}
                                drawConnectedPaths={true}
                                drawingZoneBounds={undefined}
                                replayDrawProgress={canvasReplayProgress}
                            />
                        </div>

                        {/* No paths message */}
                        {canvasActions.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <p className="text-muted-foreground text-sm">
                                    {positionMatches.length === 0
                                        ? 'No matches from this position'
                                        : 'Select matches to view paths'}
                                </p>
                            </div>
                        )}

                        {replayTarget && replayActions.length < 2 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <p className="text-muted-foreground text-sm bg-background/80 px-3 py-1 rounded">
                                    Selected auto has insufficient path data for replay.
                                </p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Match List */}
                <Card className="p-4 max-h-125 overflow-y-auto">
                    <h3 className="font-semibold mb-3">{listTitle} ({positionMatches.length})</h3>
                    {positionMatches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {isCustomMode ? 'No autos' : 'No matches'} from {START_POSITION_LABELS[selectedPosition]}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {positionItems.map((item) => {
                                const id = item.id;
                                const isSelected = selectedMatches.has(id);
                                return (
                                    <div
                                        key={id}
                                        className={cn(
                                            'p-3 rounded-lg border cursor-pointer transition-colors',
                                            isSelected
                                                ? 'border-primary bg-primary/10'
                                                : 'border-border hover:border-primary/50'
                                        )}
                                        onClick={() => toggleMatch(id)}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleMatch(id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="font-medium">
                                                    {item.label}
                                                </span>
                                                {item.alliance && (
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'text-xs',
                                                            item.alliance === 'red' ? 'border-red-500 text-red-400' : 'border-blue-500 text-blue-400'
                                                        )}
                                                    >
                                                        {item.alliance}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    {item.metricText ?? `${item.actions.length} actions`}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground ml-6">
                                            {item.detailText ?? `${item.actions.length} actions`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>
            )}
        </div>
    );
}
