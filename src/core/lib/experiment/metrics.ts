import {
  AUTO_START_LOCATION_KEYS,
  SHOT_GRID_CELL_COUNT,
  SHOT_GRID_COLS,
  SHOT_GRID_ROW_BOUNDARIES,
  SHOT_GRID_SHOOTABLE_ROWS,
} from './constants';
import { FIELD_ELEMENTS } from '@/game-template/components/field-map/constants';
import type { AutoStartLocationValue, NormalizedExperimentMetrics, PhaseMetrics, ComparisonSummary, MetricComparison } from './types';

const createEmptyPhaseMetrics = (): PhaseMetrics => ({
  actionsTotal: 0,
  scoreActions: 0,
  autoStartLocation: 'none',
  shotGridCounts: Array.from({ length: SHOT_GRID_CELL_COUNT }, () => 0),
  passGridCounts: Array.from({ length: SHOT_GRID_CELL_COUNT }, () => 0),
  collectGridCounts: Array.from({ length: SHOT_GRID_CELL_COUNT }, () => 0),
  collectActions: 0,
  collectFromDepotActions: 0,
  collectFromOutpostActions: 0,
  passActions: 0,
  climbActions: 'no',
  climbResult: 'none',
  climbLocation: 'none',
  foulActions: 0,
  defenseActions: 0,
  stealActions: 0,
  fuelScored: 0,
  fuelCollected: 0,
  fuelPassed: 0,
  zoneAllianceActions: 0,
  zoneNeutralActions: 0,
  zoneOpponentActions: 0,
});

export const createEmptyMetrics = (): NormalizedExperimentMetrics => ({
  auto: createEmptyPhaseMetrics(),
  teleop: createEmptyPhaseMetrics(),
});

const getGridCellIndex = (position: { x: number; y: number } | undefined, options?: { shootableOnly?: boolean }) => {
  if (!position) return null;

  const x = Math.min(0.999999, Math.max(0, position.x));
  const y = Math.min(0.999999, Math.max(0, position.y));

  const col = Math.floor(x * SHOT_GRID_COLS);
  const row = SHOT_GRID_ROW_BOUNDARIES.findIndex((boundary) => y < boundary);

  if (row < 0) {
    return null;
  }

  if (options?.shootableOnly && !SHOT_GRID_SHOOTABLE_ROWS.includes(row as (typeof SHOT_GRID_SHOOTABLE_ROWS)[number])) {
    return null;
  }

  const index = row * SHOT_GRID_COLS + col;

  if (index < 0 || index >= SHOT_GRID_CELL_COUNT) return null;
  return index;
};

const resolveAutoStartLocation = (position?: { x: number; y: number }): AutoStartLocationValue => {
  if (!position) return 'none';

  let closest: AutoStartLocationValue = 'none';
  let closestDistance = Number.POSITIVE_INFINITY;

  AUTO_START_LOCATION_KEYS.forEach((startKey) => {
    const element = FIELD_ELEMENTS[startKey];
    if (!element) return;

    const dx = position.x - element.x;
    const dy = position.y - element.y;
    const squaredDistance = dx * dx + dy * dy;

    if (squaredDistance < closestDistance) {
      closestDistance = squaredDistance;
      closest = startKey;
    }
  });

  return closest;
};

const resolveAutoStartLocationFromAction = (action: Record<string, any>): AutoStartLocationValue => {
  const actionKey = String(action.action || '');
  if (AUTO_START_LOCATION_KEYS.includes(actionKey as (typeof AUTO_START_LOCATION_KEYS)[number])) {
    return actionKey as AutoStartLocationValue;
  }

  return resolveAutoStartLocation(action.position);
};

export const buildMetricsFromActions = (params: {
  autoActions: Array<Record<string, any>>;
  teleopActions: Array<Record<string, any>>;
}): NormalizedExperimentMetrics => {
  const metrics = createEmptyMetrics();

  const processActionList = (
    phase: 'auto' | 'teleop',
    actions: Array<Record<string, any>>,
    phaseMetrics: PhaseMetrics,
  ) => {
    actions.forEach((action) => {
      phaseMetrics.actionsTotal += 1;

      const actionType = String(action.type || '');
      const fuelDelta = Number(action.fuelDelta || 0);

      if (phase === 'auto' && actionType === 'start') {
        phaseMetrics.autoStartLocation = resolveAutoStartLocationFromAction(action);
        return;
      }

      if (actionType === 'score') {
        phaseMetrics.scoreActions += 1;
        phaseMetrics.fuelScored += Math.abs(fuelDelta);
        const shotGridIndex = getGridCellIndex(action.position, { shootableOnly: true });
        if (shotGridIndex !== null) {
          phaseMetrics.shotGridCounts[shotGridIndex] = (phaseMetrics.shotGridCounts[shotGridIndex] ?? 0) + 1;
        }
      } else if (actionType === 'collect') {
        if (phase === 'auto') {
          phaseMetrics.collectActions += 1;
          const collectGridIndex = getGridCellIndex(action.position);
          if (collectGridIndex !== null) {
            phaseMetrics.collectGridCounts[collectGridIndex] = (phaseMetrics.collectGridCounts[collectGridIndex] ?? 0) + 1;
          }
        }
      }
    });
  };

  processActionList('auto', params.autoActions, metrics.auto);
  processActionList('teleop', params.teleopActions, metrics.teleop);

  return metrics;
};

const normalizeShotGridCounts = (counts: number[] | undefined) =>
  Array.from({ length: SHOT_GRID_CELL_COUNT }, (_, index) => counts?.[index] ?? 0);

const normalizeCollectGridCounts = (counts: number[] | undefined) =>
  Array.from({ length: SHOT_GRID_CELL_COUNT }, (_, index) => counts?.[index] ?? 0);

const flattenMetrics = (metrics: NormalizedExperimentMetrics): Record<string, number> => ({
  auto_score_actions: metrics.auto.scoreActions,
  ...Object.fromEntries(AUTO_START_LOCATION_KEYS.map((key) => [`auto_start_location_${key}`, metrics.auto.autoStartLocation === key ? 1 : 0])),
  ...Object.fromEntries(normalizeShotGridCounts(metrics.auto.shotGridCounts).map((value, index) => [`auto_shot_cell_${index}`, value])),
  ...Object.fromEntries(normalizeCollectGridCounts(metrics.auto.collectGridCounts).map((value, index) => [`auto_collect_cell_${index}`, value])),
  auto_collect_actions: metrics.auto.collectActions,
  auto_fuel_scored: metrics.auto.fuelScored,
  teleop_score_actions: metrics.teleop.scoreActions,
  ...Object.fromEntries(normalizeShotGridCounts(metrics.teleop.shotGridCounts).map((value, index) => [`teleop_shot_cell_${index}`, value])),
  teleop_fuel_scored: metrics.teleop.fuelScored,
  total_fuel_scored: metrics.auto.fuelScored + metrics.teleop.fuelScored,
});

export const compareMetrics = (params: {
  responseId: string;
  sessionId: string;
  clipId: string;
  block: 1 | 2;
  interfaceType: 'visual' | 'form';
  scout: NormalizedExperimentMetrics;
  answer: NormalizedExperimentMetrics;
}): ComparisonSummary => {
  const scoutFlat = flattenMetrics(params.scout);
  const answerFlat = flattenMetrics(params.answer);

  const lineItems: MetricComparison[] = Object.keys(answerFlat).map((key) => {
    const scoutValue = scoutFlat[key] ?? 0;
    const answerValue = answerFlat[key] ?? 0;

    return {
      key,
      scoutValue,
      answerValue,
      absoluteDiff: Math.abs(scoutValue - answerValue),
    };
  });

  const totalAbsoluteDiff = lineItems.reduce((acc, item) => acc + item.absoluteDiff, 0);
  const normalizationBase = lineItems.reduce((acc, item) => acc + Math.max(1, item.answerValue), 0);
  const normalizedError = normalizationBase > 0 ? totalAbsoluteDiff / normalizationBase : 0;
  const accuracyPercent = Math.max(0, (1 - normalizedError) * 100);

  return {
    responseId: params.responseId,
    sessionId: params.sessionId,
    clipId: params.clipId,
    block: params.block,
    interfaceType: params.interfaceType,
    totalAbsoluteDiff,
    normalizedError,
    accuracyPercent,
    lineItems,
  };
};
