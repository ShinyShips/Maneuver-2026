import { calculateTeamStats } from "@/game-template/calculations";
import type { ScoutingEntry } from "@/game-template/scoring";
import { db } from "@/core/db/database";
import type { ScoutingEntryBase } from "@/core/types/scouting-entry";
import {
    STRATEGY_SNAPSHOT_CACHE_VERSION,
    STRATEGY_SNAPSHOT_METADATA_ID,
    type StrategySnapshot,
    type StrategySnapshotCacheMetadata,
} from "@/core/types/strategy-snapshot";

type StrategyKey = {
    teamNumber: number;
    eventKey: string;
};

const toSnapshotId = (teamNumber: number, eventKey: string): string => `${teamNumber}::${eventKey}`;

const normalizeEventKey = (eventKey: string): string => eventKey.toLowerCase().trim();

const uniqueStrategyKeys = (keys: StrategyKey[]): StrategyKey[] => {
    const deduped = new Map<string, StrategyKey>();

    for (const key of keys) {
        if (!Number.isFinite(key.teamNumber) || !key.eventKey) {
            continue;
        }

        deduped.set(toSnapshotId(key.teamNumber, key.eventKey), key);
    }

    return Array.from(deduped.values());
};

const toStrategyKey = (entry: Pick<ScoutingEntryBase, "teamNumber" | "eventKey">): StrategyKey | null => {
    if (!Number.isFinite(entry.teamNumber) || !entry.eventKey) {
        return null;
    }

    return {
        teamNumber: entry.teamNumber,
        eventKey: normalizeEventKey(entry.eventKey),
    };
};

const buildStrategySnapshot = (
    teamNumber: number,
    eventKey: string,
    entries: ScoutingEntry[]
): StrategySnapshot => {
    const stats = calculateTeamStats(entries) as Omit<
        StrategySnapshot,
        "id" | "teamNumber" | "eventKey" | "cacheVersion" | "updatedAt"
    >;

    return {
        ...stats,
        id: toSnapshotId(teamNumber, eventKey),
        teamNumber,
        eventKey,
        cacheVersion: STRATEGY_SNAPSHOT_CACHE_VERSION,
        updatedAt: Date.now(),
    } as StrategySnapshot;
};

const putMetadata = async (): Promise<void> => {
    const metadata: StrategySnapshotCacheMetadata = {
        id: STRATEGY_SNAPSHOT_METADATA_ID,
        version: STRATEGY_SNAPSHOT_CACHE_VERSION,
        updatedAt: Date.now(),
    };

    await db.strategyCacheMetadata.put(metadata);
};

const recomputeKey = async ({ teamNumber, eventKey }: StrategyKey): Promise<void> => {
    const entries = await db.scoutingData
        .where("[teamNumber+eventKey]")
        .equals([teamNumber, eventKey])
        .toArray() as ScoutingEntry[];

    const snapshotId = toSnapshotId(teamNumber, eventKey);

    if (entries.length === 0) {
        await db.strategySnapshots.delete(snapshotId);
        return;
    }

    const snapshot = buildStrategySnapshot(teamNumber, eventKey, entries);
    await db.strategySnapshots.put(snapshot);
};

export const rebuildStrategySnapshots = async (): Promise<void> => {
    const entries = await db.scoutingData.toArray() as ScoutingEntry[];
    const grouped = new Map<string, { teamNumber: number; eventKey: string; entries: ScoutingEntry[] }>();

    for (const entry of entries) {
        const key = toStrategyKey(entry);
        if (!key) {
            continue;
        }

        const id = toSnapshotId(key.teamNumber, key.eventKey);
        const existing = grouped.get(id);
        if (existing) {
            existing.entries.push(entry);
            continue;
        }

        grouped.set(id, {
            teamNumber: key.teamNumber,
            eventKey: key.eventKey,
            entries: [entry],
        });
    }

    const snapshots = Array.from(grouped.values()).map(({ teamNumber, eventKey, entries: scopedEntries }) =>
        buildStrategySnapshot(teamNumber, eventKey, scopedEntries)
    );

    await db.transaction("rw", db.strategySnapshots, db.strategyCacheMetadata, async () => {
        await db.strategySnapshots.clear();
        if (snapshots.length > 0) {
            await db.strategySnapshots.bulkPut(snapshots);
        }
        await putMetadata();
    });
};

export const ensureStrategySnapshotsCurrent = async (): Promise<void> => {
    const [metadata, entryCount, snapshotCount] = await Promise.all([
        db.strategyCacheMetadata.get(STRATEGY_SNAPSHOT_METADATA_ID),
        db.scoutingData.count(),
        db.strategySnapshots.count(),
    ]);

    if (
        !metadata ||
        metadata.version !== STRATEGY_SNAPSHOT_CACHE_VERSION ||
        (entryCount > 0 && snapshotCount === 0)
    ) {
        await rebuildStrategySnapshots();
    }
};

export const getStrategySnapshots = async (eventKey?: string): Promise<StrategySnapshot[]> => {
    await ensureStrategySnapshotsCurrent();

    if (eventKey) {
        return await db.strategySnapshots.where("eventKey").equals(normalizeEventKey(eventKey)).toArray();
    }

    return await db.strategySnapshots.toArray();
};

export const applyScoutingEntryUpsertToStrategySnapshots = async (
    entry: ScoutingEntryBase,
    previousEntry?: ScoutingEntryBase
): Promise<void> => {
    const keys = uniqueStrategyKeys(
        [entry, previousEntry]
            .filter((candidate): candidate is ScoutingEntryBase => !!candidate)
            .map(candidate => toStrategyKey(candidate))
            .filter((candidate): candidate is StrategyKey => !!candidate)
    );

    if (keys.length === 0) {
        return;
    }

    await db.transaction("rw", db.strategySnapshots, db.strategyCacheMetadata, async () => {
        for (const key of keys) {
            await recomputeKey(key);
        }

        await putMetadata();
    });
};

export const applyScoutingEntriesUpsertToStrategySnapshots = async (
    entries: ScoutingEntryBase[],
    previousEntries: ScoutingEntryBase[] = []
): Promise<void> => {
    const keys = uniqueStrategyKeys(
        [...entries, ...previousEntries]
            .map(entry => toStrategyKey(entry))
            .filter((candidate): candidate is StrategyKey => !!candidate)
    );

    if (keys.length === 0) {
        return;
    }

    await db.transaction("rw", db.strategySnapshots, db.strategyCacheMetadata, async () => {
        for (const key of keys) {
            await recomputeKey(key);
        }

        await putMetadata();
    });
};

export const applyScoutingEntryDeleteToStrategySnapshots = async (entry: ScoutingEntryBase): Promise<void> => {
    const key = toStrategyKey(entry);
    if (!key) {
        return;
    }

    await db.transaction("rw", db.strategySnapshots, db.strategyCacheMetadata, async () => {
        await recomputeKey(key);
        await putMetadata();
    });
};
