import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProjectCredits, useTeamCredits } from "./use-credits";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

const fake = vi.hoisted(() => ({
  supabase: {} as { from: ReturnType<typeof vi.fn> },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

const handle = createFakeSupabase();

function renderHookWithClient<TReturn>(useHook: () => TReturn) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fake.supabase.from = handle.client.from;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...renderHook(useHook, { wrapper }), qc };
}

beforeEach(() => handle.reset());

// --- useProjectCredits -----------------------------------------------------

describe("useProjectCredits", () => {
  it("compiles the roll from contributors + activity, crediting most recent work", async () => {
    handle.on("project_contributors:select", () => ({
      data: [
        { profile_id: "p1", role: "creator" },
        { profile_id: "p2", role: "contributor" },
      ],
      error: null,
    }));
    handle.on("project_activity:select", () => ({
      data: [
        {
          id: "a1",
          actor_id: "p2",
          kind: "update",
          title: "Ship v2",
          created_at: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "a2",
          actor_id: null,
          kind: "update",
          title: "Anon event",
          created_at: "2026-08-01T00:00:00.000Z",
        },
      ],
      error: null,
    }));
    handle.on("projects:select", () => ({
      data: { profile_id: "p1", created_at: "2026-08-01T00:00:00.000Z" },
      error: null,
    }));
    handle.on("profiles:select", () => ({
      data: [
        { id: "p1", display_name: "Ada", handle: "ada" },
        { id: "p2", display_name: "Lin", handle: "lin" },
      ],
      error: null,
    }));

    const { result } = renderHookWithClient(() => useProjectCredits("pr-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    const [creator, contributor] = result.current.data ?? [];
    expect(creator).toMatchObject({
      profile_id: "p1",
      display_name: "Ada",
      handle: "ada",
      role: "creator",
      credit_text: "Created the project",
      at: "2026-08-01T00:00:00.000Z",
      credit_count: 1,
    });
    expect(contributor).toMatchObject({
      profile_id: "p2",
      display_name: "Lin",
      role: "contributor",
      credit_text: "Posted update “Ship v2”",
      at: "2026-09-01T00:00:00.000Z",
      credit_count: 1,
    });
  });

  it("keeps the creator headline while extra work only bumps the count", async () => {
    handle.on("project_contributors:select", () => ({
      data: [{ profile_id: "p1", role: "creator" }],
      error: null,
    }));
    handle.on("project_activity:select", () => ({
      data: [
        {
          id: "a1",
          actor_id: "p1",
          kind: "update",
          title: "V1",
          created_at: "2026-08-10T00:00:00.000Z",
        },
        {
          id: "a2",
          actor_id: "p1",
          kind: "update",
          title: "V2",
          created_at: "2026-08-20T00:00:00.000Z",
        },
      ],
      error: null,
    }));
    handle.on("projects:select", () => ({
      data: { profile_id: "p1", created_at: "2026-08-01T00:00:00.000Z" },
      error: null,
    }));
    handle.on("profiles:select", () => ({
      data: [{ id: "p1", display_name: "Ada", handle: "ada" }],
      error: null,
    }));

    const { result } = renderHookWithClient(() => useProjectCredits("pr-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({
      role: "creator",
      credit_text: "Created the project",
      credit_count: 3,
    });
  });

  it("surfaces DB errors", async () => {
    handle.on("project_contributors:select", () => ({
      data: null,
      error: { message: "contributors exploded" },
    }));
    const { result } = renderHookWithClient(() => useProjectCredits("pr-1"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: "contributors exploded" }),
    );
  });
});

// --- useTeamCredits ---------------------------------------------------------

describe("useTeamCredits", () => {
  it("merges per-person rolls across the team's projects (strongest role, latest text)", async () => {
    handle.on("team_projects:select", () => ({
      data: [{ project_id: "pr-1" }, { project_id: "pr-2" }],
      error: null,
    }));
    handle.on("projects:select", () => ({
      data: [
        {
          id: "pr-1",
          title: "Alpha",
          profile_id: "p-owner",
          created_at: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "pr-2",
          title: "Beta",
          profile_id: "p-owner",
          created_at: "2026-09-01T00:00:00.000Z",
        },
      ],
      error: null,
    }));
    handle.on("project_contributors:select", () => ({
      data: [{ project_id: "pr-1", profile_id: "p-bo", role: "contributor" }],
      error: null,
    }));
    handle.on("project_activity:select", () => ({
      data: [
        {
          project_id: "pr-1",
          actor_id: "p-bo",
          kind: "contributor_joined",
          title: "Bo joined",
          created_at: "2026-08-05T00:00:00.000Z",
        },
        {
          project_id: "pr-1",
          actor_id: "p-owner",
          kind: "update",
          title: "Alpha1",
          created_at: "2026-08-15T00:00:00.000Z",
        },
        {
          project_id: "pr-2",
          actor_id: "p-owner",
          kind: "update",
          title: "Beta1",
          created_at: "2026-09-15T00:00:00.000Z",
        },
      ],
      error: null,
    }));
    handle.on("profiles:select", () => ({
      data: [
        { id: "p-owner", display_name: "Ava", handle: "ava" },
        { id: "p-bo", display_name: "Bo", handle: "bo" },
      ],
      error: null,
    }));

    const { result } = renderHookWithClient(() => useTeamCredits("team-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Creator outranks contributor → owner first, then Bo. The creator's
    // timestamp stays the project created_at (headline never advances).
    expect(result.current.data?.[0]).toMatchObject({
      profile_id: "p-owner",
      display_name: "Ava",
      role: "creator",
      credit_text: "Created the project — Beta",
      at: "2026-09-01T00:00:00.000Z",
      credit_count: 4,
    });
    expect(result.current.data?.[1]).toMatchObject({
      profile_id: "p-bo",
      display_name: "Bo",
      role: "contributor",
      credit_text: "Joined the project as a contributor — Alpha",
      credit_count: 1,
    });
  });

  it("returns an empty roll when the team has no linked projects", async () => {
    handle.on("team_projects:select", () => ({ data: [], error: null }));
    const { result } = renderHookWithClient(() => useTeamCredits("team-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
