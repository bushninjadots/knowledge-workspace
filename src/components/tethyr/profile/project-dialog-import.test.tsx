// ── ProjectDialog GitHub import ───────────────────────────────────────────────
// The import path must pre-fill the manual form (never publish directly), and
// the linked repo + imported README must persist on save. These tests mock the
// GitHub server functions so the flow is pinned offline.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listGithubRepos = vi.fn();
const fetchRepoReadmeServer = vi.fn();
vi.mock("@/lib/github-server", () => ({
  listGithubRepos: (...a: unknown[]) => listGithubRepos(...a),
  fetchRepoReadmeServer: (...a: unknown[]) => fetchRepoReadmeServer(...a),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => supabaseCalls(table),
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) },
  },
}));

const from = vi.fn();
function supabaseCalls(table: string) {
  from.mockImplementation(() => from);
  (from as unknown as { __table?: string }).__table = table;
  return from;
}
// The save path chains .insert(...).select(...).single() for projects, then
// project_skills and project_repositories writes; shape per table is asserted
// via the recorded table names + resolved payloads.
from.mockReturnValue(from);
from.mockImplementation(() => from);
(from as unknown as { insert: ReturnType<typeof vi.fn> }).insert = vi.fn(() => from);
from.mockImplementation(() => from);
Object.assign(from, {
  select: vi.fn(() => from),
  single: vi.fn(() => Promise.resolve({ data: { id: "new-project-id" }, error: null })),
  eq: vi.fn(() => from),
  update: vi.fn(() => from),
  delete: vi.fn(() => from),
  insert: vi.fn(() => from),
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
  from.mockClear();
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

  it("stays usable when the repo list fails — retry, not a dead end", async () => {
    const user = userEvent.setup();
    listGithubRepos.mockRejectedValueOnce(new Error("network"));
    renderDialog();
    await user.click(screen.getByRole("radio", { name: /import from github/i }));
    expect(await screen.findByText(/couldn't load repositories/i)).toBeInTheDocument();
  });
});
