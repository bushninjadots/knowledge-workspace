import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const state = vi.hoisted(() => ({
  user: null as {
    userId: string;
    email: string | null;
    emailVerified: boolean;
  } | null,
}));

const fake = vi.hoisted(() => ({
  supabase: {
    auth: { resend: vi.fn() },
  },
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ data: state.user }),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

import { EmailVerificationBanner } from "./email-verification-banner";

function unverifiedUser() {
  return { userId: "user-1", email: "ada@tethyr.dev", emailVerified: false };
}

beforeEach(() => {
  state.user = null;
  fake.supabase.auth.resend.mockReset();
  fake.supabase.auth.resend.mockResolvedValue({ error: null });
  sessionStorage.clear();
});

describe("EmailVerificationBanner", () => {
  it("renders nothing when the email is verified", () => {
    state.user = { userId: "user-1", email: "ada@tethyr.dev", emailVerified: true };
    render(<EmailVerificationBanner />);
    expect(screen.queryByText(/confirm your email/i)).toBeNull();
  });

  it("renders nothing before the current-user query resolves", () => {
    render(<EmailVerificationBanner />);
    expect(screen.queryByText(/confirm your email/i)).toBeNull();
  });

  it("renders nothing when the account has no email to confirm", () => {
    state.user = { userId: "user-1", email: null, emailVerified: false };
    render(<EmailVerificationBanner />);
    expect(screen.queryByText(/confirm your email/i)).toBeNull();
  });

  it("shows the banner with a resend action for an unverified email", async () => {
    state.user = unverifiedUser();
    render(<EmailVerificationBanner />);
    expect(screen.getByText(/confirm your email/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /resend email/i })).toBeTruthy();
  });

  it("resends the confirmation email to the account address", async () => {
    state.user = unverifiedUser();
    const user = userEvent.setup();
    render(<EmailVerificationBanner />);
    await user.click(screen.getByRole("button", { name: /resend email/i }));
    expect(fake.supabase.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "ada@tethyr.dev",
      options: { emailRedirectTo: "http://localhost:3000" },
    });
    expect(await screen.findByText(/sent — check your inbox/i)).toBeTruthy();
  });

  it("shows a failure message when resend errors", async () => {
    state.user = unverifiedUser();
    fake.supabase.auth.resend.mockResolvedValue({ error: { message: "rate limited" } });
    const user = userEvent.setup();
    render(<EmailVerificationBanner />);
    await user.click(screen.getByRole("button", { name: /resend email/i }));
    expect(await screen.findByText(/couldn't send/i)).toBeTruthy();
  });

  it("dismisses for the session and stays dismissed on re-render", async () => {
    state.user = unverifiedUser();
    const user = userEvent.setup();
    const { unmount } = render(<EmailVerificationBanner />);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/confirm your email/i)).toBeNull();
    expect(sessionStorage.getItem("email-banner-dismissed:user-1")).toBe("1");

    unmount();
    render(<EmailVerificationBanner />);
    expect(screen.queryByText(/confirm your email/i)).toBeNull();
  });
});
