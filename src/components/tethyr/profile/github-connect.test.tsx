import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GitHubConnect } from "./github-connect";
import { createFakeSupabase } from "../../../../tests/helpers/fake-supabase";

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
  tokenStatus: false,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

vi.mock("@/hooks/use-current-user", () => ({
  useAuthUser: () => ({ data: { id: "test-user" } }),
}));

vi.mock("@/lib/github-server", () => ({
  hasGithubToken: (...args: unknown[]) => fake.serverFns.hasGithubToken(...args),
  saveGithubToken: (...args: unknown[]) => fake.serverFns.saveGithubToken(...args),
  removeGithubToken: (...args: unknown[]) => fake.serverFns.removeGithubToken(...args),
}));

type Account = { id: string; provider: string; username: string | null; created_at: string };

const handle = createFakeSupabase();

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

function useFake({ accounts = [] }: { accounts?: Account[] } = {}) {
  handle.reset();
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
  handle.on("connected_accounts:select", () => ({ data: accounts, error: null }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.tokenStatus = false;
  fake.serverFns.hasGithubToken.mockImplementation(() => Promise.resolve(fake.tokenStatus));
  fake.serverFns.saveGithubToken.mockResolvedValue({ ok: true, username: "octocat" });
  fake.serverFns.removeGithubToken.mockResolvedValue({ ok: true });
  useFake();
});

// --- Tests ---------------------------------------------------------------

describe("GitHubConnect token sync", () => {
  it("shows the shared token row when GitHub is connected", async () => {
    useFake({ accounts: [githubAccount] });

    renderCard();

    expect(await screen.findByText("GitHub connected")).toBeInTheDocument();
    expect(screen.getByText("GitHub token")).toBeInTheDocument();
    // No stored token yet → Add token affordance.
    expect(screen.getByRole("button", { name: "Add token" })).toBeInTheDocument();
  });

  it("saves a token through the server function and confirms the GitHub username", async () => {
    useFake({ accounts: [githubAccount] });
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
    useFake({ accounts: [githubAccount] });
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
    useFake({ accounts: [githubAccount] });
    renderCard();

    await userEvent.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(fake.serverFns.removeGithubToken).toHaveBeenCalled();
    });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("GitHub token removed");
  });

  it("validates the token before connecting the account", async () => {
    useFake();
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
      expect(
        handle.calls.some((c) => c.action === "upsert" && c.table === "connected_accounts"),
      ).toBe(true);
    });
  });

  it("does not connect the account when the token is invalid", async () => {
    fake.serverFns.saveGithubToken.mockResolvedValue({
      ok: false,
      reason: "unauthorized",
    } as never);
    useFake();
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
    expect(handle.calls.some((c) => c.action === "upsert")).toBe(false);
  });
});
