import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";
import {
  useProjectReturnChanges,
  useProjectWatchStatus,
  useMarkProjectVisited,
  useToggleProjectWatch,
  useUpdateProjectDirection,
  useCreateProjectContribution,
  useRecognizeProjectActivity,
} from "./use-project-loop";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

const handle = createFakeSupabase();

function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  handle.reset();
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
});

describe("useProjectWatchStatus", () => {
  it("reports whether the current user watches a project", async () => {
    handle.on("project_watchers:select", () => ({
      data: { project_id: "project-1" },
      error: null,
    }));
    const { result } = renderHook(() => useProjectWatchStatus("project-1"), {
      wrapper: makeWrapper(newQueryClient()),
    });
    await waitFor(() => expect(result.current.data).toBe(true));
  });

  it("treats a missing table as not watching", async () => {
    handle.on("project_watchers:select", () => ({
      data: null,
      error: { code: "42P01" },
    }));
    const { result } = renderHook(() => useProjectWatchStatus("project-1"), {
      wrapper: makeWrapper(newQueryClient()),
    });
    await waitFor(() => expect(result.current.data).toBe(false));
  });
});

describe("useToggleProjectWatch", () => {
  it("watches a project via upsert", async () => {
    handle.on("project_watchers:upsert", () => ({ data: null, error: null }));
    const { result } = renderHook(() => useToggleProjectWatch(), {
      wrapper: makeWrapper(newQueryClient()),
    });
    await act(async () => {
      await result.current.mutateAsync({ projectId: "project-1", watching: true });
    });
    const call = handle.calls.find((c) => c.action === "upsert");
    expect(call?.table).toBe("project_watchers");
    expect(call?.value).toEqual({ project_id: "project-1", user_id: "user-1" });
  });

  it("stops watching a project via delete", async () => {
    handle.on("project_watchers:delete", () => ({ data: null, error: null }));
    const { result } = renderHook(() => useToggleProjectWatch(), {
      wrapper: makeWrapper(newQueryClient()),
    });
    await act(async () => {
      await result.current.mutateAsync({ projectId: "project-1", watching: false });
    });
    const call = handle.calls.find((c) => c.action === "delete");
    expect(call?.table).toBe("project_watchers");
  });
});

describe("useMarkProjectVisited", () => {
  it("upserts a private last-seen cursor on visit", async () => {
    handle.on("project_visits:upsert", () => ({ data: null, error: null }));
    const { result } = renderHook(() => useMarkProjectVisited(), {
      wrapper: makeWrapper(newQueryClient()),
    });
    await act(async () => {
      await result.current.mutateAsync("project-1");
    });
    const call = handle.calls.find((c) => c.action === "upsert");
    expect(call?.table).toBe("project_visits");
    expect(call?.value).toMatchObject({ project_id: "project-1", user_id: "user-1" });
  });
});

describe("useUpdateProjectDirection", () => {
  it("persists season, brief, and lineage together", async () => {
    handle.on("projects:update", () => ({ data: null, error: null }));
    const { result } = renderHook(() => useUpdateProjectDirection(), {
      wrapper: makeWrapper(newQueryClient()),
    });
    await act(async () => {
      await result.current.mutateAsync({
        projectId: "project-1",
        season: "prototype",
        brief: { need: "feedback" },
        lineage: { label: "sequel" },
      });
    });
    const call = handle.calls.find((c) => c.action === "update");
    expect(call?.table).toBe("projects");
    expect(call?.value).toEqual({
      season: "prototype",
      collaboration_brief: { need: "feedback" },
      lineage: { label: "sequel" },
    });
  });
});

describe("useCreateProjectContribution", () => {
  it("inserts trimmed evidence with normalized metadata", async () => {
    handle.on("project_activity:insert", () => ({
      data: { id: "activity-1" },
      error: null,
    }));
    const queryClient = newQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateProjectContribution(), {
      wrapper: makeWrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({
        projectId: "project-1",
        title: "  Shipped ",
        body: "  a demo ",
        evidenceUrl: "https://img/a.png",
        evidenceKind: "image",
      });
    });
    const call = handle.calls.find((c) => c.action === "insert");
    expect(call?.table).toBe("project_activity");
    expect(call?.value).toMatchObject({
      project_id: "project-1",
      actor_id: "user-1",
      kind: "contribution",
      title: "Shipped",
      body: "a demo",
    });
    expect((call?.value as { metadata: unknown }).metadata).toEqual({
      evidence_url: "https://img/a.png",
      evidence_kind: "image",
      entry_kind: "contribution",
      prompt_id: null,
    });
    expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
      expect.arrayContaining([
        ["project-activity", "project-1"],
        ["project-detail", "project-1"],
        ["project-credits", "project-1"],
        ["studio-credits"],
        ["reputation-breakdown"],
        ["contribution-log"],
        ["public-profile"],
        ["project-return-changes"],
      ]),
    );
  });
});

describe("useRecognizeProjectActivity", () => {
  it("records recognition against the evidence item", async () => {
    handle.on("project_recognitions:insert", () => ({
      data: { id: "r1", kind: "helpful_feedback" },
      error: null,
    }));
    const { result } = renderHook(() => useRecognizeProjectActivity(), {
      wrapper: makeWrapper(newQueryClient()),
    });
    await act(async () => {
      await result.current.mutateAsync({
        projectActivityId: "a1",
        projectId: "project-1",
        recipientId: "user-2",
        kind: "helpful_feedback",
      });
    });
    const call = handle.calls.find((c) => c.action === "insert");
    expect(call?.table).toBe("project_recognitions");
    expect(call?.value).toMatchObject({
      project_activity_id: "a1",
      project_id: "project-1",
      giver_id: "user-1",
      recipient_id: "user-2",
      kind: "helpful_feedback",
    });
  });
});

describe("useProjectReturnChanges", () => {
  it("maps watched-project activity and sorts newest first", async () => {
    handle.on("project_watchers:select", () => ({
      data: [{ project_id: "project-1" }],
      error: null,
    }));
    handle.on("project_visits:select", () => ({ data: [], error: null }));
    handle.on("projects:select", () => ({
      data: [{ id: "project-1", title: "Return Loop" }],
      error: null,
    }));
    handle.on("project_activity:select", () => ({
      data: [
        {
          id: "a1",
          project_id: "project-1",
          title: "Older",
          kind: "contribution",
          body: null,
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "a2",
          project_id: "project-1",
          title: "Newer",
          kind: "contribution",
          body: "body",
          created_at: "2026-02-01T00:00:00Z",
        },
      ],
      error: null,
    }));
    const { result } = renderHook(() => useProjectReturnChanges(), {
      wrapper: makeWrapper(newQueryClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].title).toBe("Newer");
    expect(result.current.data?.[0].projectTitle).toBe("Return Loop");
  });

  it("returns an empty shelf when nothing is watched", async () => {
    handle.on("project_watchers:select", () => ({ data: [], error: null }));
    const { result } = renderHook(() => useProjectReturnChanges(), {
      wrapper: makeWrapper(newQueryClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
