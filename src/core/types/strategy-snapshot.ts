import type { TeamStats } from "./team-stats";

export const STRATEGY_SNAPSHOT_CACHE_VERSION = 1;
export const STRATEGY_SNAPSHOT_METADATA_ID = "strategy-snapshot-cache";

export interface StrategySnapshot extends TeamStats {
    id: string;
    teamNumber: number;
    eventKey: string;
    cacheVersion: number;
    updatedAt: number;
}

export interface StrategySnapshotCacheMetadata {
    id: string;
    version: number;
    updatedAt: number;
}
