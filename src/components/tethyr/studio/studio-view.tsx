// ── Studio View ───────────────────────────────────────────────────────────────
// The data-first Studio surface: renders the saved layout as a visitor would
// see it, but — because the owner is signed in — keeps the header's quick-edit
// controls (banner, profile photo, caption, identity, appearance) available
// without opening the full block editor. "Open editor" launches the builder.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Sparkles } from "lucide-react";
import { usePage } from "@/hooks/use-page";
import { useCreatePage } from "@/hooks/use-page-editor";
import { shouldRenderSectionInView } from "@/lib/studio-visibility";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import { Button } from "@/components/ui/button";
import {
  studioConfigToStyle,
  EDITORIAL_HEADING_FONT,
  structureMaxWidth,
  DEFAULT_STUDIO_CONFIG,
  type StudioConfig,
} from "@/lib/studio-config";
import type {
  BlockContext,
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
} from "@/lib/page-blocks";

import "@/components/tethyr/blocks/register-all";

interface StudioViewProps {
  userId: string;
  profile: { id: string; handle: string | null; display_name: string | null } | null;
  onBack?: () => void;
  /** Open the full identity-completion form (skills, links, tools, etc.). */
  onCompleteProfile?: () => void;
}

/** Tailwind span classes for each grid width (1–12). Declared as literals so
 *  Tailwind's scanner generates every variant. */
const SPAN_CLASS: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  10: "md:col-span-10",
  11: "md:col-span-11",
  12: "md:col-span-12",
};

export function StudioView({ userId, profile, onBack, onCompleteProfile }: StudioViewProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"view" | "preview">("view");
  const pageQuery = usePage({ ownerId: userId, ownerType: "profile", includeDraft: true });
  const createPage = useCreatePage();
  const createAttempted = useRef(false);
  const page = pageQuery.data;

  // Auto-provision a Studio draft the first time the owner lands here, so the
  // view is never stuck on an empty state. Mirrors the editor's behaviour.
  useEffect(() => {
    if (
      pageQuery.isLoading ||
      pageQuery.isError ||
      page ||
      createAttempted.current ||
      createPage.isPending
    ) {
      return;
    }
    createAttempted.current = true;
    createPage.mutate(
      { ownerId: userId, ownerType: "profile" },
      {
        onSuccess: () => toast.success("Your Studio draft is ready"),
        onError: () => {
          createAttempted.current = false;
          toast.error("Could not create your Studio draft");
        },
      },
    );
  }, [createPage, page, pageQuery.isError, pageQuery.isLoading, userId]);

  const config: StudioConfig = page?.config ?? DEFAULT_STUDIO_CONFIG;
  const layout: PageLayout | null = page?.layout ?? null;
  const maxWidth = structureMaxWidth(config);
  const surfaceStyle = studioSurfaceStyle(config);
  const [emptyBlocks, setEmptyBlocks] = useState<Set<string>>(() => new Set());
  const handleBlockEmpty = useCallback((blockId: string, isEmpty: boolean) => {
    setEmptyBlocks((previous) => {
      const next = new Set(previous);
      if (isEmpty) next.add(blockId);
      else next.delete(blockId);
      return next;
    });
  }, []);

  const blockContext: BlockContext = {
    ownerId: userId,
    ownerType: "profile",
    pageId: page?.id ?? `profile:${userId}`,
    isEditing: false,
    isOwner: true,
    quickEdit: mode === "view",
    data: profile ? { profile } : undefined,
    onBlockEmptyChange: handleBlockEmpty,
  };

  if (pageQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading your Studio…</p>
        </div>
      </div>
    );
  }

  if (pageQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm text-muted-foreground">Your studio could not load.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => pageQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background" data-studio-view style={surfaceStyle}>
      <StudioViewTopBar
        profile={profile}
        published={page?.status === "published"}
        mode={mode}
        onBack={onBack}
        onCompleteProfile={onCompleteProfile}
        onOpenEditor={() => navigate({ to: "/studio" })}
        onToggleMode={() => setMode((m) => (m === "view" ? "preview" : "view"))}
      />
      <main className="min-w-0 flex-1 overflow-y-auto bg-noise" aria-label="Studio">
        {mode === "preview" && profile?.handle ? (
          <iframe
            title="Public Studio preview"
            src={`/u/${profile.handle}`}
            className="h-full w-full border-0 bg-background"
            data-studio-preview-frame
          />
        ) : (
          <div className="mx-auto w-full px-4 pb-24 pt-6 sm:px-6" style={{ maxWidth }}>
            {!layout || layout.sections.length === 0 ? (
              <div className="flex min-h-[30vh] items-center justify-center text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Your Studio is empty.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Open Customize to add blocks and arrange your space.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col" style={{ gap: "calc(var(--studio-gap, 14px) * 1.6)" }}>
                {layout.sections
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .filter((section) => shouldRenderSectionInView(section, emptyBlocks))
                  .map((section) => (
                    <StudioViewSection key={section.id} section={section} context={blockContext} />
                  ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StudioViewTopBar({
  profile,
  published,
  mode,
  onBack,
  onCompleteProfile,
  onOpenEditor,
  onToggleMode,
}: {
  profile: { display_name: string | null; handle: string | null } | null;
  published: boolean;
  mode: "view" | "preview";
  onBack?: () => void;
  onCompleteProfile?: () => void;
  onOpenEditor: () => void;
  onToggleMode: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[var(--surface-elevated)]">
      <div className="flex min-h-10 items-center gap-2 px-3 py-1.5">
        {onBack && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-foreground">
            Tethyr
          </span>
          <span className="text-muted-foreground-subtle" aria-hidden>
            /
          </span>
          <span className="truncate text-[13px] font-semibold text-foreground">Studio</span>
          <span
            className={`hidden border px-1.5 py-0.5 font-mono text-3xs sm:inline ${
              published ? "border-trust text-trust" : "border-caution text-caution"
            }`}
          >
            {published ? "Live" : "Draft"}
          </span>
        </div>
        <div className="mx-auto hidden sm:block">
          <span className="truncate text-xs text-muted-foreground">
            {profile?.display_name || `@${profile?.handle ?? ""}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onCompleteProfile && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={onCompleteProfile}
            >
              Complete profile
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onToggleMode} title="Toggle preview">
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">
              {mode === "view" ? "View as visitor" : "Back to quick edit"}
            </span>
          </Button>
          <Button variant="default" size="sm" onClick={onOpenEditor}>
            <Pencil className="h-3 w-3" />
            Customize
          </Button>
        </div>
      </div>
    </header>
  );
}

function StudioViewSection({
  section,
  context,
}: {
  section: LayoutSection;
  context: BlockContext;
}) {
  const blocks = section.blocks
    .slice()
    .sort((a, b) => a.position - b.position)
    .filter((block) => block.visible !== false);

  if (blocks.length === 0) return null;

  const gridMap = new Map((section.grid ?? []).map((item) => [item.i, item]));

  return (
    <section aria-label={section.title ?? section.layout} className="relative">
      {section.layout === "feature" && (
        <header className="mb-2 flex items-center gap-2">
          <span className="h-3 w-0.5" style={{ backgroundColor: "var(--user-accent)" }} />
          <span className="t-label">{section.title ?? section.layout}</span>
          <span className="t-rule flex-1" />
        </header>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {blocks.map((block) => (
          <StudioViewBlock
            key={block.id}
            block={block}
            gridItem={gridMap.get(block.id)}
            context={context}
          />
        ))}
      </div>
    </section>
  );
}

function StudioViewBlock({
  block,
  gridItem,
  context,
}: {
  block: LayoutBlockInstance;
  gridItem?: LayoutGridItem;
  context: BlockContext;
}) {
  const span = Math.max(1, Math.min(12, gridItem?.w ?? 12));
  return (
    <div
      className={SPAN_CLASS[span] ?? "md:col-span-12"}
      style={{ borderRadius: "var(--studio-radius)" }}
    >
      <div
        className="relative h-full min-h-0 overflow-hidden rounded-[inherit] bg-[var(--surface)]"
        style={{ borderRadius: "var(--studio-radius)" }}
      >
        <BlockRenderer
          type={block.type}
          config={block.config}
          context={{ ...context, blockId: block.id }}
          onChange={() => undefined}
        />
      </div>
    </div>
  );
}

/** Page-local style: studio accent variables + personality font hints. Mirrors
 *  g-studio-surface's studioSurfaceStyle so the view and editor match. */
function studioSurfaceStyle(config: StudioConfig): React.CSSProperties {
  const style = studioConfigToStyle(config) as React.CSSProperties & Record<string, string>;
  style["--studio-display-font"] = config.personality === "editorial" ? "Space Grotesk" : "Inter";
  style["--studio-label-font"] = config.personality === "technical" ? "JetBrains Mono" : "Inter";
  if (config.personality === "editorial") {
    style["--font-display"] = EDITORIAL_HEADING_FONT;
    style["--font-title"] = EDITORIAL_HEADING_FONT;
  }
  return style;
}
