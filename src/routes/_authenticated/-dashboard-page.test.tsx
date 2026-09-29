import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPage } from "./-dashboard-page";

// The needs-attention row reads three live counters; tests reshape these
// between renders. Defaults are the all-clear state.
const counts = vi.hoisted(() => ({
  sessions: [] as Array<{ status: string; to_user_id: string }>,
  connections: [] as Array<{ status: string; addressee_id: string }>,
  unreadTotal: 0,
}));

vi.mock("@/hooks/use-sessions", () => ({
  useSessionRequests: () => ({ data: counts.sessions }),
}));
vi.mock("@/hooks/use-connections", () => ({
  useConnections: () => ({ data: counts.connections }),
}));
vi.mock("@/hooks/use-messages", () => ({
  useUnreadCounts: () => ({ data: { total: counts.unreadTotal } }),
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({
    data: {
      userId: "user-1",
      profile: { id: "user-1", display_name: "Maya Lind" },
      projects: [],
      activity: [],
      teachIds: [],
      learnIds: [],
    },
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    ...rest
  }: {
    to: string;
    search?: Record<string, string>;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={to} data-search={JSON.stringify(search ?? null)} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/reputation", () => ({
  checkAndAwardAchievements: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/use-project-loop", () => ({
  useProjectReturnChanges: () => ({ data: [], isLoading: false }),
}));

// The grid and its module rows are the layout-heavy, unrelated part — inert.
vi.mock("@/components/tethyr/workspace/workspace-grid", () => ({
  WorkspaceGrid: () => null,
}));
vi.mock("@/lib/workspace-layouts", () => ({
  DASHBOARD_LAYOUT_PRESETS: [],
  DASHBOARD_MODULES: [],
}));
vi.mock("@/components/tethyr/workspace/dashboard-module-rows", () => ({
  selectActiveProjects: (projects: unknown[]) => projects,
  ActivityModuleRow: () => null,
  ApplicationsModuleRow: () => null,
  ChallengesModuleRow: () => null,
  ConnectionsModuleRow: () => null,
  ProjectsModuleRow: () => null,
  RoadmapModuleRow: () => null,
  SuggestedCreatorsModuleRow: () => null,
  SuggestedProjectsModuleRow: () => null,
  TrendingSkillsModuleRow: () => null,
  WatchlistModuleRow: () => null,
}));
vi.mock("@/components/tethyr/first-session-onboarding", () => ({
  FirstSessionOnboarding: () => null,
}));
vi.mock("@/components/tethyr/next-steps", () => ({
  NextStepsList: () => null,
}));
vi.mock("@/components/tethyr/create-project-button", () => ({
  CreateProjectButton: () => null,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

function activityRow() {
  return screen.queryByText("You have activity")?.closest("a");
}

beforeEach(() => {
  vi.clearAllMocks();
  counts.sessions = [];
  counts.connections = [];
  counts.unreadTotal = 0;
});

describe("Dashboard needs-attention row", () => {
  it("is inert when everything is all clear", () => {
    renderPage();
    expect(screen.getByText("No pending invites")).toBeInTheDocument();
    expect(screen.getByText("All clear — nothing needs your attention.")).toBeInTheDocument();
    expect(activityRow() ?? null).toBeNull();
    expect(document.querySelector('section a[href="/messages"]')).toBeNull();
  });

  it("links into session requests when one is pending", () => {
    counts.sessions = [{ status: "pending", to_user_id: "user-1" }];
    renderPage();
    const row = activityRow();
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute("href", "/sessions");
    expect(row).toHaveAttribute("data-search", JSON.stringify({ tab: "requests" }));
  });

  it("prefers sessions over connections and messages", () => {
    counts.sessions = [{ status: "pending", to_user_id: "user-1" }];
    counts.connections = [{ status: "pending", addressee_id: "user-1" }];
    counts.unreadTotal = 3;
    renderPage();
    expect(activityRow()).toHaveAttribute("href", "/sessions");
  });

  it("links to connections when only connection requests are pending", () => {
    counts.connections = [{ status: "pending", addressee_id: "user-1" }];
    renderPage();
    expect(activityRow()).toHaveAttribute("href", "/connections");
  });

  it("links to messages when only unread messages remain", () => {
    counts.unreadTotal = 2;
    renderPage();
    expect(activityRow()).toHaveAttribute("href", "/messages");
  });
});
