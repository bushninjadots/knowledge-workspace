import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { slugify, useCreateTeam, useInviteToTeam, useRespondToTeamInvite } from "./use-teams";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

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

function renderHookWithClient<TReturn>(useHook: () => TReturn) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(useHook, { wrapper });
}

// --- slugify -------------------------------------------------------------

describe("slugify", () => {
  it("lowercases, hyphenates, and appends a random suffix", () => {
    const slug = slugify("My Crew!");
    expect(slug).toMatch(/^my-crew-[a-z0-9]{4}$/);
  });

  it("collapses runs of non-alphanumeric characters into one hyphen", () => {
    const slug = slugify("  Big   Bad & Crew  ");
    expect(slug).toMatch(/^big-bad-crew-[a-z0-9]{4}$/);
  });

  it("falls back to a 'crew' base for empty or symbol-only names", () => {
    expect(slugify("")).toMatch(/^crew-[a-z0-9]{4}$/);
    expect(slugify("!!!")).toMatch(/^crew-[a-z0-9]{4}$/);
  });

  it("truncates long bases to 48 characters before the suffix", () => {
    const long = "a".repeat(80);
    const slug = slugify(long);
    const base = slug.slice(0, -5); // strip the -XXXX suffix
    expect(base).toHaveLength(48);
    expect(base).toBe("a".repeat(48));
  });
});

// --- useCreateTeam -------------------------------------------------------

describe("useCreateTeam", () => {
  it("inserts the team; the DB trigger seats the creator as lead", async () => {
    handle.reset();
    handle.on("teams:insert", () => ({
      data: { id: "team-1", name: "My Crew", slug: "my-crew-abc1" },
      error: null,
    }));

    const { result } = renderHookWithClient(() => useCreateTeam());
    await act(async () => {
      await result.current.mutateAsync({ name: "My Crew" });
    });

    const teamInsert = handle.calls.find((c) => c.table === "teams" && c.action === "insert");
    expect(teamInsert?.value).toMatchObject({
      name: "My Crew",
      created_by: "user-1",
      slug: expect.stringMatching(/^my-crew-[a-z0-9]{4}$/),
    });

    // The creator is seated as lead by trg_team_creator_lead in the database,
    // not by a client-side team_members insert (RLS blocks that anyway).
    const memberInsert = handle.calls.find(
      (c) => c.table === "team_members" && c.action === "insert",
    );
    expect(memberInsert).toBeUndefined();
  });
});

// --- useInviteToTeam -----------------------------------------------------

describe("useInviteToTeam", () => {
  it("resolves the handle to a profile and inserts a pending invite", async () => {
    handle.reset();
    handle.on("profiles:select", () => ({ data: { id: "profile-2" }, error: null }));
    handle.on("team_invites:insert", () => ({ data: null, error: null }));

    const { result } = renderHookWithClient(() => useInviteToTeam("team-1"));
    await act(async () => {
      await result.current.mutateAsync("maya");
    });

    const invite = handle.calls.find((c) => c.table === "team_invites" && c.action === "insert");
    expect(invite?.value).toEqual({
      team_id: "team-1",
      profile_id: "profile-2",
      invited_by: "user-1",
    });
  });

  it("rejects an unknown handle", async () => {
    handle.reset();
    handle.on("profiles:select", () => ({ data: null, error: null }));

    const { result } = renderHookWithClient(() => useInviteToTeam("team-1"));
    await act(async () => {
      await expect(result.current.mutateAsync("nobody")).rejects.toThrow(
        "No member with that handle",
      );
    });
  });

  it("rejects inviting someone who is already a member", async () => {
    handle.reset();
    handle.on("profiles:select", () => ({ data: { id: "profile-2" }, error: null }));
    handle.on("team_members:select", () => ({
      data: { profile_id: "profile-2" },
      error: null,
    }));

    const { result } = renderHookWithClient(() => useInviteToTeam("team-1"));
    await act(async () => {
      await expect(result.current.mutateAsync("maya")).rejects.toThrow(
        "Already a member of this crew",
      );
    });

    const invite = handle.calls.find((c) => c.table === "team_invites" && c.action === "insert");
    expect(invite).toBeUndefined();
  });

  it("treats a duplicate pending invite (23505) as success", async () => {
    handle.reset();
    handle.on("profiles:select", () => ({ data: { id: "profile-2" }, error: null }));
    handle.on("team_invites:insert", () => ({
      data: null,
      error: { code: "23505", message: "duplicate" },
    }));

    const { result } = renderHookWithClient(() => useInviteToTeam("team-1"));
    await act(async () => {
      await expect(result.current.mutateAsync("maya")).resolves.toEqual({ id: "profile-2" });
    });
  });
});

// --- useRespondToTeamInvite ----------------------------------------------

describe("useRespondToTeamInvite", () => {
  it("accepting adds the member as contributor and marks the invite accepted", async () => {
    handle.reset();
    handle.on("team_members:insert", () => ({ data: null, error: null }));
    handle.on("team_invites:update", () => ({ data: null, error: null }));

    const { result } = renderHookWithClient(() => useRespondToTeamInvite());
    await act(async () => {
      await result.current.mutateAsync({ inviteId: "invite-1", teamId: "team-1", accept: true });
    });

    const member = handle.calls.find((c) => c.table === "team_members" && c.action === "insert");
    expect(member?.value).toEqual({ team_id: "team-1", profile_id: "user-1", role: "contributor" });

    const update = handle.calls.find((c) => c.table === "team_invites" && c.action === "update");
    expect(update?.value).toEqual({ status: "accepted" });
  });

  it("declining only marks the invite declined without adding a member", async () => {
    handle.reset();
    handle.on("team_invites:update", () => ({ data: null, error: null }));

    const { result } = renderHookWithClient(() => useRespondToTeamInvite());
    await act(async () => {
      await result.current.mutateAsync({ inviteId: "invite-1", teamId: "team-1", accept: false });
    });

    expect(handle.calls.some((c) => c.table === "team_members")).toBe(false);
    const update = handle.calls.find((c) => c.table === "team_invites" && c.action === "update");
    expect(update?.value).toEqual({ status: "declined" });
  });
});
