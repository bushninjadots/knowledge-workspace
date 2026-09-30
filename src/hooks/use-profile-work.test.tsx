// ── use-profile-work ──────────────────────────────────────────────────────────
// The public profile's work evidence is the surface that carries Tethyr's core
// claim, and it is the only place a visitor sees a person's work without the
// owner having touched the Studio editor. Two behaviours are load-bearing and
// neither is visible in the type system:
//
//   1. a private project must never surface, and
//   2. two people on three projects are one collaborator, not three rows.
//
// (1) is enforced by RLS on the nested `projects` embed, not by a client filter,
// so the test asserts the *response shape* RLS produces: a membership row whose
// `projects` is null. If a future migration ever widens that policy, this test
// is where it should fail.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => from(...a) },
}));

import { useProfileWork, useProjectOpenWork, openWorkCount } from "./use-profile-work";

function chain(result: unknown) {
  const q = {
    select: () => q,
    eq: () => q,
    neq: () => q,
    in: () => q,
    limit: () => Promise.resolve({ data: result, error: null }),
  };
  return q;
}

/** Chain without .limit — the open-work reads terminate on the builder itself. */
function openChain(result: unknown, error: unknown = null) {
  const q = {
    select: () => q,
    in: () => Promise.resolve({ data: result, error }),
  };
  return q;
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  from.mockReset();
});

describe("useProfileWork", () => {
  it("returns the person's projects with the role they hold on each", async () => {
    from.mockReturnValueOnce(
      chain([
        {
          project_id: "p1",
          role: "creator",
          projects: { id: "p1", title: "Bloom", status: "active" },
        },
        {
          project_id: "p2",
          role: "contributor",
          projects: { id: "p2", title: "Reverb", status: "planning" },
        },
      ]),
    );
    from.mockReturnValueOnce(chain([]));

    const { result } = renderHook(() => useProfileWork("me"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.projects).toEqual([
      expect.objectContaining({ title: "Bloom", role: "creator" }),
      expect.objectContaining({ title: "Reverb", role: "contributor" }),
    ]);
  });

  it("drops membership rows whose project is null (private, hidden by RLS)", async () => {
    from.mockReturnValueOnce(
      chain([
        // RLS lets the membership row through but nulls the private project.
        { project_id: "secret", role: "creator", projects: null },
        {
          project_id: "p1",
          role: "creator",
          projects: { id: "p1", title: "Atlas", status: "active" },
        },
      ]),
    );
    from.mockReturnValueOnce(chain([]));

    const { result } = renderHook(() => useProfileWork("me"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.projects).toHaveLength(1);
    expect(result.current.data?.projects[0].title).toBe("Atlas");
    expect(result.current.data?.hasWork).toBe(true);
  });

  it("collapses repeat collaborators and ranks them by shared projects", async () => {
    from.mockReturnValueOnce(
      chain([
        {
          project_id: "p1",
          role: "creator",
          projects: { id: "p1", title: "Bloom", status: "active" },
        },
      ]),
    );
    from.mockReturnValueOnce(
      chain([
        { project_id: "p1", profile_id: "a", profile: { handle: "ada", display_name: "Ada" } },
        { project_id: "p1", profile_id: "b", profile: { handle: "bo", display_name: "Bo" } },
        { project_id: "p1", profile_id: "b", profile: { handle: "bo", display_name: "Bo" } },
        { project_id: "p1", profile_id: "c", profile: { handle: "cy", display_name: "Cy" } },
        { project_id: "p1", profile_id: "c", profile: { handle: "cy", display_name: "Cy" } },
        { project_id: "p1", profile_id: "c", profile: { handle: "cy", display_name: "Cy" } },
        // No handle → not linkable → cannot be a "builds with" entry.
        { project_id: "p1", profile_id: "ghost", profile: { handle: null, display_name: "Ghost" } },
      ]),
    );

    const { result } = renderHook(() => useProfileWork("me"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const collab = result.current.data?.collaborators ?? [];
    // Ranked by strength of relationship, and the handle-less row is dropped.
    expect(collab.map((c) => c.profile?.handle)).toEqual(["cy", "bo", "ada"]);
    // Cy appeared on three rows; they are still one person.
    expect(collab[0].sharedProjectCount).toBe(3);
    expect(collab[1].sharedProjectCount).toBe(2);
    expect(collab[2].sharedProjectCount).toBe(1);
    // Three raw rows collapsed to three distinct people, not five.
    expect(collab).toHaveLength(3);
  });

  it("reports no work without querying collaborators at all", async () => {
    from.mockReturnValueOnce(chain([]));

    const { result } = renderHook(() => useProfileWork("me"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ projects: [], collaborators: [], hasWork: false });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("stays disabled without a profile id", () => {
    renderHook(() => useProfileWork(null), { wrapper: wrapper() });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("useProjectOpenWork", () => {
  it("counts unfilled needs and roles per project in one batched read", async () => {
    from
      .mockReturnValueOnce(
        openChain([
          { project_id: "p1", is_filled: false },
          { project_id: "p1", is_filled: false },
          { project_id: "p1", is_filled: true }, // filled — not a spot
          { project_id: "p2", is_filled: false },
        ]),
      )
      .mockReturnValueOnce(openChain([{ project_id: "p2", is_filled: false }]));

    const { result } = renderHook(() => useProjectOpenWork(["p1", "p2"]), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const open = result.current.data;
    expect(open?.get("p1")).toEqual({ roles: 0, needs: 2 });
    expect(open?.get("p2")).toEqual({ roles: 1, needs: 1 });
    expect(openWorkCount(open, "p1")).toBe(2);
    expect(openWorkCount(open, "p2")).toBe(2);
    // A project with no open work is simply absent.
    expect(open?.has("p3")).toBe(false);
    expect(openWorkCount(open, "p3")).toBe(0);
  });

  it("degrades to no-signal when a read fails — never a wrong badge", async () => {
    from
      .mockReturnValueOnce(openChain(null, { message: "rls error" }))
      .mockReturnValueOnce(openChain([{ project_id: "p1", is_filled: false }]));

    const { result } = renderHook(() => useProjectOpenWork(["p1"]), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The map exists and is empty: the badge omits itself, cards still render.
    expect(result.current.data?.size).toBe(0);
  });

  it("stays disabled with no project ids", () => {
    renderHook(() => useProjectOpenWork(null), { wrapper: wrapper() });
    expect(from).not.toHaveBeenCalled();
  });
});
