// ── Public/owner Studio parity ───────────────────────────────────────────────
// The public page renderer (PageLayoutRenderer in view mode) must lay blocks
// out exactly like the owner's Studio view: same studio-block frame, same
// full-bleed opt-outs, same grid-item sizing. These tests pin that contract —
// when the owner view changes, these assertions should change with it.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageLayoutRenderer } from "./page-layout";
import { registerBlock } from "@/lib/block-registry";
import type { BlockContext, BlockProps, PageLayout } from "@/lib/page-blocks";

const Stub = ({ config }: BlockProps) => (
  <p>{typeof config.label === "string" ? config.label : "stub"}</p>
);

registerBlock({
  type: "parity-stub",
  category: "utility",
  label: "Parity stub",
  description: "Test-only block",
  icon: "Minus",
  defaults: {},
  component: Stub,
});

registerBlock({
  type: "parity-flush",
  category: "utility",
  label: "Parity flush stub",
  description: "Test-only containerless block",
  icon: "Minus",
  defaults: {},
  containerless: true,
  component: Stub,
});

const ctx: BlockContext = {
  ownerId: "owner-1",
  ownerType: "profile",
  pageId: "page-1",
  isEditing: false,
  isOwner: false,
};

function layoutWith(
  section: Partial<PageLayout["sections"][number]>,
  blocks: PageLayout["sections"][number]["blocks"],
): PageLayout {
  return {
    sections: [
      {
        id: "s1",
        position: 0,
        layout: "full",
        blocks,
        ...section,
      },
    ],
  };
}

function block(id: string, type = "parity-stub", span?: number) {
  return { id, type, position: 0, config: { label: id }, visible: true, span };
}

const frameOf = (label: string) => screen.queryByText(label)?.closest(".studio-block");

describe("PageLayoutRenderer public parity with the owner Studio view", () => {
  it("wraps public blocks in the same studio-block frame the owner view uses", () => {
    render(<PageLayoutRenderer layout={layoutWith({}, [block("framed")])} context={ctx} />);
    const frame = frameOf("framed");
    expect(frame).not.toBeNull();
    expect(frame?.className).toContain("studio-block");
    expect(frame?.className).not.toContain("studio-block-flush");
  });

  it("keeps full-bleed blocks flush inside the frame, like the owner view", () => {
    render(
      <PageLayoutRenderer layout={layoutWith({}, [block("hero", "parity-flush")])} context={ctx} />,
    );
    const frame = frameOf("hero");
    expect(frame).not.toBeNull();
    expect(frame?.className).toContain("studio-block-flush");
  });

  it("places grid sections from the persisted 12-col grid", () => {
    render(
      <PageLayoutRenderer
        layout={layoutWith(
          {
            layout: "feature",
            grid: [
              { i: "lead", x: 0, y: 0, w: 8, h: 4 },
              { i: "aside", x: 8, y: 0, w: 4, h: 4 },
            ],
          },
          [block("lead"), block("aside")],
        )}
        context={ctx}
      />,
    );
    const leadItem = frameOf("lead")?.parentElement;
    const asideItem = frameOf("aside")?.parentElement;
    expect(leadItem?.className).toContain("md:col-start-1");
    expect(leadItem?.className).toContain("md:col-span-8");
    expect(asideItem?.className).toContain("md:col-start-9");
    expect(asideItem?.className).toContain("md:col-span-4");
  });

  it("sizes template sections with span boxes, not auto-flow", () => {
    // No persisted grid: the wrapper must still be the grid item (relative
    // min-w-0 + span class), never display:contents auto-flow — that laid
    // template sections out differently from the owner Studio view.
    render(
      <PageLayoutRenderer
        layout={layoutWith({ layout: "two_column" }, [
          block("first", "parity-stub", 6),
          block("second", "parity-stub", 6),
        ])}
        context={ctx}
      />,
    );
    const firstItem = frameOf("first")?.parentElement;
    expect(firstItem?.className).toContain("relative min-w-0");
    expect(firstItem?.className).toContain("md:col-span-6");
    expect(firstItem?.className).not.toContain("contents");
  });

  it("does not add the frame in edit mode (the editor owns block chrome)", () => {
    render(
      <PageLayoutRenderer
        layout={layoutWith({}, [block("editing")])}
        context={{ ...ctx, isEditing: true, isOwner: true }}
      />,
    );
    expect(frameOf("editing")).toBeFalsy();
  });
});
