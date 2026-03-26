/**
 * Team Stats Dialog Component
 * 
 * Detailed stats modal triggered by the eye icon button.
 * This is year-specific - customize the tabs and stats per game.
 */

import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/core/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/animate-ui/radix/tabs";
import { Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { ConfiguredStatsSections } from "@/core/components/team-stats";
import type { TeamStats } from '@/core/types/team-stats';
import { strategyAnalysis } from "@/game-template/analysis";
import { AutoAnalysis } from "@/game-template/components/team-stats/AutoAnalysis";
import { DefenseAgainstTeamAnalysis } from "@/game-template/components/team-stats/DefenseAgainstTeamAnalysis";
import { getDisplayMatchLabel } from "@/game-template/matchLabel";

interface TeamStatsDialogProps {
    teamNumber: string | number;
    teamStats?: TeamStats;
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg";
    className?: string;
}

/**
 * Detailed stats dialog for a team.
 * Customize the tabs and content for each game year.
 */
export function TeamStatsDialog({
    teamNumber,
    teamStats,
    variant = "outline",
    size = "sm",
    className = ""
}: TeamStatsDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");

    if (!teamStats) {
        return (
            <Button variant={variant} size={size} className={className} disabled>
                <Eye className="w-3 h-3" />
                <span>View Stats</span>
            </Button>
        );
    }

    const statSections = strategyAnalysis.getStatSections();
    const rateSections = strategyAnalysis.getRateSections();
    const overviewStatSections = statSections.filter((section) => section.tab === 'overview');
    const scoringStatSections = statSections.filter((section) => section.tab === 'scoring');
    const overviewRateSections = rateSections.filter((section) => section.tab === 'overview');
    const performanceRateSections = rateSections.filter((section) => section.tab === 'performance');
    const startPositionConfig = strategyAnalysis.getStartPositionConfig();
    const comments = Array.isArray(teamStats.matchResults)
        ? teamStats.matchResults
            .map((match) => {
                const comment = typeof match?.comment === 'string' ? match.comment.trim() : '';
                if (!comment) {
                    return null;
                }

                const eventKey = typeof match?.eventKey === 'string' ? match.eventKey.trim() : '';
                const matchNumber = String(match?.matchNumber || '');
                const matchLabel = typeof match?.matchLabel === 'string' && match.matchLabel.trim() !== ''
                    ? match.matchLabel.trim()
                    : getDisplayMatchLabel(matchNumber);

                return {
                    key: typeof match?.id === 'string' ? match.id : `${eventKey}:${matchNumber}:${comment}`,
                    comment,
                    eventKey,
                    matchLabel,
                    scoutName: typeof match?.scoutName === 'string' ? match.scoutName.trim() : '',
                };
            })
            .filter((comment): comment is {
                key: string;
                comment: string;
                eventKey: string;
                matchLabel: string;
                scoutName: string;
            } => comment !== null)
        : [];

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant={variant} size={size} className={className}>
                    <Eye className="w-3 h-3" />
                    <span>View Stats</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] h-[min(600px,90vh)] flex flex-col p-6">
                <DialogHeader className="shrink-0 px-0">
                    <DialogTitle>Team {teamNumber} Detailed Stats</DialogTitle>
                </DialogHeader>

                <div
                    className="flex-1 min-h-0"
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    <Tabs value={activeTab} onValueChange={setActiveTab} enableSwipe className="w-full h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-4 shrink-0">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="scoring">Scoring</TabsTrigger>
                            <TabsTrigger value="performance">Performance</TabsTrigger>
                            <TabsTrigger value="auto">Auto</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto px-0 mt-4">
                            <TabsContent value="overview" className="space-y-4 h-full mt-0">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <Card>
                                        <CardContent className="pt-4">
                                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Matches Played</div>
                                            <div className="text-2xl font-semibold text-orange-600">{teamStats.matchCount || 0}</div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="pt-4">
                                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Avg Total Points</div>
                                            <div className="text-2xl font-semibold text-blue-600">{teamStats.overall?.avgTotalPoints ?? 0}</div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="pt-4">
                                            <div className="text-xs uppercase tracking-wide text-muted-foreground">No Shows</div>
                                            <div className="text-2xl font-semibold text-red-600">{typeof teamStats.noShowCount === 'number' ? teamStats.noShowCount : 0}</div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="pt-4">
                                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Breakdowns</div>
                                            <div className="text-2xl font-semibold text-yellow-600">{typeof teamStats.brokeDownCount === 'number' ? teamStats.brokeDownCount : 0}</div>
                                        </CardContent>
                                    </Card>
                                </div>
                                <ConfiguredStatsSections
                                    teamStats={teamStats}
                                    statSections={overviewStatSections}
                                    rateSections={overviewRateSections}
                                />
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Scout Comments</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {comments.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No scout comments recorded for this team yet.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {comments.map((entry) => (
                                                    <div key={entry.key} className="rounded-md border p-3 space-y-2">
                                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                            {entry.eventKey && (
                                                                <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground/80">
                                                                    {entry.eventKey}
                                                                </span>
                                                            )}
                                                            <span>{entry.matchLabel}</span>
                                                            {entry.scoutName && <span>Scout: {entry.scoutName}</span>}
                                                        </div>
                                                        <p className="text-sm leading-relaxed">{entry.comment}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="scoring" className="space-y-4 h-full mt-0">
                                <ConfiguredStatsSections
                                    teamStats={teamStats}
                                    statSections={scoringStatSections}
                                    emptyMessage="No detailed stats available for scoring."
                                />
                            </TabsContent>

                            <TabsContent value="performance" className="space-y-4 h-full mt-0">
                                <DefenseAgainstTeamAnalysis
                                    teamNumber={String(teamNumber)}
                                    selectedEvent={teamStats.eventKey}
                                />
                                <ConfiguredStatsSections
                                    teamStats={teamStats}
                                    rateSections={performanceRateSections}
                                    emptyMessage="No rate metrics available for performance."
                                />
                            </TabsContent>

                            <TabsContent value="auto" className="space-y-4 h-full mt-0">
                                <AutoAnalysis
                                    teamStats={teamStats}
                                    compareStats={null}
                                    startPositionConfig={startPositionConfig}
                                    showStartPositionMap={false}
                                />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
