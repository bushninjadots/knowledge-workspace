import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileLink } from "./profile-link";

// Mock the router Link as a plain anchor, resolving $params like the real
// router does (ProfileLink only ever uses /u/$handle).
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={params ? to.replace(/\$(\w+)/g, (_m, k) => params[k] ?? "") : to} {...rest}>
      {children}
    </a>
  ),
}));

describe("ProfileLink", () => {
  it("renders a link to /u/:handle when the profile has a handle", () => {
    render(
      <ProfileLink handle="maya">
        <span>Maya</span>
      </ProfileLink>,
    );
    const link = screen.getByRole("link", { name: "Maya" });
    expect(link).toHaveAttribute("href", "/u/maya");
  });

  it("renders a non-interactive element (not a link) when the handle is missing", () => {
    render(
      <ProfileLink handle={null}>
        <span>No handle</span>
      </ProfileLink>,
    );
    // No link exists for a handle-less profile — a broken /u/ link is a 404.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("No handle")).toBeInTheDocument();
  });

  it("treats an empty-string handle the same as a missing one", () => {
    render(
      <ProfileLink handle="">
        <span>Empty</span>
      </ProfileLink>,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  it("passes title and style through on both branches", () => {
    const { rerender } = render(
      <ProfileLink handle="maya" title="Maya Chen" style={{ animationDelay: "40ms" }}>
        <span>M</span>
      </ProfileLink>,
    );
    expect(screen.getByTitle("Maya Chen")).toHaveStyle({ animationDelay: "40ms" });

    rerender(
      <ProfileLink handle={null} title="Maya Chen" style={{ animationDelay: "40ms" }}>
        <span>M</span>
      </ProfileLink>,
    );
    expect(screen.getByTitle("Maya Chen")).toHaveStyle({ animationDelay: "40ms" });
  });

  it("applies the className on the link branch", () => {
    render(
      <ProfileLink handle="maya" className="card-border">
        <span>M</span>
      </ProfileLink>,
    );
    expect(screen.getByRole("link")).toHaveClass("card-border");
  });
});
