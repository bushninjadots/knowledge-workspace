import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "./navbar";

// The navbar reads the location via useLocation() and signs out via the
// supabase client; both are replaced so the test renders in isolation.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useLocation: vi.fn(() => ({ pathname: "/" })),
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: vi.fn(async () => ({})) } },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

vi.mock("./theme-toggle", () => ({ ThemeToggle: () => <div data-testid="theme-toggle" /> }));
vi.mock("./logo", () => ({ Logo: () => <div data-testid="logo" /> }));
vi.mock("./create-project-button", () => ({
  CreateProjectButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? "Create"}</button>
  ),
}));

const { useCurrentUser } = await import("@/hooks/use-current-user");

const AUTHED = {
  data: { userId: "u1", profile: { display_name: "Maya Lind" } },
  isLoading: false,
};

beforeEach(() => {
  vi.mocked(useCurrentUser).mockReturnValue({ data: null, isLoading: false } as never);
});

describe("Navbar", () => {
  it("carries the three primary areas for visitors", () => {
    render(<Navbar />);
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("link", { name: "Community" })).toHaveAttribute("href", "/community");
    expect(screen.getByRole("link", { name: "Challenges" })).toHaveAttribute("href", "/challenges");
  });

  it("does not re-advertise Skills or Teams as primary destinations", () => {
    // They remain reachable via the footer and the authenticated sidebar, but
    // they are discovery/filter surfaces, not navbar-level areas.
    render(<Navbar />);
    expect(screen.queryByRole("link", { name: "Skills" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Teams" })).toBeNull();
  });

  it("renders no Dashboard button for signed-in members", () => {
    // The workspace lives in the account menu; the navbar must not compete
    // with the dashboard for navigation.
    vi.mocked(useCurrentUser).mockReturnValue(AUTHED as never);
    render(<Navbar />);
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
  });

  it("gives signed-in members an account menu trigger", () => {
    vi.mocked(useCurrentUser).mockReturnValue(AUTHED as never);
    render(<Navbar />);
    expect(
      screen.getByRole("button", { name: "Account menu for Maya Lind" }),
    ).toBeInTheDocument();
  });

  it("keeps the create-project action prominent for signed-in members", () => {
    vi.mocked(useCurrentUser).mockReturnValue(AUTHED as never);
    render(<Navbar />);
    expect(screen.getByRole("button", { name: "Create project" })).toBeInTheDocument();
  });
});
