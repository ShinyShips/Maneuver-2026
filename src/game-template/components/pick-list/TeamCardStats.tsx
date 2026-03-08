/**
 * Team Card Stats Component
 * 
 * Displays inline statistics below the team name in the pick list.
 * Dynamically renders action averages from team stats.
 */

import type { TeamStats } from '@/core/types/team-stats';

interface TeamCardStatsProps {
    team: TeamStats;
}

/**
 * Helper to format a key like "avgAction1Count" to "Act1"
 */
const formatShortLabel = (key: string): string => {
    // Extract action number from key like "avgAction1Count" -> "A1"
    const match = key.match(/avg(\w+?)(\d+)?/i);
    if (match && match[1]) {
        const name = match[1].charAt(0).toUpperCase();
        const num = match[2] ?? '';
        return `${name}${num}`;
    }
    return key.replace('avg', '').substring(0, 3);
};

/**
 * Inline stats display for team cards.
 * Dynamically renders action averages from team stats.
 */
export const TeamCardStats = ({ team }: TeamCardStatsProps) => {
    const auto = team.auto as Record<string, unknown> | undefined;
    const teleop = team.teleop as Record<string, unknown> | undefined;
    const endgame = team.endgame;

    // Get action averages from auto phase
    const autoStats = auto
        ? Object.entries(auto)
            .filter(([key]) => key.startsWith('avg') && typeof auto[key] === 'number')
            .slice(0, 2)  // Limit to 2 for card display
            .map(([key, val]) => `${formatShortLabel(key)}: ${(val as number).toFixed(1)}`)
            .join(', ')
        : '';

    // Get action averages from teleop phase
    const teleopStats = teleop
        ? Object.entries(teleop)
            .filter(([key]) => key.startsWith('avg') && typeof teleop[key] === 'number')
            .slice(0, 2)
            .map(([key, val]) => `${formatShortLabel(key)}: ${(val as number).toFixed(1)}`)
            .join(', ')
        : '';

    return (
        <>
            <div className="text-xs text-muted-foreground">
                {autoStats && <>Auto: {autoStats} | </>}
                {teleopStats && <>Teleop: {teleopStats}</>}
            </div>
            <div className="text-xs text-muted-foreground">
                {endgame?.climbRate || 0}% climb • {team.matchCount || 0} matches
            </div>
        </>
    );
};
