import { importExperimentBundle } from '@/core/db/experimentDatabase';
import type { ExperimentExportBundle } from './types';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const parseExperimentImportJson = (raw: string): ExperimentExportBundle => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON file.');
  }

  if (!isObject(parsed)) {
    throw new Error('Invalid import payload shape.');
  }

  const candidate = parsed as unknown as Partial<ExperimentExportBundle>;

  if (
    !Array.isArray(candidate.sessions) &&
    !Array.isArray(candidate.responses) &&
    !Array.isArray(candidate.answerKeys) &&
    !Array.isArray(candidate.preferences)
  ) {
    throw new Error('No importable experiment arrays found.');
  }

  return {
    exportedAt: typeof candidate.exportedAt === 'number' ? candidate.exportedAt : Date.now(),
    sessions: Array.isArray(candidate.sessions) ? candidate.sessions : [],
    responses: Array.isArray(candidate.responses) ? candidate.responses : [],
    answerKeys: Array.isArray(candidate.answerKeys) ? candidate.answerKeys : [],
    preferences: Array.isArray(candidate.preferences) ? candidate.preferences : [],
    comparisons: Array.isArray(candidate.comparisons) ? candidate.comparisons : [],
  };
};

export const importExperimentJsonText = async (raw: string) => {
  const bundle = parseExperimentImportJson(raw);

  const counts = await importExperimentBundle({
    sessions: bundle.sessions,
    responses: bundle.responses,
    answerKeys: bundle.answerKeys,
    preferences: bundle.preferences,
  });

  return counts;
};
