import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { chooseNextAction, getActionSignals, ProjectWorkbench } from "./project-workbench";
import {
  canContinueProjectCreation,
  PROJECT_CREATION_STEPS,
  ProjectDialog,
} from "../profile-sections";
import type { ProjectDetail } from "@/hooks/use-projects";
import { createFakeSupabase } from "../../../../tests/helpers/fake-supabase";

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

function renderWithProviders(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  handle.reset();
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
});

function makeProject(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: "project-1",
    profile_id: "user-1",
    title: "A test project",
    description: null,
    goal: null,
    vision: null,
    status: "active",
    visibility: "public",
    stage: "building",
    started_at: "2026-01-01T00:00:00Z",
    progress_percent: 25,
    cover_url: null,
    gallery: [],
    resources: [],
    links: {},
    tags: [],
    looking_for_feedback: false,
    looking_for_collaborators: false,
    is_featured: false,
    presentation_preset: "story-first",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("Project Workbench", () => {
  it("prioritizes a first demonstration for an owner", () => {
    const next = chooseNextAction({
      project: makeProject(),
      gallery: [],
      milestones: [],
      openNeeds: 0,
      openRolesCount: 0,
      isOwner: true,
      isContributor: true,
    });

    expect(next).toMatchObject({ action: "demonstrations", cta: "Add demonstration" });
  });

  it("summarizes the project loop in a stable order", () => {
    const signals = getActionSignals({
      gallery: [{ url: "https://example.com/demo.gif", type: "image" }],
      milestones: [
        {
          id: "milestone-1",
          project_id: "project-1",
          title: "Prototype",
          description: null,
          status: "in_progress",
          position: 0,
          due_date: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      openNeeds: 1,
      openRolesCount: 2,
      isContributor: true,
    });

    expect(signals.map((signal) => signal.label)).toEqual([
      "Next: Prototype",
      "1 open need",
      "2 open roles",
      "1 demonstration",
      "You can add evidence",
    ]);
  });

  it("uses a pending milestone when work has not started", () => {
    const signals = getActionSignals({
      gallery: [],
      milestones: [
        {
          id: "milestone-1",
          project_id: "project-1",
          title: "Research",
          description: null,
          status: "pending",
          position: 0,
          due_date: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      openNeeds: 0,
      openRolesCount: 0,
      isContributor: false,
    });

    expect(signals[0].label).toBe("Next: Research");
    expect(signals[3].label).toBe("No demonstrations yet");
  });

  it("prioritizes collaboration for a visitor when roles are open", () => {
    const next = chooseNextAction({
      project: makeProject({ readme: "# Story" }),
      gallery: [{ url: "https://example.com/demo.gif", type: "image" }],
      milestones: [],
      openNeeds: 0,
      openRolesCount: 2,
      isOwner: false,
      isContributor: false,
    });

    expect(next).toMatchObject({ action: "join", cta: "Apply for a role" });
  });

  it("directs feedback-seeking visitors to the conversation", () => {
    const next = chooseNextAction({
      project: makeProject({ readme: "# Story", looking_for_feedback: true }),
      gallery: [{ url: "https://example.com/demo.gif", type: "image" }],
      milestones: [],
      openNeeds: 0,
      openRolesCount: 0,
      isOwner: false,
      isContributor: false,
    });

    expect(next).toMatchObject({ action: "discussions", cta: "Offer feedback" });
  });

  it("exposes the presentation choice only to the owner", () => {
    const onPresentationChange = vi.fn();
    const props = {
      project: makeProject(),
      gallery: [],
      milestones: [],
      openRoles: [],
      needs: [],
      isOwner: true,
      isContributor: true,
      onAction: vi.fn(),
      onPresentationChange,
    };

    renderWithProviders(<ProjectWorkbench {...props} />);

    expect(screen.getByRole("combobox", { name: /project presentation preset/i })).toHaveValue(
      "story-first",
    );
    expect(screen.getByRole("option", { name: "Demo first" })).toBeInTheDocument();
  });

  it("surfaces the current season as a chip", () => {
    renderWithProviders(
      <ProjectWorkbench
        project={makeProject({ season: "prototype" })}
        gallery={[]}
        milestones={[]}
        openRoles={[]}
        needs={[]}
        isOwner
        isContributor
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("shows visible saved feedback after a preset change", () => {
    renderWithProviders(
      <ProjectWorkbench
        project={makeProject()}
        gallery={[]}
        milestones={[]}
        openRoles={[]}
        needs={[]}
        isOwner
        isContributor
        onAction={vi.fn()}
        onPresentationChange={vi.fn()}
        presentationSaveState="saved"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
});

describe("guided project creation", () => {
  it("keeps the three steps focused on setup, direction, and sharing", () => {
    expect(PROJECT_CREATION_STEPS).toEqual(["Basics", "Direction", "Share"]);
    expect(canContinueProjectCreation(0, "")).toBe(false);
    expect(canContinueProjectCreation(0, "  ")).toBe(false);
    expect(canContinueProjectCreation(0, "A real project")).toBe(true);
    expect(canContinueProjectCreation(1, "")).toBe(true);
  });

  it("shows only the next guided section after a title is provided", async () => {
    const user = userEvent.setup();
    render(
      <ProjectDialog
        project={null}
        userId="user-1"
        allSkills={[]}
        initialSkillIds={[]}
        open
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Start a project" })).toBeInTheDocument();
    expect(screen.getByText("Basics")).toBeInTheDocument();
    expect(screen.getByText("Direction")).toBeInTheDocument();
    expect(screen.getByText("Share")).toBeInTheDocument();

    await user.type(screen.getAllByRole("textbox")[0], "A project with direction");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Planning" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish project" })).not.toBeInTheDocument();
  });
});
