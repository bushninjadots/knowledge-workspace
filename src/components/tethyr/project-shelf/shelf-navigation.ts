export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export type WheelStep = {
  accumulated: number;
  direction: 1 | -1 | null;
};

/**
 * Accumulate wheel deltas and decide whether a browse step should fire.
 * Below the threshold it keeps accumulating (so small trackpad increments
 * still eventually navigate); crossing the threshold navigates once and
 * resets the accumulator.
 */
export function wheelStep(accumulated: number, delta: number, threshold = 40): WheelStep {
  const next = accumulated + delta;
  if (Math.abs(next) < threshold) {
    return { accumulated: next, direction: null };
  }
  return { accumulated: 0, direction: next > 0 ? 1 : -1 };
}

/** Drag/swipe direction: a leftward drag (negative dx) advances forward. */
export function dragDirection(dx: number): 1 | -1 {
  return dx < 0 ? 1 : -1;
}
