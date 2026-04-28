import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Badge } from "@/core/components/ui/badge";
import { ProgressCard } from "@/core/components/team-stats/ProgressCard";
import { MatchProgressionChart } from "./MatchProgressionChart";
import type { MatchProgressionMatchResult } from "./MatchProgressionChart";
import { MatchStatsDialog } from "./MatchStatsDialog";
import { DefenseAgainstTeamAnalysis } from "./DefenseAgainstTeamAnalysis";
import type { TeamStats } from "@/core/types/team-stats";
import type { RateSectionDefinition, MatchBadgeDefinition } from "@/types/team-stats-display";
import { getDisplayMatchLabel } from "@/game-template/matchLabel";

const START_POSITION_LABELS = ['Left Trench', 'Left Bump', 'Hub', 'Right Bump', 'Right Trench'] as const;

function getStartPositionLabel(startPosition: number | null): string | null {
    if (startPosition === null || startPosition < 0) {
        return null;
    }

    return START_POSITION_LABELS[startPosition] ?? `Pos ${startPosition}`;
}

interface PerformanceAnalysisProps {
    teamStats: TeamStats;
    compareStats: TeamStats | null;
    rateSections: RateSectionDefinition[];
    matchBadges: MatchBadgeDefinition[];
    selectedEvent?: string;
    onMatchDataChanged?: () => void;
}

export function PerformanceAnalysis({
    teamStats,
    compareStats,
    rateSections,
    matchBadges,
    selectedEvent,
    onMatchDataChanged,
}: PerformanceAnalysisProps) {
    const matchResults = (teamStats as TeamStats & { matchResults?: Record<string, unknown>[] })?.matchResults;
    const compareMatchResults = (compareStats as (TeamStats & { matchResults?: Record<string, unknown>[] }) | null)?.matchResults;
    const hasMatchResults = Array.isArray(matchResults) && matchResults.length > 0;

    if (teamStats.matchesPlayed === 0 && !hasMatchResults) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">No performance data available</p>
                </CardContent>
            </Card>
        );
    }

    const sections = rateSections.filter(s => s.tab === 'performance');

    const getStatValue = (stats: TeamStats, key: string): number => {
        const value = (stats as Record<string, unknown>)[key];
        return typeof value === 'number' ? value : 0;
    };

    const avgAutoPoints = getStatValue(teamStats, 'avgAutoPoints');
    const avgTeleopPoints = getStatValue(teamStats, 'avgTeleopPoints');
    const avgEndgamePoints = getStatValue(teamStats, 'avgEndgamePoints');
    const hasPhasePointSummary = avgAutoPoints !== 0 || avgTeleopPoints !== 0 || avgEndgamePoints !== 0;

    const renderMatchResults = () => {
        if (!matchResults || !Array.isArray(matchResults)) {
            return <p className="text-muted-foreground text-center py-4">No match data available</p>;
        }

        return (
            <div className="h-full space-y-3 overflow-y-auto pr-1">
                {matchResults.map((match, index: number) => {
                    const eventKey = typeof match['eventKey'] === 'string' ? match['eventKey'] : null;
                    const matchNumber = String(match['matchNumber'] || '');
                    const matchLabel = typeof match['matchLabel'] === 'string' && match['matchLabel'].trim() !== ''
                        ? match['matchLabel'].trim()
                        : getDisplayMatchLabel(matchNumber);
                    const alliance = String(match['alliance'] || '');
                    const startPos = typeof match['startPosition'] === 'number' ? match['startPosition'] : null;
                    const startPosLabel = getStartPositionLabel(startPos);
                    const totalPoints = String(match['totalPoints'] || 0);
                    const autoPoints = String(match['autoPoints'] || 0);
                    const teleopPoints = String(match['teleopPoints'] || 0);
                    const endgamePoints = String(match['endgamePoints'] || 0);
                    const totalPointsNumber = typeof match['totalPoints'] === 'number' ? match['totalPoints'] : 0;
                    const autoPointsNumber = typeof match['autoPoints'] === 'number' ? match['autoPoints'] : 0;
                    const teleopPointsNumber = typeof match['teleopPoints'] === 'number' ? match['teleopPoints'] : 0;
                    const endgamePointsNumber = typeof match['endgamePoints'] === 'number' ? match['endgamePoints'] : 0;
                    const rollingMopr = typeof match['rollingOprTotalPoints'] === 'number' ? match['rollingOprTotalPoints'] : 0;
                    const hasRecordedPoints = totalPointsNumber !== 0 || autoPointsNumber !== 0 || teleopPointsNumber !== 0 || endgamePointsNumber !== 0;
                    const showMoprFallback = !hasRecordedPoints && rollingMopr > 0;
                    const comment = typeof match['comment'] === 'string' ? match['comment'] : "";
                    const ignoreForStats = !!match['ignoreForStats'];

                    return (
                        <div key={index} className="flex flex-col p-3 border rounded gap-3">
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    {eventKey && (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                            {eventKey}
                                        </Badge>
                                    )}
                                    <Badge variant="outline">{matchLabel}</Badge>
                                    <Badge
                                        variant={alliance.toLowerCase() === "red" ? "destructive" : "default"}
                                        className={alliance.toLowerCase() === "blue" ? "bg-blue-600" : ""}
                                    >
                                        {alliance}
                                    </Badge>
                                    {startPosLabel && (
                                        <Badge variant="secondary">{startPosLabel}</Badge>
                                    )}
                                    {ignoreForStats && (
                                        <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">
                                            Excluded from stats
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {matchBadges.map(badge => {
                                        const matchValue = match[badge.key];
                                        if (matchValue === badge.showWhen) {
                                            return (
                                                <Badge key={badge.key} variant={badge.variant}>
                                                    {badge.label}
                                                </Badge>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="font-bold text-lg">
                                    {showMoprFallback ? `${rollingMopr.toFixed(1)} mOPR` : `${totalPoints} pts`}
                                </div>
                                {showMoprFallback ? (
                                    <div className="text-sm text-muted-foreground flex gap-2">
                                        <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-600 dark:text-emerald-400">
                                            No scout scoring data
                                        </span>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground flex gap-2">
                                        <span className="bg-blue-500/10 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400">A: {autoPoints}</span>
                                        <span className="bg-purple-500/10 px-1.5 py-0.5 rounded text-purple-600 dark:text-purple-400">T: {teleopPoints}</span>
                                        <span className="bg-orange-500/10 px-1.5 py-0.5 rounded text-orange-600 dark:text-orange-400">E: {endgamePoints}</span>
                                    </div>
                                )}
                            </div>
                            {comment.trim() !== "" && (
                                <div className="text-xs text-muted-foreground italic border-t pt-2">
                                    "{comment}"
                                </div>
                            )}
                            <MatchStatsDialog
                                matchData={{
                                    id: typeof match['id'] === 'string' ? match['id'] : undefined,
                                    matchNumber,
                                    teamNumber: typeof match['teamNumber'] === 'number' ? match['teamNumber'] : undefined,
                                    alliance,
                                    eventKey: eventKey || '',
                                    scoutName: typeof match['scoutName'] === 'string' ? match['scoutName'] : undefined,
                                    startPosition: startPos ?? undefined,
                                    comment,
                                    autoPoints: typeof match['autoPoints'] === 'number' ? match['autoPoints'] : 0,
                                    teleopPoints: typeof match['teleopPoints'] === 'number' ? match['teleopPoints'] : 0,
                                    endgamePoints: typeof match['endgamePoints'] === 'number' ? match['endgamePoints'] : 0,
                                    totalPoints: typeof match['totalPoints'] === 'number' ? match['totalPoints'] : 0,
                                    autoPassedMobilityLine: !!match['autoPassedMobilityLine'],
                                    climbAttempted: !!match['climbAttempted'] || !!match['climbed'],
                                    climbSucceeded: !!match['climbed'],
                                    parkAttempted: !!match['parkAttempted'],
                                    brokeDown: !!match['brokeDown'],
                                    playedDefense: !!match['playedDefense'],
                                    ignoreForStats,
                                    gameData: match['gameData'] as {
                                        auto?: Record<string, unknown>;
                                        teleop?: Record<string, unknown>;
                                        endgame?: Record<string, unknown>;
                                    } | undefined,
                                }}
                                onMatchDataChanged={onMatchDataChanged}
                                variant="outline"
                                size="default"
                                className="w-full mt-2"
                            />
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-6">
            {hasMatchResults && (
                <MatchProgressionChart
                    matchResults={matchResults as MatchProgressionMatchResult[]}
                    compareMatchResults={Array.isArray(compareMatchResults)
                        ? compareMatchResults as MatchProgressionMatchResult[]
                        : undefined}
                    teamNumber={teamStats.teamNumber}
                    compareTeamNumber={compareStats?.teamNumber}
                />
            )}

            <DefenseAgainstTeamAnalysis
                teamNumber={String(teamStats.teamNumber)}
                selectedEvent={selectedEvent}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Performance Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {/* Fixed: Points by Phase */}
                            <div>
                                <p className="text-sm font-medium mb-3">Points by Phase</p>
                                {hasPhasePointSummary ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded">
                                            <span className="text-sm font-medium">Auto</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-blue-600">{avgAutoPoints.toFixed(1)} pts</span>
                                                {compareStats && (
                                                    <span className={`text-xs font-medium ${(avgAutoPoints - getStatValue(compareStats, 'avgAutoPoints')) > 0 ? 'text-green-600' :
                                                        (avgAutoPoints - getStatValue(compareStats, 'avgAutoPoints')) < 0 ? 'text-red-600' : 'text-gray-500'
                                                        }`}>
                                                        ({(avgAutoPoints - getStatValue(compareStats, 'avgAutoPoints')) > 0 ? '+' : ''}{(avgAutoPoints - getStatValue(compareStats, 'avgAutoPoints')).toFixed(1)})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded">
                                            <span className="text-sm font-medium">Teleop</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-purple-600">{avgTeleopPoints.toFixed(1)} pts</span>
                                                {compareStats && (
                                                    <span className={`text-xs font-medium ${(avgTeleopPoints - getStatValue(compareStats, 'avgTeleopPoints')) > 0 ? 'text-green-600' :
                                                        (avgTeleopPoints - getStatValue(compareStats, 'avgTeleopPoints')) < 0 ? 'text-red-600' : 'text-gray-500'
                                                        }`}>
                                                        ({(avgTeleopPoints - getStatValue(compareStats, 'avgTeleopPoints')) > 0 ? '+' : ''}{(avgTeleopPoints - getStatValue(compareStats, 'avgTeleopPoints')).toFixed(1)})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded">
                                            <span className="text-sm font-medium">Endgame</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-orange-600">{avgEndgamePoints.toFixed(1)} pts</span>
                                                {compareStats && (
                                                    <span className={`text-xs font-medium ${(avgEndgamePoints - getStatValue(compareStats, 'avgEndgamePoints')) > 0 ? 'text-green-600' :
                                                        (avgEndgamePoints - getStatValue(compareStats, 'avgEndgamePoints')) < 0 ? 'text-red-600' : 'text-gray-500'
                                                        }`}>
                                                        ({(avgEndgamePoints - getStatValue(compareStats, 'avgEndgamePoints')) > 0 ? '+' : ''}{(avgEndgamePoints - getStatValue(compareStats, 'avgEndgamePoints')).toFixed(1)})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                                        Detailed scoring was not collected for this team. Use match notes, rate-based metrics, defense matchups, and external analytics for evaluation.
                                    </div>
                                )}
                            </div>

                            {/* Configurable: Rate sections (e.g., Reliability Metrics) */}
                            {sections.map(section => (
                                <div key={section.id}>
                                    <p className="text-sm font-medium mb-3">{section.title}</p>
                                    <div className="space-y-3">
                                        {section.rates.map(rate => (
                                            <ProgressCard
                                                key={rate.key}
                                                title={rate.label}
                                                value={getStatValue(teamStats, rate.key)}
                                                compareValue={compareStats ? getStatValue(compareStats, rate.key) : undefined}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle>Match-by-Match Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0">
                        {renderMatchResults()}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
