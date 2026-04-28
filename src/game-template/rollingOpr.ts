import type { TBAMatchData } from '@/core/lib/tbaMatchData';

export interface RollingTotalRatings {
    oprTotalPoints: number;
    coprTotalPoints: number;
    matchesProcessed: number;
}

export interface RollingTotalRatingsOptions {
    includePlayoffs?: boolean;
    ridgeLambda?: number;
}

const DEFAULT_LAMBDA = 0.75;

const COMP_LEVEL_ORDER: Record<string, number> = {
    qm: 0,
    ef: 1,
    qf: 2,
    sf: 3,
    f: 4,
};

export function calculateRollingTotalRatings(
    matches: TBAMatchData[],
    options: RollingTotalRatingsOptions = {}
): Map<string, RollingTotalRatings> {
    const includePlayoffs = options.includePlayoffs ?? true;
    const ridgeLambda = options.ridgeLambda ?? DEFAULT_LAMBDA;
    const eligibleMatches = getEligibleMatches(matches, includePlayoffs);
    const ratingsByTeamMatch = new Map<string, RollingTotalRatings>();

    for (let index = 0; index < eligibleMatches.length; index++) {
        const prefix = eligibleMatches.slice(0, index + 1);
        const oprByTeam = calculateRatingByTeam(prefix, ridgeLambda, getAllianceScore);
        const coprByTeam = calculateRatingByTeam(prefix, ridgeLambda, getAllianceCorrectedTotal);
        const match = eligibleMatches[index]!;
        const participatingTeams = [
            ...extractAllianceTeams(match, 'red'),
            ...extractAllianceTeams(match, 'blue'),
        ];

        for (const teamNumber of participatingTeams) {
            ratingsByTeamMatch.set(`${match.key}::${teamNumber}`, {
                oprTotalPoints: round1(oprByTeam.get(teamNumber) ?? 0),
                coprTotalPoints: round1(coprByTeam.get(teamNumber) ?? 0),
                matchesProcessed: index + 1,
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

            return Number.isFinite(getAllianceScore(match, 'red'))
                && Number.isFinite(getAllianceScore(match, 'blue'))
                && Number.isFinite(getAllianceCorrectedTotal(match, 'red'))
                && Number.isFinite(getAllianceCorrectedTotal(match, 'blue'));
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

function calculateRatingByTeam(
    matches: TBAMatchData[],
    ridgeLambda: number,
    getAllianceTotal: (match: TBAMatchData, alliance: 'red' | 'blue') => number
): Map<number, number> {
    const teamNumbers = [...new Set(matches.flatMap(match => [
        ...extractAllianceTeams(match, 'red'),
        ...extractAllianceTeams(match, 'blue'),
    ]))].sort((a, b) => a - b);

    if (teamNumbers.length === 0) {
        return new Map();
    }

    const teamIndex = new Map(teamNumbers.map((teamNumber, index) => [teamNumber, index] as const));
    const A: number[][] = [];
    const b: number[] = [];

    for (const match of matches) {
        for (const alliance of ['red', 'blue'] as const) {
            const teams = extractAllianceTeams(match, alliance);
            if (teams.length !== 3) {
                continue;
            }

            const row = new Array(teamNumbers.length).fill(0);
            for (const team of teams) {
                const index = teamIndex.get(team);
                if (index !== undefined) {
                    row[index] = 1;
                }
            }

            A.push(row);
            b.push(getAllianceTotal(match, alliance));
        }
    }

    const solved = solveRidgeLeastSquares(A, b, ridgeLambda);
    return new Map(teamNumbers.map((teamNumber, index) => [teamNumber, solved[index] ?? 0] as const));
}

function extractAllianceTeams(match: TBAMatchData, alliance: 'red' | 'blue'): number[] {
    return match.alliances[alliance].team_keys
        .map(teamKey => Number.parseInt(teamKey.replace('frc', ''), 10))
        .filter(teamNumber => Number.isFinite(teamNumber));
}

function getAllianceScore(match: TBAMatchData, alliance: 'red' | 'blue'): number {
    const score = match.alliances[alliance].score;
    return typeof score === 'number' && Number.isFinite(score) && score >= 0 ? score : Number.NaN;
}

function getAllianceCorrectedTotal(match: TBAMatchData, alliance: 'red' | 'blue'): number {
    const scoreBreakdown = match.score_breakdown as Record<string, Record<string, unknown>> | null;
    const breakdown = scoreBreakdown?.[alliance];
    const totalPoints = breakdown?.totalPoints;

    if (typeof totalPoints === 'number' && Number.isFinite(totalPoints) && totalPoints >= 0) {
        return totalPoints;
    }

    return getAllianceScore(match, alliance);
}

function solveRidgeLeastSquares(A: number[][], b: number[], lambda: number): number[] {
    const nTeams = A[0]?.length ?? 0;
    if (nTeams === 0) return [];

    const { AtA, Atb } = buildNormalEquations(A, b, lambda);
    return gaussianEliminationSolve(AtA, Atb);
}

function buildNormalEquations(A: number[][], b: number[], lambda: number): { AtA: number[][]; Atb: number[] } {
    const nTeams = A[0]?.length ?? 0;
    const AtA = Array.from({ length: nTeams }, () => new Array(nTeams).fill(0));
    const Atb = new Array(nTeams).fill(0);

    for (let row = 0; row < A.length; row++) {
        const aRow = A[row]!;
        const bRow = b[row] ?? 0;

        for (let i = 0; i < nTeams; i++) {
            const ai = aRow[i] ?? 0;
            if (ai === 0) continue;

            Atb[i] += ai * bRow;

            for (let j = 0; j < nTeams; j++) {
                const aj = aRow[j] ?? 0;
                if (aj === 0) continue;
                AtA[i]![j] += ai * aj;
            }
        }
    }

    for (let i = 0; i < nTeams; i++) {
        AtA[i]![i] += lambda;
    }

    return { AtA, Atb };
}

function gaussianEliminationSolve(matrix: number[][], vector: number[]): number[] {
    const n = matrix.length;
    const A = matrix.map(row => [...row]);
    const b = [...vector];

    for (let pivot = 0; pivot < n; pivot++) {
        let maxRow = pivot;
        let maxAbs = Math.abs(A[pivot]?.[pivot] ?? 0);

        for (let row = pivot + 1; row < n; row++) {
            const value = Math.abs(A[row]?.[pivot] ?? 0);
            if (value > maxAbs) {
                maxAbs = value;
                maxRow = row;
            }
        }

        if (maxAbs < 1e-12) {
            return new Array(n).fill(0);
        }

        if (maxRow !== pivot) {
            [A[pivot], A[maxRow]] = [A[maxRow]!, A[pivot]!];
            [b[pivot], b[maxRow]] = [b[maxRow]!, b[pivot]!];
        }

        const pivotValue = A[pivot]![pivot]!;
        for (let col = pivot; col < n; col++) {
            A[pivot]![col] = (A[pivot]![col] ?? 0) / pivotValue;
        }
        b[pivot] = (b[pivot] ?? 0) / pivotValue;

        for (let row = pivot + 1; row < n; row++) {
            const factor = A[row]![pivot] ?? 0;
            if (factor === 0) continue;

            for (let col = pivot; col < n; col++) {
                A[row]![col] = (A[row]![col] ?? 0) - factor * (A[pivot]![col] ?? 0);
            }
            b[row] = (b[row] ?? 0) - factor * (b[pivot] ?? 0);
        }
    }

    const x = new Array(n).fill(0);
    for (let row = n - 1; row >= 0; row--) {
        let sum = b[row] ?? 0;
        for (let col = row + 1; col < n; col++) {
            sum -= (A[row]![col] ?? 0) * (x[col] ?? 0);
        }
        x[row] = sum;
    }

    return x;
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}