import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes";

/**
 * This guard is the only thing keeping an in-flight edit from being lost on
 * settings forms, the library editor, and the message composer. It has two
 * independent halves — the browser's beforeunload dialog and the router's
 * in-app navigation block — and getting either wrong is silent: the user just
 * loses their text.
 */
const blocker = vi.hoisted(() => ({
  shouldBlock: undefined as undefined | ((args?: unknown) => boolean),
  enabled: [] as (boolean | undefined)[],
}));

vi.mock("@tanstack/react-router", () => ({
  useBlocker: (fn: (args?: unknown) => boolean, enabled?: boolean) => {
    blocker.shouldBlock = fn;
    blocker.enabled.push(enabled);
  },
}));

type BeforeUnloadHandler = (event: { preventDefault: () => void; returnValue: unknown }) => unknown;

/**
 * Captures the beforeunload listener rather than dispatching a real event:
 * jsdom implements only the legacy boolean `Event.returnValue`, so a string
 * assignment cannot be read back and the assertion would be vacuous.
 */
function listenerSpy() {
  const handlers: BeforeUnloadHandler[] = [];
  const add = vi.spyOn(window, "addEventListener").mockImplementation(((
    type: string,
    handler: unknown,
  ) => {
    if (type === "beforeunload") handlers.push(handler as BeforeUnloadHandler);
  }) as typeof window.addEventListener);

  return {
    add,
    handlers,
    fire() {
      const event = { preventDefault: vi.fn(), returnValue: undefined as unknown };
      const result = handlers.at(-1)?.(event);
      return { event, result };
    },
  };
}

beforeEach(() => {
  blocker.shouldBlock = undefined;
  blocker.enabled = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUnsavedChangesGuard", () => {
  it("installs no listener while the form is clean", () => {
    const spy = listenerSpy();
    renderHook(() => useUnsavedChangesGuard(false));

    expect(spy.handlers).toHaveLength(0);
    expect(blocker.enabled).toEqual([false]);
  });

  it("blocks the browser dialog while dirty", () => {
    const spy = listenerSpy();
    renderHook(() => useUnsavedChangesGuard(true));
    const { event, result } = spy.fire();

    expect(spy.handlers).toHaveLength(1);
    expect(event.preventDefault).toHaveBeenCalled();
    // Chrome only shows the dialog when returnValue is set.
    expect(event.returnValue).toBe("You have unsaved changes. Leave anyway?");
    expect(result).toBe("You have unsaved changes. Leave anyway?");
  });

  it("uses the caller's message in both halves", () => {
    const spy = listenerSpy();
    renderHook(() => useUnsavedChangesGuard(true, "Discard this draft?"));
    expect(spy.fire().event.returnValue).toBe("Discard this draft?");

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    expect(blocker.shouldBlock?.()).toBe(true);
    expect(confirm).toHaveBeenCalledWith("Discard this draft?");
  });

  it("removes the listener when the form becomes clean", () => {
    const spy = listenerSpy();
    const remove = vi.spyOn(window, "removeEventListener");
    const { rerender } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty), {
      initialProps: { dirty: true },
    });

    rerender({ dirty: false });

    expect(remove.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(1);
    expect(blocker.enabled).toEqual([true, false]);
    expect(spy.handlers).toHaveLength(1);
  });

  it("removes the listener on unmount", () => {
    listenerSpy();
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useUnsavedChangesGuard(true));

    unmount();
    expect(remove.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(1);
  });

  it("lets the user leave when they confirm, and blocks when they cancel", () => {
    renderHook(() => useUnsavedChangesGuard(true));

    vi.spyOn(window, "confirm").mockReturnValue(true);
    expect(blocker.shouldBlock?.()).toBe(false);

    vi.spyOn(window, "confirm").mockReturnValue(false);
    expect(blocker.shouldBlock?.()).toBe(true);
  });

  it("never blocks when the form is clean", () => {
    const confirm = vi.spyOn(window, "confirm");
    renderHook(() => useUnsavedChangesGuard(false));

    expect(blocker.shouldBlock?.()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });
});
