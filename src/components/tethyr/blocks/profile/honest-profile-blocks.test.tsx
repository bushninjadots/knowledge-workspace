import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { BlockContext } from "@/lib/page-blocks";
import type { ProfileWorkSummary } from "@/hooks/use-profile-work-summary";

// Profile blocks must never show numbers or claims the member didn't produce:
// no data → nothing public (and the block reports itself empty so its section
// collapses); real data → exactly that data.

let summary: { data: ProfileWorkSummary | undefined; isLoading: boolean };
vi.mock("@/hooks/use-profile-work-summary", () => ({
  useProfileWorkSummary: () => summary,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#profile">{children}</a>,
}));

const { ProfileContributionStatsBlock } = await import("./contribution-stats-block");
const { ProfileCollaborationNetworkBlock } = await import("./collaboration-network-block");
const { ProfileLookingForBlock } = await import("./looking-for-block");
const { ProfileAvailabilityBlock } = await import("./availability-block");

function context(overrides: Partial<BlockContext> = {}) {
  return {
    ownerId: "p1",
    ownerType: "profile",
    pageId: "page1",
    blockId: "b1",
    isEditing: false,
    onBlockEmptyChange: vi.fn(),
    ...overrides,
  } as BlockContext & { onBlockEmptyChange: ReturnType<typeof vi.fn> };
}

const EMPTY: ProfileWorkSummary = { projects: 0, contributions: 0, collaborators: [] };

beforeEach(() => {
  summary = { data: EMPTY, isLoading: false };
});

describe("contribution stats", () => {
  it("renders nothing publicly and reports empty when there is no activity", () => {
    const ctx = context();
    const { container } = render(<ProfileContributionStatsBlock config={{}} context={ctx} />);
    expect(container).toBeEmptyDOMElement();
    expect(ctx.onBlockEmptyChange).toHaveBeenCalledWith("b1", true);
  });

  it("shows the real counts, never sample numbers", () => {
    summary = {
      data: {
        projects: 2,
        contributions: 5,
        collaborators: [{ profileId: "x", name: "Ari", handle: "ari", sharedProjects: 1 }],
      },
      isLoading: false,
    };
    render(<ProfileContributionStatsBlock config={{}} context={context()} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("42")).toBeNull();
  });

  it("shows the owner an empty state while editing", () => {
    render(<ProfileContributionStatsBlock config={{}} context={context({ isEditing: true })} />);
    expect(screen.getByLabelText("Empty Contribution stats block")).toBeInTheDocument();
  });
});

describe("collaboration network", () => {
  it("renders nothing publicly without shared projects", () => {
    const ctx = context();
    const { container } = render(<ProfileCollaborationNetworkBlock config={{}} context={ctx} />);
    expect(container).toBeEmptyDOMElement();
    expect(ctx.onBlockEmptyChange).toHaveBeenCalledWith("b1", true);
  });

  it("lists real collaborators with their shared project counts", () => {
    summary = {
      data: {
        projects: 3,
        contributions: 0,
        collaborators: [
          { profileId: "a", name: "Ari", handle: "ari", sharedProjects: 2 },
          { profileId: "b", name: "Bo", handle: null, sharedProjects: 1 },
        ],
      },
      isLoading: false,
    };
    render(<ProfileCollaborationNetworkBlock config={{}} context={context()} />);
    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.getByText("2 shared projects")).toBeInTheDocument();
    expect(screen.getByText("1 shared project")).toBeInTheDocument();
    expect(screen.queryByText("People you have built with")).toBeNull();
  });
});

describe("starter text blocks", () => {
  it("hides untouched Looking for text from visitors but not from the editor", () => {
    const ctx = context();
    const { container } = render(<ProfileLookingForBlock config={{}} context={ctx} />);
    expect(container).toBeEmptyDOMElement();
    expect(ctx.onBlockEmptyChange).toHaveBeenCalledWith("b1", true);

    render(<ProfileLookingForBlock config={{}} context={context({ isEditing: true })} />);
    expect(screen.getByText("Collaborators")).toBeInTheDocument();
  });

  it("shows Looking for once the member has written something", () => {
    render(
      <ProfileLookingForBlock
        config={{ items: ["Illustrators"], note: "Need help with a picture book." }}
        context={context()}
      />,
    );
    expect(screen.getByText("Illustrators")).toBeInTheDocument();
  });

  it("hides untouched Availability and shows it after a change", () => {
    const { container } = render(<ProfileAvailabilityBlock config={{}} context={context()} />);
    expect(container).toBeEmptyDOMElement();

    render(<ProfileAvailabilityBlock config={{ capacity: "open" }} context={context()} />);
    expect(screen.getByText("open")).toBeInTheDocument();
  });
});
