// ── useProfileRepoSnapshot ────────────────────────────────────────────────────
// The profile-level GitHub facts: one batched read over the safe view, mapped
// to per-project stats and one aggregate 52-week graph. Mocked client, so the
// mapping and aggregation are pinned offline.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const safeFrom = vi.fn();
vi.mock("@/lib/supabase-pending-schema", () => ({
  supabasePending: {
    from: (...a: unknown[]) => safeFrom(...a),
  },
}));

import { useProfileRepoSnapshot } from "./use-profile-repo-snapshot";

beforeEach(() => {
  safeFrom.mockClear();
});

const WEEK = 1_700_000_000;
const weeks = (totals: number[]) =>
  totals.map((total, i) => ({ week: WEEK + i * 604_800, total, days: [total, 0, 0, 0, 0, 0, 0] }));

function mockSafeSelect(rows: unknown) {
  safeFrom.mockImplementation(() => {
    const b: Record<string, unknown> = {
      select: vi.fn(() => b),
      in: vi.fn(() => Promise.resolve({ data: rows, error: null })),
    };
    return b;
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useProfileRepoSnapshot", () => {
  it("maps per-project stats and merges histories into one aggregate", async () => {
    mockSafeSelect([
      {
        project_id: "p1",
        metadata: {
          full_name: "maya/threadline-app",
          stargazers_count: 12,
          language: "TypeScript",
          private: false,
          commit_activity: weeks([2, 3]),
        },
      },
      {
        project_id: "p2",
        metadata: {
          full_name: "maya/tomebase",
          stargazers_count: 0,
          language: "TypeScript",
          private: false,
          commit_activity: weeks([4]),
        },
      },
    ]);

    const { result } = renderHook(() => useProfileRepoSnapshot(["p1", "p2"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.byProject.get("p1")?.stargazersCount).toBe(12);
    expect(result.current.data?.byProject.get("p2")?.fullName).toBe("maya/tomebase");
    // Weeks aligned by timestamp: week0 = 2+4, week1 = 3.
    expect(result.current.data?.aggregateWeeks).toEqual([
      { week: WEEK, total: 6, days: [6, 0, 0, 0, 0, 0, 0] },
      { week: WEEK + 604_800, total: 3, days: [3, 0, 0, 0, 0, 0, 0] },
    ]);
    expect(result.current.data?.totalCommits).toBe(9);
    expect(result.current.data?.reposWithHistory).toBe(2);
  });

  it("repos without cached history are mapped but contribute no weeks", async () => {
    mockSafeSelect([
      { project_id: "p1", metadata: { full_name: "maya/x", stargazers_count: 1 } },
      { project_id: "p2", metadata: { commit_activity: [] } },
    ]);

    const { result } = renderHook(() => useProfileRepoSnapshot(["p1", "p2"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.byProject.size).toBe(2);
    expect(result.current.data?.aggregateWeeks).toEqual([]);
    expect(result.current.data?.reposWithHistory).toBe(0);
  });

  it("an empty project list never fires the read", () => {
    const { result } = renderHook(() => useProfileRepoSnapshot([]), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(safeFrom).not.toHaveBeenCalled();
  });
});
