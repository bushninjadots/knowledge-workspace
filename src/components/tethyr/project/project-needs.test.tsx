import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectNeeds } from "./project-needs";
import type { ProjectNeedRow } from "@/hooks/use-projects";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mocks = vi.hoisted(() => ({
  createNeed: vi.fn(),
  fillNeed: vi.fn(),
  deleteNeed: vi.fn(),
}));

vi.mock("@/hooks/use-projects", () => ({
  useCreateProjectNeed: () => ({ mutateAsync: mocks.createNeed, isPending: false }),
  useFillProjectNeed: () => ({ mutateAsync: mocks.fillNeed, isPending: false }),
  useDeleteProjectNeed: () => ({ mutateAsync: mocks.deleteNeed, isPending: false }),
}));

vi.mock("@/hooks/use-current-user", () => ({
  useSkillsCatalog: () => ({
    data: [
      { id: "skill-design", name: "Design", slug: "design", category: "Design", description: null },
      {
        id: "skill-dev",
        name: "Development",
        slug: "development",
        category: "Development",
        description: null,
      },
    ],
  }),
}));

function makeNeed(overrides: Partial<ProjectNeedRow> = {}): ProjectNeedRow {
  return {
    id: "n1",
    project_id: "p1",
    title: "A logo designer",
    note: "For the launch",
    skill_id: "skill-design",
    urgency: "high",
    is_filled: false,
    filled_by: null,
    created_at: "2026-08-16T00:00:00Z",
    ...overrides,
  };
}

function renderNeeds({
  needs = [],
  canManage = false,
  projectId = "p1",
}: { needs?: ProjectNeedRow[]; canManage?: boolean; projectId?: string } = {}) {
  return render(<ProjectNeeds needs={needs} projectId={projectId} canManage={canManage} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createNeed.mockResolvedValue(undefined);
  mocks.fillNeed.mockResolvedValue(undefined);
  mocks.deleteNeed.mockResolvedValue(undefined);
});

describe("ProjectNeeds", () => {
  it("renders nothing when there are no open needs and the viewer can't manage", () => {
    const { container } = renderNeeds({ needs: [], canManage: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the add affordance and empty copy to managers even with no needs", () => {
    renderNeeds({ needs: [], canManage: true });
    expect(screen.getByRole("heading", { name: /need help now/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add need/i })).toBeInTheDocument();
    expect(screen.getByText(/nothing needed right now/i)).toBeInTheDocument();
  });

  it("lists open needs with their urgency and resolved skill name", () => {
    renderNeeds({ needs: [makeNeed()], canManage: false });
    expect(screen.getByText("A logo designer")).toBeInTheDocument();
    expect(screen.getByText("High priority")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText("For the launch")).toBeInTheDocument();
  });

  it("does not render filled needs", () => {
    renderNeeds({ needs: [makeNeed({ is_filled: true })], canManage: false });
    expect(screen.queryByText("A logo designer")).not.toBeInTheDocument();
  });

  it("posts a need with the selected skill and urgency", async () => {
    renderNeeds({ needs: [], canManage: true });

    await userEvent.click(screen.getByRole("button", { name: /add need/i }));
    await userEvent.type(screen.getByLabelText(/need title/i), "A video editor");
    await userEvent.selectOptions(screen.getByLabelText(/related skill/i), "skill-dev");
    await userEvent.click(screen.getByRole("button", { name: /post need/i }));

    await waitFor(() => expect(mocks.createNeed).toHaveBeenCalledTimes(1));
    expect(mocks.createNeed).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        title: "A video editor",
        skillId: "skill-dev",
      }),
    );
  });

  it("exposes fill and delete actions to managers", async () => {
    renderNeeds({ needs: [makeNeed()], canManage: true });

    await userEvent.click(screen.getByLabelText('Mark "A logo designer" filled'));
    await waitFor(() => expect(mocks.fillNeed).toHaveBeenCalledWith({ id: "n1", projectId: "p1" }));

    await userEvent.click(screen.getByLabelText('Delete "A logo designer"'));
    await waitFor(() =>
      expect(mocks.deleteNeed).toHaveBeenCalledWith({ id: "n1", projectId: "p1" }),
    );
  });
});
