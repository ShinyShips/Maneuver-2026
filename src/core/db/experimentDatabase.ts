import Dexie, { type Table } from 'dexie';
import type {
  ExperimentAnswerKey,
  ExperimentPreferenceForm,
  ExperimentResponse,
  ExperimentSession,
} from '@/core/lib/experiment/types';

export class ExperimentDB extends Dexie {
  sessions!: Table<ExperimentSession, string>;
  responses!: Table<ExperimentResponse, string>;
  answerKeys!: Table<ExperimentAnswerKey, string>;
  preferences!: Table<ExperimentPreferenceForm, string>;

  constructor() {
    super('ExperimentDB');

    this.version(1).stores({
      sessions: 'id, participantCode, group, createdAt, completedAt',
      responses: 'id, sessionId, clipId, block, interfaceType, startedAt, submittedAt, [sessionId+block]',
      answerKeys: 'id, clipId, updatedAt',
      preferences: 'id, sessionId, submittedAt',
    });
  }
}

export const experimentDB = new ExperimentDB();

experimentDB.open().catch((error) => {
  console.error('Failed to open ExperimentDB:', error);
});

export const saveExperimentSession = async (session: ExperimentSession) => {
  await experimentDB.sessions.put(session);
};

export const getExperimentSession = async (id: string) => {
  return experimentDB.sessions.get(id);
};

export const getAllSessions = async () => {
  return experimentDB.sessions.toArray();
};

export const markExperimentSessionComplete = async (id: string, completedAt: number) => {
  await experimentDB.sessions.update(id, { completedAt });
};

export const saveExperimentResponse = async (response: ExperimentResponse) => {
  await experimentDB.responses.put(response);
};

export const getResponsesBySession = async (sessionId: string) => {
  return experimentDB.responses.where('sessionId').equals(sessionId).sortBy('block');
};

export const getAllResponses = async () => {
  return experimentDB.responses.toArray();
};

export const saveAnswerKey = async (answerKey: ExperimentAnswerKey) => {
  await experimentDB.answerKeys.put(answerKey);
};

export const getAnswerKeyByClip = async (clipId: string) => {
  return experimentDB.answerKeys.where('clipId').equals(clipId).first();
};

export const getAllAnswerKeys = async () => {
  return experimentDB.answerKeys.toArray();
};

export const deleteAnswerKeyByClip = async (clipId: string) => {
  const existing = await getAnswerKeyByClip(clipId);
  if (!existing) return false;

  await experimentDB.answerKeys.delete(existing.id);
  return true;
};

export const savePreferenceForm = async (preference: ExperimentPreferenceForm) => {
  await experimentDB.preferences.put(preference);
};

export const getPreferenceBySession = async (sessionId: string) => {
  return experimentDB.preferences.where('sessionId').equals(sessionId).first();
};

export const getAllPreferences = async () => {
  return experimentDB.preferences.toArray();
};

export const importExperimentBundle = async (bundle: {
  sessions?: ExperimentSession[];
  responses?: ExperimentResponse[];
  answerKeys?: ExperimentAnswerKey[];
  preferences?: ExperimentPreferenceForm[];
}) => {
  await experimentDB.transaction('rw', experimentDB.sessions, experimentDB.responses, experimentDB.answerKeys, experimentDB.preferences, async () => {
    if (bundle.sessions?.length) {
      await experimentDB.sessions.bulkPut(bundle.sessions);
    }
    if (bundle.responses?.length) {
      await experimentDB.responses.bulkPut(bundle.responses);
    }
    if (bundle.answerKeys?.length) {
      await experimentDB.answerKeys.bulkPut(bundle.answerKeys);
    }
    if (bundle.preferences?.length) {
      await experimentDB.preferences.bulkPut(bundle.preferences);
    }
  });

  return {
    sessions: bundle.sessions?.length ?? 0,
    responses: bundle.responses?.length ?? 0,
    answerKeys: bundle.answerKeys?.length ?? 0,
    preferences: bundle.preferences?.length ?? 0,
  };
};

export const clearExperimentData = async () => {
  await experimentDB.transaction('rw', experimentDB.sessions, experimentDB.responses, experimentDB.answerKeys, experimentDB.preferences, async () => {
    await experimentDB.sessions.clear();
    await experimentDB.responses.clear();
    await experimentDB.answerKeys.clear();
    await experimentDB.preferences.clear();
  });
};
