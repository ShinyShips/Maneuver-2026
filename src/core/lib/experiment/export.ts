import {
  getAllAnswerKeys,
  getAllPreferences,
  getAllResponses,
  getAllSessions,
} from '@/core/db/experimentDatabase';
import { compareMetrics } from './metrics';
import type {
  ComparisonSummary,
  ExperimentExportInsight,
  ExperimentExportResults,
  ExperimentResponse,
  NormalizedExperimentMetrics,
  TLXRawScores,
} from './types';

const TLX_DIMENSIONS: Array<{ key: keyof TLXRawScores; label: string }> = [
  { key: 'mentalDemand', label: 'Mental' },
  { key: 'physicalDemand', label: 'Physical' },
  { key: 'temporalDemand', label: 'Temporal' },
  { key: 'performance', label: 'Performance' },
  { key: 'effort', label: 'Effort' },
  { key: 'frustration', label: 'Frustration' },
];

const downloadFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const toCsv = (rows: Array<Record<string, unknown>>) => {
  if (rows.length === 0) return '';

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const escapeCell = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const escaped = raw.replace(/"/g, '""');
    return /[",\n]/.test(raw) ? `"${escaped}"` : escaped;
  };

  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','));
  });

  return lines.join('\n');
};

const toSlimMetrics = (metrics: NormalizedExperimentMetrics) => ({
  auto: {
    scoreActions: metrics.auto.scoreActions,
    autoStartLocation: metrics.auto.autoStartLocation,
    shotGridCounts: metrics.auto.shotGridCounts,
    collectGridCounts: metrics.auto.collectGridCounts,
    collectActions: metrics.auto.collectActions,
    fuelScored: metrics.auto.fuelScored,
  },
  teleop: {
    scoreActions: metrics.teleop.scoreActions,
    shotGridCounts: metrics.teleop.shotGridCounts,
    fuelScored: metrics.teleop.fuelScored,
  },
});

const toSlimResponse = (response: ExperimentResponse) => ({
  ...response,
  metrics: toSlimMetrics(response.metrics),
});

const average = (values: number[]) => (
  values.length
    ? values.reduce((acc, value) => acc + value, 0) / values.length
    : null
);

const formatSignedSeconds = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}s`;

const formatPercentDelta = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)} pts`;

const buildFieldDifferenceSummary = (comparisons: ComparisonSummary[]): ExperimentExportResults['fieldDifferences'] => {
  type Bucket = {
    key: string;
    total: number;
    count: number;
    visualTotal: number;
    visualCount: number;
    formTotal: number;
    formCount: number;
  };

  const buckets = new Map<string, Bucket>();

  comparisons.forEach((comparison) => {
    comparison.lineItems.forEach((lineItem) => {
      const existing = buckets.get(lineItem.key) ?? {
        key: lineItem.key,
        total: 0,
        count: 0,
        visualTotal: 0,
        visualCount: 0,
        formTotal: 0,
        formCount: 0,
      };

      existing.total += lineItem.absoluteDiff;
      existing.count += 1;

      if (comparison.interfaceType === 'visual') {
        existing.visualTotal += lineItem.absoluteDiff;
        existing.visualCount += 1;
      } else {
        existing.formTotal += lineItem.absoluteDiff;
        existing.formCount += 1;
      }

      buckets.set(lineItem.key, existing);
    });
  });

  const rows = Array.from(buckets.values()).map((bucket) => ({
    key: bucket.key,
    overallAvgAbsoluteDiff: bucket.count ? bucket.total / bucket.count : 0,
    visualAvgAbsoluteDiff: bucket.visualCount ? bucket.visualTotal / bucket.visualCount : null,
    formAvgAbsoluteDiff: bucket.formCount ? bucket.formTotal / bucket.formCount : null,
  }));

  const sortRows = (left: (typeof rows)[number], right: (typeof rows)[number]) => (
    right.overallAvgAbsoluteDiff - left.overallAvgAbsoluteDiff
  );

  return {
    nonCell: rows.filter((row) => !row.key.includes('_cell_')).sort(sortRows),
    cell: rows.filter((row) => row.key.includes('_cell_')).sort(sortRows),
  };
};

const buildExportResults = (params: {
  sessions: Array<{ id: string; completedAt?: number }>;
  responses: ExperimentResponse[];
  preferences: Array<{
    preferredInterface: 'visual' | 'form' | 'no-preference';
    visualSatisfaction: number;
    formSatisfaction: number;
    visualEase: number;
    formEase: number;
  }>;
  comparisons: ComparisonSummary[];
}): ExperimentExportResults => {
  const durationByInterface: Record<'visual' | 'form', number[]> = { visual: [], form: [] };
  const tlxByInterface: Record<'visual' | 'form', Record<keyof TLXRawScores, number[]>> = {
    visual: {
      mentalDemand: [],
      physicalDemand: [],
      temporalDemand: [],
      performance: [],
      effort: [],
      frustration: [],
    },
    form: {
      mentalDemand: [],
      physicalDemand: [],
      temporalDemand: [],
      performance: [],
      effort: [],
      frustration: [],
    },
  };

  params.responses.forEach((response) => {
    durationByInterface[response.interfaceType].push(response.durationMs / 1000);

    const tlxRaw = response.tlxRaw;
    if (!tlxRaw) {
      return;
    }

    TLX_DIMENSIONS.forEach(({ key }) => {
      tlxByInterface[response.interfaceType][key].push(tlxRaw[key]);
    });
  });

  const comparisonByInterface = {
    visual: params.comparisons.filter((comparison) => comparison.interfaceType === 'visual'),
    form: params.comparisons.filter((comparison) => comparison.interfaceType === 'form'),
  };

  const tlxDimensions = TLX_DIMENSIONS.map(({ key, label }) => ({
    key,
    label,
    visual: average(tlxByInterface.visual[key]),
    form: average(tlxByInterface.form[key]),
  }));

  const overallVisualTlx = average(
    tlxDimensions.map((row) => row.visual).filter((value): value is number => value !== null),
  );
  const overallFormTlx = average(
    tlxDimensions.map((row) => row.form).filter((value): value is number => value !== null),
  );

  const preferenceSummary = {
    preferredCounts: {
      visual: params.preferences.filter((item) => item.preferredInterface === 'visual').length,
      form: params.preferences.filter((item) => item.preferredInterface === 'form').length,
      none: params.preferences.filter((item) => item.preferredInterface === 'no-preference').length,
    },
    visualSatisfaction: average(params.preferences.map((item) => item.visualSatisfaction)),
    formSatisfaction: average(params.preferences.map((item) => item.formSatisfaction)),
    visualEase: average(params.preferences.map((item) => item.visualEase)),
    formEase: average(params.preferences.map((item) => item.formEase)),
  };

  const durationDeltaSeconds =
    average(durationByInterface.form) !== null && average(durationByInterface.visual) !== null
      ? average(durationByInterface.form)! - average(durationByInterface.visual)!
      : null;

  return {
    sessionCount: params.sessions.length,
    completedSessionCount: params.sessions.filter((session) => typeof session.completedAt === 'number').length,
    responseCount: params.responses.length,
    preferenceCount: params.preferences.length,
    comparisonCount: params.comparisons.length,
    interfaces: {
      visual: {
        responseCount: durationByInterface.visual.length,
        averageAccuracyPercent: average(comparisonByInterface.visual.map((item) => item.accuracyPercent)),
        averageDurationSeconds: average(durationByInterface.visual),
        averageTlx: overallVisualTlx,
      },
      form: {
        responseCount: durationByInterface.form.length,
        averageAccuracyPercent: average(comparisonByInterface.form.map((item) => item.accuracyPercent)),
        averageDurationSeconds: average(durationByInterface.form),
        averageTlx: overallFormTlx,
      },
    },
    durationDeltaSeconds,
    tlx: {
      overallVisual: overallVisualTlx,
      overallForm: overallFormTlx,
      dimensions: tlxDimensions,
    },
    preferences: preferenceSummary,
    fieldDifferences: buildFieldDifferenceSummary(params.comparisons),
  };
};

const buildInsights = (results: ExperimentExportResults): ExperimentExportInsight[] => {
  const insights: ExperimentExportInsight[] = [];

  const visualAccuracy = results.interfaces.visual.averageAccuracyPercent;
  const formAccuracy = results.interfaces.form.averageAccuracyPercent;
  if (visualAccuracy !== null && formAccuracy !== null) {
    const winner = visualAccuracy === formAccuracy
      ? 'tie'
      : visualAccuracy > formAccuracy
        ? 'visual'
        : 'form';
    insights.push({
      id: 'accuracy-winner',
      title: 'Accuracy comparison',
      summary: winner === 'tie'
        ? `Visual and form accuracy are tied at ${visualAccuracy.toFixed(1)}%.`
        : `${winner} produced higher mean accuracy by ${formatPercentDelta(Math.abs(visualAccuracy - formAccuracy))}.`,
      metric: 'accuracyPercent',
      value: winner === 'tie' ? visualAccuracy : Math.abs(visualAccuracy - formAccuracy),
    });
  }

  const durationDeltaSeconds = results.durationDeltaSeconds;
  if (durationDeltaSeconds !== null) {
    const faster = durationDeltaSeconds === 0 ? 'tie' : durationDeltaSeconds > 0 ? 'visual' : 'form';
    insights.push({
      id: 'speed-winner',
      title: 'Speed comparison',
      summary: faster === 'tie'
        ? 'Visual and form took the same average time.'
        : `${faster} was faster on average by ${formatSignedSeconds(Math.abs(durationDeltaSeconds))}.`,
      metric: 'durationSeconds',
      value: Math.abs(durationDeltaSeconds),
    });
  }

  const visualTlx = results.tlx.overallVisual;
  const formTlx = results.tlx.overallForm;
  if (visualTlx !== null && formTlx !== null) {
    const lowerLoad = visualTlx === formTlx ? 'tie' : visualTlx < formTlx ? 'visual' : 'form';
    insights.push({
      id: 'workload-winner',
      title: 'NASA-TLX comparison',
      summary: lowerLoad === 'tie'
        ? `Visual and form have the same average TLX score at ${visualTlx.toFixed(1)}.`
        : `${lowerLoad} produced lower average workload by ${(Math.abs(visualTlx - formTlx)).toFixed(1)} TLX points.`,
      metric: 'nasaTlx',
      value: lowerLoad === 'tie' ? visualTlx : Math.abs(visualTlx - formTlx),
    });
  }

  const preferenceCounts = results.preferences.preferredCounts;
  const preferenceWinner = Object.entries(preferenceCounts).reduce(
    (best, current) => current[1] > best[1] ? current : best,
    ['none', preferenceCounts.none] as ['visual' | 'form' | 'none', number],
  );
  if (preferenceWinner[1] > 0) {
    insights.push({
      id: 'preference-winner',
      title: 'Stated preference',
      summary: preferenceWinner[0] === 'none'
        ? `${preferenceWinner[1]} participants reported no interface preference.`
        : `${preferenceWinner[0]} was preferred by ${preferenceWinner[1]} participants.`,
      metric: 'preferredInterface',
      value: preferenceWinner[0],
    });
  }

  const topNonCellField = results.fieldDifferences.nonCell[0];
  if (topNonCellField) {
    insights.push({
      id: 'top-non-cell-diff',
      title: 'Largest non-cell error source',
      summary: `${topNonCellField.key} had the highest average absolute difference at ${topNonCellField.overallAvgAbsoluteDiff.toFixed(3)}.`,
      metric: topNonCellField.key,
      value: topNonCellField.overallAvgAbsoluteDiff,
    });
  }

  const topCellField = results.fieldDifferences.cell[0];
  if (topCellField) {
    insights.push({
      id: 'top-cell-diff',
      title: 'Largest cell-level error source',
      summary: `${topCellField.key} had the highest average absolute difference at ${topCellField.overallAvgAbsoluteDiff.toFixed(3)}.`,
      metric: topCellField.key,
      value: topCellField.overallAvgAbsoluteDiff,
    });
  }

  return insights;
};

export const exportExperimentJson = async (options?: { sessionId?: string }) => {
  const [allResponses, allPreferences, allSessions, allAnswerKeys] = await Promise.all([
    getAllResponses(),
    getAllPreferences(),
    getAllSessions(),
    getAllAnswerKeys(),
  ]);
  const responses = options?.sessionId
    ? allResponses.filter((response) => response.sessionId === options.sessionId)
    : allResponses;
  const responseSessionIds = new Set(responses.map((response) => response.sessionId));
  const preferences = options?.sessionId
    ? allPreferences.filter((preference) => preference.sessionId === options.sessionId)
    : allPreferences.filter((preference) => responseSessionIds.has(preference.sessionId));
  const sessions = options?.sessionId
    ? allSessions.filter((session) => session.id === options.sessionId)
    : allSessions.filter((session) => responseSessionIds.has(session.id));
  const clipIds = new Set(responses.map((response) => response.clipId));
  const answerKeys = allAnswerKeys.filter((answerKey) => clipIds.has(answerKey.clipId));
  const answerKeysByClip = new Map(answerKeys.map((answerKey) => [answerKey.clipId, answerKey]));
  const comparisons = responses.flatMap((response) => {
    const answerKey = answerKeysByClip.get(response.clipId);
    if (!answerKey) {
      return [];
    }

    return [compareMetrics({
      responseId: response.id,
      sessionId: response.sessionId,
      clipId: response.clipId,
      block: response.block,
      interfaceType: response.interfaceType,
      scout: response.metrics,
      answer: answerKey.metrics,
    })];
  });
  const results = buildExportResults({
    sessions,
    responses,
    preferences,
    comparisons,
  });
  const insights = buildInsights(results);

  const payload = {
    exportedAt: Date.now(),
    exportSchemaVersion: 'analysis-v2',
    sessions,
    responses: responses.map(toSlimResponse),
    answerKeys: answerKeys.map((answerKey) => ({
      ...answerKey,
      metrics: toSlimMetrics(answerKey.metrics),
    })),
    preferences,
    comparisons,
    results,
    insights,
  };

  downloadFile(
    options?.sessionId
      ? `experiment-export-session-${options.sessionId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`
      : `experiment-export-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  );
};

export const exportExperimentCsv = async (options?: { sessionId?: string }) => {
  const [allResponses, allPreferences, allAnswerKeys] = await Promise.all([
    getAllResponses(),
    getAllPreferences(),
    getAllAnswerKeys(),
  ]);
  const responses = options?.sessionId
    ? allResponses.filter((response) => response.sessionId === options.sessionId)
    : allResponses;
  const responseSessionIds = new Set(responses.map((response) => response.sessionId));
  const preferences = options?.sessionId
    ? allPreferences.filter((preference) => preference.sessionId === options.sessionId)
    : allPreferences.filter((preference) => responseSessionIds.has(preference.sessionId));
  const answerKeysByClip = new Map(allAnswerKeys.map((answerKey) => [answerKey.clipId, answerKey]));

  const rows = responses.map((response) => {
    const preference = preferences.find((item) => item.sessionId === response.sessionId);
    const answerKey = answerKeysByClip.get(response.clipId);
    const comparison = answerKey
      ? compareMetrics({
        responseId: response.id,
        sessionId: response.sessionId,
        clipId: response.clipId,
        block: response.block,
        interfaceType: response.interfaceType,
        scout: response.metrics,
        answer: answerKey.metrics,
      })
      : null;

    return {
      responseId: response.id,
      sessionId: response.sessionId,
      clipId: response.clipId,
      block: response.block,
      interfaceType: response.interfaceType,
      startedAt: response.startedAt,
      submittedAt: response.submittedAt,
      durationMs: response.durationMs,
      hasAnswerKey: answerKey ? 'yes' : 'no',
      totalAbsoluteDiff: comparison?.totalAbsoluteDiff ?? '',
      normalizedError: comparison?.normalizedError ?? '',
      accuracyPercent: comparison?.accuracyPercent ?? '',
      tlx_mentalDemand: response.tlxRaw?.mentalDemand ?? '',
      tlx_physicalDemand: response.tlxRaw?.physicalDemand ?? '',
      tlx_temporalDemand: response.tlxRaw?.temporalDemand ?? '',
      tlx_performance: response.tlxRaw?.performance ?? '',
      tlx_effort: response.tlxRaw?.effort ?? '',
      tlx_frustration: response.tlxRaw?.frustration ?? '',
      preferredInterface: preference?.preferredInterface ?? '',
      visualSatisfaction: preference?.visualSatisfaction ?? '',
      formSatisfaction: preference?.formSatisfaction ?? '',
      visualEase: preference?.visualEase ?? '',
      formEase: preference?.formEase ?? '',
      preferenceNotes: preference?.notes ?? '',
      metrics: toSlimMetrics(response.metrics),
    };
  });

  downloadFile(
    options?.sessionId
      ? `experiment-export-session-${options.sessionId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`
      : `experiment-export-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(rows),
    'text/csv;charset=utf-8;',
  );
};
