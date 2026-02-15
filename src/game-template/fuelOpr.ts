import type { TBAMatchData } from '@/core/lib/tbaMatchData';

export interface FuelOPROptions {
    ridgeLambda?: number;
    includePlayoffs?: boolean;
}

export interface FuelOPRTeamResult {
    teamNumber: number;
    matchesPlayed: number;
    autoFuelOPR: number;
    teleopFuelOPR: number;
    totalFuelOPR: number;
}

export interface FuelOPRResult {
    lambda: number;
    teams: FuelOPRTeamResult[];
    matchCount: number;
    allianceSamples: number;
    fitSamples: FuelOPRFitSample[];
    fitSummary: FuelOPRFitSummary;
}

export interface FuelOPRLambdaSweepRow {
    lambda: number;
    holdoutRmse: number;
}

export interface FuelOPRLambdaSweepOptions {
    lambdas?: number[];
    includePlayoffs?: boolean;
    holdoutMatchCount?: number;
}

export interface FuelOPRLambdaSweepResult {
    trainMatchCount: number;
    holdoutMatchCount: number;
    rows: FuelOPRLambdaSweepRow[];
    bestLambda: number | null;
}

export interface FuelOPRHybridOptions {
    includePlayoffs?: boolean;
    fallbackLambda?: number;
    minMatchesForSweep?: number;
    updateEveryMatches?: number;
    smoothing?: number;
    minLambda?: number;
    maxLambda?: number;
    lambdas?: number[];
}

export type FuelOPRHybridMode = 'fixed' | 'carry' | 'swept';

export interface FuelOPRHybridTimelinePoint {
    matchCount: number;
    mode: FuelOPRHybridMode;
    lambda: number;
    sweptLambda: number | null;
}

export interface FuelOPRHybridResult {
    opr: FuelOPRResult;
    selectedLambda: number;
    mode: FuelOPRHybridMode;
    timeline: FuelOPRHybridTimelinePoint[];
    latestSweep: FuelOPRLambdaSweepResult | null;
}

export interface FuelOPRFitSample {
    teams: number[];
    observed: {
        autoFuel: number;
        teleopFuel: number;
        totalFuel: number;
    };
    modeled: {
        autoFuel: number;
        teleopFuel: number;
        totalFuel: number;
    };
    residual: {
        autoFuel: number;
        teleopFuel: number;
        totalFuel: number;
    };
}

export interface FuelOPRFitSummary {
    sampleCount: number;
    mae: {
        autoFuel: number;
        teleopFuel: number;
        totalFuel: number;
    };
    rmse: {
        autoFuel: number;
        teleopFuel: number;
        totalFuel: number;
    };
}

interface AllianceSample {
    teams: number[];
    autoFuel: number;
    teleopFuel: number;
    totalFuel: number;
}

const DEFAULT_LAMBDA = 0.75;
const DEFAULT_SWEEP_LAMBDAS = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 0.75, 1.0];
const DEFAULT_HYBRID_FALLBACK_LAMBDA = 0.3;
const DEFAULT_HYBRID_MIN_MATCHES_FOR_SWEEP = 7;
const DEFAULT_HYBRID_UPDATE_EVERY_MATCHES = 3;
const DEFAULT_HYBRID_SMOOTHING = 0.35;
const DEFAULT_HYBRID_MIN_LAMBDA = 0.01;
const DEFAULT_HYBRID_MAX_LAMBDA = 0.75;

export function calculateFuelOPR(
    matches: TBAMatchData[],
    options: FuelOPROptions = {}
): FuelOPRResult {
    const lambda = options.ridgeLambda ?? DEFAULT_LAMBDA;
    const includePlayoffs = options.includePlayoffs ?? false;

    const { samples, matchCount } = buildAllianceSamples(matches, includePlayoffs);
    const teamSet = new Set<number>();
    const matchesByTeam = new Map<number, number>();

    for (const sample of samples) {
        for (const team of sample.teams) {
            teamSet.add(team);
            matchesByTeam.set(team, (matchesByTeam.get(team) ?? 0) + 1);
        }
    }

    const teamNumbers = [...teamSet].sort((a, b) => a - b);
    if (teamNumbers.length === 0 || samples.length === 0) {
        return {
            lambda,
            teams: [],
            matchCount: 0,
            allianceSamples: 0,
            fitSamples: [],
            fitSummary: {
                sampleCount: 0,
                mae: { autoFuel: 0, teleopFuel: 0, totalFuel: 0 },
                rmse: { autoFuel: 0, teleopFuel: 0, totalFuel: 0 },
            },
        };
    }

    const teamIndex = new Map<number, number>();
    for (let i = 0; i < teamNumbers.length; i++) {
        teamIndex.set(teamNumbers[i]!, i);
    }

    const A: number[][] = samples.map(sample => {
        const row = new Array(teamNumbers.length).fill(0);
        for (const team of sample.teams) {
            const index = teamIndex.get(team);
            if (index !== undefined) {
                row[index] = 1;
            }
        }
        return row;
    });

    const bAuto = samples.map(s => s.autoFuel);
    const bTeleop = samples.map(s => s.teleopFuel);
    const bTotal = samples.map(s => s.totalFuel);

    const autoFuelOPR = solveRidgeLeastSquares(A, bAuto, lambda);
    const teleopFuelOPR = solveRidgeLeastSquares(A, bTeleop, lambda);
    const totalFuelOPR = solveRidgeLeastSquares(A, bTotal, lambda);

    const teams: FuelOPRTeamResult[] = teamNumbers.map((teamNumber, i) => ({
        teamNumber,
        matchesPlayed: matchesByTeam.get(teamNumber) ?? 0,
        autoFuelOPR: autoFuelOPR[i] ?? 0,
        teleopFuelOPR: teleopFuelOPR[i] ?? 0,
        totalFuelOPR: totalFuelOPR[i] ?? 0,
    }));

    const fitSamples = samples.map(sample => {
        const modeledAutoFuel = sample.teams.reduce((sum, team) => {
            const index = teamIndex.get(team);
            return sum + (index !== undefined ? (autoFuelOPR[index] ?? 0) : 0);
        }, 0);

        const modeledTeleopFuel = sample.teams.reduce((sum, team) => {
            const index = teamIndex.get(team);
            return sum + (index !== undefined ? (teleopFuelOPR[index] ?? 0) : 0);
        }, 0);

        const modeledTotalFuel = sample.teams.reduce((sum, team) => {
            const index = teamIndex.get(team);
            return sum + (index !== undefined ? (totalFuelOPR[index] ?? 0) : 0);
        }, 0);

        return {
            teams: sample.teams,
            observed: {
                autoFuel: sample.autoFuel,
                teleopFuel: sample.teleopFuel,
                totalFuel: sample.totalFuel,
            },
            modeled: {
                autoFuel: modeledAutoFuel,
                teleopFuel: modeledTeleopFuel,
                totalFuel: modeledTotalFuel,
            },
            residual: {
                autoFuel: sample.autoFuel - modeledAutoFuel,
                teleopFuel: sample.teleopFuel - modeledTeleopFuel,
                totalFuel: sample.totalFuel - modeledTotalFuel,
            },
        };
    });

    const fitSummary = buildFitSummary(fitSamples);

    return {
        lambda,
        teams,
        matchCount,
        allianceSamples: samples.length,
        fitSamples,
        fitSummary,
    };
}

export function sweepFuelOPRLambda(
    matches: TBAMatchData[],
    options: FuelOPRLambdaSweepOptions = {}
): FuelOPRLambdaSweepResult {
    const includePlayoffs = options.includePlayoffs ?? false;
    const lambdas = (options.lambdas ?? DEFAULT_SWEEP_LAMBDAS)
        .filter(value => Number.isFinite(value) && value > 0);

    const eligibleMatches = getEligibleMatches(matches, includePlayoffs);

    if (eligibleMatches.length < 2 || lambdas.length === 0) {
        return {
            trainMatchCount: eligibleMatches.length,
            holdoutMatchCount: 0,
            rows: [],
            bestLambda: null,
        };
    }

    const requestedHoldout = options.holdoutMatchCount ?? Math.max(2, Math.floor(eligibleMatches.length * 0.25));
    const holdoutMatchCount = Math.min(Math.max(1, requestedHoldout), eligibleMatches.length - 1);
    const trainMatchCount = eligibleMatches.length - holdoutMatchCount;

    const trainMatches = eligibleMatches.slice(0, trainMatchCount);
    const holdoutMatches = eligibleMatches.slice(trainMatchCount);

    const rows = lambdas.map(lambda => {
        const trained = calculateFuelOPR(trainMatches, {
            ridgeLambda: lambda,
            includePlayoffs: true,
        });

        const byTeam = new Map(trained.teams.map(team => [team.teamNumber, team]));
        let squaredErrorSum = 0;
        let sampleCount = 0;

        for (const match of holdoutMatches) {
            for (const alliance of ['red', 'blue'] as const) {
                const observed = getObservedAllianceTotal(match, alliance);
                const teams = getAllianceTeamNumbers(match, alliance);
                if (teams.length !== 3) {
                    continue;
                }

                const predicted = teams.reduce((sum, team) => sum + (byTeam.get(team)?.totalFuelOPR ?? 0), 0);
                const error = observed - predicted;
                squaredErrorSum += error * error;
                sampleCount += 1;
            }
        }

        const holdoutRmse = sampleCount > 0
            ? Math.sqrt(squaredErrorSum / sampleCount)
            : Number.POSITIVE_INFINITY;

        return {
            lambda,
            holdoutRmse,
        };
    });

    const best = rows.reduce<FuelOPRLambdaSweepRow | null>((bestRow, row) => {
        if (!Number.isFinite(row.holdoutRmse)) {
            return bestRow;
        }

        if (!bestRow || row.holdoutRmse < bestRow.holdoutRmse) {
            return row;
        }

        return bestRow;
    }, null);

    return {
        trainMatchCount,
        holdoutMatchCount,
        rows,
        bestLambda: best?.lambda ?? null,
    };
}

export function calculateFuelOPRHybrid(
    matches: TBAMatchData[],
    options: FuelOPRHybridOptions = {}
): FuelOPRHybridResult {
    const includePlayoffs = options.includePlayoffs ?? false;
    const fallbackLambda = options.fallbackLambda ?? DEFAULT_HYBRID_FALLBACK_LAMBDA;
    const minMatchesForSweep = options.minMatchesForSweep ?? DEFAULT_HYBRID_MIN_MATCHES_FOR_SWEEP;
    const updateEveryMatches = options.updateEveryMatches ?? DEFAULT_HYBRID_UPDATE_EVERY_MATCHES;
    const smoothing = options.smoothing ?? DEFAULT_HYBRID_SMOOTHING;
    const minLambda = options.minLambda ?? DEFAULT_HYBRID_MIN_LAMBDA;
    const maxLambda = options.maxLambda ?? DEFAULT_HYBRID_MAX_LAMBDA;
    const lambdas = (options.lambdas ?? DEFAULT_SWEEP_LAMBDAS)
        .filter(value => Number.isFinite(value) && value > 0);

    const clampLambda = (value: number) => Math.max(minLambda, Math.min(maxLambda, value));
    let currentLambda = clampLambda(fallbackLambda);
    const timeline: FuelOPRHybridTimelinePoint[] = [];
    let latestSweep: FuelOPRLambdaSweepResult | null = null;

    const eligibleMatches = getEligibleMatches(matches, includePlayoffs);

    for (let matchCount = 1; matchCount <= eligibleMatches.length; matchCount++) {
        if (matchCount < minMatchesForSweep || lambdas.length === 0) {
            timeline.push({
                matchCount,
                mode: 'fixed',
                lambda: currentLambda,
                sweptLambda: null,
            });
            continue;
        }

        const shouldSweep = (matchCount - minMatchesForSweep) % Math.max(1, updateEveryMatches) === 0;
        if (!shouldSweep) {
            timeline.push({
                matchCount,
                mode: 'carry',
                lambda: currentLambda,
                sweptLambda: null,
            });
            continue;
        }

        latestSweep = sweepFuelOPRLambda(eligibleMatches.slice(0, matchCount), {
            includePlayoffs: true,
            lambdas,
        });

        const sweepChoice = latestSweep.bestLambda ?? currentLambda;
        const blendedLambda = currentLambda * (1 - smoothing) + sweepChoice * smoothing;
        currentLambda = clampLambda(blendedLambda);

        timeline.push({
            matchCount,
            mode: 'swept',
            lambda: currentLambda,
            sweptLambda: latestSweep.bestLambda,
        });
    }

    const opr = calculateFuelOPR(matches, {
        ridgeLambda: currentLambda,
        includePlayoffs,
    });

    const mode = timeline[timeline.length - 1]?.mode ?? 'fixed';

    return {
        opr,
        selectedLambda: currentLambda,
        mode,
        timeline,
        latestSweep,
    };
}

function getEligibleMatches(matches: TBAMatchData[], includePlayoffs: boolean): TBAMatchData[] {
    return matches.filter(match => {
        if (!includePlayoffs && match.comp_level !== 'qm') {
            return false;
        }

        const scoreBreakdown = match.score_breakdown as {
            red?: { hubScore?: Record<string, unknown> };
            blue?: { hubScore?: Record<string, unknown> };
        } | null;

        return Boolean(scoreBreakdown?.red?.hubScore && scoreBreakdown?.blue?.hubScore);
    });
}

function buildAllianceSamples(matches: TBAMatchData[], includePlayoffs: boolean): { samples: AllianceSample[]; matchCount: number } {
    const samples: AllianceSample[] = [];
    let eligibleMatches = 0;

    for (const match of matches) {
        if (!includePlayoffs && match.comp_level !== 'qm') {
            continue;
        }

        const scoreBreakdown = match.score_breakdown as { red?: Record<string, unknown>; blue?: Record<string, unknown> } | null;
        if (!scoreBreakdown?.red || !scoreBreakdown?.blue) {
            continue;
        }

        const redSample = buildAllianceSample(match.alliances.red.team_keys, scoreBreakdown.red);
        const blueSample = buildAllianceSample(match.alliances.blue.team_keys, scoreBreakdown.blue);

        if (redSample) samples.push(redSample);
        if (blueSample) samples.push(blueSample);

        if (redSample || blueSample) {
            eligibleMatches++;
        }
    }

    return { samples, matchCount: eligibleMatches };
}

function buildAllianceSample(teamKeys: string[], breakdown: Record<string, unknown>): AllianceSample | null {
    const hubScore = breakdown.hubScore as Record<string, unknown> | undefined;
    if (!hubScore) {
        return null;
    }

    const teams = teamKeys
        .map(key => parseInt(key.replace('frc', ''), 10))
        .filter(number => Number.isFinite(number));

    if (teams.length !== 3) {
        return null;
    }

    const autoFuel = toNumber(hubScore.autoCount);
    const teleopFuel = toNumber(hubScore.teleopCount);
    const totalFuel = toNumber(hubScore.totalCount);

    return {
        teams,
        autoFuel,
        teleopFuel,
        totalFuel,
    };
}

function toNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getObservedAllianceTotal(match: TBAMatchData, alliance: 'red' | 'blue'): number {
    const scoreBreakdown = match.score_breakdown as {
        red?: { hubScore?: Record<string, unknown> };
        blue?: { hubScore?: Record<string, unknown> };
    } | null;

    const hubScore = scoreBreakdown?.[alliance]?.hubScore;
    return toNumber(hubScore?.totalCount);
}

function getAllianceTeamNumbers(match: TBAMatchData, alliance: 'red' | 'blue'): number[] {
    return match.alliances[alliance].team_keys
        .map(key => parseInt(key.replace('frc', ''), 10))
        .filter(number => Number.isFinite(number));
}

function solveRidgeLeastSquares(A: number[][], b: number[], lambda: number): number[] {
    const nTeams = A[0]?.length ?? 0;
    if (nTeams === 0) return [];

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

    return gaussianEliminationSolve(AtA, Atb);
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

function buildFitSummary(samples: FuelOPRFitSample[]): FuelOPRFitSummary {
    if (samples.length === 0) {
        return {
            sampleCount: 0,
            mae: { autoFuel: 0, teleopFuel: 0, totalFuel: 0 },
            rmse: { autoFuel: 0, teleopFuel: 0, totalFuel: 0 },
        };
    }

    const totals = samples.reduce((acc, sample) => {
        const autoError = Math.abs(sample.residual.autoFuel);
        const teleopError = Math.abs(sample.residual.teleopFuel);
        const totalError = Math.abs(sample.residual.totalFuel);

        acc.absAuto += autoError;
        acc.absTeleop += teleopError;
        acc.absTotal += totalError;

        acc.sqAuto += sample.residual.autoFuel ** 2;
        acc.sqTeleop += sample.residual.teleopFuel ** 2;
        acc.sqTotal += sample.residual.totalFuel ** 2;

        return acc;
    }, {
        absAuto: 0,
        absTeleop: 0,
        absTotal: 0,
        sqAuto: 0,
        sqTeleop: 0,
        sqTotal: 0,
    });

    const count = samples.length;

    return {
        sampleCount: count,
        mae: {
            autoFuel: totals.absAuto / count,
            teleopFuel: totals.absTeleop / count,
            totalFuel: totals.absTotal / count,
        },
        rmse: {
            autoFuel: Math.sqrt(totals.sqAuto / count),
            teleopFuel: Math.sqrt(totals.sqTeleop / count),
            totalFuel: Math.sqrt(totals.sqTotal / count),
        },
    };
}
