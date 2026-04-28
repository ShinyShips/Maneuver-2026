import type { TBAMatchData } from '@/core/lib/tbaMatchData';
import { calculateFuelOPR, calculateFuelOPRHybrid, type FuelOPRHybridMode } from '@/game-template/fuelOpr';

export interface RollingFuelMoprRatings {
    fixedTotalMopr: number;
    adaptiveTotalMopr: number;
    matchesProcessed: number;
    adaptiveLambda: number;
    adaptiveMode: FuelOPRHybridMode;
}

export interface RollingFuelMoprOptions {
    includePlayoffs?: boolean;
    fixedLambda?: number;
}

const DEFAULT_FIXED_LAMBDA = 0.3;

const COMP_LEVEL_ORDER: Record<string, number> = {
    qm: 0,
    ef: 1,
    qf: 2,
    sf: 3,
    f: 4,
};

export function calculateRollingFuelMoprRatings(
    matches: TBAMatchData[],
    options: RollingFuelMoprOptions = {}
): Map<string, RollingFuelMoprRatings> {
    const includePlayoffs = options.includePlayoffs ?? true;
    const fixedLambda = options.fixedLambda ?? DEFAULT_FIXED_LAMBDA;
    const eligibleMatches = getEligibleMatches(matches, includePlayoffs);
    const ratingsByTeamMatch = new Map<string, RollingFuelMoprRatings>();

    for (let index = 0; index < eligibleMatches.length; index++) {
        const prefix = eligibleMatches.slice(0, index + 1);
        const fixed = calculateFuelOPR(prefix, {
            ridgeLambda: fixedLambda,
            includePlayoffs: true,
            nonNegative: false,
        });
        const adaptive = calculateFuelOPRHybrid(prefix, {
            includePlayoffs: true,
            nonNegative: false,
            fallbackLambda: fixedLambda,
        });

        const fixedByTeam = new Map(fixed.teams.map(team => [team.teamNumber, team] as const));
        const adaptiveByTeam = new Map(adaptive.opr.teams.map(team => [team.teamNumber, team] as const));
        const match = eligibleMatches[index]!;
        const participatingTeams = [
            ...extractAllianceTeams(match, 'red'),
            ...extractAllianceTeams(match, 'blue'),
        ];

        for (const teamNumber of participatingTeams) {
            ratingsByTeamMatch.set(`${match.key}::${teamNumber}`, {
                fixedTotalMopr: round1(fixedByTeam.get(teamNumber)?.totalFuelOPR ?? 0),
                adaptiveTotalMopr: round1(adaptiveByTeam.get(teamNumber)?.totalFuelOPR ?? 0),
                matchesProcessed: index + 1,
                adaptiveLambda: adaptive.selectedLambda,
                adaptiveMode: adaptive.mode,
            });
        }
    }

    return ratingsByTeamMatch;
}

function getEligibleMatches(matches: TBAMatchData[], includePlayoffs: boolean): TBAMatchData[] {
    return [...matches]
        .filter(match => {
            if (!includePlayoffs && match.comp_level !== 'qm') {
                return false;
            }

            const redTeams = extractAllianceTeams(match, 'red');
            const blueTeams = extractAllianceTeams(match, 'blue');
            if (redTeams.length !== 3 || blueTeams.length !== 3) {
                return false;
            }

            const scoreBreakdown = match.score_breakdown as {
                red?: { hubScore?: Record<string, unknown> };
                blue?: { hubScore?: Record<string, unknown> };
            } | null;

            return Boolean(scoreBreakdown?.red?.hubScore && scoreBreakdown?.blue?.hubScore);
        })
        .sort(compareTbaMatches);
}

function compareTbaMatches(a: TBAMatchData, b: TBAMatchData): number {
    const compLevelDiff = (COMP_LEVEL_ORDER[a.comp_level] ?? 99) - (COMP_LEVEL_ORDER[b.comp_level] ?? 99);
    if (compLevelDiff !== 0) {
        return compLevelDiff;
    }

    if (a.set_number !== b.set_number) {
        return a.set_number - b.set_number;
    }

    if (a.match_number !== b.match_number) {
        return a.match_number - b.match_number;
    }

    return a.key.localeCompare(b.key);
}

function extractAllianceTeams(match: TBAMatchData, alliance: 'red' | 'blue'): number[] {
    return match.alliances[alliance].team_keys
        .map(teamKey => Number.parseInt(teamKey.replace('frc', ''), 10))
        .filter(teamNumber => Number.isFinite(teamNumber));
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}