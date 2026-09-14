import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardSidebar } from "./dashboard-sidebar";

// The sidebar reads the current pathname via useRouterState({ select }). The
// mock returns the selected value (the pathname string) directly.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: vi.fn(() => "/dashboard"),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/hooks/use-messages", () => ({
  useUnreadCounts: () => ({ data: { total: 4, byConnection: {} } }),
}));

vi.mock("@/hooks/use-notifications", () => ({
  useUnreadNotificationCount: () => ({ data: 7 }),
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({
    data: {
      userId: "u1",
      profile: { display_name: "Test User", handle: "testuser", availability: "available" },
    },
  }),
}));

vi.mock("./global-search", () => ({ GlobalSearch: () => <div data-testid="global-search" /> }));
vi.mock("./create-project-button", () => ({
  CreateProjectButton: ({ ariaLabel }: { ariaLabel?: string }) => (
    <button aria-label={ariaLabel}>Create</button>
  ),
}));
vi.mock("./availability-badge", () => ({
  AvailabilitySelector: ({ compact }: { compact?: boolean }) => (
    <button
      aria-label={compact ? "Set availability status — Available" : "Set availability status"}
    />
  ),
  useUpdateAvailability: () => ({ mutate: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DashboardSidebar rail", () => {
  it("renders every destination with its label when expanded", () => {
    render(<DashboardSidebar onToggleCollapse={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("omits the rail toggle when the shell doesn't offer one (mobile drawer)", () => {
    render(<DashboardSidebar />);
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).not.toBeInTheDocument();
  });

  it("keeps every destination reachable when collapsed, with a title for hover", () => {
    render(<DashboardSidebar collapsed onToggleCollapse={vi.fn()} />);
    const dashboard = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboard).toHaveAttribute("title", "Dashboard");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  it("folds the unread count into the accessible name and shows a dot instead", () => {
    render(<DashboardSidebar collapsed onToggleCollapse={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Notifications, 7 unread" })).toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
  });

  it("keeps the search field only when there is room for it", () => {
    const { unmount } = render(<DashboardSidebar onToggleCollapse={vi.fn()} />);
    expect(screen.getByTestId("global-search")).toBeInTheDocument();
    unmount();

    render(<DashboardSidebar collapsed onToggleCollapse={vi.fn()} />);
    expect(screen.queryByTestId("global-search")).not.toBeInTheDocument();
  });

  it("reports the collapse intent", async () => {
    const onToggleCollapse = vi.fn();
    render(<DashboardSidebar onToggleCollapse={onToggleCollapse} />);
    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it("uses the compact availability trigger in rail mode", () => {
    render(<DashboardSidebar collapsed onToggleCollapse={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Set availability status — Available" }),
    ).toBeInTheDocument();
  });
});
