/**
 * Auto Paths by Starting Position Component
 * 
 * Displays auto paths grouped by starting position for team analysis.
 * Uses the same field visualization as AutoFieldMap but in read-only mode.
 */

import { useState, useRef, useMemo, useEffect } from 'react';
import { Card } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { Checkbox } from '@/core/components/ui/checkbox';
import { Maximize2 } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import type { MatchResult } from '@/game-template/analysis';
import { FieldCanvas, type FieldCanvasRef, FieldHeader } from '@/game-template/components/field-map';
import fieldImage from '@/game-template/assets/2026-field.png';

interface AutoPathsByPositionProps {
    matchResults: MatchResult[];
    alliance?: 'red' | 'blue';
}

const START_POSITION_LABELS = ['Left Trench', 'Left Bump', 'Hub', 'Right Bump', 'Right Trench'];
const START_POSITION_COLORS = ['yellow', 'orange', 'green', 'orange', 'yellow'];

export function AutoPathsByPosition({ matchResults, alliance = 'blue' }: AutoPathsByPositionProps) {
    const [selectedPosition, setSelectedPosition] = useState<number>(2); // Default to Hub
    const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
    const [isFullscreen, setIsFullscreen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const fieldCanvasRef = useRef<FieldCanvasRef>(null);

    // Group matches by start position
    const matchesByPosition = useMemo(() => {
        const grouped: Record<number, MatchResult[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
        matchResults.forEach(match => {
            const pos = match.startPosition;
            // Include all matches with valid start position, even if no path data
            if (pos >= 0 && pos <= 4 && grouped[pos]) {
                grouped[pos].push(match);
            }
        });
        return grouped;
    }, [matchResults]);

    // Get matches for selected position
    const positionMatches = useMemo(() => 
        matchesByPosition[selectedPosition] || [],
        [matchesByPosition, selectedPosition]
    );

    // Get actions to display from selected matches
    const displayActions = useMemo(() => {
        return positionMatches
            .filter(m => selectedMatches.has(m.matchNumber))
            .flatMap(m => m.autoPath || []);
    }, [positionMatches, selectedMatches]);

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
            } else {
                next.add(matchNumber);
            }
            return next;
        });
    };

    // Select all matches for current position
    const selectAll = () => {
        setSelectedMatches(new Set(positionMatches.map(m => m.matchNumber)));
    };

    // Clear all selections
    const clearAll = () => {
        setSelectedMatches(new Set());
    };

    return (
        <div className="space-y-4">
            {/* Position Selector */}
            <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4].map(pos => {
                    const count = matchesByPosition[pos]?.length || 0;
                    const color = START_POSITION_COLORS[pos];
                    return (
                        <Button
                            key={pos}
                            variant={selectedPosition === pos ? 'default' : 'outline'}
                            onClick={() => {
                                setSelectedPosition(pos);
                                setSelectedMatches(new Set());
                            }}
                            className="flex items-center gap-2 p-4"
                        >
                            {START_POSITION_LABELS[pos]}
                            <Badge variant="secondary" className={cn(
                                'ml-1',
                                color === 'yellow' && 'bg-yellow-500/20 text-yellow-300',
                                color === 'orange' && 'bg-orange-500/20 text-orange-300',
                                color === 'green' && 'bg-green-500/20 text-green-300',
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
                        isFieldRotated={false}
                        actionLogSlot={
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
                        <img
                            src={fieldImage}
                            alt="2026 Field"
                            className="w-full h-full object-fill"
                            style={{ opacity: 0.9 }}
                        />

                        <FieldCanvas
                            ref={fieldCanvasRef}
                            actions={displayActions}
                            pendingWaypoint={null}
                            drawingPoints={[]}
                            alliance={alliance}
                            isFieldRotated={false}
                            width={canvasDimensions.width}
                            height={canvasDimensions.height}
                            isSelectingScore={false}
                            isSelectingPass={false}
                            isSelectingCollect={false}
                            drawConnectedPaths={true}
                            drawingZoneBounds={undefined}
                        />

                        {displayActions.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <p className="text-muted-foreground text-sm">
                                    {positionMatches.length === 0
                                        ? 'No matches from this position'
                                        : 'Select matches to view paths'}
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
                        {/* Field Background */}
                        <img
                            src={fieldImage}
                            alt="2026 Field"
                            className="w-full h-full object-fill"
                            style={{ opacity: 0.9 }}
                        />

                        {/* Path Canvas */}
                        <FieldCanvas
                            ref={fieldCanvasRef}
                            actions={displayActions}
                            pendingWaypoint={null}
                            drawingPoints={[]}
                            alliance={alliance}
                            isFieldRotated={false}
                            width={canvasDimensions.width}
                            height={canvasDimensions.height}
                            isSelectingScore={false}
                            isSelectingPass={false}
                            isSelectingCollect={false}
                            drawConnectedPaths={true}
                            drawingZoneBounds={undefined}
                        />

                        {/* No paths message */}
                        {displayActions.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <p className="text-muted-foreground text-sm">
                                    {positionMatches.length === 0
                                        ? 'No matches from this position'
                                        : 'Select matches to view paths'}
                                </p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Match List */}
                <Card className="p-4 max-h-125 overflow-y-auto">
                    <h3 className="font-semibold mb-3">Matches ({positionMatches.length})</h3>
                    {positionMatches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No matches from {START_POSITION_LABELS[selectedPosition]}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {positionMatches.map(match => {
                                const isSelected = selectedMatches.has(match.matchNumber);
                                return (
                                    <div
                                        key={match.matchNumber}
                                        className={cn(
                                            'p-3 rounded-lg border cursor-pointer transition-colors',
                                            isSelected
                                                ? 'border-primary bg-primary/10'
                                                : 'border-border hover:border-primary/50'
                                        )}
                                        onClick={() => toggleMatch(match.matchNumber)}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleMatch(match.matchNumber)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="font-medium">Match {match.matchNumber}</span>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'text-xs',
                                                        match.alliance === 'red' ? 'border-red-500 text-red-400' : 'border-blue-500 text-blue-400'
                                                    )}
                                                >
                                                    {match.alliance}
                                                </Badge>
                                            </div>
                                            <Badge variant="secondary" className="text-xs">
                                                {match.autoPoints} pts
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground ml-6">
                                            {match.autoFuel} fuel scored
                                            {match.autoPath && match.autoPath.length > 0 
                                                ? ` • ${match.autoPath.length} actions` 
                                                : ' • No path data'}
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
