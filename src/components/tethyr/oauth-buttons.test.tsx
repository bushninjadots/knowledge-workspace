import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OAuthButtons } from "./oauth-buttons";

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(async () => ({
    data: { url: "https://accounts.google.com/..." },
    error: null as Error | null,
  })),
  toast: { error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithOAuth: mocks.signInWithOAuth } },
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

describe("OAuthButtons", () => {
  beforeEach(() => {
    mocks.signInWithOAuth.mockClear();
    mocks.toast.error.mockClear();
  });

  it("renders all social providers as buttons", () => {
    render(<OAuthButtons />);
    for (const provider of ["Google", "GitHub", "Apple", "GitLab", "Discord"]) {
      expect(screen.getByRole("button", { name: `Continue with ${provider}` })).toBeInTheDocument();
    }
  });

  it("puts the two common providers first and the rest in one compact row", () => {
    render(<OAuthButtons />);
    const google = screen.getByRole("button", { name: "Continue with Google" });
    const github = screen.getByRole("button", { name: "Continue with GitHub" });
    const apple = screen.getByRole("button", { name: "Continue with Apple" });
    const discord = screen.getByRole("button", { name: "Continue with Discord" });

    expect(google.parentElement).toBe(github.parentElement);
    expect(google.parentElement).toHaveClass("grid-cols-2");
    expect(apple.parentElement).toHaveClass("grid-cols-3");
    expect(apple.parentElement).toBe(discord.parentElement);

    // Visible text stays short so the grid works on a 390px viewport; the full
    // action phrase remains the accessible name.
    expect(google).toHaveTextContent("Google");
    expect(google).not.toHaveTextContent("Continue with");
  });

  it("starts an OAuth flow with the default redirect target", async () => {
    const user = userEvent.setup();
    render(<OAuthButtons />);
    await user.click(screen.getByRole("button", { name: "Continue with GitHub" }));

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  });

  it("honors a custom redirect target", async () => {
    const user = userEvent.setup();
    render(<OAuthButtons redirectTarget="/projects/new" />);
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/projects/new` },
    });
  });

  it("shows a toast when the provider is not enabled", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: { url: "" },
      error: new Error("Provider is not enabled"),
    });
    const user = userEvent.setup();
    render(<OAuthButtons />);
    await user.click(screen.getByRole("button", { name: "Continue with Apple" }));

    expect(mocks.toast.error).toHaveBeenCalledWith("Provider is not enabled");
  });
});
