import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectShelf } from "./project-shelf";
import type { ProjectRow } from "@/routes/_authenticated/explore";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: () => false,
    useMotionValue: () => ({ get: () => 0, set: () => {}, isAnimating: () => false }),
  };
});

// Desktop layout — jsdom has no matchMedia, and ProjectShelf uses it to pick
// between the carousel and the stacked mobile list.
beforeAll(() => {
  // The overlay's swipe-to-dismiss uses pointer capture; jsdom lacks it.
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  window.matchMedia =
    window.matchMedia ??
    (((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia);
});

function makeProject(id: string, title: string): ProjectRow {
  return {
    id,
    profile_id: "user-1",
    title,
    description: null,
    status: "active",
    stage: "shipped",
    tags: [],
    progress_percent: 50,
    cover_url: null,
    is_featured: false,
    looking_for_collaborators: false,
    looking_for_feedback: false,
    created_at: "2026-08-01T00:00:00Z",
    profiles: {
      id: "user-1",
      handle: "creator",
      display_name: "Creator",
      creator_title: null,
      avatar_url: null,
    },
  };
}

function renderShelf(projects: ProjectRow[]) {
  return render(
    <ProjectShelf
      projects={projects}
      meId="user-1"
      contributorIds={new Set()}
      q=""
      setQ={vi.fn()}
      category="All"
      setCategory={vi.fn()}
    />,
  );
}

describe("ProjectShelf keyboard navigation", () => {
  it("browses projects with the arrow keys and updates the counter", async () => {
    const user = userEvent.setup();
    const projects = [
      makeProject("p1", "First"),
      makeProject("p2", "Second"),
      makeProject("p3", "Third"),
    ];
    renderShelf(projects);

    // Starts on the first project.
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    // Clamped at the end — ArrowRight past the last project does nothing.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("ignores arrow keys while the project overlay is open", async () => {
    const user = userEvent.setup();
    const projects = [makeProject("p1", "First"), makeProject("p2", "Second")];
    renderShelf(projects);

    // Open the overlay by clicking the active card.
    await user.click(screen.getByRole("button", { name: /First/i }));
    expect(await screen.findByRole("dialog", { name: "First" })).toBeInTheDocument();

    // Arrow keys are handled by the overlay (prev/next inside it) rather than
    // the shelf — the shelf counter must not change.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });
});

describe("ProjectShelf point-and-click navigation", () => {
  it("moves with the previous/next buttons, disabling at the ends", async () => {
    const user = userEvent.setup();
    const projects = [makeProject("p1", "First"), makeProject("p2", "Second")];
    renderShelf(projects);

    const prev = screen.getByRole("button", { name: "Previous project" });
    const next = screen.getByRole("button", { name: "Next project" });
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();

    await user.click(next);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(next).toBeDisabled();

    await user.click(prev);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("jumps to a project from the thumbnail strip", async () => {
    const user = userEvent.setup();
    const projects = [
      makeProject("p1", "First"),
      makeProject("p2", "Second"),
      makeProject("p3", "Third"),
    ];
    renderShelf(projects);

    await user.click(screen.getByRole("tab", { name: "Go to project 3: Third" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Go to project 3: Third" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows the empty state with a working clear-filters action", async () => {
    const user = userEvent.setup();
    const setQ = vi.fn();
    const setCategory = vi.fn();
    render(
      <ProjectShelf
        projects={[]}
        meId="user-1"
        contributorIds={new Set()}
        q="socks"
        setQ={setQ}
        category="All"
        setCategory={setCategory}
      />,
    );

    expect(screen.getByText("No projects match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(setQ).toHaveBeenCalledWith("");
    expect(setCategory).toHaveBeenCalledWith("All");
  });
});

describe("ProjectShelf overlay focus", () => {
  it("moves focus to the close button when the overlay opens", async () => {
    const user = userEvent.setup();
    const projects = [makeProject("p1", "First"), makeProject("p2", "Second")];
    renderShelf(projects);

    await user.click(screen.getByRole("button", { name: /First/i }));
    const closeButton = await screen.findByRole("button", { name: "Close overlay" });
    // The overlay focuses its close button shortly after opening.
    await waitFor(() => expect(closeButton).toHaveFocus());
  });

  it("closes the overlay on Escape and returns to the shelf", async () => {
    const user = userEvent.setup();
    const projects = [makeProject("p1", "First")];
    renderShelf(projects);

    await user.click(screen.getByRole("button", { name: /First/i }));
    expect(await screen.findByRole("dialog", { name: "First" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "First" })).not.toBeInTheDocument(),
    );
  });
});
