import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

describe('off-season match submission reproduction', () => {
  beforeEach(async () => {
    const { db } = await import('@/core/db/database');
    await db.delete();
    await db.open();
    localStorage.clear();
  });

  it('saves scouting data for a manually-added TBA event', async () => {
    const { submitMatchData } = await import('@/core/lib/submitMatch');
    let reportedError: Error | undefined;

    const saved = await submitMatchData({
      inputs: {
        eventKey: '2026gasuw',
        matchNumber: '1',
        matchType: 'qm',
        selectTeam: '3314',
        alliance: 'red',
        scoutName: 'Scout',
      },
      transformation: {
        transformActionsToCounters: () => ({ auto: {}, teleop: {}, endgame: {} }),
      },
      onError: (error) => { reportedError = error; },
    });

    expect(saved, reportedError?.message).toBe(true);
  });
});
