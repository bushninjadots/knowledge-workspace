import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FirstSessionOnboarding } from "./first-session-onboarding";
import type { CurrentUserData } from "@/hooks/use-current-user";

vi.mock("@/components/tethyr/create-project-button", () => ({
  CreateProjectButton: ({ label, onCreated }: { label: string; onCreated?: () => void }) => (
    <button type="button" onClick={onCreated}>
      {label}
    </button>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    onClick,
    to,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    to: string;
  }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
}));

function makeData(overrides: Partial<CurrentUserData> = {}): CurrentUserData {
  return {
    userId: "user-1",
    profile: null,
    projects: [],
    teachIds: [],
    learnIds: [],
    activity: [],
    ...overrides,
  } as CurrentUserData;
}

function renderOnboarding(data = makeData()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FirstSessionOnboarding data={data} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("FirstSessionOnboarding", () => {
  it("starts with an intent question and reveals a relevant action", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    expect(screen.getByRole("heading", { name: "What brings you to Tethyr?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Find a project" }));

    expect(screen.getByRole("heading", { name: "Find work worth joining." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore projects/ })).toHaveAttribute(
      "href",
      "/explore",
    );
  });

  it("dismisses per user", async () => {
    const user = userEvent.setup();
    const { rerender } = renderOnboarding();

    await user.click(screen.getByRole("button", { name: "Dismiss onboarding" }));
    expect(
      screen.queryByRole("heading", { name: "What brings you to Tethyr?" }),
    ).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FirstSessionOnboarding data={makeData()} />
      </QueryClientProvider>,
    );
    expect(
      screen.queryByRole("heading", { name: "What brings you to Tethyr?" }),
    ).not.toBeInTheDocument();
  });

  it("does not show once the user has started building", () => {
    renderOnboarding(makeData({ projects: [{ id: "p1" } as CurrentUserData["projects"][number]] }));
    expect(
      screen.queryByRole("heading", { name: "What brings you to Tethyr?" }),
    ).not.toBeInTheDocument();
  });
});
