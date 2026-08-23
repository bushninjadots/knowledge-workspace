// ── Dev Preview — Block System Verification ─────────────────────────────────
// Renders sample blocks directly via PageLayoutRenderer to verify the block
// system renders end-to-end without depending on the database.
// Access at /dev — no auth required (dev only).

import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

// Import all block categories so they register themselves.
import "@/components/tethyr/blocks/content";
import "@/components/tethyr/blocks/project";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import { useTheme } from "@/hooks/use-theme";
import { themeTokensToStyle } from "@/lib/theme-tokens";
import type { PageLayout, BlockContext } from "@/lib/page-blocks";

/** Sample layout exercising every content block type. */
const SAMPLE_LAYOUT: PageLayout = {
  sections: [
    {
      id: "hero",
      position: 0,
      layout: "full",
      blocks: [
        {
          id: "title",
          type: "heading",
          position: 0,
          config: { level: 1, content: "Welcome to the Tethyr Block System" },
          visible: true,
        },
        {
          id: "subtitle",
          type: "text",
          position: 1,
          config: {
            content:
              "This page demonstrates the Phase 2 block foundation. Every section below is rendered by a registered block type — no hard-coded JSX in this route.",
          },
          visible: true,
        },
        { id: "div-1", type: "divider", position: 2, config: { label: "Content Blocks" }, visible: true },
      ],
    },
    {
      id: "headings-section",
      position: 1,
      layout: "two_column",
      blocks: [
        {
          id: "h1-demo",
          type: "heading",
          position: 0,
          config: { level: 1, content: "Heading Level 1 — Page Title" },
          visible: true,
        },
        {
          id: "h2-demo",
          type: "heading",
          position: 1,
          config: { level: 2, content: "Heading Level 2 — Section Title" },
          visible: true,
        },
        {
          id: "h3-demo",
          type: "heading",
          position: 2,
          config: { level: 3, content: "Heading Level 3 — Subsection" },
          visible: true,
        },
        {
          id: "h4-demo",
          type: "heading",
          position: 3,
          config: { level: 4, content: "Heading Level 4 — Topic" },
          visible: true,
        },
      ],
    },
    {
      id: "markdown-section",
      position: 2,
      layout: "full",
      blocks: [
        {
          id: "md-heading",
          type: "heading",
          position: 0,
          config: { level: 2, content: "Markdown Rendering" },
          visible: true,
        },
        {
          id: "md-demo",
          type: "markdown",
          position: 1,
          config: {
            content:
              "# This is rendered from markdown\n\nMarkdown blocks support **bold**, *italic*, `inline code`, and [links](https://tethyr.app).\n\n## Features\n\n- Bullet lists\n- Nested content\n- Code blocks\n\n```ts\nconst greeting = \"Hello, Tethyr!\";\n```\n\n> Blockquotes work too.\n\n---\n\nThis is **really** useful for READMEs and project descriptions.",
          },
          visible: true,
        },
      ],
    },
    {
      id: "text-section",
      position: 3,
      layout: "three_column",
      blocks: [
        {
          id: "text-1",
          type: "text",
          position: 0,
          config: {
            content:
              "This is a text block. It renders plain text with whitespace preservation. Text blocks are great for short descriptions, bios, and contextual copy that doesn't need markdown formatting.",
          },
          visible: true,
        },
        {
          id: "text-2",
          type: "text",
          position: 1,
          config: {
            content:
              "Text blocks in a three-column layout create clean, scannable content areas. Each block is independently editable when the page is in edit mode.",
          },
          visible: true,
        },
        {
          id: "text-3",
          type: "text",
          position: 2,
          config: {
            content:
              "The layout system supports full, two-column, three-column, sidebar-left, sidebar-right, and feature arrangements. Columns automatically collapse to single-column on mobile.",
          },
          visible: true,
        },
      ],
    },
    {
      id: "closing",
      position: 4,
      layout: "full",
      blocks: [
        { id: "div-end", type: "divider", position: 0, config: { label: "End of Demo" }, visible: true },
        {
          id: "closing-text",
          type: "text",
          position: 1,
          config: {
            content:
              "This page is rendered entirely by the block registry. No blocks were hard-coded in this route — every section is driven by the layout data structure. Phase 3 will add project-specific blocks (Hero, Status, Roadmap, Team, Files, Activity) and wire them into the actual project route.",
          },
          visible: true,
        },
      ],
    },
  ],
};

const CONTEXT: BlockContext = {
  ownerId: "00000000-0000-0000-0000-000000000000",
  ownerType: "profile",
  pageId: "dev-preview",
  isEditing: false,
};

export const Route = createFileRoute("/dev")({
  head: () => ({
    meta: [{ title: "Block System Preview — Tethyr" }],
  }),
  component: DevPreviewPage,
});

function DevPreviewPage() {
  const { data: themeVars = {} } = useTheme(null);
  const style = useMemo(() => ({ ...themeVars }) as React.CSSProperties, [themeVars]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 rounded-lg border border-dashed border-caution/50 bg-caution-subtle px-4 py-3">
          <p className="text-sm font-medium text-caution-foreground">
            🧪 Dev Preview — Block System Phase 2 Verification
          </p>
          <p className="mt-1 text-xs text-caution-foreground/70">
            This page bypasses the database and renders directly from a sample layout.
            Remove this route before production.
          </p>
        </div>

        <div style={style}>
          <PageLayoutRenderer layout={SAMPLE_LAYOUT} context={CONTEXT} />
        </div>
      </div>
    </div>
  );
}