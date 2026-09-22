import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOnlineStatus } from "@/hooks/use-online-status";

/**
 * Offline-aware surfaces (retry banners, queued-write messaging) read this. The
 * two ways it breaks are a wrong first value after hydration, and a leaked pair
 * of window listeners on every mount.
 */
function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

afterEach(() => {
  vi.restoreAllMocks();
  setNavigatorOnline(true);
});

describe("useOnlineStatus", () => {
  it("starts online and syncs to the real browser state after mount", () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("follows offline and online events", () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("removes both listeners on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();

    expect(remove.mock.calls.map(([type]) => type).sort()).toEqual(["offline", "online"]);
  });
});
