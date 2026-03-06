import {
  getAllPreferences,
  getAllResponses,
  getExperimentSession,
} from '@/core/db/experimentDatabase';
import type {
  ExperimentResponse,
  NormalizedExperimentMetrics,
} from './types';

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

export const exportExperimentJson = async (options?: { sessionId?: string }) => {
  const allResponses = await getAllResponses();
  const responses = options?.sessionId
    ? allResponses.filter((response) => response.sessionId === options.sessionId)
    : allResponses;
  const allPreferences = await getAllPreferences();
  const responseSessionIds = new Set(responses.map((response) => response.sessionId));
  const preferences = options?.sessionId
    ? allPreferences.filter((preference) => preference.sessionId === options.sessionId)
    : allPreferences.filter((preference) => responseSessionIds.has(preference.sessionId));

  const sessionIds = Array.from(new Set(responses.map((r) => r.sessionId)));
  const sessions = await Promise.all(sessionIds.map((id) => getExperimentSession(id)));

  const payload = {
    exportedAt: Date.now(),
    exportSchemaVersion: 'responses-only-v1',
    sessions: sessions.filter(Boolean),
    responses: responses.map(toSlimResponse),
    preferences,
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
  const allResponses = await getAllResponses();
  const responses = options?.sessionId
    ? allResponses.filter((response) => response.sessionId === options.sessionId)
    : allResponses;
  const allPreferences = await getAllPreferences();
  const responseSessionIds = new Set(responses.map((response) => response.sessionId));
  const preferences = options?.sessionId
    ? allPreferences.filter((preference) => preference.sessionId === options.sessionId)
    : allPreferences.filter((preference) => responseSessionIds.has(preference.sessionId));

  const rows = responses.map((response) => {
    return {
      responseId: response.id,
      sessionId: response.sessionId,
      clipId: response.clipId,
      block: response.block,
      interfaceType: response.interfaceType,
      startedAt: response.startedAt,
      submittedAt: response.submittedAt,
      durationMs: response.durationMs,
      tlx_mentalDemand: response.tlxRaw?.mentalDemand ?? '',
      tlx_physicalDemand: response.tlxRaw?.physicalDemand ?? '',
      tlx_temporalDemand: response.tlxRaw?.temporalDemand ?? '',
      tlx_performance: response.tlxRaw?.performance ?? '',
      tlx_effort: response.tlxRaw?.effort ?? '',
      tlx_frustration: response.tlxRaw?.frustration ?? '',
      preferredInterface: preferences.find((p) => p.sessionId === response.sessionId)?.preferredInterface ?? '',
      visualSatisfaction: preferences.find((p) => p.sessionId === response.sessionId)?.visualSatisfaction ?? '',
      formSatisfaction: preferences.find((p) => p.sessionId === response.sessionId)?.formSatisfaction ?? '',
      visualEase: preferences.find((p) => p.sessionId === response.sessionId)?.visualEase ?? '',
      formEase: preferences.find((p) => p.sessionId === response.sessionId)?.formEase ?? '',
      preferenceNotes: preferences.find((p) => p.sessionId === response.sessionId)?.notes ?? '',
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
