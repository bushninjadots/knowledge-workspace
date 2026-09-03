import type { StudioSnapshot } from '../types/studio';

/** Deep clone — snapshots must never share references with live state. */
export function cloneSnapshot(snapshot: StudioSnapshot): StudioSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as StudioSnapshot;
}

export interface HistoryEntry {
  snapshot: StudioSnapshot;
  label: string;
}

export const HISTORY_LIMIT = 50;

export function pushHistory(stack: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...stack, entry];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}