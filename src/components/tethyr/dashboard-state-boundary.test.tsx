import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardStateBoundary } from "./dashboard-state-boundary";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("./auth-shell", () => ({
  AuthShell: ({
    title,
    subtitle,
    children,
    footer,
  }: {
    title: string;
    subtitle: string;
    children: ReactNode;
    footer: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div>{children}</div>
      <footer>{footer}</footer>
    </div>
  ),
}));

function renderBoundary(overrides: Partial<Parameters<typeof DashboardStateBoundary>[0]> = {}) {
  const onRetry = vi.fn();
  render(
    <DashboardStateBoundary
      data={null}
      isLoading={false}
      isError={false}
      onRetry={onRetry}
      {...overrides}
    >
      <main>Authenticated dashboard</main>
    </DashboardStateBoundary>,
  );
  return { onRetry };
}

describe("DashboardStateBoundary", () => {
  it("shows the signed-out gateway only for a settled, non-error query", () => {
    renderBoundary();

    expect(screen.getByRole("heading", { name: "Your workspace awaits" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /log in/i })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /log in/i })[0]).toHaveAttribute("href", "/login");
    expect(screen.queryByText("Authenticated dashboard")).not.toBeInTheDocument();
  });

  it("keeps the loading skeleton while auth data is pending", () => {
    renderBoundary({ isLoading: true });

    expect(screen.queryByText("Your workspace awaits")).not.toBeInTheDocument();
    expect(screen.queryByText("Authenticated dashboard")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading your dashboard" })).toBeInTheDocument();
  });

  it("prioritizes the error state over signed-out fallback and exposes retry", async () => {
    const { onRetry } = renderBoundary({
      isError: true,
      error: new Error("profile query failed"),
    });

    expect(
      screen.getByRole("heading", { name: /couldn't load your dashboard/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("profile query failed")).toBeInTheDocument();
    expect(screen.queryByText("Your workspace awaits")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("prioritizes an error over loading and stale authenticated data", () => {
    renderBoundary({
      data: { userId: "user-1" },
      isLoading: true,
      isError: true,
      error: new Error("stale query failed"),
    });

    expect(
      screen.getByRole("heading", { name: /couldn't load your dashboard/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Authenticated dashboard")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Loading your dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("renders authenticated content only after user data is available", () => {
    renderBoundary({ data: { userId: "user-1" } });

    expect(screen.getByText("Authenticated dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Your workspace awaits")).not.toBeInTheDocument();
  });
});
