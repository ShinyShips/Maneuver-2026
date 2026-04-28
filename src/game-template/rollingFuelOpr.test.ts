import { describe, expect, it } from 'vitest';
import type { TBAMatchData } from '@/core/lib/tbaMatchData';
import { calculateFuelOPR, calculateFuelOPRHybrid } from './fuelOpr';
import { calculateRollingFuelMoprRatings } from './rollingFuelOpr';

function createMatch(
    key: string,
    matchNumber: number,
    redTeams: number[],
    blueTeams: number[],
    redAutoFuel: number,
    redTeleopFuel: number,
    blueAutoFuel: number,
    blueTeleopFuel: number,
): TBAMatchData {
    return {
        key,
        event_key: '2026test',
        comp_level: 'qm',
        match_number: matchNumber,
        set_number: 1,
        alliances: {
            red: {
                score: redAutoFuel + redTeleopFuel,
                team_keys: redTeams.map(team => `frc${team}`),
                dq_team_keys: [],
                surrogate_team_keys: [],
            },
            blue: {
                score: blueAutoFuel + blueTeleopFuel,
                team_keys: blueTeams.map(team => `frc${team}`),
                dq_team_keys: [],
                surrogate_team_keys: [],
            },
        },
        score_breakdown: {
            red: {
                hubScore: {
                    autoCount: redAutoFuel,
                    teleopCount: redTeleopFuel,
                    totalCount: redAutoFuel + redTeleopFuel,
                },
            },
            blue: {
                hubScore: {
                    autoCount: blueAutoFuel,
                    teleopCount: blueTeleopFuel,
                    totalCount: blueAutoFuel + blueTeleopFuel,
                },
            },
        },
        winning_alliance: redAutoFuel + redTeleopFuel > blueAutoFuel + blueTeleopFuel ? 'red' : 'blue',
        time: 0,
        actual_time: 0,
        predicted_time: 0,
        post_result_time: 0,
    };
}

describe('calculateRollingFuelMoprRatings', () => {
    it('ends on the same fixed and adaptive totals as the validation-page solvers', () => {
        const matches: TBAMatchData[] = [
            createMatch('2026test_qm1', 1, [1, 2, 3], [4, 5, 6], 12, 18, 10, 14),
            createMatch('2026test_qm2', 2, [1, 4, 5], [2, 3, 6], 8, 16, 15, 21),
            createMatch('2026test_qm3', 3, [1, 2, 6], [3, 4, 5], 14, 20, 9, 15),
        ];

        const rolling = calculateRollingFuelMoprRatings(matches, {
            includePlayoffs: true,
            fixedLambda: 0.3,
        });
        const fixed = calculateFuelOPR(matches, {
            ridgeLambda: 0.3,
            includePlayoffs: true,
            nonNegative: false,
        });
        const adaptive = calculateFuelOPRHybrid(matches, {
            includePlayoffs: true,
            nonNegative: false,
            fallbackLambda: 0.3,
        });

        const finalRollingTeam1 = rolling.get('2026test_qm3::1');
        const fixedTeam1 = fixed.teams.find(team => team.teamNumber === 1);
        const adaptiveTeam1 = adaptive.opr.teams.find(team => team.teamNumber === 1);

        expect(finalRollingTeam1).toBeDefined();
        expect(fixedTeam1).toBeDefined();
        expect(adaptiveTeam1).toBeDefined();

        expect(finalRollingTeam1?.matchesProcessed).toBe(3);
        expect(finalRollingTeam1?.fixedTotalMopr).toBeCloseTo(fixedTeam1?.totalFuelOPR ?? 0, 1);
        expect(finalRollingTeam1?.adaptiveTotalMopr).toBeCloseTo(adaptiveTeam1?.totalFuelOPR ?? 0, 1);
    });
});