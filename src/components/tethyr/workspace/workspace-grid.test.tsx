import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceGrid } from "./workspace-grid";
import type { WorkspaceModule } from "@/lib/workspace-layouts";
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
});
