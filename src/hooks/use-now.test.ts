import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNow } from "@/hooks/use-now";

/**
 * Relative timestamps are everywhere (feeds, chat, poll countdowns), and the
 * whole point of this hook is that the cost stays flat: one timer for the page,
 * not one per card. Both halves of that promise are easy to break silently —
 * a stale timestamp that never re-renders, or N timers that all keep running.
 */
describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("drives every subscriber from a single 30s interval", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const a = renderHook(() => useNow());
    const b = renderHook(() => useNow());
    const c = renderHook(() => useNow());

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy.mock.calls[0][1]).toBe(30_000);

    // Same snapshot for everyone, so they agree on "now" within a tick.
    expect(b.result.current).toBe(a.result.current);
    expect(c.result.current).toBe(a.result.current);
  });

  it("keeps the snapshot stable until the interval elapses", () => {
    const { result } = renderHook(() => useNow());
    const before = result.current;
    expect(before).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(before);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBeGreaterThanOrEqual(before + 30_000);
  });

  it("stops the interval when the last subscriber leaves and restarts later", () => {
    const clearSpy = vi.spyOn(window, "clearInterval");
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const first = renderHook(() => useNow());
    const second = renderHook(() => useNow());
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    first.unmount();
    // One subscriber left, so the timer must survive — dropping it here would
    // freeze the remaining card's timestamp.
    expect(clearSpy).not.toHaveBeenCalled();

    second.unmount();
    expect(clearSpy).toHaveBeenCalledTimes(1);

    // A later mount starts a fresh timer rather than reusing a cleared handle.
    const third = renderHook(() => useNow());
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(third.result.current).toBeGreaterThan(0);
  });
});
