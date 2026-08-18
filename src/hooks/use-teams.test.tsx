import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { slugify, useCreateTeam, useInviteToTeam, useRespondToTeamInvite } from "./use-teams";

// --- Mocks ---------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
  calls: [] as { table: string; action: string; value?: unknown }[],
  // Handlers keyed by `${table}:${action}` produce the awaited `{ data, error }`.
  handlers: {} as Record<string, () => { data: unknown; error: unknown }>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

function createFakeSupabase() {
  fake.calls.length = 0;
  const from = vi.fn((table: string) => {
    const builder = {
      _action: "select" as string,
      _value: undefined as unknown,
      insert(v: unknown) {
        builder._action = "insert";
        builder._value = v;
        return builder;
      },
      update(v: unknown) {
        builder._action = "update";
        builder._value = v;
        return builder;
      },
      select() {
        return builder;
      },
      eq() {
        return builder;
      },
      maybeSingle() {
        return builder;
      },
      single() {
        return builder;
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
        fake.calls.push({ table, action: builder._action, value: builder._value });
        const handler =
          fake.handlers[`${table}:${builder._action}`] ??
          (() => ({
            data: null,
            error: null,
          }));
        return Promise.resolve(handler()).then(onFulfilled);
      },
    };
    return builder;
  });
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
  };
  return { from, auth };
}

function resetHandlers() {
  fake.handlers = {};
}

function renderHookWithClient<TReturn>(useHook: () => TReturn) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const built = createFakeSupabase();
  fake.supabase.from = built.from;
  fake.supabase.auth = built.auth;
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
    resetHandlers();
    fake.handlers["teams:insert"] = () => ({
      data: { id: "team-1", name: "My Crew", slug: "my-crew-abc1" },
      error: null,
    });

    const { result } = renderHookWithClient(() => useCreateTeam());
    await act(async () => {
      await result.current.mutateAsync({ name: "My Crew" });
    });

    const teamInsert = fake.calls.find((c) => c.table === "teams" && c.action === "insert");
    expect(teamInsert?.value).toMatchObject({
      name: "My Crew",
      created_by: "user-1",
      slug: expect.stringMatching(/^my-crew-[a-z0-9]{4}$/),
    });

    // The creator is seated as lead by trg_team_creator_lead in the database,
    // not by a client-side team_members insert (RLS blocks that anyway).
    const memberInsert = fake.calls.find(
      (c) => c.table === "team_members" && c.action === "insert",
    );
    expect(memberInsert).toBeUndefined();
  });
});

// --- useInviteToTeam -----------------------------------------------------

describe("useInviteToTeam", () => {
  it("resolves the handle to a profile and inserts a pending invite", async () => {
    resetHandlers();
    fake.handlers["profiles:select"] = () => ({ data: { id: "profile-2" }, error: null });
    fake.handlers["team_invites:insert"] = () => ({ data: null, error: null });

    const { result } = renderHookWithClient(() => useInviteToTeam("team-1"));
    await act(async () => {
      await result.current.mutateAsync("maya");
    });

    const invite = fake.calls.find((c) => c.table === "team_invites" && c.action === "insert");
    expect(invite?.value).toEqual({
      team_id: "team-1",
      profile_id: "profile-2",
      invited_by: "user-1",
    });
  });

  it("rejects an unknown handle", async () => {
    resetHandlers();
    fake.handlers["profiles:select"] = () => ({ data: null, error: null });

    const { result } = renderHookWithClient(() => useInviteToTeam("team-1"));
    await act(async () => {
      await expect(result.current.mutateAsync("nobody")).rejects.toThrow(
        "No member with that handle",
      );
    });
  });

  it("treats a duplicate pending invite (23505) as success", async () => {
    resetHandlers();
    fake.handlers["profiles:select"] = () => ({ data: { id: "profile-2" }, error: null });
    fake.handlers["team_invites:insert"] = () => ({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });

    const { result } = renderHookWithClient(() => useInviteToTeam("team-1"));
    await act(async () => {
      await expect(result.current.mutateAsync("maya")).resolves.toEqual({ id: "profile-2" });
    });
  });
});

// --- useRespondToTeamInvite ----------------------------------------------

describe("useRespondToTeamInvite", () => {
  it("accepting adds the member as contributor and marks the invite accepted", async () => {
    resetHandlers();
    fake.handlers["team_members:insert"] = () => ({ data: null, error: null });
    fake.handlers["team_invites:update"] = () => ({ data: null, error: null });

    const { result } = renderHookWithClient(() => useRespondToTeamInvite());
    await act(async () => {
      await result.current.mutateAsync({ inviteId: "invite-1", teamId: "team-1", accept: true });
    });

    const member = fake.calls.find((c) => c.table === "team_members" && c.action === "insert");
    expect(member?.value).toEqual({ team_id: "team-1", profile_id: "user-1", role: "contributor" });

    const update = fake.calls.find((c) => c.table === "team_invites" && c.action === "update");
    expect(update?.value).toEqual({ status: "accepted" });
  });

  it("declining only marks the invite declined without adding a member", async () => {
    resetHandlers();
    fake.handlers["team_invites:update"] = () => ({ data: null, error: null });

    const { result } = renderHookWithClient(() => useRespondToTeamInvite());
    await act(async () => {
      await result.current.mutateAsync({ inviteId: "invite-1", teamId: "team-1", accept: false });
    });

    expect(fake.calls.some((c) => c.table === "team_members")).toBe(false);
    const update = fake.calls.find((c) => c.table === "team_invites" && c.action === "update");
    expect(update?.value).toEqual({ status: "declined" });
  });
});
