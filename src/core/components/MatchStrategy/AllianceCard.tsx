/**
 * Alliance Card Component
 * 
 * Displays team selectors and stats for one alliance (Red or Blue).
 * Contains 3 team slots with selectors and stats display.
 */

import { Card } from "@/core/components/ui/card";
import { TeamSelector } from "./TeamSelector";
import { TeamStatsDetail } from "./TeamStatsDetail";
import { TeamStatsHeaders } from "./TeamStatsHeaders";
import type { TeamStats } from "@/core/types/team-stats";

interface AllianceCardProps {
    alliance: 'red' | 'blue';
    selectedTeams: (number | null)[];
    availableTeams: number[];
    activeStatsTab: string;
    getTeamStats: (teamNumber: number | null) => TeamStats | null;
    onTeamChange: (index: number, teamNumber: number | null) => void;
    onTouchStart?: (e: React.TouchEvent) => void;
    onTouchEnd?: (e: React.TouchEvent) => void;
}

export const AllianceCard = ({
    alliance,
    selectedTeams,
    availableTeams,
    activeStatsTab,
    getTeamStats,
    onTeamChange,
    onTouchStart,
    onTouchEnd
}: AllianceCardProps) => {
    const isBlue = alliance === 'blue';
    const startIndex = isBlue ? 3 : 0;
    const borderColor = isBlue ? 'border-blue-200 dark:border-blue-800' : 'border-red-200 dark:border-red-800';
    const textColor = isBlue ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400';

    return (
        <div className="flex-1" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className={`border rounded-lg ${borderColor}`}>
                <div className={`p-4 border-b ${borderColor}`}>
                    <div className="flex items-center justify-between">
                        <h3 className={`text-lg font-semibold ${textColor}`}>
                            {alliance === 'blue' ? 'Blue' : 'Red'} Alliance
                        </h3>
                        <TeamStatsHeaders
                            alliance={alliance}
                            activeStatsTab={activeStatsTab}
                            selectedTeams={selectedTeams}
                            getTeamStats={getTeamStats}
                        />
                    </div>
                </div>
                <div className="p-4 space-y-3">
                    {Array.from({ length: 3 }, (_, index) => {
                        const teamIndex = startIndex + index;
                        const team = selectedTeams[teamIndex] ?? null;
                        const stats = getTeamStats(team);

                        return (
                            <Card key={teamIndex} className="p-3">
                                <div className="space-y-3">
                                    {/* Team Selector */}
                                    <div className="flex items-center gap-3">
                                        <label className={`text-sm font-medium ${textColor} min-w-0 shrink-0`}>
                                            {alliance === 'blue' ? 'Blue' : 'Red'} Team {index + 1}:
                                        </label>
                                        <div className="w-full flex-1">
                                            <TeamSelector
                                                index={teamIndex}
                                                label={`${alliance === 'blue' ? 'Blue' : 'Red'} Team ${index + 1}`}
                                                labelColor={textColor}
                                                value={selectedTeams[teamIndex] ?? null}
                                                availableTeams={availableTeams}
                                                onValueChange={(value) => onTeamChange(teamIndex, value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Team Stats */}
                                    {team && stats ? (
                                        <TeamStatsDetail
                                            stats={stats}
                                            activeStatsTab={activeStatsTab}
                                        />
                                    ) : (
                                        <div className="text-center py-2 text-muted-foreground text-sm">
                                            {team ? "No data available" : "No team selected"}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
