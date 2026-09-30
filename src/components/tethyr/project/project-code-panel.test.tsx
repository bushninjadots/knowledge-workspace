// ── ProjectCodePanel ──────────────────────────────────────────────────────────
// The code panel is the GitHub showcase on the project page: it renders the
// cached snapshot (stats, topics, details, 52-week contribution graph),
// owners can hide each section, and "Sync from GitHub" pulls README + stats.
// These tests mock the server functions so the render paths are pinned
// offline.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const fetchRepoMetaServer = vi.fn();
const fetchRepoCommitActivityServer = vi.fn();
vi.mock("@/lib/github-server", () => ({
  fetchRepoMetaServer: (...a: unknown[]) => fetchRepoMetaServer(...a),
  fetchRepoCommitActivityServer: (...a: unknown[]) => fetchRepoCommitActivityServer(...a),
}));
vi.mock("@/integrations/supabase/client", () => {
  const updatePayloads: unknown[] = [];
  const makeBuilder = () => {
    const b: Record<string, unknown> = {
      update: vi.fn((payload: unknown) => {
        updatePayloads.push(payload);
        return b;
      }),
      eq: vi.fn(() => Promise.resolve({ error: null })),
    };
    return b;
  };
  return {
    __updatePayloads: updatePayloads,
    supabase: {
      from: vi.fn(() => makeBuilder()),
      auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "u1" } } })) },
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) },
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test module mock
const mockModule: any = await import("@/integrations/supabase/client");

import { ProjectCodePanel } from "./project-code-panel";
import type { ProjectRepo } from "@/hooks/use-project-repos";

const WEEKS = Array.from({ length: 52 }, (_, i) => ({
  week: 1_700_000_000 + i * 604_800,
  total: i % 4,
  days: [0, 1, 2, 0, 0, 0, 0],
}));

const META_REPO: ProjectRepo = {
  id: "repo-1",
  project_id: "project-1",
  url: "https://github.com/maya/threadline-app",
  provider: "github",
  metadata: {
    full_name: "maya/threadline-app",
    description: "An offline-first travel companion",
    language: "TypeScript",
    stargazers_count: 1234,
    forks_count: 21,
    open_issues_count: 5,
    updated_at: "2026-09-30T00:00:00Z",
    created_at: "2024-01-15T00:00:00Z",
    topics: ["offline", "travel"],
    private: false,
    default_branch: "main",
    license: "MIT",
    homepage: "https://threadline.app",
    commit_activity: WEEKS,
  },
  created_at: "2026-09-30T00:00:00Z",
  updated_at: "2026-09-30T00:00:00Z",
};

function renderPanel(overrides: Partial<Parameters<typeof ProjectCodePanel>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = {
    project: { id: "project-1", readme: "# Threadline", github_display: null },
    repos: [META_REPO],
    isOwner: false,
    ...overrides,
  };
  return render(
    <QueryClientProvider client={client}>
      <ProjectCodePanel {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchRepoMetaServer.mockReset();
  fetchRepoCommitActivityServer.mockReset();
});

describe("ProjectCodePanel", () => {
  it("renders the cached snapshot: stats, topics, details, and the graph", () => {
    renderPanel();
    expect(screen.getByText("1,234 ★")).toBeInTheDocument();
    expect(screen.getByText("21 forks")).toBeInTheDocument();
    expect(screen.getByText("5 open issues")).toBeInTheDocument();
    expect(screen.getByText("MIT license")).toBeInTheDocument();
    expect(screen.getByText(/started .* ago/i)).toBeInTheDocument();
    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /contribution graph/i })).toBeInTheDocument();
  });

  it("hides a section when the owner opted out of it", () => {
    renderPanel({
      project: {
        id: "project-1",
        readme: "# Threadline",
        github_display: { show_graph: false, show_details: false },
      },
    });
    expect(screen.queryByRole("img", { name: /contribution graph/i })).not.toBeInTheDocument();
    expect(screen.queryByText("MIT license")).not.toBeInTheDocument();
    // Stats are untouched — opting out of the graph only hides the graph.
    expect(screen.getByText("1,234 ★")).toBeInTheDocument();
  });

  it("renders the empty state when no repo is linked", () => {
    renderPanel({ repos: [] });
    expect(screen.getByText(/team hasn't linked a source repository/i)).toBeInTheDocument();
  });

  it("owners get the customize panel and toggling writes the payload", async () => {
    const user = userEvent.setup();
    renderPanel({ isOwner: true, onLinkRepo: vi.fn() });
    await user.click(screen.getByRole("button", { name: "Customize" }));
    const topicsSwitch = screen.getByRole("switch", { name: "Topics" });
    expect(topicsSwitch).toHaveAttribute("aria-checked", "true");
    await user.click(topicsSwitch);
    // The optimistic write carries the flipped flag merged over the defaults.
    await waitFor(() => {
      expect(mockModule.__updatePayloads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            github_display: expect.objectContaining({ show_topics: false }),
          }),
        ]),
      );
    });
  });
});
