
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Badge } from "@/core/components/ui/badge";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { loadPitScoutingByTeamAndEvent, loadPitScoutingByTeam } from "@/core/db/database";
import type { PitScoutingEntryBase } from "@/types/database";
import { Skeleton } from "@/core/components/ui/skeleton";

interface PitDataDisplayProps {
    teamNumber: string;
    selectedEvent?: string;
}

export function PitDataDisplay({ teamNumber, selectedEvent }: PitDataDisplayProps) {
    const [entry, setEntry] = useState<PitScoutingEntryBase | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadPyData = async () => {
            if (!teamNumber) return;

            setIsLoading(true);
            try {
                let data: PitScoutingEntryBase | undefined | PitScoutingEntryBase[];
                const teamNum = parseInt(teamNumber);

                if (selectedEvent && selectedEvent !== "all") {
                    data = await loadPitScoutingByTeamAndEvent(teamNum, selectedEvent);
                } else {
                    // If no event selected or "all", get the most recent one for the team across events
                    const entries = await loadPitScoutingByTeam(teamNum);
                    data = entries.sort((a, b) => b.timestamp - a.timestamp)[0];
                }

                if (isMounted) {
                    if (Array.isArray(data)) {
                        setEntry(data[0] || null); // Should not happen with current logic but for safety
                    } else {
                        setEntry(data || null);
                    }
                }
            } catch (error) {
                console.error("Failed to load pit data", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadPyData();
        return () => { isMounted = false; };
    }, [teamNumber, selectedEvent]);

    if (isLoading) {
        return <PitDataSkeleton />;
    }

    if (!entry) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="bg-muted rounded-full p-4 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="9" x2="15" y1="15" y2="15" /></svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-1">No Pit Data Found</h3>
                    <p className="text-muted-foreground text-center max-w-[400px]">
                        No pit scouting data has been recorded for Team {teamNumber} {selectedEvent && selectedEvent !== 'all' ? `at ${selectedEvent}` : ''} yet.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* Robot Photo & Basic Info Column */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Robot Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {entry.robotPhoto ? (
                            <div className="aspect-video relative rounded-lg overflow-hidden bg-muted border border-border">
                                <img
                                    src={entry.robotPhoto}
                                    alt={`Team ${teamNumber} Robot`}
                                    className="object-cover w-full h-full"
                                />
                            </div>
                        ) : (
                            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border border-border">
                                <p className="text-muted-foreground">No photo available</p>
                            </div>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2 justify-between items-center text-sm text-muted-foreground">
                            <span>Scouted by: <span className="font-medium text-foreground">{entry.scoutName}</span></span>
                            <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Robot Specs</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Drivetrain</span>
                                <div className="font-medium text-lg capitalize">{entry.drivetrain || "Unknown"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Weight</span>
                                <div className="font-medium text-lg">{entry.weight ? `${entry.weight} lbs` : "Unknown"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Programming</span>
                                <div className="font-medium text-lg">{entry.programmingLanguage || "Unknown"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dimensions</span>
                                <div className="font-medium text-lg">
                                    {entry.gameData?.maxLength || entry.gameData?.maxWidth || entry.gameData?.maxHeight ? (
                                        <div className="text-sm leading-tight">
                                            {entry.gameData?.maxLength && <div>L: {entry.gameData.maxLength}"</div>}
                                            {entry.gameData?.maxWidth && <div>W: {entry.gameData.maxWidth}"</div>}
                                            {entry.gameData?.maxHeight && <div>H: {entry.gameData.maxHeight}"</div>}
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Notes & Game Specific Data Column */}
            <div className="space-y-6">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle>Technical Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-6">
                        {/* Notes Section */}
                        <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                Scout Notes
                            </h4>
                            <div className="bg-muted/30 p-4 rounded-lg border border-border text-sm leading-relaxed min-h-[100px]">
                                {entry.notes || <span className="text-muted-foreground italic">No notes recorded.</span>}
                            </div>
                        </div>

                        {/* Game Specific Data Section */}
                        <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                Game Specific Data
                            </h4>
                            <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/10">
                                {entry.gameData && Object.keys(entry.gameData).length > 0 ? (
                                    <div className="space-y-2">
                                        {Object.entries(entry.gameData).map(([key, value]) => (
                                            <div key={key} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                                                <span className="text-sm font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                <Badge variant="secondary" className="font-mono">
                                                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                                        <p>No game-specific data found.</p>
                                        <p className="text-xs opacity-70 mt-1">Configure PitScoutingRules to track additional metrics.</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function PitDataSkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            <div className="space-y-6">
                <Card>
                    <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                    <CardContent>
                        <Skeleton className="aspect-video w-full rounded-lg" />
                        <div className="mt-4 flex justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-28" /></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-6 w-full" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-6">
                <Card className="h-full">
                    <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                    <CardContent className="space-y-6">
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-48 w-full rounded-lg" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default PitDataDisplay;
