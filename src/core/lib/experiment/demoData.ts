import { importExperimentBundle } from '@/core/db/experimentDatabase';
import { createEmptyMetrics } from '@/core/lib/experiment/metrics';
import { STUDY_CLIP_IDS } from '@/core/lib/experiment/constants';
import type {
  AutoStartLocationValue,
  ClimbLocationValue,
  ClimbResultValue,
  ExperimentAnswerKey,
  ExperimentPreferenceForm,
  ExperimentResponse,
  ExperimentSession,
  InterfaceType,
  NormalizedExperimentMetrics,
} from '@/core/lib/experiment/types';

const now = () => Date.now();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hashToUnit = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return (Math.abs(hash) % 10000) / 10000;
};

const randomInt = (seed: string, min: number, max: number) => {
  const unit = hashToUnit(seed);
  return Math.floor(unit * (max - min + 1)) + min;
};

const setCell = (cells: number[], index: number, count: number) => {
  if (index >= 0 && index < cells.length) cells[index] = count;
};

const cloneMetrics = (metrics: NormalizedExperimentMetrics): NormalizedExperimentMetrics => ({
  auto: {
    ...metrics.auto,
    shotGridCounts: [...metrics.auto.shotGridCounts],
    passGridCounts: [...metrics.auto.passGridCounts],
    collectGridCounts: [...metrics.auto.collectGridCounts],
  },
  teleop: {
    ...metrics.teleop,
    shotGridCounts: [...metrics.teleop.shotGridCounts],
    passGridCounts: [...metrics.teleop.passGridCounts],
    collectGridCounts: [...metrics.teleop.collectGridCounts],
  },
});

const recalcDerived = (metrics: NormalizedExperimentMetrics) => {
  const recalcPhase = (phase: NormalizedExperimentMetrics['auto']) => {
    phase.scoreActions = phase.shotGridCounts.reduce((acc, value) => acc + value, 0);
    phase.passActions = phase.passGridCounts.reduce((acc, value) => acc + value, 0);
    phase.collectActions = phase.collectGridCounts.reduce((acc, value) => acc + value, 0);
    phase.collectFromDepotActions = clamp(phase.collectFromDepotActions, 0, phase.collectActions);
    phase.collectFromOutpostActions = clamp(phase.collectFromOutpostActions, 0, phase.collectActions);
    if (phase.collectFromDepotActions + phase.collectFromOutpostActions < phase.collectActions) {
      phase.collectFromDepotActions = clamp(
        phase.collectFromDepotActions + (phase.collectActions - (phase.collectFromDepotActions + phase.collectFromOutpostActions)),
        0,
        phase.collectActions,
      );
    }

    if (phase.climbActions === 'no') {
      phase.climbResult = 'none';
      phase.climbLocation = 'none';
    }

    phase.fuelScored = Math.max(0, Math.round(phase.scoreActions * 1.8));
    phase.fuelPassed = Math.max(0, Math.round(phase.passActions * 1.4));
  };

  recalcPhase(metrics.auto);
  recalcPhase(metrics.teleop);

  return metrics;
};

const makeAnswerKeyMetrics = (clipId: string): NormalizedExperimentMetrics => {
  const metrics = createEmptyMetrics();

  if (clipId === STUDY_CLIP_IDS.block1) {
    metrics.auto.autoStartLocation = 'hub';
    setCell(metrics.auto.shotGridCounts, 7, 2);
    setCell(metrics.auto.shotGridCounts, 12, 1);
    setCell(metrics.auto.passGridCounts, 6, 1);
    setCell(metrics.auto.collectGridCounts, 1, 1);
    setCell(metrics.auto.collectGridCounts, 5, 1);
    metrics.auto.collectFromDepotActions = 1;
    metrics.auto.collectFromOutpostActions = 1;
    metrics.auto.foulActions = 1;

    setCell(metrics.teleop.shotGridCounts, 7, 4);
    setCell(metrics.teleop.shotGridCounts, 8, 2);
    setCell(metrics.teleop.passGridCounts, 10, 2);
    setCell(metrics.teleop.passGridCounts, 15, 1);
    metrics.teleop.defenseActions = 2;
    metrics.teleop.stealActions = 1;
    metrics.teleop.climbActions = 'yes';
    metrics.teleop.climbResult = 'success';
    metrics.teleop.climbLocation = 'side';
  } else {
    metrics.auto.autoStartLocation = 'bump1';
    setCell(metrics.auto.shotGridCounts, 11, 2);
    setCell(metrics.auto.shotGridCounts, 16, 1);
    setCell(metrics.auto.passGridCounts, 11, 1);
    setCell(metrics.auto.collectGridCounts, 20, 2);
    metrics.auto.collectFromDepotActions = 2;
    metrics.auto.collectFromOutpostActions = 0;

    setCell(metrics.teleop.shotGridCounts, 11, 3);
    setCell(metrics.teleop.shotGridCounts, 12, 2);
    setCell(metrics.teleop.passGridCounts, 14, 1);
    setCell(metrics.teleop.passGridCounts, 19, 2);
    metrics.teleop.defenseActions = 1;
    metrics.teleop.stealActions = 2;
    metrics.teleop.climbActions = 'yes';
    metrics.teleop.climbResult = 'fail';
    metrics.teleop.climbLocation = 'middle';
  }

  return recalcDerived(metrics);
};

const mutateCellCounts = (cells: number[], seedPrefix: string, interfaceType: InterfaceType, variability: number) =>
  cells.map((value, index) => {
    const delta = randomInt(`${seedPrefix}-cell-${index}-${interfaceType}`, -variability, variability);
    return Math.max(0, value + delta);
  });

const mutateStartLocation = (current: AutoStartLocationValue, seed: string, interfaceType: InterfaceType): AutoStartLocationValue => {
  const options: AutoStartLocationValue[] = ['trench1', 'bump1', 'hub', 'bump2', 'trench2'];
  if (current === 'none') return current;
  const driftChance = interfaceType === 'form' ? 0.2 : 0.1;
  if (hashToUnit(`${seed}-start-drift-${interfaceType}`) > driftChance) return current;

  const index = options.indexOf(current);
  if (index < 0) return current;
  const move = randomInt(`${seed}-start-move-${interfaceType}`, -1, 1);
  return options[clamp(index + move, 0, options.length - 1)]!;
};

const mutateEnum = <T extends string>(value: T, options: readonly T[], seed: string, chance: number) => {
  if (hashToUnit(seed) > chance) return value;
  const nextIndex = randomInt(`${seed}-next`, 0, options.length - 1);
  return options[nextIndex]!;
};

const makeScoutMetrics = (
  answer: NormalizedExperimentMetrics,
  interfaceType: InterfaceType,
  scoutIndex: number,
  block: 1 | 2,
) => {
  const base = cloneMetrics(answer);
  const variability = interfaceType === 'form' ? 2 : 1;
  const seedPrefix = `scout-${scoutIndex}-block-${block}`;

  base.auto.shotGridCounts = mutateCellCounts(base.auto.shotGridCounts, `${seedPrefix}-auto-shot`, interfaceType, variability);
  base.auto.passGridCounts = mutateCellCounts(base.auto.passGridCounts, `${seedPrefix}-auto-pass`, interfaceType, variability);
  base.auto.collectGridCounts = mutateCellCounts(base.auto.collectGridCounts, `${seedPrefix}-auto-collect`, interfaceType, variability);

  base.teleop.shotGridCounts = mutateCellCounts(base.teleop.shotGridCounts, `${seedPrefix}-teleop-shot`, interfaceType, variability);
  base.teleop.passGridCounts = mutateCellCounts(base.teleop.passGridCounts, `${seedPrefix}-teleop-pass`, interfaceType, variability);

  base.auto.autoStartLocation = mutateStartLocation(base.auto.autoStartLocation, `${seedPrefix}-auto-start`, interfaceType);

  base.auto.foulActions = Math.max(0, base.auto.foulActions + randomInt(`${seedPrefix}-auto-foul-${interfaceType}`, -1, 1));
  base.teleop.defenseActions = Math.max(0, base.teleop.defenseActions + randomInt(`${seedPrefix}-teleop-defense-${interfaceType}`, -1, 1));
  base.teleop.stealActions = Math.max(0, base.teleop.stealActions + randomInt(`${seedPrefix}-teleop-steal-${interfaceType}`, -1, 1));

  base.auto.collectFromDepotActions = Math.max(0, base.auto.collectFromDepotActions + randomInt(`${seedPrefix}-collect-depot-${interfaceType}`, -1, 1));
  base.auto.collectFromOutpostActions = Math.max(0, base.auto.collectFromOutpostActions + randomInt(`${seedPrefix}-collect-outpost-${interfaceType}`, -1, 1));

  base.teleop.climbActions = mutateEnum(base.teleop.climbActions, ['no', 'yes'] as const, `${seedPrefix}-climb-attempt-${interfaceType}`, interfaceType === 'form' ? 0.2 : 0.1);
  base.teleop.climbResult = mutateEnum(base.teleop.climbResult, ['none', 'success', 'fail'] as const, `${seedPrefix}-climb-result-${interfaceType}`, interfaceType === 'form' ? 0.18 : 0.08) as ClimbResultValue;
  base.teleop.climbLocation = mutateEnum(base.teleop.climbLocation, ['none', 'side', 'middle'] as const, `${seedPrefix}-climb-location-${interfaceType}`, interfaceType === 'form' ? 0.18 : 0.08) as ClimbLocationValue;

  return recalcDerived(base);
};

const makeTlx = (interfaceType: InterfaceType, scoutIndex: number, block: 1 | 2) => {
  const base = interfaceType === 'visual' ? 4.5 : 5.8;
  const score = (dimension: string) => clamp(
    Math.round(base + randomInt(`tlx-${dimension}-${interfaceType}-${scoutIndex}-${block}`, -2, 2)),
    1,
    10,
  );

  return {
    mentalDemand: score('mental'),
    physicalDemand: score('physical'),
    temporalDemand: score('temporal'),
    performance: score('performance'),
    effort: score('effort'),
    frustration: score('frustration'),
  };
};

const makePreference = (sessionId: string, scoutIndex: number): ExperimentPreferenceForm => {
  const prefersVisual = hashToUnit(`pref-${scoutIndex}`) > 0.35;
  const visualBase = prefersVisual ? 7 : 5;
  const formBase = prefersVisual ? 5 : 7;

  return {
    id: `demo-preference-${sessionId}`,
    sessionId,
    preferredInterface: prefersVisual ? 'visual' : 'form',
    visualSatisfaction: clamp(visualBase + randomInt(`vsat-${scoutIndex}`, -1, 1), 1, 10),
    formSatisfaction: clamp(formBase + randomInt(`fsat-${scoutIndex}`, -1, 1), 1, 10),
    visualEase: clamp(visualBase + randomInt(`vease-${scoutIndex}`, -1, 1), 1, 10),
    formEase: clamp(formBase + randomInt(`fease-${scoutIndex}`, -1, 1), 1, 10),
    submittedAt: now(),
  };
};

export const seedExperimentDemoData = async () => {
  const createdAtBase = now();

  const answerKeyClip1Metrics = makeAnswerKeyMetrics(STUDY_CLIP_IDS.block1);
  const answerKeyClip2Metrics = makeAnswerKeyMetrics(STUDY_CLIP_IDS.block2);

  const answerKeys: ExperimentAnswerKey[] = [
    {
      id: 'demo-answer-key-clip-1',
      clipId: STUDY_CLIP_IDS.block1,
      metrics: answerKeyClip1Metrics,
      notes: 'Demo key generated from visual reference workflow.',
      createdAt: createdAtBase,
      updatedAt: createdAtBase,
    },
    {
      id: 'demo-answer-key-clip-2',
      clipId: STUDY_CLIP_IDS.block2,
      metrics: answerKeyClip2Metrics,
      notes: 'Demo key generated from visual reference workflow.',
      createdAt: createdAtBase,
      updatedAt: createdAtBase,
    },
  ];

  const sessions: ExperimentSession[] = [];
  const responses: ExperimentResponse[] = [];
  const preferences: ExperimentPreferenceForm[] = [];

  for (let index = 0; index < 12; index += 1) {
    const scoutNumber = index + 1;
    const group = index < 6 ? 'A' : 'B';
    const interfaceOrder: [InterfaceType, InterfaceType] = group === 'A'
      ? ['visual', 'form']
      : ['form', 'visual'];

    const sessionId = `demo-session-${group}-${group === 'A' ? scoutNumber : scoutNumber - 6}`;
    const sessionCreatedAt = createdAtBase + index * 1000;

    sessions.push({
      id: sessionId,
      participantCode: `DEMO-${String(scoutNumber).padStart(2, '0')}`,
      group,
      interfaceOrder,
      createdAt: sessionCreatedAt,
      clip1Id: STUDY_CLIP_IDS.block1,
      clip2Id: STUDY_CLIP_IDS.block2,
      completedAt: sessionCreatedAt + 8 * 60 * 1000,
    });

    const blocks: Array<{ block: 1 | 2; clipId: string; interfaceType: InterfaceType }> = [
      { block: 1, clipId: STUDY_CLIP_IDS.block1, interfaceType: interfaceOrder[0] },
      { block: 2, clipId: STUDY_CLIP_IDS.block2, interfaceType: interfaceOrder[1] },
    ];

    blocks.forEach(({ block, clipId, interfaceType }) => {
      const baseAnswer = clipId === STUDY_CLIP_IDS.block1 ? answerKeyClip1Metrics : answerKeyClip2Metrics;
      const metrics = makeScoutMetrics(baseAnswer, interfaceType, scoutNumber, block);

      const durationBaseSeconds = interfaceType === 'visual' ? 85 : 108;
      const jitter = randomInt(`duration-${sessionId}-${block}-${interfaceType}`, -14, 14);
      const durationMs = Math.max(30_000, (durationBaseSeconds + jitter) * 1000);
      const startedAt = sessionCreatedAt + block * 60_000;
      const submittedAt = startedAt + durationMs;

      responses.push({
        id: `demo-response-${sessionId}-block-${block}`,
        sessionId,
        block,
        interfaceType,
        clipId,
        startedAt,
        submittedAt,
        durationMs,
        metrics,
        tlxRaw: makeTlx(interfaceType, scoutNumber, block),
      });
    });

    preferences.push(makePreference(sessionId, scoutNumber));
  }

  return importExperimentBundle({
    sessions,
    responses,
    answerKeys,
    preferences,
  });
};
