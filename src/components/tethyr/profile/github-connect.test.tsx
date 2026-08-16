import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GitHubConnect } from "./github-connect";

// --- Mocks ---------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
  serverFns: {
    hasGithubToken: vi.fn(),
    saveGithubToken: vi.fn(),
    removeGithubToken: vi.fn(),
  },
  calls: [] as { kind: "select" | "upsert"; table: string; value?: unknown }[],
  tokenStatus: false,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

vi.mock("@/lib/github-server", () => ({
  hasGithubToken: (...args: unknown[]) => fake.serverFns.hasGithubToken(...args),
  saveGithubToken: (...args: unknown[]) => fake.serverFns.saveGithubToken(...args),
  removeGithubToken: (...args: unknown[]) => fake.serverFns.removeGithubToken(...args),
}));

type Account = { id: string; provider: string; username: string | null; created_at: string };

function createFakeSupabase({ accounts = [] }: { accounts?: Account[] } = {}) {
  fake.calls.length = 0;
  const from = vi.fn((table: string) => {
    const builder = {
      _kind: "select" as "select" | "upsert",
      _value: null as unknown,
      select() {
        return builder;
      },
      eq() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      upsert(v: unknown) {
        builder._kind = "upsert";
        builder._value = v;
        return builder;
      },
      single() {
        return builder;
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
        const isUpsert = builder._kind === "upsert";
        fake.calls.push({
          kind: isUpsert ? "upsert" : "select",
          table,
          value: isUpsert ? builder._value : undefined,
        });
        const result = isUpsert
          ? { data: builder._value, error: null }
          : { data: accounts, error: null };
        return Promise.resolve(result).then(onFulfilled);
      },
    };
    return builder;
  });
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { id: "test-user" } }, error: null })),
  };
  return { from, auth };
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GitHubConnect />
    </QueryClientProvider>,
  );
}

const githubAccount: Account = {
  id: "acc-1",
  provider: "github",
  username: "octo",
  created_at: "2026-01-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  fake.tokenStatus = false;
  fake.serverFns.hasGithubToken.mockImplementation(() => Promise.resolve(fake.tokenStatus));
  fake.serverFns.saveGithubToken.mockResolvedValue({ ok: true, username: "octocat" });
  fake.serverFns.removeGithubToken.mockResolvedValue({ ok: true });
  const built = createFakeSupabase();
  fake.supabase.from = built.from;
  fake.supabase.auth = built.auth;
});

// --- Tests ---------------------------------------------------------------

describe("GitHubConnect token sync", () => {
  it("shows the shared token row when GitHub is connected", async () => {
    createFakeSupabase({ accounts: [githubAccount] });
    fake.supabase.from = createFakeSupabase({ accounts: [githubAccount] }).from;

    renderCard();

    expect(await screen.findByText("GitHub connected")).toBeInTheDocument();
    expect(screen.getByText("GitHub token")).toBeInTheDocument();
    // No stored token yet → Add token affordance.
    expect(screen.getByRole("button", { name: "Add token" })).toBeInTheDocument();
  });

  it("saves a token through the server function and confirms the GitHub username", async () => {
    fake.supabase.from = createFakeSupabase({ accounts: [githubAccount] }).from;
    renderCard();

    await userEvent.click(await screen.findByRole("button", { name: "Add token" }));
    await userEvent.type(screen.getByPlaceholderText("ghp_…"), "ghp_newtoken");
    // The save succeeds → the token-status query refetches and reads the new value.
    fake.tokenStatus = true;
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(fake.serverFns.saveGithubToken).toHaveBeenCalledWith({
        data: { token: "ghp_newtoken" },
      });
    });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("authenticated as @octocat"),
    );

    // Status flips to "Set" once the query refetches.
    expect(await screen.findByText(/set — powers private repos/i)).toBeInTheDocument();
  });

  it("rejects an invalid token with a helpful error and does not store it", async () => {
    fake.serverFns.saveGithubToken.mockResolvedValue({
      ok: false,
      reason: "unauthorized",
    } as never);
    fake.supabase.from = createFakeSupabase({ accounts: [githubAccount] }).from;
    renderCard();

    await userEvent.click(await screen.findByRole("button", { name: "Add token" }));
    await userEvent.type(screen.getByPlaceholderText("ghp_…"), "ghp_bad");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(fake.serverFns.saveGithubToken).toHaveBeenCalledWith({
        data: { token: "ghp_bad" },
      });
    });
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("rejected"));
    // Editor stays open and nothing was stored — the inline token input remains.
    expect(screen.getByPlaceholderText("ghp_…")).toBeInTheDocument();
  });

  it("removes the stored token via the server function", async () => {
    fake.tokenStatus = true;
    fake.supabase.from = createFakeSupabase({ accounts: [githubAccount] }).from;
    renderCard();

    await userEvent.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(fake.serverFns.removeGithubToken).toHaveBeenCalled();
    });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("GitHub token removed");
  });

  it("validates the token before connecting the account", async () => {
    fake.supabase.from = createFakeSupabase().from;
    renderCard();

    await userEvent.click(await screen.findByRole("button", { name: "Connect" }));
    await userEvent.type(screen.getByPlaceholderText("your-username"), "octo");
    await userEvent.type(screen.getByPlaceholderText(/ghp_…/), "ghp_good");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(fake.serverFns.saveGithubToken).toHaveBeenCalledWith({
        data: { token: "ghp_good" },
      });
    });
    // Token validated first, then the account row is upserted.
    await waitFor(() => {
      expect(fake.calls.some((c) => c.kind === "upsert" && c.table === "connected_accounts")).toBe(
        true,
      );
    });
  });

  it("does not connect the account when the token is invalid", async () => {
    fake.serverFns.saveGithubToken.mockResolvedValue({
      ok: false,
      reason: "unauthorized",
    } as never);
    fake.supabase.from = createFakeSupabase().from;
    renderCard();

    await userEvent.click(await screen.findByRole("button", { name: "Connect" }));
    await userEvent.type(screen.getByPlaceholderText("your-username"), "octo");
    await userEvent.type(screen.getByPlaceholderText(/ghp_…/), "ghp_bad");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(fake.serverFns.saveGithubToken).toHaveBeenCalledWith({
        data: { token: "ghp_bad" },
      });
    });
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("rejected"));
    expect(fake.calls.some((c) => c.kind === "upsert")).toBe(false);
  });
});
