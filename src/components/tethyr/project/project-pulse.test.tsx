import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { ProjectPulse } from "./project-pulse";
import type { ProjectDetail } from "@/hooks/use-projects";

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

function renderWithProviders(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("ProjectPulse", () => {
  it("renders nothing for a lean project with no direction content", () => {
    const { container } = renderWithProviders(
      <ProjectPulse
        project={makeProject()}
        isOwner={false}
        editing={false}
        onEditingChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the contribution brief when present", () => {
    renderWithProviders(
      <ProjectPulse
        project={makeProject({ collaboration_brief: { need: "Help with visuals" } })}
        isOwner={false}
        editing={false}
        onEditingChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Contribution brief")).toBeInTheDocument();
    expect(screen.getByText("Help with visuals")).toBeInTheDocument();
  });

  it("shows the direction editor when the owner is shaping direction", () => {
    renderWithProviders(
      <ProjectPulse project={makeProject()} isOwner editing onEditingChange={vi.fn()} />,
    );
    expect(screen.getByText("Current season")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save direction" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
