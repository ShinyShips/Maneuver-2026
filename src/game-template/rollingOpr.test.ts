import { describe, expect, it } from 'vitest';
import type { TBAMatchData } from '@/core/lib/tbaMatchData';
import { calculateRollingTotalRatings } from './rollingOpr';

function createMatch(
    key: string,
    matchNumber: number,
    redTeams: number[],
    blueTeams: number[],
    redScore: number,
    blueScore: number,
    redCorrectedTotal: number,
    blueCorrectedTotal: number,
): TBAMatchData {
    return {
        key,
        event_key: '2026test',
        comp_level: 'qm',
        match_number: matchNumber,
        set_number: 1,
        alliances: {
            red: {
                score: redScore,
                team_keys: redTeams.map(team => `frc${team}`),
                dq_team_keys: [],
                surrogate_team_keys: [],
            },
            blue: {
                score: blueScore,
                team_keys: blueTeams.map(team => `frc${team}`),
                dq_team_keys: [],
                surrogate_team_keys: [],
            },
        },
        score_breakdown: {
            red: {
                totalPoints: redCorrectedTotal,
            },
            blue: {
                totalPoints: blueCorrectedTotal,
            },
        },
        winning_alliance: redScore > blueScore ? 'red' : (blueScore > redScore ? 'blue' : ''),
        time: 0,
        actual_time: 0,
        predicted_time: 0,
        post_result_time: 0,
    };
}

describe('calculateRollingTotalRatings', () => {
    it('builds rolling values for each played match and uses corrected totals for cOPR', () => {
        const matches: TBAMatchData[] = [
            createMatch('2026test_qm1', 1, [1, 2, 3], [4, 5, 6], 30, 24, 27, 21),
            createMatch('2026test_qm2', 2, [1, 4, 5], [2, 3, 6], 18, 36, 16, 33),
        ];

        const ratings = calculateRollingTotalRatings(matches, { includePlayoffs: true });

        const firstMatchTeam1 = ratings.get('2026test_qm1::1');
        const secondMatchTeam1 = ratings.get('2026test_qm2::1');
        const secondMatchTeam6 = ratings.get('2026test_qm2::6');

        expect(firstMatchTeam1).toBeDefined();
        expect(secondMatchTeam1).toBeDefined();
        expect(secondMatchTeam6).toBeDefined();

        expect(firstMatchTeam1?.matchesProcessed).toBe(1);
        expect(secondMatchTeam1?.matchesProcessed).toBe(2);

        expect(firstMatchTeam1?.oprTotalPoints).not.toBe(firstMatchTeam1?.coprTotalPoints);
        expect(secondMatchTeam1?.oprTotalPoints).not.toBe(secondMatchTeam1?.coprTotalPoints);
        expect(secondMatchTeam6?.oprTotalPoints).toBeGreaterThan(0);
        expect(secondMatchTeam6?.coprTotalPoints).toBeGreaterThan(0);
    });
});