import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceGrid } from "./workspace-grid";
import type { WorkspaceLayoutPreset, WorkspaceModule } from "@/lib/workspace-layouts";
import { Sparkles } from "lucide-react";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-layout-preferences", () => ({
  useLayoutPreferences: () => ({
    data: null,
    isLoading: false,
    save: vi.fn(async () => undefined),
  }),
}));

vi.mock("react-grid-layout", () => ({
  ResponsiveGridLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="workspace-grid">{children}</div>
  ),
  useContainerWidth: () => ({
    width: 1024,
    containerRef: { current: null },
  }),
}));

const moduleDefinition: WorkspaceModule = {
  id: "projects",
  title: "Projects",
  icon: Sparkles,
  defaultW: 12,
  defaultH: 4,
};

const activityDefinition: WorkspaceModule = {
  id: "activity",
  title: "Activity",
  icon: Sparkles,
  defaultW: 12,
  defaultH: 4,
};

const creativePreset: WorkspaceLayoutPreset = {
  id: "work-first",
  label: "Work first",
  description: "Lead with your work.",
  items: [{ i: "projects", x: 0, y: 0, w: 12, h: 4 }],
  hidden: [],
  pinned: ["projects"],
};

function renderGrid(
  overrides: Partial<Parameters<typeof WorkspaceGrid>[0]> = {},
  { childOwnsTitle = true }: { childOwnsTitle?: boolean } = {},
) {
  return render(
    <WorkspaceGrid
      page="dashboard"
      userId="user-1"
      modules={[moduleDefinition]}
      canCustomize={false}
      renderModule={() => (
        <section>
          {childOwnsTitle && <h2>Projects</h2>}
          <div>Project body</div>
        </section>
      )}
      {...overrides}
    />,
  );
}

describe("WorkspaceGrid module chrome ownership", () => {
  it("does not add a module title in normal mode when the module owns its header", () => {
    renderGrid({ showModuleTitles: false });

    expect(screen.getByText("Project body")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getAllByText("Projects")).toHaveLength(1);
  });

  it("keeps the customization toolbar while deferring module titles to the body", () => {
    renderGrid({
      canCustomize: true,
      defaultCustomizing: true,
      showModuleTitles: false,
    });

    expect(screen.getByText("Customize layout")).toBeInTheDocument();
    expect(screen.getByText("Project body")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getAllByText("Projects")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Move module" })).toBeInTheDocument();
  });

  it("renders one module title when the grid owns module chrome", () => {
    renderGrid(
      {
        canCustomize: true,
        defaultCustomizing: true,
        showModuleTitles: true,
      },
      { childOwnsTitle: false },
    );

    expect(screen.getByText("Project body")).toBeInTheDocument();
    expect(screen.getAllByText("Projects")).toHaveLength(1);
  });

  it("exposes quick creative arrangements without entering edit mode", () => {
    renderGrid({
      canCustomize: true,
      showCustomizeBar: false,
      showPresetPicker: true,
      layoutPresets: [creativePreset],
    });

    expect(screen.getByLabelText("Creative arrangement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Work first" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arrange sections" })).toBeInTheDocument();
  });

  it("labels the quick arrangement picker (dashboard passes its own label)", () => {
    renderGrid({
      canCustomize: true,
      showCustomizeBar: false,
      showPresetPicker: true,
      layoutPresets: [creativePreset],
      presetPickerLabel: "Focus",
    });

    expect(screen.getByLabelText("Focus")).toBeInTheDocument();
    expect(screen.getByText("Focus")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Work first" })).toBeInTheDocument();
  });

  it("exits customize mode when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderGrid({ canCustomize: true, defaultCustomizing: true });

    expect(screen.getByText("Customize layout")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Customize layout")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Customize" })).toBeInTheDocument();
  });

  it("moves a module with the arrow-key handle (and stops the page scroll)", async () => {
    const user = userEvent.setup();
    renderGrid({
      canCustomize: true,
      defaultCustomizing: true,
      modules: [moduleDefinition, activityDefinition],
      renderModule: (id) => (
        <section>
          <h2>{id}</h2>
        </section>
      ),
    });

    const grid = screen.getByTestId("workspace-grid");
    const moveHandles = within(grid).getAllByRole("button", { name: "Move module" });
    const projectsHandle = moveHandles[0];
    await projectsHandle.focus();

    // ArrowLeft/ArrowRight move x and must not scroll the page; ArrowDown
    // moves y. None of these should throw or scroll the viewport.
    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowDown}");

    const sections = within(grid).getAllByRole("heading", { level: 2 });
    expect(sections.map((s) => s.textContent)).toEqual(["projects", "activity"]);
  });

  it("moves a module up/down with the explicit buttons", async () => {
    const user = userEvent.setup();
    renderGrid({
      canCustomize: true,
      defaultCustomizing: true,
      modules: [moduleDefinition, activityDefinition],
      renderModule: (id) => (
        <section>
          <h2>{id}</h2>
        </section>
      ),
    });

    const grid = screen.getByTestId("workspace-grid");
    await user.click(within(grid).getByRole("button", { name: "Move Projects down" }));

    const sections = within(grid).getAllByRole("heading", { level: 2 });
    expect(sections.map((s) => s.textContent)).toEqual(["projects", "activity"]);
  });

  it("provides direct navigation to visible workspace sections", () => {
    renderGrid({
      modules: [moduleDefinition, activityDefinition],
      showSectionNav: true,
      renderModule: (id) => (
        <section>
          <h2>{id}</h2>
        </section>
      ),
    });

    expect(screen.getByRole("navigation", { name: "workspace sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "#workspace-section-projects",
    );
    expect(screen.getByRole("link", { name: "Activity" })).toHaveAttribute(
      "href",
      "#workspace-section-activity",
    );
  });
});
