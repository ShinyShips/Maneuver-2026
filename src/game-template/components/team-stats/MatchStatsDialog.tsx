/**
 * Match Stats Dialog Component
 * 
 * Detailed match data modal for viewing a single match's full scouting data.
 * Used in the Performance tab of Team Stats page.
 * 
 * This is year-specific - customize the tabs and stats per game.
 * Compare with TeamStatsDialog which shows aggregated stats.
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/core/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/core/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/animate-ui/radix/tabs";
import { Eye } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { FieldCanvas, type FieldCanvasRef } from "@/game-template/components/field-map";
import fieldImage from "@/game-template/assets/2026-field.png";
import { type MatchResult } from "@/game-template/analysis";

/**
 * MatchData for the dialog - uses MatchResult as base (single source of truth)
 * All fields are optional since dialog may receive partial data
 */
type GameDataPhase = {
    [key: string]: unknown;
    startPosition?: number;
};

type MatchData = Partial<MatchResult> & {
    // Game data with typed phases
    gameData?: {
        auto?: GameDataPhase;
        teleop?: GameDataPhase;
        endgame?: GameDataPhase;
        [key: string]: unknown;
    };
    // Additional display-specific fields not in MatchResult
    autoPassedMobilityLine?: boolean;
    climbAttempted?: boolean;
    climbSucceeded?: boolean;
    parkAttempted?: boolean;
    playedDefense?: boolean;
    // Allow additional game-specific fields
    [key: string]: unknown;
};

interface MatchStatsDialogProps {
    matchData: MatchData;
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg";
    className?: string;
    buttonText?: string;
    showIcon?: boolean;
}

/**
 * Detailed stats dialog for a single match.
 * Customize the tabs and content for each game year.
 */
export function MatchStatsDialog({
    matchData,
    variant = "outline",
    size = "sm",
    className = "",
    buttonText = "View Full Match Data",
    showIcon = true,
}: MatchStatsDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("scoring");
    const fieldCanvasRef = useRef<FieldCanvasRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 640, height: 320 });

    // Update canvas dimensions when container resizes or auto tab is active
    useEffect(() => {
        if (activeTab !== 'auto') return;
        
        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setCanvasDimensions({ width: rect.width, height: rect.width / 2 });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [activeTab]);

    if (!matchData) {
        return (
            <Button variant={variant} size={size} className={className} disabled>
                {showIcon && <Eye className="w-3 h-3 mr-2" />}
                {buttonText}
            </Button>
        );
    }

    // Helper to safely get numeric value
    const num = (value: unknown): number => {
        return typeof value === 'number' ? value : 0;
    };

    // Calculate fuel moved totals (only fuel scoring actions)
    const sumFuelCounts = (phaseData: GameDataPhase | undefined): number => {
        if (!phaseData) return 0;
        return Object.entries(phaseData)
            .filter(([key]) => key === 'fuelScoredCount' || key === 'fuelPassedCount')
            .reduce((sum, [, value]) => sum + num(value), 0);
    };

    const autoFuelMoved = sumFuelCounts(matchData.gameData?.auto);
    const teleopFuelMoved = sumFuelCounts(matchData.gameData?.teleop);
    
    // Other actions (non-scoring)
    const otherActionKeys = ['depotCollectCount', 'outpostCollectCount', 'foulCommittedCount', 'stealCount', 'brokenDownCount'];

    // Simplify alliance name
    const allianceName = String(matchData.alliance || '').replace(/Alliance$/i, '').trim();

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant={variant} size={size} className={className}>
                    {showIcon && <Eye className="w-4 h-4 mr-2" />}
                    {buttonText}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] h-[min(600px,90vh)] flex flex-col p-6">
                <DialogHeader className="shrink-0 px-0">
                    <DialogTitle>
                        Match {matchData.matchNumber} - Team {matchData.teamNumber}
                    </DialogTitle>
                </DialogHeader>

                <div
                    className="flex-1 min-h-0"
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    <Tabs value={activeTab} onValueChange={setActiveTab} enableSwipe className="w-full h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-4 shrink-0">
                            <TabsTrigger value="scoring">Scoring</TabsTrigger>
                            <TabsTrigger value="auto">Auto</TabsTrigger>
                            <TabsTrigger value="endgame">Endgame</TabsTrigger>
                            <TabsTrigger value="info">Info</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto px-0 mt-4">
                            {/* Scoring Tab */}
                            <TabsContent value="scoring" className="space-y-4 h-full mt-0">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-semibold mb-3">Auto Scoring</h4>
                                        <div className="space-y-2">
                                            {/* Only show fuel-related scoring actions */}
                                            {matchData.gameData?.auto && Object.entries(matchData.gameData.auto as Record<string, unknown>)
                                                .filter(([key]) => key === 'fuelScoredCount' || key === 'fuelPassedCount')
                                                .map(([key, value]) => (
                                                    <div key={key} className="flex justify-between">
                                                        <span>{key.replace('Count', '').replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                        <span className="font-bold">{num(value)}</span>
                                                    </div>
                                                ))
                                            }
                                            <div className="flex justify-between pt-2 border-t">
                                                <span className="font-semibold">Fuel Moved:</span>
                                                <span className="font-bold text-blue-600">{autoFuelMoved}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-3">Teleop Scoring</h4>
                                        <div className="space-y-2">
                                            {/* Only show fuel-related scoring actions */}
                                            {matchData.gameData?.teleop && Object.entries(matchData.gameData.teleop as Record<string, unknown>)
                                                .filter(([key]) => key === 'fuelScoredCount' || key === 'fuelPassedCount')
                                                .map(([key, value]) => (
                                                    <div key={key} className="flex justify-between">
                                                        <span>{key.replace('Count', '').replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                        <span className="font-bold">{num(value)}</span>
                                                    </div>
                                                ))
                                            }
                                            <div className="flex justify-between pt-2 border-t">
                                                <span className="font-semibold">Fuel Moved:</span>
                                                <span className="font-bold text-purple-600">{teleopFuelMoved}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Other Actions Section */}
                                <div className="mt-6">
                                    <h4 className="font-semibold mb-3">Other Actions</h4>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-2">Auto</div>
                                            <div className="space-y-2">
                                                {matchData.gameData?.auto && Object.entries(matchData.gameData.auto as Record<string, unknown>)
                                                    .filter(([key]) => otherActionKeys.includes(key))
                                                    .map(([key, value]) => (
                                                        <div key={key} className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">{key.replace('Count', '').replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                            <span>{num(value)}</span>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-2">Teleop</div>
                                            <div className="space-y-2">
                                                {matchData.gameData?.teleop && Object.entries(matchData.gameData.teleop as Record<string, unknown>)
                                                    .filter(([key]) => otherActionKeys.includes(key))
                                                    .map(([key, value]) => (
                                                        <div key={key} className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">{key.replace('Count', '').replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                            <span>{num(value)}</span>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* Points Summary */}
                                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <h4 className="font-semibold mb-3">Points Summary</h4>
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-blue-600">{num(matchData.autoPoints)}</div>
                                            <div className="text-xs text-muted-foreground">Auto</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-purple-600">{num(matchData.teleopPoints)}</div>
                                            <div className="text-xs text-muted-foreground">Teleop</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-orange-600">{num(matchData.endgamePoints)}</div>
                                            <div className="text-xs text-muted-foreground">Endgame</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-600">{num(matchData.totalPoints)}</div>
                                            <div className="text-xs text-muted-foreground">Total</div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Auto Tab */}
                            <TabsContent value="auto" className="space-y-4 h-full mt-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-semibold mb-3">Auto Performance</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span>Auto Points:</span>
                                                <span className="font-bold text-blue-600">{num(matchData.autoPoints)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Fuel Scored:</span>
                                                <span className="font-bold text-yellow-600">{num(matchData.autoFuel)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Fuel Passed:</span>
                                                <span className="font-bold text-blue-600">{num(matchData.autoFuelPassed)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 pt-2 border-t">
                                                <input
                                                    type="checkbox"
                                                    checked={!!matchData.gameData?.auto?.autoClimbL1}
                                                    disabled
                                                    className="rounded"
                                                />
                                                <span>Auto Climb L1</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-3">Auto Path</h4>
                                        {matchData.autoPath && matchData.autoPath.length > 0 ? (
                                            <div
                                                ref={containerRef}
                                                className={cn(
                                                    "relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 select-none",
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
                                                    actions={matchData.autoPath}
                                                    pendingWaypoint={null}
                                                    drawingPoints={[]}
                                                    alliance={matchData.alliance?.toLowerCase().includes('blue') ? 'blue' : 'red'}
                                                    isFieldRotated={false}
                                                    width={canvasDimensions.width}
                                                    height={canvasDimensions.height}
                                                    isSelectingScore={false}
                                                    isSelectingPass={false}
                                                    isSelectingCollect={false}
                                                    drawConnectedPaths={true}
                                                    drawingZoneBounds={undefined}
                                                />
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                                <div className="text-muted-foreground text-center">No path data</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Endgame Tab */}
                            <TabsContent value="endgame" className="space-y-4 h-full mt-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-semibold mb-3">Climbing</h4>
                                        <div className="space-y-3">
                                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium">Climb Level:</span>
                                                    <span className="font-bold text-xl text-blue-600">
                                                        {matchData.climbLevel && matchData.climbLevel > 0 ? `L${matchData.climbLevel}` : 'None'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800">
                                                <span className="text-red-600">Climb Failed</span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!matchData.gameData?.endgame?.climbFailed}
                                                    disabled
                                                    className="rounded"
                                                />
                                            </div>

                                            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium">Endgame Points:</span>
                                                    <span className="font-bold text-xl text-orange-600">{num(matchData.endgamePoints)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold mb-3">Other Performance</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                                <span>Played Defense</span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!matchData.gameData?.teleop?.defense}
                                                    disabled
                                                    className="rounded"
                                                />
                                            </div>
                                            
                                            {/* Stuck Metrics */}
                                            <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded border border-orange-200 dark:border-orange-800">
                                                <h4 className="font-semibold mb-2 text-sm text-orange-600">Stuck Incidents</h4>
                                                <div className="space-y-2">
                                                    <div className="text-sm">
                                                        <div className="flex justify-between mb-1">
                                                            <span className="font-medium">Auto:</span>
                                                        </div>
                                                        <div className="ml-4 space-y-1">
                                                            <div className="flex justify-between">
                                                                <span>Trench:</span>
                                                                <span>{num(matchData.gameData?.auto?.trenchStuckCount)}x ({Math.round(num(matchData.gameData?.auto?.trenchStuckDuration) / 1000)}s)</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Bump:</span>
                                                                <span>{num(matchData.gameData?.auto?.bumpStuckCount)}x ({Math.round(num(matchData.gameData?.auto?.bumpStuckDuration) / 1000)}s)</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-sm">
                                                        <div className="flex justify-between mb-1">
                                                            <span className="font-medium">Teleop:</span>
                                                        </div>
                                                        <div className="ml-4 space-y-1">
                                                            <div className="flex justify-between">
                                                                <span>Trench:</span>
                                                                <span>{num(matchData.gameData?.teleop?.trenchStuckCount)}x ({Math.round(num(matchData.gameData?.teleop?.trenchStuckDuration) / 1000)}s)</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Bump:</span>
                                                                <span>{num(matchData.gameData?.teleop?.bumpStuckCount)}x ({Math.round(num(matchData.gameData?.teleop?.bumpStuckDuration) / 1000)}s)</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Broken Down Metrics */}
                                            <div className="p-3 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800">
                                                <h4 className="font-semibold mb-2 text-sm text-red-600">Broken Down Time</h4>
                                                <div className="space-y-2">
                                                    <div className="text-sm">
                                                        <div className="ml-4 space-y-1">
                                                            <div className="flex justify-between">
                                                                <span>Auto:</span>
                                                                <span>{num(matchData.gameData?.auto?.brokenDownCount)}x ({Math.round(num(matchData.gameData?.auto?.brokenDownDuration) / 1000)}s)</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Teleop:</span>
                                                                <span>{num(matchData.gameData?.teleop?.brokenDownCount)}x ({Math.round(num(matchData.gameData?.teleop?.brokenDownDuration) / 1000)}s)</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Info Tab */}
                            <TabsContent value="info" className="space-y-4 h-full mt-0">
                                <div>
                                    <h4 className="font-semibold mb-3">Match Information</h4>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                                <div className="text-sm text-muted-foreground">Match Number</div>
                                                <div className="text-lg font-bold">{matchData.matchNumber}</div>
                                            </div>
                                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                                <div className="text-sm text-muted-foreground">Team Number</div>
                                                <div className="text-lg font-bold">{matchData.teamNumber}</div>
                                            </div>
                                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                                <div className="text-sm text-muted-foreground">Alliance</div>
                                                <div className="text-lg font-bold capitalize">{allianceName || 'Unknown'}</div>
                                            </div>
                                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                                <div className="text-sm text-muted-foreground">Event</div>
                                                <div className="text-lg font-bold">{matchData.eventKey || "Unknown"}</div>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                            <div className="text-sm text-muted-foreground">Scout</div>
                                            <div className="text-lg font-bold">{matchData.scoutName || "Unknown"}</div>
                                        </div>

                                        {matchData.comment && (
                                            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                                                <h5 className="font-semibold mb-2">Scout Comments</h5>
                                                <p className="text-sm">{matchData.comment}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default MatchStatsDialog;
