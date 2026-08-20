import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobilePrimaryNav } from "./mobile-primary-nav";

// The nav reads the current pathname via useRouterState({ select }). The mock
// returns the selected value (the pathname string) directly.
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
  useRouterState: vi.fn(() => "/dashboard"),
}));

const { useRouterState } = await import("@tanstack/react-router");

beforeEach(() => {
  vi.mocked(useRouterState).mockReturnValue("/dashboard" as never);
});

describe("MobilePrimaryNav", () => {
  it("uses the same labels as the desktop sidebar", () => {
    render(<MobilePrimaryNav onOpenMore={() => {}} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Your Studio" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute("href", "/messages");
  });

  it("marks the current page with aria-current", () => {
    render(<MobilePrimaryNav onOpenMore={() => {}} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Explore" })).not.toHaveAttribute("aria-current");
  });

  it("marks the profile tab active on any profile route", () => {
    vi.mocked(useRouterState).mockReturnValue("/profile" as never);
    render(<MobilePrimaryNav onOpenMore={() => {}} />);
    expect(screen.getByRole("link", { name: "Your Studio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("exposes the More sheet opener", async () => {
    const onOpenMore = vi.fn();
    render(<MobilePrimaryNav onOpenMore={onOpenMore} />);
    const more = screen.getByRole("button", { name: "Open more navigation" });
    more.click();
    expect(onOpenMore).toHaveBeenCalled();
  });
});
