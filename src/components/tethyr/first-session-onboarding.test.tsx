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

const withStudio = {
  profile: {
    display_name: "Ada Lovelace",
    creator_title: "Mathematician",
    bio: "First programmer.",
  } as CurrentUserData["profile"],
};

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
  it("shows the guided path with all three steps when nothing is set up", () => {
    renderOnboarding();

    expect(
      screen.getByRole("heading", { name: "Set up your Studio, then start building." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Set up your Studio")).toBeInTheDocument();
    expect(screen.getByText("Start your first project")).toBeInTheDocument();
    expect(screen.getByText("Share a skill you teach")).toBeInTheDocument();
    // Studio is the first undone step → its action is the primary CTA.
    expect(screen.getByRole("link", { name: /Open Your Studio/ })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("advances the action to the project step once the studio is set up", () => {
    renderOnboarding(makeData(withStudio));

    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a project" })).toBeInTheDocument();
  });

  it("advances the action to the skills step once a project exists", () => {
    renderOnboarding(
      makeData({
        ...withStudio,
        projects: [{ id: "p1" } as CurrentUserData["projects"][number]],
      }),
    );

    expect(screen.getByRole("link", { name: /Add a skill/ })).toHaveAttribute("href", "/profile");
  });

  it("hides once studio, a project, and a skill are all in place", () => {
    const { rerender } = renderOnboarding(
      makeData({
        ...withStudio,
        projects: [{ id: "p1" } as CurrentUserData["projects"][number]],
        teachIds: ["s1"],
      }),
    );

    expect(
      screen.queryByRole("heading", { name: "Set up your Studio, then start building." }),
    ).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FirstSessionOnboarding
          data={makeData({
            ...withStudio,
            projects: [{ id: "p1" } as CurrentUserData["projects"][number]],
            teachIds: ["s1"],
          })}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.queryByRole("heading", { name: "Set up your Studio, then start building." }),
    ).not.toBeInTheDocument();
  });

  it("dismisses per user", async () => {
    const user = userEvent.setup();
    const { rerender } = renderOnboarding();

    await user.click(screen.getByRole("button", { name: "Dismiss onboarding" }));
    expect(
      screen.queryByRole("heading", { name: "Set up your Studio, then start building." }),
    ).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FirstSessionOnboarding data={makeData()} />
      </QueryClientProvider>,
    );
    expect(
      screen.queryByRole("heading", { name: "Set up your Studio, then start building." }),
    ).not.toBeInTheDocument();
  });
});
