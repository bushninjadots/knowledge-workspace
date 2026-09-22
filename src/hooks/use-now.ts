import { useSyncExternalStore } from "react";

/**
 * Shared wall-clock ticker. Relative timestamps ("2m ago", poll countdowns)
 * need periodic re-renders, but a 30s setInterval per card means a 50-post
 * feed runs 50 timers and re-renders 50 components every half minute.
 *
 * One module-level interval drives every subscriber; useSyncExternalStore
 * deduplicates re-renders to components whose returned value actually changes
 * (React compares the snapshot between renders).
 */
let now = Date.now();

const subscribers = new Set<() => void>();
let timer: number | undefined;

function start() {
  if (timer !== undefined) return;
  timer = window.setInterval(() => {
    now = Date.now();
    for (const notify of subscribers) notify();
  }, 30_000);
}

function stop() {
  if (timer === undefined) return;
  window.clearInterval(timer);
  timer = undefined;
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  start();
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0) stop();
  };
}

/**
 * Current wall-clock time (ms), refreshed every 30 seconds while subscribed.
 * On the server the snapshot is the render-time timestamp, so SSR markup and
 * the first client render agree.
 */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    // Server snapshot: no subscription exists there, so return render time.
    () => now,
  );
}
