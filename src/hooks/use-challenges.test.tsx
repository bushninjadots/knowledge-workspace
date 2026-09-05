import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useChallenges,
  useCreateChallenge,
  useJoinChallenge,
  useLeaveChallenge,
  useUpdateChallengeProgress,
  useSubmitChallengeWork,
} from "./use-challenges";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

const handle = createFakeSupabase();

function renderHookWithClient<TReturn>(useHook: () => TReturn) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...renderHook(useHook, { wrapper }), qc };
}

beforeEach(() => handle.reset());

// --- useChallenges (catalog with join + creator info) ---------------------

describe("useChallenges", () => {
  const challengeRow = {
    id: "ch-1",
    title: "Ship a CLI",
    description: "Build a terminal todo app",
    type: "skill",
    skills: ["typescript"],
    difficulty: "beginner",
    start_date: null,
    end_date: null,
    max_participants: null,
    pass_criteria: null,
    status: "active",
    created_by: "creator-1",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    project_id: null,
    is_starter: true,
  } as const;

  it("joins creator profiles and participant counts, flagging my membership", async () => {
    handle.on("challenges:select", () => ({ data: [challengeRow], error: null }));
    handle.on("challenge_participants:select", () => ({
      data: [
        { challenge_id: "ch-1", user_id: "user-1", status: "joined" },
        { challenge_id: "ch-1", user_id: "other", status: "in_progress" },
      ],
      error: null,
    }));
    handle.on("profiles:select", () => ({
      data: [{ id: "creator-1", display_name: "Ada", handle: "ada", avatar_url: null }],
      error: null,
    }));

    const { result } = renderHookWithClient(() => useChallenges("active"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    const row = result.current.data![0];
    expect(row.creator).toEqual({
      id: "creator-1",
      display_name: "Ada",
      handle: "ada",
      avatar_url: null,
    });
    expect(row.participant_count).toBe(2);
    expect(row.is_joined).toBe(true);
    expect(row.my_participation).toEqual(
      expect.objectContaining({ user_id: "user-1", status: "joined" }),
    );
  });

  it("falls back to a Community Member label when the creator row is missing", async () => {
    handle.on("challenges:select", () => ({ data: [challengeRow], error: null }));
    handle.on("challenge_participants:select", () => ({ data: [], error: null }));
    handle.on("profiles:select", () => ({ data: [], error: null }));

    const { result } = renderHookWithClient(() => useChallenges("active"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data![0].creator).toEqual({
      display_name: "Community Member",
      handle: "creator",
      avatar_url: null,
    });
    expect(result.current.data![0].is_joined).toBe(false);
  });

  it("returns an empty list when the challenges table is missing (42P01)", async () => {
    handle.on("challenges:select", () => ({
      data: null,
      error: { code: "42P01", message: "Could not find the table" },
    }));

    const { result } = renderHookWithClient(() => useChallenges("all"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

// --- useCreateChallenge ---------------------------------------------------

describe("useCreateChallenge", () => {
  it("applies default type/difficulty and seats the creator", async () => {
    handle.on("challenges:insert", () => ({ data: { id: "ch-1" }, error: null }));

    const { result } = renderHookWithClient(() => useCreateChallenge());
    await act(async () => {
      await result.current.mutateAsync({ title: "Learn Go", description: "Basics" });
    });

    const insert = handle.calls.find((c) => c.table === "challenges" && c.action === "insert");
    expect(insert?.value).toMatchObject({
      title: "Learn Go",
      description: "Basics",
      type: "skill",
      skills: [],
      difficulty: "intermediate",
      start_date: null,
      end_date: null,
      max_participants: null,
      pass_criteria: null,
      project_id: null,
      created_by: "user-1",
    });
  });

  it("preserves explicit fields and ties to a project when provided", async () => {
    handle.on("challenges:insert", () => ({ data: { id: "ch-1" }, error: null }));

    const { result } = renderHookWithClient(() => useCreateChallenge());
    await act(async () => {
      await result.current.mutateAsync({
        title: "Ship it",
        description: "Launch a CLI tool",
        type: "project",
        difficulty: "advanced",
        skills: ["rust", "cli"],
        max_participants: 5,
        project_id: "proj-9",
      });
    });

    const insert = handle.calls.find((c) => c.table === "challenges" && c.action === "insert");
    expect(insert?.value).toMatchObject({
      type: "project",
      difficulty: "advanced",
      skills: ["rust", "cli"],
      max_participants: 5,
      project_id: "proj-9",
    });
  });

  it("refuses to create a challenge without a session", async () => {
    handle.client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const { result } = renderHookWithClient(() => useCreateChallenge());
    await act(async () => {
      await expect(result.current.mutateAsync({ title: "X", description: "" })).rejects.toThrow(
        "Not authenticated",
      );
    });
    expect(handle.calls).toEqual([]);
  });

  it("invalidates the challenges catalog after creating", async () => {
    handle.on("challenges:insert", () => ({ data: { id: "ch-1" }, error: null }));

    const { result, qc } = renderHookWithClient(() => useCreateChallenge());
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync({ title: "X", description: "" });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["challenges"] });
  });
});

// --- useJoinChallenge / useLeaveChallenge ---------------------------------

describe("useJoinChallenge", () => {
  it("inserts a joined participant row for the current user", async () => {
    handle.on("challenge_participants:insert", () => ({ data: { id: "p-1" }, error: null }));

    const { result } = renderHookWithClient(() => useJoinChallenge());
    await act(async () => {
      await result.current.mutateAsync("ch-1");
    });

    const insert = handle.calls.find(
      (c) => c.table === "challenge_participants" && c.action === "insert",
    );
    expect(insert?.value).toEqual({ challenge_id: "ch-1", user_id: "user-1", status: "joined" });
  });

  it("requires a session before joining", async () => {
    handle.client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const { result } = renderHookWithClient(() => useJoinChallenge());
    await act(async () => {
      await expect(result.current.mutateAsync("ch-1")).rejects.toThrow("Not authenticated");
    });
    expect(handle.calls).toEqual([]);
  });
});

describe("useLeaveChallenge", () => {
  it("deletes only the caller's own participant row", async () => {
    handle.on("challenge_participants:delete", () => ({ data: null, error: null }));

    const { result } = renderHookWithClient(() => useLeaveChallenge());
    await act(async () => {
      await result.current.mutateAsync("ch-1");
    });

    const del = handle.calls.find(
      (c) => c.table === "challenge_participants" && c.action === "delete",
    );
    expect(del?.value).toBeUndefined();
  });
});

// --- useUpdateChallengeProgress -------------------------------------------

describe("useUpdateChallengeProgress", () => {
  it("updates status and progress scoped to the user's participation", async () => {
    handle.on("challenge_participants:update", () => ({ data: { id: "p-1" }, error: null }));

    const { result } = renderHookWithClient(() => useUpdateChallengeProgress());
    await act(async () => {
      await result.current.mutateAsync({
        challengeId: "ch-1",
        status: "in_progress",
        progress: { steps_done: 2 },
      });
    });

    const update = handle.calls.find(
      (c) => c.table === "challenge_participants" && c.action === "update",
    );
    expect(update?.value).toEqual({
      status: "in_progress",
      progress: { steps_done: 2 },
    });
  });
});

// --- useSubmitChallengeWork -----------------------------------------------

describe("useSubmitChallengeWork", () => {
  it("marks the submission as completed + submitted and trims the note", async () => {
    handle.on("challenge_participants:update", () => ({ data: { id: "p-1" }, error: null }));

    const { result } = renderHookWithClient(() => useSubmitChallengeWork());
    await act(async () => {
      await result.current.mutateAsync({
        challengeId: "ch-1",
        submissionUrl: "https://example.com/repo",
        submissionNote: "  done!  ",
      });
    });

    const update = handle.calls.find(
      (c) => c.table === "challenge_participants" && c.action === "update",
    );
    expect(update?.value).toMatchObject({
      status: "completed",
      review_status: "submitted",
      submission_url: "https://example.com/repo",
      submission_note: "done!",
      reviewed_at: null,
      reviewer_note: null,
    });
    const value = update!.value as { submitted_at: string };
    expect(new Date(value.submitted_at).toISOString()).toBe(value.submitted_at);
  });
});
