/**
 * TeamStatsPage - Year-Agnostic Team Statistics Page
 * 
 * This component renders team statistics based on configuration provided
 * by game implementations through the StrategyAnalysis interface.
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Badge } from "@/core/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/animate-ui/radix/tabs";
import { GenericSelector } from "@/core/components/ui/generic-selector";
import { DataAttribution } from "@/core/components/DataAttribution";
import { TeamStatsFieldSettingsSheet, type TeamStatsFieldOption } from "@/core/components/team-stats/TeamStatsFieldSettingsSheet";
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
    const [isFieldSettingsOpen, setIsFieldSettingsOpen] = useState(false);
    const [hiddenStatKeys, setHiddenStatKeys] = useState<Set<string>>(new Set());
    const [autoHideUncollected, setAutoHideUncollected] = useState(true);
    const [statsRefreshKey, setStatsRefreshKey] = useState(0);

    const getTabCategoryLabel = (tab: 'overview' | 'scoring' | 'performance') => {
        if (tab === 'overview') return 'Overview';
        if (tab === 'scoring') return 'Scoring';
        return 'Performance';
    };

    const allFieldOptions = useMemo<TeamStatsFieldOption[]>(() => {
        const optionsByKey = new Map<string, TeamStatsFieldOption>();
        const statLabelCounts = new Map<string, number>();

        statSections.forEach(section => {
            section.stats.forEach(stat => {
                statLabelCounts.set(stat.label, (statLabelCounts.get(stat.label) ?? 0) + 1);
            });
        });

        const getStatCategory = (section: StatSectionDefinition) => {
            if (section.tab === 'scoring') {
                return `Scoring — ${section.title}`;
            }

            return `${getTabCategoryLabel(section.tab)} Stats`;
        };

        const getRateCategory = (section: RateSectionDefinition) => {
            if (section.tab === 'overview') {
                return 'Overview Stats';
            }

            if (section.tab === 'performance') {
                return `Performance — ${section.title}`;
            }

            return `${getTabCategoryLabel(section.tab)} Rates`;
        };

        const getStatOptionLabel = (label: string, subtitle?: string) => {
            if (!subtitle) return label;

            const isDuplicateLabel = (statLabelCounts.get(label) ?? 0) > 1;
            if (isDuplicateLabel) {
                const normalizedLabel = label.trim().toLowerCase();
                const normalizedSubtitle = subtitle.trim().toLowerCase();
                if (normalizedLabel === normalizedSubtitle) {
                    return label;
                }

                return `${label} — ${subtitle}`;
            }

            return label;
        };

        statSections.forEach(section => {
            section.stats.forEach(stat => {
                if (!optionsByKey.has(stat.key)) {
                    optionsByKey.set(stat.key, {
                        key: stat.key,
                        label: getStatOptionLabel(stat.label, stat.subtitle),
                        category: getStatCategory(section),
                    });
                }
            });
        });

        rateSections.forEach(section => {
            section.rates.forEach(rate => {
                if (!optionsByKey.has(rate.key)) {
                    optionsByKey.set(rate.key, {
                        key: rate.key,
                        label: rate.label,
                        category: getRateCategory(section),
                    });
                }
            });
        });

        return Array.from(optionsByKey.values());
    }, [statSections, rateSections]);

    useEffect(() => {
        const savedHiddenFields = localStorage.getItem("team_stats_hidden_fields");
        if (savedHiddenFields) {
            try {
                const parsed = JSON.parse(savedHiddenFields) as string[];
                setHiddenStatKeys(new Set(parsed));
            } catch (error) {
                console.error("Failed to parse team stats hidden fields:", error);
            }
        }

        const savedAutoHide = localStorage.getItem("team_stats_auto_hide_uncollected");
        if (savedAutoHide !== null) {
            setAutoHideUncollected(savedAutoHide === "true");
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("team_stats_hidden_fields", JSON.stringify(Array.from(hiddenStatKeys)));
    }, [hiddenStatKeys]);

    useEffect(() => {
        localStorage.setItem("team_stats_auto_hide_uncollected", String(autoHideUncollected));
    }, [autoHideUncollected]);

    const hasMeaningfulValue = (value: unknown): boolean => {
        if (typeof value === 'number') {
            return Number.isFinite(value) && Math.abs(value) > 0;
        }

        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (!normalized) return false;
            return !['n/a', 'na', 'none', 'unknown', 'no data', '-', 'null'].includes(normalized);
        }

        if (typeof value === 'boolean') {
            return value;
        }

        if (Array.isArray(value)) {
            return value.length > 0;
        }

        return false;
    };

    const autoHiddenStatKeys = useMemo(() => {
        if (!autoHideUncollected || !teamStats) {
            return new Set<string>();
        }

        const autoHiddenKeys = new Set<string>();

        allFieldOptions.forEach(({ key }) => {
            const primaryValue = (teamStats as Record<string, unknown>)[key];
            const compareValue = compareStats ? (compareStats as Record<string, unknown>)[key] : undefined;

            if (!hasMeaningfulValue(primaryValue) && !hasMeaningfulValue(compareValue)) {
                autoHiddenKeys.add(key);
            }
        });

        return autoHiddenKeys;
    }, [autoHideUncollected, teamStats, compareStats, allFieldOptions]);

    const totalHiddenFieldCount = useMemo(() => {
        const combined = new Set(hiddenStatKeys);
        autoHiddenStatKeys.forEach((key) => combined.add(key));
        return combined.size;
    }, [hiddenStatKeys, autoHiddenStatKeys]);

    const visibleStatSections = useMemo(() => {
        return statSections
            .map(section => ({
                ...section,
                stats: section.stats.filter(stat => {
                    if (hiddenStatKeys.has(stat.key)) return false;
                    if (autoHideUncollected && autoHiddenStatKeys.has(stat.key)) return false;
                    return true;
                }),
            }))
            .filter(section => section.stats.length > 0);
    }, [statSections, hiddenStatKeys, autoHideUncollected, autoHiddenStatKeys]);

    const visibleRateSections = useMemo(() => {
        return rateSections
            .map(section => ({
                ...section,
                rates: section.rates.filter(rate => {
                    if (hiddenStatKeys.has(rate.key)) return false;
                    if (autoHideUncollected && autoHiddenStatKeys.has(rate.key)) return false;
                    return true;
                }),
            }))
            .filter(section => section.rates.length > 0);
    }, [rateSections, hiddenStatKeys, autoHideUncollected, autoHiddenStatKeys]);

    const handleToggleField = (key: string) => {
        setHiddenStatKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleShowAllFields = () => {
        setHiddenStatKeys(new Set());
    };

    const handleHideAllFields = () => {
        setHiddenStatKeys(new Set(allFieldOptions.map(field => field.key)));
    };

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
    }, [selectedTeam, selectedEvent, calculateStats, statsRefreshKey]);

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
    }, [compareTeam, selectedEvent, calculateStats, statsRefreshKey]);

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

                    <div className="flex items-center gap-2">
                        <TeamStatsFieldSettingsSheet
                            isOpen={isFieldSettingsOpen}
                            onOpenChange={setIsFieldSettingsOpen}
                            fieldOptions={allFieldOptions}
                            hiddenFieldKeys={hiddenStatKeys}
                            autoHiddenFieldKeys={autoHiddenStatKeys}
                            autoHideUncollected={autoHideUncollected}
                            onAutoHideUncollectedChange={setAutoHideUncollected}
                            onToggleField={handleToggleField}
                            onShowAll={handleShowAllFields}
                            onHideAll={handleHideAllFields}
                        />
                        {totalHiddenFieldCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                                {totalHiddenFieldCount} hidden
                            </Badge>
                        )}
                    </div>
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
                                    statSections={visibleStatSections}
                                    rateSections={visibleRateSections}
                                    setActiveTab={setActiveTab}
                                />
                            </TabsContent>

                            {/* Scoring Tab */}
                            <TabsContent value="scoring">
                                <ScoringAnalysis
                                    teamStats={teamStats}
                                    compareStats={compareStats}
                                    statSections={visibleStatSections}
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
                                    rateSections={visibleRateSections}
                                    matchBadges={matchBadges}
                                    onMatchDataChanged={() => setStatsRefreshKey(prev => prev + 1)}
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
