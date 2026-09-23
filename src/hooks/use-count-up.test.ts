import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountUp } from "./use-count-up";

type AnyObserver = {
  callback: IntersectionObserverCallback;
  elements: Set<Element>;
};

function elementsOf(observer: AnyObserver) {
  return [...observer.elements];
}

beforeEach(() => {
  vi.useFakeTimers();
  // Drive rAF through fake timers so the easing run is deterministic.
  let rafId = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = ++rafId;
    vi.setSystemTime(new Date(0));
    setTimeout(() => cb(performance.now() + 16), 16);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id as unknown as number));
  // jsdom lacks matchMedia — default to "no reduced motion".
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

function triggerIntersection() {
  const instances = (window as unknown as { IntersectionObserver: { instances: AnyObserver[] } })
    .IntersectionObserver.instances;
  const observer = instances.at(-1);
  if (!observer) throw new Error("no IntersectionObserver created");
  observer.callback(
    [
      {
        isIntersecting: true,
        target: elementsOf(observer)[0],
      } as unknown as IntersectionObserverEntry,
    ],
    observer as unknown as IntersectionObserver,
  );
}

describe("useCountUp", () => {
  it("starts at 0 and eases to the target once the element is in view", () => {
    const { result, rerender } = renderHook(({ target }) => useCountUp(target), {
      initialProps: { target: 0 },
    });
    act(() => {
      result.current.ref.current = document.createElement("p");
    });
    rerender({ target: 1200 });

    expect(result.current.value).toBe(0);
    act(() => triggerIntersection());
    act(() => vi.advanceTimersByTime(820));
    expect(result.current.value).toBe(1200);
  });

  it("snaps straight to the target under prefers-reduced-motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    const { result, rerender } = renderHook(({ target }) => useCountUp(target), {
      initialProps: { target: 0 },
    });
    act(() => {
      result.current.ref.current = document.createElement("p");
    });
    rerender({ target: 42 });
    expect(result.current.value).toBe(42);
  });

  it("stays at 0 for a zero target", () => {
    const { result, rerender } = renderHook(({ target }) => useCountUp(target), {
      initialProps: { target: 0 },
    });
    act(() => {
      result.current.ref.current = document.createElement("p");
    });
    rerender({ target: 0 });
    expect(result.current.value).toBe(0);
  });
});
