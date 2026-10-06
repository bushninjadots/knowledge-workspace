import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { SettingsPage } from "@/components/tethyr/settings-page";
import { renderRoutePage } from "@/test-utils/route-page";

function renderPage(ui: ReactElement = <SettingsPage />) {
  return renderRoutePage(ui);
}

// --- Mocks ---------------------------------------------------------------

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const supabase = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-1", email: "test@tethyr.com" } },
      error: null,
    })),
    updateUser: vi.fn(async () => ({ data: null, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase }));

const accountServer = vi.hoisted(() => ({ deleteAccount: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/account-server", () => accountServer);

const prefs = vi.hoisted(() => ({
  useNotificationPreferences: () => ({
    mutedCategories: [],
    isLoading: false,
    toggle: vi.fn(),
    isMuted: vi.fn(() => false),
  }),
}));
vi.mock("@/hooks/use-notification-preferences", () => prefs);

vi.mock("@/hooks/use-current-user", () => ({
  useAuthUser: () => ({ data: { id: "user-1", email: "test@tethyr.com" } }),
  useCurrentUser: () => ({
    data: {
      userId: "user-1",
      profile: { id: "user-1" },
    },
    refresh: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-router", async () => {
  const { reactRouterMock } = await import("@/test-utils/route-page");
  // Route files call createFileRoute at module scope — present but inert here.
  return reactRouterMock({ createFileRoute: () => () => ({}) });
});

vi.mock("@/lib/theme", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({
    theme: "system",
    resolvedTheme: "light",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    themePreset: null,
    setThemePreset: vi.fn(),
    siteAppearance: { density: "comfortable", shape: "theme", accent: "", motion: "standard" },
    setSiteAppearance: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "test@tethyr.com" } },
    error: null,
  });
  supabase.auth.updateUser.mockResolvedValue({ data: null, error: null });
  accountServer.deleteAccount.mockResolvedValue({ ok: true });
});

describe("SettingsPage", () => {
  it("renders the account, notifications, and danger-zone sections", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Account & security" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    // Scope is explicit: this section changes Tethyr, not the profile.
    expect(screen.getByRole("heading", { name: "Site appearance" })).toBeInTheDocument();
    expect(screen.getByText(/Changes how Tethyr itself looks to you/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Delete account" })).toBeInTheDocument();
    expect(screen.getByText("test@tethyr.com")).toBeInTheDocument();
  });

  it("rejects an invalid email without calling the auth provider", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByRole("textbox", { name: "Change email" }), "a@b");
    await user.click(screen.getByRole("button", { name: "Update email" }));
    expect(toast.error).toHaveBeenCalled();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("New password"), "short");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(toast.error).toHaveBeenCalledWith("Password must be at least 8 characters");
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("keeps Delete forever disabled until the exact email is typed", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const confirm = screen.getByRole("button", { name: "Delete forever" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Your email" }), "someone@else.com");
    expect(confirm).toBeDisabled();

    await user.clear(screen.getByRole("textbox", { name: "Your email" }));
    await user.type(screen.getByRole("textbox", { name: "Your email" }), "test@tethyr.com");
    expect(confirm).toBeEnabled();
  });

  it("deletes the account through the server function and signs out", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.type(screen.getByRole("textbox", { name: "Your email" }), "test@tethyr.com");
    await user.click(screen.getByRole("button", { name: "Delete forever" }));

    await waitFor(() => expect(accountServer.deleteAccount).toHaveBeenCalled());
    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalled());
  });
});
