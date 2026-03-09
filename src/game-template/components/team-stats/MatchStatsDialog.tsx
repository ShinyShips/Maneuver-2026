/**
 * Match Stats Dialog Component
 * 
 * Detailed match data modal for viewing a single match's full scouting data.
 * Used in the Performance tab of Team Stats page.
 * 
 * This is year-specific - customize the tabs and stats per game.
 * Compare with TeamStatsDialog which shows aggregated stats.
 */

import { useEffect, useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/core/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/animate-ui/radix/tabs";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/core/components/ui/alert-dialog";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Label } from "@/core/components/ui/label";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { AutoStartPositionMap } from "./AutoStartPositionMap";
import strategyAnalysis, { type MatchResult } from "@/game-template/analysis";
import { deleteScoutingEntry, updateScoutingEntryIgnoreForStats } from "@/core/db/database";

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
    onMatchDataChanged?: () => void;
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
    onMatchDataChanged,
    variant = "outline",
    size = "sm",
    className = "",
    buttonText = "View Full Match Data",
    showIcon = true,
}: MatchStatsDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("scoring");
    const [ignoreForStats, setIgnoreForStats] = useState(!!matchData.ignoreForStats);
    const [isSavingIgnore, setIsSavingIgnore] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    useEffect(() => {
        setIgnoreForStats(!!matchData.ignoreForStats);
    }, [matchData.id, matchData.ignoreForStats]);

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

    // Calculate totals by summing all action counts
    const sumCounts = (phaseData: GameDataPhase | undefined): number => {
        if (!phaseData) return 0;
        return Object.entries(phaseData)
            .filter(([key]) => key.endsWith('Count'))
            .reduce((sum, [, value]) => sum + num(value), 0);
    };

    const autoTotal = sumCounts(matchData.gameData?.auto);
    const teleopTotal = sumCounts(matchData.gameData?.teleop);


    // Determine climb status (customize per game)
    const getClimbStatus = () => {
        if (matchData.brokeDown) return { text: "Broke Down", color: "text-red-600" };
        if (matchData.climbSucceeded) return { text: "Climbed", color: "text-green-600" };
        if (matchData.climbAttempted) return { text: "Climb Failed", color: "text-orange-600" };
        if (matchData.parkAttempted) return { text: "Park", color: "text-yellow-600" };
        return { text: "None", color: "text-gray-600" };
    };
    const climbStatus = getClimbStatus();

    // Simplify alliance name
    const allianceName = String(matchData.alliance || '').replace(/Alliance$/i, '').trim();

    const handleIgnoreToggle = async (checked: boolean) => {
        if (!matchData.id) {
            toast.error("Cannot update this entry: missing entry ID.");
            return;
        }

        setIsSavingIgnore(true);
        try {
            await updateScoutingEntryIgnoreForStats(matchData.id, checked);
            setIgnoreForStats(checked);
            onMatchDataChanged?.();
            toast.success(checked ? "Match excluded from stats." : "Match included in stats.");
        } catch (error) {
            console.error("Failed to update ignore-for-stats flag:", error);
            toast.error("Failed to update match stats setting.");
        } finally {
            setIsSavingIgnore(false);
        }
    };

    const handleDeleteMatch = async () => {
        if (!matchData.id) {
            toast.error("Cannot delete this entry: missing entry ID.");
            return;
        }

        setIsDeleting(true);
        try {
            await deleteScoutingEntry(matchData.id);
            toast.success("Match entry deleted.");
            setIsDeleteConfirmOpen(false);
            setIsOpen(false);
            onMatchDataChanged?.();
        } catch (error) {
            console.error("Failed to delete scouting entry:", error);
            toast.error("Failed to delete match entry.");
        } finally {
            setIsDeleting(false);
        }
    };

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
                                            {/* Dynamically render action counts from gameData.auto */}
                                            {matchData.gameData?.auto && Object.entries(matchData.gameData.auto as Record<string, unknown>)
                                                .filter(([key]) => key.endsWith('Count'))
                                                .map(([key, value]) => (
                                                    <div key={key} className="flex justify-between">
                                                        <span>{key.replace('Count', '').replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                        <span className="font-bold">{num(value)}</span>
                                                    </div>
                                                ))
                                            }
                                            <div className="flex justify-between pt-2 border-t">
                                                <span className="font-semibold">Total Scored:</span>
                                                <span className="font-bold text-blue-600">{autoTotal}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-3">Teleop Scoring</h4>
                                        <div className="space-y-2">
                                            {/* Dynamically render action counts from gameData.teleop */}
                                            {matchData.gameData?.teleop && Object.entries(matchData.gameData.teleop as Record<string, unknown>)
                                                .filter(([key]) => key.endsWith('Count'))
                                                .map(([key, value]) => (
                                                    <div key={key} className="flex justify-between">
                                                        <span>{key.replace('Count', '').replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                        <span className="font-bold">{num(value)}</span>
                                                    </div>
                                                ))
                                            }
                                            <div className="flex justify-between pt-2 border-t">
                                                <span className="font-semibold">Total Scored:</span>
                                                <span className="font-bold text-purple-600">{teleopTotal}</span>
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
                                                <span>Points:</span>
                                                <span className="font-bold text-blue-600">{num(matchData.autoPoints)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 pt-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!matchData.autoPassedMobilityLine}
                                                    disabled
                                                    className="rounded"
                                                />
                                                <span>Passed Mobility Line</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-3">Starting Position</h4>
                                        {matchData.startPosition !== undefined && matchData.startPosition >= 0 ? (
                                            <div className="h-64 md:h-48">
                                                <AutoStartPositionMap
                                                    config={strategyAnalysis.getStartPositionConfig()}
                                                    highlightedPosition={matchData.startPosition}
                                                    alliance={matchData.alliance?.toLowerCase().includes('blue') ? 'blue' : 'red'}
                                                />
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                                <div className="text-muted-foreground text-center">Unknown</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Endgame Tab */}
                            <TabsContent value="endgame" className="space-y-4 h-full mt-0">
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <h4 className="font-semibold mb-3">Endgame Performance</h4>
                                        <div className="space-y-3">
                                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium">Status:</span>
                                                    <span className={`font-bold ${climbStatus.color}`}>
                                                        {climbStatus.text}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!matchData.climbAttempted}
                                                        disabled
                                                        className="rounded"
                                                    />
                                                    <span>Climb Attempted</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!matchData.climbSucceeded}
                                                        disabled
                                                        className="rounded"
                                                    />
                                                    <span>Climb Succeeded</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!matchData.parkAttempted}
                                                        disabled
                                                        className="rounded"
                                                    />
                                                    <span>Park Attempted</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold mb-3">Other Performance</h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!matchData.playedDefense}
                                                    disabled
                                                    className="rounded"
                                                />
                                                <span>Played Defense</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!matchData.brokeDown}
                                                    disabled
                                                    className="rounded"
                                                />
                                                <span className="text-red-600">Broke Down</span>
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

                                        <div className="p-4 border rounded space-y-4">
                                            <div className="space-y-2">
                                                <h5 className="font-semibold">Data Controls</h5>
                                                <p className="text-xs text-muted-foreground">
                                                    Excluding a match keeps the record but removes it from aggregate team stats.
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`ignore-${matchData.id ?? matchData.matchNumber ?? 'match'}`}
                                                    checked={ignoreForStats}
                                                    disabled={!matchData.id || isSavingIgnore || isDeleting}
                                                    onCheckedChange={(value) => {
                                                        void handleIgnoreToggle(Boolean(value));
                                                    }}
                                                />
                                                <Label htmlFor={`ignore-${matchData.id ?? matchData.matchNumber ?? 'match'}`}>
                                                    Ignore this match in team stat calculations
                                                </Label>
                                            </div>

                                            <Button
                                                className="p-2"
                                                type="button"
                                                variant="destructive"
                                                onClick={() => setIsDeleteConfirmOpen(true)}
                                                disabled={!matchData.id || isDeleting || isSavingIgnore}
                                            >
                                                Delete This Match
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>

            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Match Entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Delete Team {matchData.teamNumber ?? "?"} Match {matchData.matchNumber ?? "?"}? This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => { void handleDeleteMatch(); }}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete Match"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}

export default MatchStatsDialog;
