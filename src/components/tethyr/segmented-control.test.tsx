import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Star } from "lucide-react";
import { SegmentedControl } from "./segmented-control";

const OPTIONS = [
  { value: "overview", label: "Overview" },
  { value: "people", label: "People" },
  { value: "projects", label: "Projects" },
] as const;

function setup(value = "overview") {
  const onChange = vi.fn();
  render(
    <SegmentedControl
      value={value}
      onChange={onChange}
      ariaLabel="Sections"
      options={[...OPTIONS]}
    />,
  );
  return { onChange };
}

describe("SegmentedControl", () => {
  it("renders a tablist with all options as tabs", () => {
    setup();
    const list = screen.getByRole("tablist", { name: "Sections" });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "People" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Projects" })).toBeInTheDocument();
  });

  it("marks the active option selected and keeps only it in the tab order", () => {
    setup("people");
    expect(screen.getByRole("tab", { name: "People" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "People" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("tabindex", "-1");
  });

  it("selects a tab on click", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("tab", { name: "Projects" }));
    expect(onChange).toHaveBeenCalledWith("projects");
  });

  it("ArrowRight selects the next tab and moves focus to it", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    const first = screen.getByRole("tab", { name: "Overview" });
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("people");
    expect(screen.getByRole("tab", { name: "People" })).toHaveFocus();
  });

  it("ArrowLeft moves backward", async () => {
    const user = userEvent.setup();
    const { onChange } = setup("people");
    screen.getByRole("tab", { name: "People" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith("overview");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
  });

  it("wraps around at both ends", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith("projects");

    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("overview");
  });

  it("Enter activates the focused tab (native button behavior)", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    screen.getByRole("tab", { name: "People" }).focus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("people");
  });

  it("ignores unrelated keys", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("a");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders icons and per-option ids/aria-controls for tab semantics", () => {
    render(
      <SegmentedControl
        value="overview"
        onChange={vi.fn()}
        ariaLabel="Skill sections"
        options={[
          {
            value: "overview",
            label: "Overview",
            icon: Star,
            id: "tab-overview",
            ariaControls: "panel-overview",
          },
        ]}
      />,
    );
    const tab = screen.getByRole("tab", { name: "Overview" });
    expect(tab).toHaveAttribute("id", "tab-overview");
    expect(tab).toHaveAttribute("aria-controls", "panel-overview");
    expect(tab.querySelector("svg")).toBeInTheDocument();
  });

  it("hides labels on mobile when requested", () => {
    render(
      <SegmentedControl
        value="a"
        onChange={vi.fn()}
        ariaLabel="Sections"
        options={[{ value: "a", label: "Alpha", hideLabelOnMobile: true }]}
      />,
    );
    const span = screen.getByText("Alpha");
    expect(span).toHaveClass("hidden", "sm:inline");
  });
});
