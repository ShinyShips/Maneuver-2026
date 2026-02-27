import {
  getAllPredictionsForMatch,
  markPredictionAsVerified,
  STAKE_VALUES,
  updateScoutWithPredictionResult,
} from '@/db';
import type { TBAMatchData } from '@/core/lib/tbaMatchData';
import type { TBAMatch } from '@/core/lib/tba';

export interface PredictionRewardResult {
  matchNumber: number;
  winner: 'red' | 'blue' | 'tie';
  predictionsCount: number;
  correctPredictions: number;
  stakesAwarded: number;
}

export interface PredictionRewardSummary {
  processedMatchCount: number;
  processedPredictionCount: number;
  correctPredictionCount: number;
  totalStakesAwarded: number;
}

export interface ProcessPredictionRewardsOptions {
  eventKey?: string;
  onlyFinalResults?: boolean;
  includeZeroResultMatches?: boolean;
}

type MatchLike = Pick<TBAMatchData, 'key' | 'event_key' | 'match_number' | 'winning_alliance' | 'post_result_time'> & {
  alliances?: {
    red?: { score?: number };
    blue?: { score?: number };
  };
};

const getMatchWinner = (match: MatchLike): 'red' | 'blue' | 'tie' => {
  if (match.winning_alliance === 'red') return 'red';
  if (match.winning_alliance === 'blue') return 'blue';

  const redScore = typeof match.alliances?.red?.score === 'number' ? match.alliances.red.score : null;
  const blueScore = typeof match.alliances?.blue?.score === 'number' ? match.alliances.blue.score : null;

  if (redScore === null || blueScore === null) return 'tie';
  if (redScore > blueScore) return 'red';
  if (blueScore > redScore) return 'blue';
  return 'tie';
};

const hasFinalResult = (match: MatchLike): boolean => {
  if (match.winning_alliance === 'red' || match.winning_alliance === 'blue') return true;

  const redScore = typeof match.alliances?.red?.score === 'number' ? match.alliances.red.score : -1;
  const blueScore = typeof match.alliances?.blue?.score === 'number' ? match.alliances.blue.score : -1;
  if (redScore >= 0 && blueScore >= 0) return true;

  return typeof match.post_result_time === 'number' && match.post_result_time > 0;
};

export async function processPredictionRewardsForMatches(
  matches: Array<TBAMatch | TBAMatchData>,
  options: ProcessPredictionRewardsOptions = {}
): Promise<{ results: PredictionRewardResult[]; summary: PredictionRewardSummary }> {
  const {
    eventKey,
    onlyFinalResults = true,
    includeZeroResultMatches = false,
  } = options;

  const normalizedMatches: MatchLike[] = [];
  const seenMatchNumbers = new Set<number>();

  for (const match of matches) {
    if (!match || typeof match.match_number !== 'number') continue;
    if (seenMatchNumbers.has(match.match_number)) continue;

    seenMatchNumbers.add(match.match_number);
    normalizedMatches.push(match as MatchLike);
  }

  const results: PredictionRewardResult[] = [];
  let processedPredictionCount = 0;
  let correctPredictionCount = 0;
  let totalStakesAwarded = 0;

  for (const match of normalizedMatches) {
    const effectiveEventKey = eventKey || match.event_key;
    if (!effectiveEventKey) continue;
    if (onlyFinalResults && !hasFinalResult(match)) continue;

    const winner = getMatchWinner(match);
    const predictions = await getAllPredictionsForMatch(effectiveEventKey, match.match_number);
    const unverifiedPredictions = predictions.filter((prediction) => !prediction.verified);

    let matchCorrectPredictions = 0;
    let matchStakesAwarded = 0;

    for (const prediction of unverifiedPredictions) {
      const isCorrect = winner !== 'tie' && prediction.predictedWinner === winner;

      if (isCorrect) {
        matchCorrectPredictions += 1;
      }

      const stakesAwarded = await updateScoutWithPredictionResult(
        prediction.scoutName,
        isCorrect,
        STAKE_VALUES.CORRECT_PREDICTION,
        effectiveEventKey,
        match.match_number
      );

      matchStakesAwarded += stakesAwarded;
      await markPredictionAsVerified(prediction.id);
    }

    if (includeZeroResultMatches || unverifiedPredictions.length > 0) {
      results.push({
        matchNumber: match.match_number,
        winner,
        predictionsCount: unverifiedPredictions.length,
        correctPredictions: matchCorrectPredictions,
        stakesAwarded: matchStakesAwarded,
      });
    }

    processedPredictionCount += unverifiedPredictions.length;
    correctPredictionCount += matchCorrectPredictions;
    totalStakesAwarded += matchStakesAwarded;
  }

  return {
    results,
    summary: {
      processedMatchCount: results.length,
      processedPredictionCount,
      correctPredictionCount,
      totalStakesAwarded,
    },
  };
}
