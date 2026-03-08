/**
 * TeamStatsPage - Year-Agnostic Team Statistics Page
 * 
 * This component renders team statistics based on configuration provided
 * by game implementations through the StrategyAnalysis interface.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Badge } from "@/core/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/animate-ui/radix/tabs";
import { GenericSelector } from "@/core/components/ui/generic-selector";
import { DataAttribution } from "@/core/components/DataAttribution";
// PitDataDisplay import removed (will use one from game-template)
import { useTeamStats } from "@/core/hooks/useTeamStats";
import type { TeamStats } from "@/types/game-interfaces";
import type {
    StatSectionDefinition,
    RateSectionDefinition,
    MatchBadgeDefinition,
    StartPositionConfig,
} from "@/types/team-stats-display";

// ============================================================================
// PROPS & CONFIGURATION
// ============================================================================

interface TeamStatsPageProps {
    /**
     * Optional: Function to calculate team stats from scouting entries
     * Defaults to useTeamStats hook implementation
     */
    calculateStats?: (teamNumber: string, eventFilter?: string) => Promise<TeamStats | null>;

    /**
     * Optional: Stat sections configuration
     */
    statSections?: StatSectionDefinition[];

    /**
     * Optional: Rate sections configuration
     */
    rateSections?: RateSectionDefinition[];

    /**
     * Optional: Match badge configuration
     */
    matchBadges?: MatchBadgeDefinition[];

    /**
     * Optional: Start position configuration
     */
    startPositionConfig?: StartPositionConfig;

    /**
     * Optional: Available teams to select from
     */
    availableTeams?: string[];

    /**
     * Optional: Available events to filter by
     */
    availableEvents?: string[];

    /**
     * Optional Pit Scouting component to render in Pit tab
     */
    PitDataComponent?: React.ComponentType<{ teamNumber: string; selectedEvent?: string }>;
}

// ============================================================================
// COMPONENT
// ============================================================================

import { StatOverview } from "@/game-template/components/team-stats/StatOverview";
import { ScoringAnalysis } from "@/game-template/components/team-stats/ScoringAnalysis";
import { AutoAnalysis } from "@/game-template/components/team-stats/AutoAnalysis";
import { PerformanceAnalysis } from "@/game-template/components/team-stats/PerformanceAnalysis";
import PitDataDisplay from "@/game-template/components/team-stats/PitDataDisplay";

export function TeamStatsPage(props: TeamStatsPageProps) {
    const {
        availableTeams: hookTeams,
        availableEvents: hookEvents,
        displayConfig,
        calculateStats: hookCalculate,
    } = useTeamStats();

    // Use props if provided, otherwise fallback to hook values
    const availableTeams = props.availableTeams ?? hookTeams;
    const availableEvents = props.availableEvents ?? hookEvents;
    const statSections = props.statSections ?? displayConfig.statSections;
    const rateSections = props.rateSections ?? displayConfig.rateSections;
    const matchBadges = props.matchBadges ?? displayConfig.matchBadges;
    const startPositionConfig = props.startPositionConfig ?? displayConfig.startPositionConfig;
    const calculateStats = props.calculateStats ?? hookCalculate;
    const PitDataComponent = props.PitDataComponent ?? PitDataDisplay;

    const [selectedTeam, setSelectedTeam] = useState<string>("");
    const [compareTeam, setCompareTeam] = useState<string>("none");
    const [selectedEvent, setSelectedEvent] = useState<string>("all");
    const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
    const [compareStats, setCompareStats] = useState<TeamStats | null>(null);
    const [activeTab, setActiveTab] = useState("overview");

    // Calculate stats when team selection or event filter changes
    useEffect(() => {
        const updateStats = async () => {
            if (selectedTeam) {
                const stats = await calculateStats(selectedTeam, selectedEvent === "all" ? undefined : selectedEvent);
                setTeamStats(stats);
            } else {
                setTeamStats(null);
            }
        };
        updateStats();
    }, [selectedTeam, selectedEvent, calculateStats]);

    useEffect(() => {
        const updateCompareStats = async () => {
            if (compareTeam && compareTeam !== "none") {
                const stats = await calculateStats(compareTeam, selectedEvent === "all" ? undefined : selectedEvent);
                setCompareStats(stats);
            } else {
                setCompareStats(null);
            }
        };
        updateCompareStats();
    }, [compareTeam, selectedEvent, calculateStats]);

    return (
        <div className="min-h-screen w-full flex flex-col items-center px-4 pt-12 pb-24">
            <div className="w-full max-w-7xl">
                {/* Page Title & Attribution */}
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold">Team Statistics</h1>
                    <div className="hidden md:block">
                        <DataAttribution sources={['tba']} variant="compact" />
                    </div>
                </div>
                <div className="md:hidden mb-4">
                    <DataAttribution sources={['tba']} variant="compact" />
                </div>

                {/* Selectors Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 pt-2">
                    <div className="flex items-center gap-2">
                        <label className="font-medium shrink-0">Select Team:</label>
                        <div className="min-w-[120px] max-w-[200px]">
                            <GenericSelector
                                label="Select Team"
                                value={selectedTeam}
                                availableOptions={availableTeams}
                                onValueChange={setSelectedTeam}
                                placeholder="Select Team"
                                className="bg-background border-muted-foreground/20"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="font-medium shrink-0">Compare to:</label>
                        <div className="min-w-[120px] max-w-[200px]">
                            <GenericSelector
                                label="Compare Team"
                                value={compareTeam}
                                availableOptions={["none", ...availableTeams.filter(t => t !== selectedTeam)]}
                                onValueChange={setCompareTeam}
                                placeholder="No team"
                                className="bg-background border-muted-foreground/20"
                            />
                        </div>
                    </div>

                    {availableEvents.length > 0 && (
                        <div className="flex items-center gap-2">
                            <label className="font-medium shrink-0">Event:</label>
                            <div className="min-w-[140px] max-w-[250px]">
                                <GenericSelector
                                    label="Select Event"
                                    value={selectedEvent}
                                    availableOptions={["all", ...availableEvents]}
                                    onValueChange={setSelectedEvent}
                                    placeholder="All events"
                                    className="bg-background border-muted-foreground/20"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {!selectedTeam || !teamStats ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <p className="text-lg text-muted-foreground">
                                {availableTeams.length === 0 ? "No scouting data available" : "Select a team to view analysis"}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="w-full space-y-6">
                        {/* Team Header Card */}
                        <Card className="w-full bg-card/50">
                            <CardHeader className="py-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <CardTitle className="text-2xl">Team {selectedTeam}</CardTitle>
                                        {compareTeam && compareTeam !== "none" && compareStats && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg text-muted-foreground italic">vs</span>
                                                <CardTitle className="text-2xl text-purple-600">Team {compareTeam}</CardTitle>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="bg-muted/50">
                                                {teamStats.matchesPlayed > 0 ? `${teamStats.matchesPlayed} matches` : 'No matches'}
                                            </Badge>
                                            <Badge variant="default">
                                                {teamStats.matchesPlayed > 0 ? `${teamStats.avgTotalPoints} avg pts` : 'Pit only'}
                                            </Badge>
                                        </div>
                                        {compareStats && (
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                                                    {compareStats.matchesPlayed > 0 ? `${compareStats.matchesPlayed} matches` : 'No matches'}
                                                </Badge>
                                                <Badge variant="outline" className="bg-purple-600 text-white border-transparent">
                                                    {compareStats.matchesPlayed > 0 ? `${compareStats.avgTotalPoints} avg pts` : 'Pit only'}
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>

                        {/* Tabs */}
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" enableSwipe={true}>
                            <TabsList className="grid w-full grid-cols-5 h-auto">
                                <TabsTrigger value="overview" className="text-xs sm:text-sm px-1 sm:px-3">
                                    <span className="hidden sm:inline">Overview</span>
                                    <span className="sm:hidden">Over.</span>
                                </TabsTrigger>
                                <TabsTrigger value="scoring" className="text-xs sm:text-sm px-1 sm:px-3">
                                    <span className="hidden sm:inline">Scoring</span>
                                    <span className="sm:hidden">Score</span>
                                </TabsTrigger>
                                <TabsTrigger value="auto" className="text-xs sm:text-sm px-1 sm:px-3">
                                    <span className="hidden sm:inline">Auto Start</span>
                                    <span className="sm:hidden">Auto</span>
                                </TabsTrigger>
                                <TabsTrigger value="performance" className="text-xs sm:text-sm px-1 sm:px-3">
                                    <span className="hidden sm:inline">Performance</span>
                                    <span className="sm:hidden">Perf.</span>
                                </TabsTrigger>
                                <TabsTrigger value="pit" className="text-xs sm:text-sm px-1 sm:px-3">
                                    <span className="hidden sm:inline">Pit Data</span>
                                    <span className="sm:hidden">Pit</span>
                                </TabsTrigger>
                            </TabsList>

                            {/* Overview Tab */}
                            <TabsContent value="overview">
                                <StatOverview
                                    teamStats={teamStats}
                                    compareStats={compareStats}
                                    statSections={statSections}
                                    rateSections={rateSections}
                                    setActiveTab={setActiveTab}
                                />
                            </TabsContent>

                            {/* Scoring Tab */}
                            <TabsContent value="scoring">
                                <ScoringAnalysis
                                    teamStats={teamStats}
                                    compareStats={compareStats}
                                    statSections={statSections}
                                />
                            </TabsContent>

                            {/* Auto Start Tab */}
                            <TabsContent value="auto">
                                <AutoAnalysis
                                    teamStats={teamStats}
                                    compareStats={compareStats}
                                    startPositionConfig={startPositionConfig}
                                />
                            </TabsContent>

                            {/* Performance Tab */}
                            <TabsContent value="performance">
                                <PerformanceAnalysis
                                    teamStats={teamStats}
                                    compareStats={compareStats}
                                    rateSections={rateSections}
                                    matchBadges={matchBadges}
                                />
                            </TabsContent>

                            {/* Pit Data Tab */}
                            <TabsContent value="pit">
                                {PitDataComponent ? (
                                    <PitDataComponent
                                        teamNumber={selectedTeam}
                                        selectedEvent={selectedEvent === "all" ? undefined : selectedEvent}
                                    />
                                ) : (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <p className="text-muted-foreground">Pit scouting data is not available for this configuration</p>
                                        </CardContent>
                                    </Card>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TeamStatsPage;
