import { describe, expect, it } from 'vitest';
import type { TBAMatchData } from '@/core/lib/tbaMatchData';
import { calculateFuelOPR, calculateFuelOPRHybrid, sweepFuelOPRLambda } from './fuelOpr';

function sumValues(source: Record<number, number>, teams: number[]): number {
  return teams.reduce((acc, team) => acc + (source[team] ?? 0), 0);
}

function maybeLogFitDiagnostics(label: string, result: ReturnType<typeof calculateFuelOPR>) {
  if (process.env.VITEST_OPR_DEBUG !== '1') {
    return;
  }

  const round2 = (value: number) => Math.round(value * 100) / 100;

  console.log(`\n[OPR DEBUG] ${label}`);
  console.log('[OPR DEBUG] Fit summary:', {
    sampleCount: result.fitSummary.sampleCount,
    mae: {
      autoFuel: round2(result.fitSummary.mae.autoFuel),
      teleopFuel: round2(result.fitSummary.mae.teleopFuel),
      totalFuel: round2(result.fitSummary.mae.totalFuel),
    },
    rmse: {
      autoFuel: round2(result.fitSummary.rmse.autoFuel),
      teleopFuel: round2(result.fitSummary.rmse.teleopFuel),
      totalFuel: round2(result.fitSummary.rmse.totalFuel),
    },
  });

  console.table(
    result.teams.map(team => ({
      team: team.teamNumber,
      matches: team.matchesPlayed,
      autoOPR: round2(team.autoFuelOPR),
      teleopOPR: round2(team.teleopFuelOPR),
      totalOPR: round2(team.totalFuelOPR),
    }))
  );

  console.table(
    result.fitSamples.slice(0, 6).map((sample, index) => ({
      sample: index + 1,
      teams: sample.teams.join(','),
      observedTotal: round2(sample.observed.totalFuel),
      modeledTotal: round2(sample.modeled.totalFuel),
      residualTotal: round2(sample.residual.totalFuel),
    }))
  );
}

function createMatch(
  key: string,
  redTeams: number[],
  blueTeams: number[],
  autoByTeam: Record<number, number>,
  teleopByTeam: Record<number, number>,
  compLevel: string = 'qm'
): TBAMatchData {
  const redAuto = sumValues(autoByTeam, redTeams);
  const blueAuto = sumValues(autoByTeam, blueTeams);
  const redTeleop = sumValues(teleopByTeam, redTeams);
  const blueTeleop = sumValues(teleopByTeam, blueTeams);

  return {
    key,
    event_key: 'test2026',
    comp_level: compLevel,
    match_number: parseInt(key.replace(/\D/g, ''), 10) || 1,
    set_number: 1,
    alliances: {
      red: {
        score: redAuto + redTeleop,
        team_keys: redTeams.map(team => `frc${team}`),
        dq_team_keys: [],
        surrogate_team_keys: [],
      },
      blue: {
        score: blueAuto + blueTeleop,
        team_keys: blueTeams.map(team => `frc${team}`),
        dq_team_keys: [],
        surrogate_team_keys: [],
      },
    },
    score_breakdown: {
      red: {
        hubScore: {
          autoCount: redAuto,
          teleopCount: redTeleop,
          totalCount: redAuto + redTeleop,
        },
      },
      blue: {
        hubScore: {
          autoCount: blueAuto,
          teleopCount: blueTeleop,
          totalCount: blueAuto + blueTeleop,
        },
      },
    },
    winning_alliance: redAuto + redTeleop > blueAuto + blueTeleop ? 'red' : (blueAuto + blueTeleop > redAuto + redTeleop ? 'blue' : ''),
    time: 0,
    actual_time: 0,
    predicted_time: 0,
    post_result_time: 0,
  };
}

function offsetHubCounts(
  match: TBAMatchData,
  offsets: {
    red: { auto: number; teleop: number };
    blue: { auto: number; teleop: number };
  }
): TBAMatchData {
  const redAuto = (match.score_breakdown?.red?.hubScore?.autoCount ?? 0) + offsets.red.auto;
  const redTeleop = (match.score_breakdown?.red?.hubScore?.teleopCount ?? 0) + offsets.red.teleop;
  const blueAuto = (match.score_breakdown?.blue?.hubScore?.autoCount ?? 0) + offsets.blue.auto;
  const blueTeleop = (match.score_breakdown?.blue?.hubScore?.teleopCount ?? 0) + offsets.blue.teleop;

  return {
    ...match,
    alliances: {
      red: {
        ...match.alliances.red,
        score: redAuto + redTeleop,
      },
      blue: {
        ...match.alliances.blue,
        score: blueAuto + blueTeleop,
      },
    },
    score_breakdown: {
      red: {
        hubScore: {
          autoCount: redAuto,
          teleopCount: redTeleop,
          totalCount: redAuto + redTeleop,
        },
      },
      blue: {
        hubScore: {
          autoCount: blueAuto,
          teleopCount: blueTeleop,
          totalCount: blueAuto + blueTeleop,
        },
      },
    },
  };
}

function getAllianceObservedTotal(match: TBAMatchData, alliance: 'red' | 'blue'): number {
  const breakdown = (match.score_breakdown as {
    red?: { hubScore?: { totalCount?: number } };
    blue?: { hubScore?: { totalCount?: number } };
  } | null)?.[alliance]?.hubScore;

  return typeof breakdown?.totalCount === 'number' ? breakdown.totalCount : 0;
}

function getAllianceTeams(match: TBAMatchData, alliance: 'red' | 'blue'): number[] {
  return match.alliances[alliance].team_keys.map(key => parseInt(key.replace('frc', ''), 10));
}

function predictAllianceTotal(
  teamMap: Map<number, ReturnType<typeof calculateFuelOPR>['teams'][number]>,
  teams: number[]
): number {
  return teams.reduce((sum, team) => sum + (teamMap.get(team)?.totalFuelOPR ?? 0), 0);
}

function computeHoldoutRmse(
  trained: ReturnType<typeof calculateFuelOPR>,
  holdoutMatches: TBAMatchData[]
): number {
  const byTeam = new Map(trained.teams.map(team => [team.teamNumber, team]));
  const squaredErrors: number[] = [];

  for (const match of holdoutMatches) {
    for (const alliance of ['red', 'blue'] as const) {
      const observed = getAllianceObservedTotal(match, alliance);
      const teams = getAllianceTeams(match, alliance);
      const predicted = predictAllianceTotal(byTeam, teams);
      const error = observed - predicted;
      squaredErrors.push(error * error);
    }
  }

  if (squaredErrors.length === 0) {
    return 0;
  }

  return Math.sqrt(squaredErrors.reduce((sum, value) => sum + value, 0) / squaredErrors.length);
}

const REALISTIC_AUTO_BY_TEAM: Record<number, number> = {
  101: 46,
  102: 38,
  103: 34,
  104: 29,
  105: 24,
  106: 18,
};

const REALISTIC_TELEOP_BY_TEAM: Record<number, number> = {
  101: 180,
  102: 150,
  103: 132,
  104: 120,
  105: 98,
  106: 84,
};

const ALLIANCE_ROTATION: Array<{ red: number[]; blue: number[] }> = [
  { red: [101, 102, 103], blue: [104, 105, 106] },
  { red: [101, 104, 105], blue: [102, 103, 106] },
  { red: [101, 102, 106], blue: [103, 104, 105] },
  { red: [101, 103, 105], blue: [102, 104, 106] },
  { red: [101, 104, 106], blue: [102, 103, 105] },
  { red: [101, 102, 104], blue: [103, 105, 106] },
  { red: [101, 103, 106], blue: [102, 104, 105] },
  { red: [101, 105, 106], blue: [102, 103, 104] },
];

const NOISE_PATTERN = [
  { red: { auto: 1, teleop: -3 }, blue: { auto: -1, teleop: 4 } },
  { red: { auto: -2, teleop: 5 }, blue: { auto: 1, teleop: -4 } },
  { red: { auto: 2, teleop: -2 }, blue: { auto: -1, teleop: 3 } },
  { red: { auto: -1, teleop: 4 }, blue: { auto: 2, teleop: -3 } },
  { red: { auto: 1, teleop: 3 }, blue: { auto: -2, teleop: -2 } },
  { red: { auto: 0, teleop: -5 }, blue: { auto: 1, teleop: 6 } },
  { red: { auto: -1, teleop: 2 }, blue: { auto: 2, teleop: -1 } },
  { red: { auto: 2, teleop: -4 }, blue: { auto: -1, teleop: 3 } },
];

function buildNoisyRealisticMatches(matchCount: number, keyBase: string): TBAMatchData[] {
  return Array.from({ length: matchCount }, (_, index) => {
    const pair = ALLIANCE_ROTATION[index % ALLIANCE_ROTATION.length]!;
    const base = createMatch(
      `${keyBase}_qm${index + 1}`,
      pair.red,
      pair.blue,
      REALISTIC_AUTO_BY_TEAM,
      REALISTIC_TELEOP_BY_TEAM
    );

    const noise = NOISE_PATTERN[index % NOISE_PATTERN.length]!;
    return offsetHubCounts(base, noise);
  });
}

const HIGH_VARIANCE_AUTO_BY_TEAM: Record<number, number> = {
  201: 70,
  202: 58,
  203: 48,
  204: 38,
  205: 28,
  206: 20,
  207: 14,
  208: 8,
};

const HIGH_VARIANCE_TELEOP_BY_TEAM: Record<number, number> = {
  201: 250,
  202: 220,
  203: 190,
  204: 150,
  205: 105,
  206: 80,
  207: 55,
  208: 35,
};

const HIGH_VARIANCE_MATCHUPS: Array<{ red: number[]; blue: number[] }> = [
  { red: [201, 207, 208], blue: [202, 203, 204] },
  { red: [201, 205, 206], blue: [202, 207, 208] },
  { red: [201, 204, 208], blue: [203, 205, 206] },
  { red: [202, 205, 208], blue: [201, 203, 207] },
  { red: [201, 202, 208], blue: [203, 204, 205] },
  { red: [201, 206, 207], blue: [202, 204, 205] },
  { red: [203, 207, 208], blue: [201, 202, 206] },
  { red: [204, 205, 208], blue: [201, 202, 207] },
  { red: [201, 203, 206], blue: [202, 204, 208] },
  { red: [202, 206, 208], blue: [201, 203, 205] },
  { red: [201, 204, 207], blue: [202, 203, 206] },
  { red: [203, 205, 207], blue: [201, 202, 208] },
  { red: [201, 205, 208], blue: [202, 204, 206] },
  { red: [202, 203, 208], blue: [201, 204, 207] },
  { red: [201, 202, 205], blue: [203, 206, 208] },
  { red: [204, 206, 207], blue: [201, 202, 203] },
  { red: [201, 203, 208], blue: [202, 205, 207] },
  { red: [202, 204, 206], blue: [201, 205, 208] },
];

const HIGH_VARIANCE_NOISE_PATTERN = [
  { red: { auto: 2, teleop: -10 }, blue: { auto: -1, teleop: 12 } },
  { red: { auto: -2, teleop: 14 }, blue: { auto: 1, teleop: -11 } },
  { red: { auto: 1, teleop: -8 }, blue: { auto: -1, teleop: 9 } },
  { red: { auto: -1, teleop: 10 }, blue: { auto: 2, teleop: -7 } },
  { red: { auto: 0, teleop: -12 }, blue: { auto: 1, teleop: 11 } },
  { red: { auto: 2, teleop: 9 }, blue: { auto: -2, teleop: -8 } },
];

function buildHighVarianceStressMatches(matchCount: number, keyBase: string): TBAMatchData[] {
  return Array.from({ length: matchCount }, (_, index) => {
    const matchup = HIGH_VARIANCE_MATCHUPS[index % HIGH_VARIANCE_MATCHUPS.length]!;
    const base = createMatch(
      `${keyBase}_qm${index + 1}`,
      matchup.red,
      matchup.blue,
      HIGH_VARIANCE_AUTO_BY_TEAM,
      HIGH_VARIANCE_TELEOP_BY_TEAM
    );

    const patternedNoise = HIGH_VARIANCE_NOISE_PATTERN[index % HIGH_VARIANCE_NOISE_PATTERN.length]!;
    const withNoise = offsetHubCounts(base, patternedNoise);

    if (index === 4) {
      return offsetHubCounts(withNoise, {
        red: { auto: 6, teleop: 160 },
        blue: { auto: -4, teleop: -120 },
      });
    }

    return withNoise;
  });
}

function getTopNTeamsByTotalOpr(result: ReturnType<typeof calculateFuelOPR>, count: number): number[] {
  return [...result.teams]
    .sort((a, b) => b.totalFuelOPR - a.totalFuelOPR || a.teamNumber - b.teamNumber)
    .slice(0, count)
    .map(team => team.teamNumber);
}

function countOverlap(a: number[], b: number[]): number {
  const bSet = new Set(b);
  return a.reduce((acc, value) => acc + (bSet.has(value) ? 1 : 0), 0);
}

function simulateHybridLambdaTimeline(
  matches: TBAMatchData[],
  options: {
    startLambda?: number;
    minMatchesForSweep?: number;
    updateEveryMatches?: number;
    smoothing?: number;
    minLambda?: number;
    maxLambda?: number;
    lambdas?: number[];
  } = {}
): Array<{
  matchCount: number;
  mode: 'fixed' | 'carry' | 'swept';
  lambda: number;
  sweptLambda: number | null;
}> {
  const startLambda = options.startLambda ?? 0.3;
  const minMatchesForSweep = options.minMatchesForSweep ?? 7;
  const updateEveryMatches = options.updateEveryMatches ?? 3;
  const smoothing = options.smoothing ?? 0.35;
  const minLambda = options.minLambda ?? 0.01;
  const maxLambda = options.maxLambda ?? 0.75;
  const lambdas = options.lambdas ?? [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 0.75];

  let currentLambda = startLambda;
  const timeline: Array<{
    matchCount: number;
    mode: 'fixed' | 'carry' | 'swept';
    lambda: number;
    sweptLambda: number | null;
  }> = [];

  for (let matchCount = 1; matchCount <= matches.length; matchCount++) {
    const available = matches.slice(0, matchCount);

    if (matchCount < minMatchesForSweep) {
      timeline.push({
        matchCount,
        mode: 'fixed',
        lambda: currentLambda,
        sweptLambda: null,
      });
      continue;
    }

    const shouldSweep = (matchCount - minMatchesForSweep) % updateEveryMatches === 0;
    if (!shouldSweep) {
      timeline.push({
        matchCount,
        mode: 'carry',
        lambda: currentLambda,
        sweptLambda: null,
      });
      continue;
    }

    const sweep = sweepFuelOPRLambda(available, {
      includePlayoffs: false,
      lambdas,
    });

    const sweepChoice = sweep.bestLambda ?? currentLambda;
    const blended = currentLambda * (1 - smoothing) + sweepChoice * smoothing;
    const clamped = Math.max(minLambda, Math.min(maxLambda, blended));
    currentLambda = clamped;

    timeline.push({
      matchCount,
      mode: 'swept',
      lambda: currentLambda,
      sweptLambda: sweep.bestLambda,
    });
  }

  return timeline;
}

describe('calculateFuelOPR', () => {
  it('fits observed alliance fuel totals with stable OPR outputs', () => {
    const expectedAuto: Record<number, number> = {
      1: 20,
      2: 25,
      3: 15,
      4: 14,
      5: 13,
      6: 18,
    };

    const expectedTeleop: Record<number, number> = {
      1: 30,
      2: 20,
      3: 10,
      4: 40,
      5: 35,
      6: 25,
    };

    const matches: TBAMatchData[] = [
      createMatch('test2026_qm1', [1, 2, 3], [4, 5, 6], expectedAuto, expectedTeleop),
      createMatch('test2026_qm2', [1, 4, 5], [2, 3, 6], expectedAuto, expectedTeleop),
      createMatch('test2026_qm3', [1, 2, 6], [3, 4, 5], expectedAuto, expectedTeleop),
      createMatch('test2026_qm4', [1, 3, 5], [2, 4, 6], expectedAuto, expectedTeleop),
      createMatch('test2026_qm5', [1, 4, 6], [2, 3, 5], expectedAuto, expectedTeleop),
    ];

    const result = calculateFuelOPR(matches, {
      ridgeLambda: 1e-6,
      includePlayoffs: false,
    });

    maybeLogFitDiagnostics('Deterministic Fixture', result);

    expect(result.lambda).toBe(1e-6);
    expect(result.matchCount).toBe(5);
    expect(result.allianceSamples).toBe(10);
    expect(result.teams).toHaveLength(6);
    expect(result.fitSamples).toHaveLength(10);
    expect(result.fitSummary.sampleCount).toBe(10);

    const byTeam = new Map(result.teams.map(row => [row.teamNumber, row]));

    for (let team = 1; team <= 6; team++) {
      expect(byTeam.has(team)).toBe(true);
      expect(byTeam.get(team)?.matchesPlayed).toBe(5);
    }

    const alliances = [
      [1, 2, 3],
      [4, 5, 6],
      [1, 4, 5],
      [2, 3, 6],
      [1, 2, 6],
      [3, 4, 5],
      [1, 3, 5],
      [2, 4, 6],
      [1, 4, 6],
      [2, 3, 5],
    ];

    for (const alliance of alliances) {
      const expectedAutoTotal = sumValues(expectedAuto, alliance);
      const expectedTeleopTotal = sumValues(expectedTeleop, alliance);
      const expectedTotal = expectedAutoTotal + expectedTeleopTotal;

      const predictedAutoTotal = alliance.reduce((acc, team) => acc + (byTeam.get(team)?.autoFuelOPR ?? 0), 0);
      const predictedTeleopTotal = alliance.reduce((acc, team) => acc + (byTeam.get(team)?.teleopFuelOPR ?? 0), 0);
      const predictedTotal = alliance.reduce((acc, team) => acc + (byTeam.get(team)?.totalFuelOPR ?? 0), 0);

      expect(Math.abs(predictedAutoTotal - expectedAutoTotal)).toBeLessThan(0.01);
      expect(Math.abs(predictedTeleopTotal - expectedTeleopTotal)).toBeLessThan(0.01);
      expect(Math.abs(predictedTotal - expectedTotal)).toBeLessThan(0.02);
    }

    const tolerance = 1e-7;
    for (const row of result.teams) {
      expect(Math.abs(row.totalFuelOPR - (row.autoFuelOPR + row.teleopFuelOPR))).toBeLessThan(tolerance);
    }

    expect(result.fitSummary.mae.autoFuel).toBeLessThan(0.01);
    expect(result.fitSummary.mae.teleopFuel).toBeLessThan(0.01);
    expect(result.fitSummary.mae.totalFuel).toBeLessThan(0.02);

    expect((byTeam.get(2)?.autoFuelOPR ?? 0)).toBeGreaterThan(byTeam.get(5)?.autoFuelOPR ?? 0);
    expect((byTeam.get(4)?.teleopFuelOPR ?? 0)).toBeGreaterThan(byTeam.get(3)?.teleopFuelOPR ?? 0);
  });

  it('excludes playoff matches unless includePlayoffs is true', () => {
    const autoByTeam: Record<number, number> = {
      1: 8,
      2: 9,
      3: 10,
      4: 7,
      5: 6,
      6: 5,
    };

    const teleopByTeam: Record<number, number> = {
      1: 18,
      2: 19,
      3: 20,
      4: 17,
      5: 16,
      6: 15,
    };

    const qual = createMatch('test2026_qm4', [1, 2, 3], [4, 5, 6], autoByTeam, teleopByTeam, 'qm');
    const playoff = createMatch('test2026_sf1m1', [1, 4, 5], [2, 3, 6], autoByTeam, teleopByTeam, 'sf');

    const withoutPlayoffs = calculateFuelOPR([qual, playoff], {
      ridgeLambda: 0.75,
      includePlayoffs: false,
    });

    const withPlayoffs = calculateFuelOPR([qual, playoff], {
      ridgeLambda: 0.75,
      includePlayoffs: true,
    });

    expect(withoutPlayoffs.matchCount).toBe(1);
    expect(withoutPlayoffs.allianceSamples).toBe(2);

    expect(withPlayoffs.matchCount).toBe(2);
    expect(withPlayoffs.allianceSamples).toBe(4);
  });

  it('handles realistic fuel totals with accurate reconstruction', () => {
    const expectedAuto: Record<number, number> = {
      101: 46,
      102: 38,
      103: 34,
      104: 29,
      105: 24,
      106: 18,
    };

    const expectedTeleop: Record<number, number> = {
      101: 180,
      102: 150,
      103: 132,
      104: 120,
      105: 98,
      106: 84,
    };

    const matches: TBAMatchData[] = [
      createMatch('test2026_qm10', [101, 102, 103], [104, 105, 106], expectedAuto, expectedTeleop),
      createMatch('test2026_qm11', [101, 104, 105], [102, 103, 106], expectedAuto, expectedTeleop),
      createMatch('test2026_qm12', [101, 102, 106], [103, 104, 105], expectedAuto, expectedTeleop),
      createMatch('test2026_qm13', [101, 103, 105], [102, 104, 106], expectedAuto, expectedTeleop),
      createMatch('test2026_qm14', [101, 104, 106], [102, 103, 105], expectedAuto, expectedTeleop),
    ];

    const result = calculateFuelOPR(matches, {
      ridgeLambda: 1e-6,
      includePlayoffs: false,
    });

    maybeLogFitDiagnostics('Realistic Fixture', result);

    expect(result.matchCount).toBe(5);
    expect(result.allianceSamples).toBe(10);
    expect(result.teams).toHaveLength(6);
    expect(result.fitSamples).toHaveLength(10);
    expect(result.fitSummary.sampleCount).toBe(10);

    const byTeam = new Map(result.teams.map(row => [row.teamNumber, row]));
    const alliances = [
      [101, 102, 103],
      [104, 105, 106],
      [101, 104, 105],
      [102, 103, 106],
      [101, 102, 106],
      [103, 104, 105],
      [101, 103, 105],
      [102, 104, 106],
      [101, 104, 106],
      [102, 103, 105],
    ];

    for (const alliance of alliances) {
      const expectedAutoTotal = sumValues(expectedAuto, alliance);
      const expectedTeleopTotal = sumValues(expectedTeleop, alliance);
      const expectedTotal = expectedAutoTotal + expectedTeleopTotal;

      const predictedAutoTotal = alliance.reduce((acc, team) => acc + (byTeam.get(team)?.autoFuelOPR ?? 0), 0);
      const predictedTeleopTotal = alliance.reduce((acc, team) => acc + (byTeam.get(team)?.teleopFuelOPR ?? 0), 0);
      const predictedTotal = alliance.reduce((acc, team) => acc + (byTeam.get(team)?.totalFuelOPR ?? 0), 0);

      expect(Math.abs(predictedAutoTotal - expectedAutoTotal)).toBeLessThan(0.05);
      expect(Math.abs(predictedTeleopTotal - expectedTeleopTotal)).toBeLessThan(0.05);
      expect(Math.abs(predictedTotal - expectedTotal)).toBeLessThan(0.1);
    }

    expect((byTeam.get(101)?.totalFuelOPR ?? 0)).toBeGreaterThan(byTeam.get(106)?.totalFuelOPR ?? 0);
    expect((byTeam.get(102)?.teleopFuelOPR ?? 0)).toBeGreaterThan(byTeam.get(105)?.teleopFuelOPR ?? 0);

    expect(result.fitSummary.mae.autoFuel).toBeLessThan(0.05);
    expect(result.fitSummary.mae.teleopFuel).toBeLessThan(0.05);
    expect(result.fitSummary.mae.totalFuel).toBeLessThan(0.1);
  });

  it('produces bounded non-zero residuals under noisy observations', () => {
    const expectedAuto: Record<number, number> = {
      101: 46,
      102: 38,
      103: 34,
      104: 29,
      105: 24,
      106: 18,
    };

    const expectedTeleop: Record<number, number> = {
      101: 180,
      102: 150,
      103: 132,
      104: 120,
      105: 98,
      106: 84,
    };

    const baseMatches: TBAMatchData[] = [
      createMatch('test2026_qm20', [101, 102, 103], [104, 105, 106], expectedAuto, expectedTeleop),
      createMatch('test2026_qm21', [101, 104, 105], [102, 103, 106], expectedAuto, expectedTeleop),
      createMatch('test2026_qm22', [101, 102, 106], [103, 104, 105], expectedAuto, expectedTeleop),
      createMatch('test2026_qm23', [101, 103, 105], [102, 104, 106], expectedAuto, expectedTeleop),
      createMatch('test2026_qm24', [101, 104, 106], [102, 103, 105], expectedAuto, expectedTeleop),
    ];

    const noisyMatches = [
      offsetHubCounts(baseMatches[0], { red: { auto: 1, teleop: -3 }, blue: { auto: -1, teleop: 4 } }),
      offsetHubCounts(baseMatches[1], { red: { auto: -2, teleop: 5 }, blue: { auto: 1, teleop: -4 } }),
      offsetHubCounts(baseMatches[2], { red: { auto: 2, teleop: -2 }, blue: { auto: -1, teleop: 3 } }),
      offsetHubCounts(baseMatches[3], { red: { auto: -1, teleop: 4 }, blue: { auto: 2, teleop: -3 } }),
      offsetHubCounts(baseMatches[4], { red: { auto: 1, teleop: 3 }, blue: { auto: -2, teleop: -2 } }),
    ];

    const result = calculateFuelOPR(noisyMatches, {
      ridgeLambda: 0.75,
      includePlayoffs: false,
    });

    maybeLogFitDiagnostics('Noisy Realistic Fixture', result);

    expect(result.matchCount).toBe(5);
    expect(result.allianceSamples).toBe(10);
    expect(result.fitSummary.sampleCount).toBe(10);

    expect(result.fitSummary.mae.totalFuel).toBeGreaterThan(0);
    expect(result.fitSummary.rmse.totalFuel).toBeGreaterThan(0);

    expect(result.fitSummary.mae.autoFuel).toBeLessThan(6);
    expect(result.fitSummary.mae.teleopFuel).toBeLessThan(25);
    expect(result.fitSummary.mae.totalFuel).toBeLessThan(30);

    const byTeam = new Map(result.teams.map(row => [row.teamNumber, row]));
    expect((byTeam.get(101)?.totalFuelOPR ?? 0)).toBeGreaterThan(byTeam.get(106)?.totalFuelOPR ?? 0);
    expect((byTeam.get(102)?.teleopFuelOPR ?? 0)).toBeGreaterThan(byTeam.get(105)?.teleopFuelOPR ?? 0);
  });

  it('sweeps lambda and finds lower holdout error than strong regularization', () => {
    const expectedAuto: Record<number, number> = {
      101: 46,
      102: 38,
      103: 34,
      104: 29,
      105: 24,
      106: 18,
    };

    const expectedTeleop: Record<number, number> = {
      101: 180,
      102: 150,
      103: 132,
      104: 120,
      105: 98,
      106: 84,
    };

    const baseMatches: TBAMatchData[] = [
      createMatch('test2026_qm30', [101, 102, 103], [104, 105, 106], expectedAuto, expectedTeleop),
      createMatch('test2026_qm31', [101, 104, 105], [102, 103, 106], expectedAuto, expectedTeleop),
      createMatch('test2026_qm32', [101, 102, 106], [103, 104, 105], expectedAuto, expectedTeleop),
      createMatch('test2026_qm33', [101, 103, 105], [102, 104, 106], expectedAuto, expectedTeleop),
      createMatch('test2026_qm34', [101, 104, 106], [102, 103, 105], expectedAuto, expectedTeleop),
      createMatch('test2026_qm35', [101, 102, 104], [103, 105, 106], expectedAuto, expectedTeleop),
      createMatch('test2026_qm36', [101, 103, 106], [102, 104, 105], expectedAuto, expectedTeleop),
      createMatch('test2026_qm37', [101, 105, 106], [102, 103, 104], expectedAuto, expectedTeleop),
    ];

    const noisyMatches = [
      offsetHubCounts(baseMatches[0], { red: { auto: 1, teleop: -3 }, blue: { auto: -1, teleop: 4 } }),
      offsetHubCounts(baseMatches[1], { red: { auto: -2, teleop: 5 }, blue: { auto: 1, teleop: -4 } }),
      offsetHubCounts(baseMatches[2], { red: { auto: 2, teleop: -2 }, blue: { auto: -1, teleop: 3 } }),
      offsetHubCounts(baseMatches[3], { red: { auto: -1, teleop: 4 }, blue: { auto: 2, teleop: -3 } }),
      offsetHubCounts(baseMatches[4], { red: { auto: 1, teleop: 3 }, blue: { auto: -2, teleop: -2 } }),
      offsetHubCounts(baseMatches[5], { red: { auto: 0, teleop: -5 }, blue: { auto: 1, teleop: 6 } }),
      offsetHubCounts(baseMatches[6], { red: { auto: -1, teleop: 2 }, blue: { auto: 2, teleop: -1 } }),
      offsetHubCounts(baseMatches[7], { red: { auto: 2, teleop: -4 }, blue: { auto: -1, teleop: 3 } }),
    ];

    const trainMatches = noisyMatches.slice(0, 6);
    const holdoutMatches = noisyMatches.slice(6);
    const lambdas = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 0.75, 1.0];

    const sweep = lambdas.map(lambda => {
      const trained = calculateFuelOPR(trainMatches, {
        ridgeLambda: lambda,
        includePlayoffs: false,
      });

      return {
        lambda,
        holdoutRmse: computeHoldoutRmse(trained, holdoutMatches),
      };
    });

    if (process.env.VITEST_OPR_DEBUG === '1') {
      console.log('\n[OPR DEBUG] Lambda sweep (holdout RMSE)');
      console.table(
        sweep.map(row => ({
          lambda: row.lambda,
          holdoutRmse: Math.round(row.holdoutRmse * 100) / 100,
        }))
      );
    }

    const best = sweep.reduce((bestSoFar, row) =>
      row.holdoutRmse < bestSoFar.holdoutRmse ? row : bestSoFar
    );

    const atStrongRegularization = sweep.find(row => row.lambda === 0.75);
    expect(atStrongRegularization).toBeDefined();
    expect(best.holdoutRmse).toBeLessThan((atStrongRegularization?.holdoutRmse ?? Number.POSITIVE_INFINITY));
    expect(best.lambda).toBeLessThan(0.75);
  });

  it('compares lambda behavior at 3, 7, and 12 matches', () => {
    const lambdas = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 0.75, 1.0];
    const scenarios = [3, 7, 12] as const;

    const scenarioResults = scenarios.map(matchCount => {
      const noisyMatches = buildNoisyRealisticMatches(matchCount, `size${matchCount}`);
      const holdoutCount = matchCount <= 7 ? 2 : 3;
      const trainMatches = noisyMatches.slice(0, Math.max(1, noisyMatches.length - holdoutCount));
      const holdoutMatches = noisyMatches.slice(Math.max(1, noisyMatches.length - holdoutCount));

      const sweep = lambdas.map(lambda => {
        const trained = calculateFuelOPR(trainMatches, {
          ridgeLambda: lambda,
          includePlayoffs: false,
        });

        return {
          lambda,
          holdoutRmse: computeHoldoutRmse(trained, holdoutMatches),
        };
      });

      const best = sweep.reduce((bestSoFar, row) =>
        row.holdoutRmse < bestSoFar.holdoutRmse ? row : bestSoFar
      );

      const strong = sweep.find(row => row.lambda === 0.75);

      return {
        matchCount,
        holdoutCount,
        sweep,
        best,
        strongRmse: strong?.holdoutRmse ?? Number.POSITIVE_INFINITY,
      };
    });

    if (process.env.VITEST_OPR_DEBUG === '1') {
      console.log('\n[OPR DEBUG] Dataset size sweep (best lambda by holdout RMSE)');
      console.table(
        scenarioResults.map(result => ({
          matches: result.matchCount,
          holdoutMatches: result.holdoutCount,
          bestLambda: result.best.lambda,
          bestRmse: Math.round(result.best.holdoutRmse * 100) / 100,
          rmseAt075: Math.round(result.strongRmse * 100) / 100,
        }))
      );
    }

    for (const result of scenarioResults) {
      expect(result.best.holdoutRmse).toBeLessThan(result.strongRmse);
      expect(result.best.lambda).toBeLessThan(0.75);
      expect(result.best.lambda).toBeGreaterThanOrEqual(0.001);
      expect(result.best.lambda).toBeLessThanOrEqual(1.0);
    }
  });

  it('sweeps lambda from helper on demo-style cached matches', () => {
    const matches = buildNoisyRealisticMatches(12, 'demoSweep');
    const sweep = sweepFuelOPRLambda(matches, {
      includePlayoffs: false,
      lambdas: [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 0.75, 1.0],
      holdoutMatchCount: 3,
    });

    if (process.env.VITEST_OPR_DEBUG === '1') {
      console.log('\n[OPR DEBUG] Helper lambda sweep (demo-style matches)');
      console.table(
        sweep.rows.map(row => ({
          lambda: row.lambda,
          holdoutRmse: Math.round(row.holdoutRmse * 100) / 100,
        }))
      );
      console.log('[OPR DEBUG] Helper best lambda:', sweep.bestLambda);
    }

    expect(sweep.trainMatchCount).toBe(9);
    expect(sweep.holdoutMatchCount).toBe(3);
    expect(sweep.rows).toHaveLength(8);
    expect(sweep.bestLambda).not.toBeNull();

    const atStrongRegularization = sweep.rows.find(row => row.lambda === 0.75);
    const bestRow = sweep.rows.find(row => row.lambda === sweep.bestLambda);

    expect(atStrongRegularization).toBeDefined();
    expect(bestRow).toBeDefined();
    expect((bestRow?.holdoutRmse ?? Number.POSITIVE_INFINITY)).toBeLessThan(atStrongRegularization?.holdoutRmse ?? 0);
  });

  it('handles high-variance alliances and outlier scouting with stable rankings', () => {
    const matches = buildHighVarianceStressMatches(18, 'stress');
    const trainMatches = matches.slice(0, 12);
    const holdoutMatches = matches.slice(12);
    const lambdas = [0.001, 0.01, 0.03, 0.1, 0.3, 0.75];
    const trueTop4 = [201, 202, 203, 204];

    const rows = lambdas.map(lambda => {
      const trained = calculateFuelOPR(trainMatches, {
        ridgeLambda: lambda,
        includePlayoffs: false,
      });

      return {
        lambda,
        holdoutRmse: computeHoldoutRmse(trained, holdoutMatches),
        top4Overlap: countOverlap(getTopNTeamsByTotalOpr(trained, 4), trueTop4),
      };
    });

    const best = rows.reduce((bestSoFar, row) =>
      row.holdoutRmse < bestSoFar.holdoutRmse ? row : bestSoFar
    );

    if (process.env.VITEST_OPR_DEBUG === '1') {
      console.log('\n[OPR DEBUG] High-variance stress sweep');
      console.table(
        rows.map(row => ({
          lambda: row.lambda,
          holdoutRmse: Math.round(row.holdoutRmse * 100) / 100,
          top4Overlap: row.top4Overlap,
        }))
      );
      console.log('[OPR DEBUG] High-variance best row:', {
        lambda: best.lambda,
        holdoutRmse: Math.round(best.holdoutRmse * 100) / 100,
        top4Overlap: best.top4Overlap,
      });
    }

    expect(best.lambda).toBeGreaterThan(0.001);
    expect(best.lambda).toBeLessThanOrEqual(0.3);
    expect(best.top4Overlap).toBeGreaterThanOrEqual(3);

    for (const row of rows) {
      expect(row.top4Overlap).toBeGreaterThanOrEqual(2);
    }

    const lowLambda = rows.find(row => row.lambda === 0.001);
    const heavyLambda = rows.find(row => row.lambda === 0.75);
    expect(lowLambda).toBeDefined();
    expect(heavyLambda).toBeDefined();
    expect((best.holdoutRmse)).toBeLessThan((heavyLambda?.holdoutRmse ?? Number.POSITIVE_INFINITY));
  });

  it('simulates a hybrid lambda timeline across event progression', () => {
    const matches = buildHighVarianceStressMatches(18, 'timeline');
    const timeline = simulateHybridLambdaTimeline(matches, {
      startLambda: 0.3,
      minMatchesForSweep: 7,
      updateEveryMatches: 3,
      smoothing: 0.35,
      minLambda: 0.01,
      maxLambda: 0.75,
      lambdas: [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 0.75],
    });

    if (process.env.VITEST_OPR_DEBUG === '1') {
      console.log('\n[OPR DEBUG] Hybrid lambda timeline');
      console.table(
        timeline.map(row => ({
          matches: row.matchCount,
          mode: row.mode,
          lambda: Math.round(row.lambda * 1000) / 1000,
          sweptLambda: row.sweptLambda,
        }))
      );
    }

    expect(timeline).toHaveLength(18);

    const at3 = timeline.find(row => row.matchCount === 3);
    const at7 = timeline.find(row => row.matchCount === 7);
    const at12 = timeline.find(row => row.matchCount === 12);
    const at18 = timeline.find(row => row.matchCount === 18);

    expect(at3?.mode).toBe('fixed');
    expect(at7?.mode).toBe('swept');
    expect(at12?.mode).toBe('carry');
    expect(at18?.mode).toBe('carry');

    for (const row of timeline) {
      expect(row.lambda).toBeGreaterThanOrEqual(0.01);
      expect(row.lambda).toBeLessThanOrEqual(0.75);
    }

    const sweepRows = timeline.filter(row => row.mode === 'swept');
    expect(sweepRows.length).toBeGreaterThanOrEqual(2);
    expect(sweepRows.some(row => row.sweptLambda !== null)).toBe(true);

    const startingLambda = timeline[0]?.lambda ?? 0.3;
    const endingLambda = timeline[timeline.length - 1]?.lambda ?? startingLambda;
    expect(Math.abs(endingLambda - startingLambda)).toBeGreaterThan(0.005);
  });

  it('uses production hybrid selector with bounded adaptive lambda', () => {
    const matches = buildHighVarianceStressMatches(18, 'hybridProd');
    const hybrid = calculateFuelOPRHybrid(matches, {
      includePlayoffs: false,
      fallbackLambda: 0.3,
      minMatchesForSweep: 7,
      updateEveryMatches: 3,
      smoothing: 0.35,
      minLambda: 0.01,
      maxLambda: 0.75,
      lambdas: [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 0.75],
    });

    if (process.env.VITEST_OPR_DEBUG === '1') {
      console.log('\n[OPR DEBUG] Production hybrid selector');
      console.log('[OPR DEBUG] Selected lambda/mode:', {
        lambda: Math.round(hybrid.selectedLambda * 1000) / 1000,
        mode: hybrid.mode,
        timelinePoints: hybrid.timeline.length,
      });
    }

    expect(hybrid.opr.matchCount).toBeGreaterThanOrEqual(12);
    expect(hybrid.selectedLambda).toBeGreaterThanOrEqual(0.01);
    expect(hybrid.selectedLambda).toBeLessThanOrEqual(0.75);
    expect(hybrid.timeline).toHaveLength(18);
    expect(hybrid.latestSweep).not.toBeNull();
  });
});
