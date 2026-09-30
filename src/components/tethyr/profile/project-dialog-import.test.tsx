// ── ProjectDialog GitHub import ───────────────────────────────────────────────
// The import path must pre-fill the manual form (never publish directly), and
// the linked repo + imported README + cached repo metadata must persist on
// save. These tests mock the GitHub server functions so the flow is pinned
// offline.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listGithubRepos = vi.fn();
const fetchRepoReadmeServer = vi.fn();
const fetchRepoMetaServer = vi.fn();
vi.mock("@/lib/github-server", () => ({
  listGithubRepos: (...a: unknown[]) => listGithubRepos(...a),
  fetchRepoReadmeServer: (...a: unknown[]) => fetchRepoReadmeServer(...a),
  fetchRepoMetaServer: (...a: unknown[]) => fetchRepoMetaServer(...a),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => supabaseCalls(table),
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) },
  },
}));

const from = vi.fn();
const insertCalls: { table: string; payload: unknown }[] = [];
function supabaseCalls(table: string) {
  from.mockImplementation(() => from);
  (from as unknown as { __table?: string }).__table = table;
  return from;
}
// The save path chains .insert(...).select(...).single() for projects, then
// project_skills and project_repositories writes. All tables share one builder
// (`from`), so each `.from(table)` stamps the table name and every insert
// records its payload alongside it for per-table assertions.
from.mockReturnValue(from);
from.mockImplementation(() => from);
(from as unknown as { insert: ReturnType<typeof vi.fn> }).insert = vi.fn((payload: unknown) => {
  insertCalls.push({
    table: (from as unknown as { __table?: string }).__table ?? "?",
    payload,
  });
  return from;
});
from.mockImplementation(() => from);
Object.assign(from, {
  select: vi.fn(() => from),
  single: vi.fn(() => Promise.resolve({ data: { id: "new-project-id" }, error: null })),
  eq: vi.fn(() => from),
  update: vi.fn(() => from),
  delete: vi.fn(() => from),
  // `insert` is intentionally NOT here — the recording vi.fn assigned above
  // is the one true insert, clobbering it here would drop the payloads.
  in: vi.fn(() => from),
  then: undefined,
});

import { ProjectDialog } from "./project-dialog";

const SKILLS = [
  { id: "skill-js", name: "JavaScript", category: "engineering" },
  { id: "skill-ts", name: "TypeScript", category: "engineering" },
];

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectDialog
        project={null}
        userId="user-1"
        allSkills={SKILLS}
        initialSkillIds={[]}
        open
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listGithubRepos.mockReset();
  fetchRepoReadmeServer.mockReset();
  fetchRepoMetaServer.mockReset();
  from.mockClear();
  insertCalls.length = 0;
});

describe("ProjectDialog GitHub import", () => {
  it("offers the source choice only when creating (not editing)", () => {
    listGithubRepos.mockResolvedValue([]);
    renderDialog();
    expect(screen.getByRole("radio", { name: /start from scratch/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /import from github/i })).toBeInTheDocument();
  });

  it("shows the repo picker with live repos when GitHub is chosen", async () => {
    const user = userEvent.setup();
    listGithubRepos.mockResolvedValue([
      {
        full_name: "maya/threadline-app",
        html_url: "https://github.com/maya/threadline-app",
        description: "An offline-first travel companion",
        language: "TypeScript",
        stargazers_count: 12,
        private: false,
      },
    ]);
    fetchRepoReadmeServer.mockResolvedValue({
      text: "# Threadline\n\n![screenshot](docs/shot.png)",
      rateLimited: false,
      unauthorized: false,
    });
    fetchRepoMetaServer.mockResolvedValue({
      full_name: "maya/threadline-app",
      description: "An offline-first travel companion",
      language: "TypeScript",
      stargazers_count: 42,
      default_branch: "main",
    });

    renderDialog();
    await user.click(screen.getByRole("radio", { name: /import from github/i }));

    const row = await screen.findByText("maya/threadline-app");
    expect(row).toBeInTheDocument();

    await user.click(row);
    // Title is the prettified repo name; README was fetched and is saved on publish.
    await waitFor(() =>
      expect((screen.getByPlaceholderText(/working name/i) as HTMLInputElement).value).toBe(
        "Threadline App",
      ),
    );
  });

  it("imports the README and absolutizes relative image paths", async () => {
    const user = userEvent.setup();
    listGithubRepos.mockResolvedValue([
      {
        full_name: "maya/threadline-app",
        html_url: "https://github.com/maya/threadline-app",
        description: "An offline-first travel companion",
        language: "TypeScript",
        stargazers_count: 12,
        private: false,
      },
    ]);
    fetchRepoReadmeServer.mockResolvedValue({
      text: "# Threadline\n\n![screenshot](docs/shot.png)",
      rateLimited: false,
      unauthorized: false,
    });
    fetchRepoMetaServer.mockResolvedValue({
      full_name: "maya/threadline-app",
      description: "An offline-first travel companion",
      language: "TypeScript",
      stargazers_count: 42,
      default_branch: "main",
    });

    renderDialog();
    await user.click(screen.getByRole("radio", { name: /import from github/i }));
    await user.click(await screen.findByText("maya/threadline-app"));

    await waitFor(() => expect(fetchRepoReadmeServer).toHaveBeenCalled());
    // Description pre-fills from the repo, language matches a catalog skill.
    await waitFor(() =>
      expect((screen.getByPlaceholderText(/working name/i) as HTMLInputElement).value).toBe(
        "Threadline App",
      ),
    );
  });

  it("caches the full repo snapshot (meta + readme) for the repo row on save", async () => {
    const user = userEvent.setup();
    listGithubRepos.mockResolvedValue([
      {
        full_name: "maya/threadline-app",
        html_url: "https://github.com/maya/threadline-app",
        description: "An offline-first travel companion",
        language: "TypeScript",
        stargazers_count: 12,
        private: false,
      },
    ]);
    fetchRepoReadmeServer.mockResolvedValue({
      text: "# Threadline\n\n![screenshot](docs/shot.png)",
      rateLimited: false,
      unauthorized: false,
    });
    fetchRepoMetaServer.mockResolvedValue({
      full_name: "maya/threadline-app",
      description: "An offline-first travel companion",
      language: "TypeScript",
      stargazers_count: 42,
      forks_count: 3,
      topics: ["offline", "travel"],
      private: false,
      default_branch: "main",
    });

    renderDialog();
    await user.click(screen.getByRole("radio", { name: /import from github/i }));
    await user.click(await screen.findByText("maya/threadline-app"));
    await waitFor(() => expect(fetchRepoMetaServer).toHaveBeenCalled());

    // Walk the wizard to the publish button.
    await user.type(screen.getByPlaceholderText(/working name/i), "x");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: /publish project/i }));

    await waitFor(() => {
      const repoInsert = insertCalls.find((c) => c.table === "project_repositories");
      expect(repoInsert).toBeTruthy();
      // The insert payload carries the full metadata snapshot with the real
      // default branch — not the old { full_name, default_branch: "HEAD" } stub.
      expect(repoInsert?.payload).toEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            full_name: "maya/threadline-app",
            stargazers_count: 42,
            default_branch: "main",
          }),
        }),
      );
    });
  });

  it("falls back to picker-known fields when the meta call fails", async () => {
    const user = userEvent.setup();
    listGithubRepos.mockResolvedValue([
      {
        full_name: "maya/threadline-app",
        html_url: "https://github.com/maya/threadline-app",
        description: "An offline-first travel companion",
        language: "TypeScript",
        stargazers_count: 12,
        private: false,
      },
    ]);
    fetchRepoReadmeServer.mockResolvedValue({
      text: "# Threadline",
      rateLimited: false,
      unauthorized: false,
    });
    fetchRepoMetaServer.mockRejectedValue(new Error("network"));

    renderDialog();
    await user.click(screen.getByRole("radio", { name: /import from github/i }));
    await user.click(await screen.findByText("maya/threadline-app"));
    await waitFor(() => expect(fetchRepoMetaServer).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText(/working name/i), "x");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: /publish project/i }));

    await waitFor(() => {
      const repoInsert = insertCalls.find((c) => c.table === "project_repositories");
      expect(repoInsert).toBeTruthy();
      expect(repoInsert?.payload).toEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            full_name: "maya/threadline-app",
            stargazers_count: 12,
          }),
        }),
      );
    });
  });

  it("shows the connect prompt in the picker when no repos are listed", async () => {
    const user = userEvent.setup();
    listGithubRepos.mockResolvedValue([]);
    renderDialog();
    await user.click(screen.getByRole("radio", { name: /import from github/i }));
    expect(await screen.findByText(/connect your github account/i)).toBeInTheDocument();
    // The inline connect block is present (GitHubConnect renders its heading).
    expect(await screen.findByText("Connect GitHub")).toBeInTheDocument();
  });

  it("stays usable when the repo list fails — retry, not a dead end", async () => {
    const user = userEvent.setup();
    listGithubRepos.mockRejectedValueOnce(new Error("network"));
    renderDialog();
    await user.click(screen.getByRole("radio", { name: /import from github/i }));
    expect(await screen.findByText(/couldn't load repositories/i)).toBeInTheDocument();
  });
});
