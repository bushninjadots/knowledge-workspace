export type ActivityLike = { actor_id: string | null; created_at: string };

const DAY = 24 * 60 * 60 * 1000;
export const HEAT_WINDOW_DAYS = 28;
export const HEAT_BUCKETS = 4;

/**
 * Bucket activity rows per actor into four 7-day windows (oldest → newest)
 * over the last 28 days. Rows without an actor and rows outside the window
 * (or in the future) are ignored. Used by the contribution heat strips on
 * the project people roster — signal, not decoration.
 */
export function bucketContributorActivity(
  rows: ActivityLike[],
  now: number = Date.now(),
): Map<string, number[]> {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.actor_id) continue;
    const age = now - new Date(row.created_at).getTime();
    if (age < 0 || age >= HEAT_WINDOW_DAYS * DAY) continue;
    const index = HEAT_BUCKETS - 1 - Math.floor(age / (7 * DAY));
    const arr = buckets.get(row.actor_id) ?? new Array<number>(HEAT_BUCKETS).fill(0);
    arr[index] += 1;
    buckets.set(row.actor_id, arr);
  }
  return buckets;
}
