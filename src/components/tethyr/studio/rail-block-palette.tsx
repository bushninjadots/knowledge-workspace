// ── Studio rail: Add tab ──────────────────────────────────────────────────────────
// The block palette: every profile block grouped by category, searchable,
// draggable onto the canvas or added to the area in view.

import { Fragment, useMemo, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getAllBlocks, getBlock } from "@/lib/block-registry";
import { useJournalSummary } from "@/hooks/use-journal";
import type { BlockDefinition } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";
import { findSection, sectionLabel } from "@/lib/studio-grid";
import { useGithubConnection } from "@/hooks/use-github";
import { BlockIcon } from "./block-icon";
import { suggestBlocks } from "@/lib/block-suggestions";
import type { GStudioSurfaceProps } from "./g-studio-surface";
import { BLOCK_CATEGORY_LABELS, BLOCK_CATEGORY_ORDER } from "./block-categories";

/**
 * "About / README" (project-about) and "README" (profile-readme) both write the
 * same `profiles.readme` document. On a studio page only one should be offered:
 * the one already in the layout wins, the other is hidden.
 */
export function dedupeSharedReadmeBlocks(blockType: string, usedTypes: Set<string>): boolean {
  if (blockType === "profile-readme") return !usedTypes.has("project-about");
  if (blockType === "project-about") return !usedTypes.has("profile-readme");
  return true;
}

/** The first area whose bottom is below the top of the visible canvas. */
function sectionInView(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const top = document.getElementById("studio-canvas")?.getBoundingClientRect().top ?? 0;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-section-id]"))) {
    if (el.getBoundingClientRect().bottom > top + 80) return el.dataset.sectionId;
  }
  return undefined;
}

/** Blocks added since the editor audit, flagged "New" in the palette. */
const NEW_BLOCKS = new Set([
  "quote",
  "call-to-action",
  "highlights",
  "timeline",
  "faq",
  "featured-link",
  "services",
  "callout",
]);

export function GBlockPalette(props: GStudioSurfaceProps) {
  const [query, setQuery] = useState("");
  const [inView] = useState(sectionInView);
  const { data: me } = useCurrentUser();
  const sections = props.layout.sections;
  const selectedSectionId = props.selectedBlockId
    ? findSection(props.layout, props.selectedBlockId)?.id
    : undefined;
  const target = props.paletteTarget || selectedSectionId || inView || sections[0]?.id;
  const usedTypes = useMemo(
    () => new Set(sections.flatMap((s) => s.blocks.map((b) => b.type))),
    [sections],
  );
  const blocks = useMemo(
    () =>
      getAllBlocks()
        .filter((block) => block.ownerContext !== "project")
        .filter((block) => dedupeSharedReadmeBlocks(block.type, usedTypes))
        .filter((block) =>
          `${block.label} ${block.description}`.toLowerCase().includes(query.toLowerCase()),
        ),
    [query, usedTypes],
  );
  const github = useGithubConnection();
  const { data: journal } = useJournalSummary(me?.userId);
  const suggestions = useMemo(
    () =>
      suggestBlocks(props.layout, {
        projectCount: me?.projects.length ?? 0,
        skillCount: (me?.teachIds.length ?? 0) + (me?.learnIds.length ?? 0),
        hasBio: !!me?.profile?.bio?.trim(),
        linkCount: me?.profile?.portfolio_links?.length ?? 0,
        toolCount:
          (me?.profile?.favourite_tools?.length ?? 0) + (me?.profile?.software_stack?.length ?? 0),
        yearsExperience: me?.profile?.years_experience ?? null,
        availability: me?.profile?.availability ?? null,
        githubConnected: github.connected,
        journalCount: journal?.total ?? 0,
      }).filter((s) => getBlock(s.type)),
    [me, props.layout, github.connected, journal?.total],
  );
  const blockItem = (def: BlockDefinition, reason?: string) => (
    <button
      key={`${reason ? "suggested-" : ""}${def.type}`}
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", def.type);
        event.dataTransfer.effectAllowed = "copy";
        props.onDragTypeChange(def.type);
      }}
      onDragEnd={() => props.onDragTypeChange(null)}
      onClick={() => props.onAdd(def.type, target)}
      title={`Add ${def.label} — or drag it onto the canvas`}
      className="group/item flex w-full cursor-pointer items-start gap-2.5 rounded-md border border-transparent px-2 py-2 text-left outline-none transition-colors hover:border-border hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
    >
      <BlockIcon name={def.icon} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {def.label}
          {NEW_BLOCKS.has(def.type) && (
            <span className="rounded-full bg-[var(--user-accent-subtle)] px-1.5 text-[10px] font-medium leading-4 text-[var(--user-accent-text)]">
              New
            </span>
          )}
          {usedTypes.has(def.type) && (
            <span className="text-[10px] font-normal text-muted-foreground">· on page</span>
          )}
        </span>
        <span className="mt-0.5 block text-2xs leading-snug text-muted-foreground">
          {reason ?? def.description}
        </span>
      </span>
      <Plus
        aria-hidden
        className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
      />
    </button>
  );
  const group = (title: string, children: React.ReactNode, accent?: boolean) => (
    <section className="mt-3 first:mt-0">
      <h3
        className={cn(
          "t-label mb-1 flex items-center gap-1 px-2",
          accent && "text-[var(--user-accent-text)]",
        )}
      >
        {accent && <Sparkles className="h-3 w-3" aria-hidden />}
        {title}
      </h3>
      {children}
    </section>
  );
  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="space-y-2 border-b border-border px-3 py-2.5">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocks"
            aria-label="Search blocks"
            className="w-full rounded-sm border border-border bg-[var(--surface-sunken)] py-1.5 pl-7 pr-2 text-xs outline-none focus-visible:border-[var(--user-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
          />
        </div>
        <label className="flex items-center gap-2">
          <span className="shrink-0 text-2xs text-muted-foreground">Add to</span>
          {/* Studio chrome keeps its compact sunken control instead of the app field grammar. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <select
            value={target ?? ""}
            onChange={(event) => props.onPaletteTargetChange(event.target.value)}
            className="min-w-0 flex-1 rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {sectionLabel(section)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2.5">
        {query.trim() ? (
          blocks.length > 0 ? (
            blocks.map((def) => blockItem(def))
          ) : (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No blocks match “{query.trim()}”.
            </p>
          )
        ) : (
          <>
            {suggestions.length > 0 &&
              group(
                "Suggested for you",
                suggestions.map((s) => blockItem(getBlock(s.type)!, s.reason)),
                true,
              )}
            {BLOCK_CATEGORY_ORDER.map((category) => {
              const categoryBlocks = blocks.filter((b) => b.category === category);
              if (categoryBlocks.length === 0) return null;
              return (
                <Fragment key={category}>
                  {group(
                    BLOCK_CATEGORY_LABELS[category],
                    categoryBlocks.map((def) => blockItem(def)),
                  )}
                </Fragment>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
