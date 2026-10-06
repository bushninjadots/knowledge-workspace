import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ProjectDialog } from "@/components/tethyr/profile";
import { BackgroundPickerDialog } from "@/components/tethyr/profile/background-picker-dialog";
import { CURRENT_USER_KEY, useSkillsCatalog } from "@/hooks/use-current-user";
import {
  arrangeGrid,
  overlapsGridItems,
  sectionLabel,
  type GridArrangement,
} from "@/lib/studio-grid";
import type { StudioCommand } from "@/lib/studio-commands";
import { StudioCommandPalette } from "./studio-command-palette";
import { dedupeSharedReadmeBlocks } from "./studio-rail";
import {
  GStudioSurface,
  type GStudioConfig,
  type GStudioDevice,
  type GStudioMode,
} from "@/components/tethyr/studio/g-studio-surface";
import { usePage } from "@/hooks/use-page";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import {
  useApplyStudioComposition,
  useCreatePage,
  usePublishPage,
  useRollbackPageVersion,
  useUpdatePageTheme,
} from "@/hooks/use-page-editor";
import { createBlockInstance, getAllBlocks, getBlock } from "@/lib/block-registry";
import { StarterPicker, type StudioStarter } from "@/components/tethyr/studio/starter-picker";
import { applyStarter, starterConfig } from "@/data/starters";
import {
  fetchTemplateSections,
  useForkTemplate,
  usePublishTemplate,
  usePublicTemplates,
  type CommunityTemplate,
} from "@/hooks/use-templates";
import { applyTemplateSections, sanitizeTemplateSections } from "@/lib/template-apply";
import { withCardBorderPreference, type CardBorderPreference } from "@/lib/background-themes";
import type {
  AreaAppearance,
  BlockConfig,
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
} from "@/lib/page-blocks";
import { DEFAULT_STUDIO_CONFIG, normalizeStudioConfig } from "@/lib/studio-config";
import { createDefaultProfileLayout } from "@/lib/default-layouts";
import "@/components/tethyr/blocks/register-all";
import {
  createHistoryEntry,
  makeId,
  blockSize,
  firstFreePosition,
  nextGridItem,
  placeDuplicateGridItem,
  normalizeGridItem,
  normalizeLayout,
  cloneLayout,
  cloneConfig,
  sameGrid,
  fromTethyrConfig,
  toTethyrConfig,
  preferredGridWidth,
  seedGridFromLayout,
  withFittedGrid,
  publicLayoutSignature,
  type HistoryEntry,
} from "@/lib/studio-layout";
import {
  StudioPublishDialog,
  StudioResetDialog,
  StudioRestoreDialog,
  StudioConflictDialog,
  StudioShareTemplateDialog,
} from "./studio-confirm-dialogs";

interface CreationStudioProps {
  userId: string;
  profile: { id: string; handle: string | null; display_name: string | null } | null;
  onCompleteProfile?: () => void;
  /** Return to the Studio view (read-only) — keeps the two pages connected. */
  onExit?: () => void;
  /** Deep link: select and reveal a specific block/section from the Studio view. */
  initialBlockId?: string | null;
  initialSectionId?: string | null;
}

const STUDIO_STARTER_INTRO_KEY = "studio-starter-intro-dismissed";

/** A save stopped because the page changed elsewhere since this editor loaded. */
class StudioConflictError extends Error {
  constructor() {
    super("Studio changed elsewhere");
  }
}

export function CreationStudio({
  userId,
  profile,
  onCompleteProfile,
  onExit,
  initialBlockId,
  initialSectionId,
}: CreationStudioProps) {
  const [mode, setMode] = useState<GStudioMode>("edit");
  const [device, setDevice] = useState<GStudioDevice>("desktop");
  const [layout, setLayout] = useState<PageLayout | null>(null);
  const [savedLayout, setSavedLayout] = useState<PageLayout | null>(null);
  const [config, setConfig] = useState<GStudioConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<GStudioConfig | null>(null);
  // The selection, in the order blocks were picked. The last one is the
  // "primary" block whose settings the Block tab shows; shift-click adds more.
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const selectedBlockId = selectedBlockIds.at(-1) ?? null;
  const selectBlock = useCallback((id: string | null, options?: { toggle?: boolean }) => {
    if (!id) return setSelectedBlockIds([]);
    if (!options?.toggle) return setSelectedBlockIds([id]);
    setSelectedBlockIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }, []);
  const [dragType, setDragType] = useState<string | null>(null);
  const [paletteTarget, setPaletteTarget] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [gridInteraction, setGridInteraction] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<number | null>(null);
  const [shareTemplateOpen, setShareTemplateOpen] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  // The Customize panel's Background entry opens the same dialog the banner's
  // Appearance control uses — one owner for backdrop/pattern/image settings.
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [introStarterOpen, setIntroStarterOpen] = useState(false);
  const [starterStripVisible, setStarterStripVisible] = useState(false);
  const [renameFocusId, setRenameFocusId] = useState<string | null>(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const pageIdRef = useRef<string | null>(null);
  const layoutRef = useRef<PageLayout | null>(null);
  const configRef = useRef<GStudioConfig | null>(null);
  const autosaveSnapshotRef = useRef<string | null>(null);
  const createAttempted = useRef(false);
  const touchedGridRef = useRef<Set<string>>(new Set());
  const [cardBorders, setCardBorders] = useState<CardBorderPreference>("neutral");
  const [cardBorderColor, setCardBorderColor] = useState("");
  const cardBorderSeededRef = useRef(false);
  const persistedBordersRef = useRef<{
    cardBorders: CardBorderPreference;
    cardBorderColor: string;
  } | null>(null);
  const { data: me, refresh: refreshMe } = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: allSkills = [] } = useSkillsCatalog();

  const pageQuery = usePage({ ownerId: userId, ownerType: "profile", includeDraft: true });
  const createPage = useCreatePage();
  const applyComposition = useApplyStudioComposition();
  const publishPage = usePublishPage();
  const updateTheme = useUpdatePageTheme();
  const rollbackPage = useRollbackPageVersion();
  const forkTemplate = useForkTemplate();
  const publishTemplate = usePublishTemplate();
  const page = pageQuery.data;
  const { data: communityTemplates } = usePublicTemplates();

  // The page theme is saved straight away (not with the draft), but it is
  // tracked here so it shows instantly and undo can put it back.
  const [themeId, setThemeId] = useState<string | null>(null);
  const themeIdRef = useRef<string | null>(null);

  // Two tabs (or devices) editing one Studio used to overwrite each other
  // silently. `baselineRef` is the page's updated_at as of this editor's last
  // load or write; a save that finds it moved stops and asks instead.
  const baselineRef = useRef<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(false);
  const readUpdatedAt = useCallback(async () => {
    const id = pageIdRef.current;
    if (!id) return null;
    const { data } = await supabase.from("pages").select("updated_at").eq("id", id).maybeSingle();
    return (data as { updated_at: string } | null)?.updated_at ?? null;
  }, []);
  // This editor's own writes run one at a time, each refreshing the baseline
  // before the next starts, so they can never look like someone else's.
  const writeChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const serialWrite = useCallback(<T,>(write: () => Promise<T>): Promise<T> => {
    const run = writeChainRef.current.catch(() => undefined).then(write);
    writeChainRef.current = run;
    return run;
  }, []);
  const refreshBaselineRef = useRef(async () => {});
  refreshBaselineRef.current = async () => {
    baselineRef.current = (await readUpdatedAt()) ?? baselineRef.current;
  };

  useEffect(() => {
    layoutRef.current = layout;
    configRef.current = config;
  }, [config, layout]);

  /** Load a page row into the editor as the saved baseline. `carry` keeps one
   *  undo step (the editor state just before a restore) so a restore can be
   *  undone like any other change. */
  const seedFromPage = useCallback((source: NonNullable<typeof page>, carry?: HistoryEntry) => {
    const nextLayout = normalizeLayout(source.layout);
    const nextConfig = fromTethyrConfig(source.config);
    pageIdRef.current = source.id;
    setLayout(cloneLayout(nextLayout));
    setSavedLayout(cloneLayout(nextLayout));
    setConfig(cloneConfig(nextConfig));
    setSavedConfig({ ...nextConfig });
    themeIdRef.current = source.themeId || null;
    setThemeId(source.themeId || null);
    baselineRef.current = source.updatedAt ?? null;
    setHistory(carry ? [carry] : []);
    setFuture([]);
    setSelectedBlockIds([]);
    autosaveSnapshotRef.current = null;
    touchedGridRef.current = new Set(
      nextLayout.sections.filter((s) => s.grid && s.grid.length > 0).map((s) => s.id),
    );
  }, []);

  // Seed once per page. Later refetches (every save invalidates the page
  // query) must not clobber edits in progress; a restore re-seeds explicitly.
  useEffect(() => {
    if (!page || pageIdRef.current === page.id) return;
    seedFromPage(page);
  }, [page, seedFromPage]);

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

  // First-run "choose a starting feel": when the Studio has never picked a
  // starter, is still a draft, and this browser hasn't dismissed the prompt,
  // invite the creator with a strip above the canvas. It doesn't open the
  // picker over the editor uninvited. localStorage persists dismissal.
  const starterStripEligible = !!config && !config.starterId && page?.status !== "published";
  useEffect(() => {
    if (!starterStripEligible || typeof window === "undefined") {
      setStarterStripVisible(false);
      return;
    }
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(STUDIO_STARTER_INTRO_KEY) === "1";
    } catch {
      // Storage unavailable: show the strip; dismissing hides it this session.
    }
    setStarterStripVisible(!dismissed);
  }, [starterStripEligible]);
  const dismissStarterIntro = useCallback(() => {
    setStarterStripVisible(false);
    try {
      window.localStorage.setItem(STUDIO_STARTER_INTRO_KEY, "1");
    } catch {
      // Storage unavailable: the strip stays hidden for this session.
    }
  }, []);

  // Deep link from the Studio view (?block= / ?section=): select the target
  // block and bring its area into view once the canvas has rendered.
  useEffect(() => {
    if (!layout) return;
    const sectionId = initialSectionId;
    const blockId = initialBlockId;
    if (!sectionId && !blockId) return;
    const timer = window.setTimeout(() => {
      let target = blockId;
      const targetSection = sectionId;
      if (!target && targetSection) {
        const section = layout.sections.find((candidate) => candidate.id === targetSection);
        target = section?.blocks[0]?.id ?? null;
        if (!target && targetSection) {
          document
            .querySelector(`[data-section-id="${CSS.escape(targetSection)}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
      if (target) setSelectedBlockIds([target]);
      const sectionEl = targetSection
        ? document.querySelector(`[data-section-id="${CSS.escape(targetSection)}"]`)
        : null;
      sectionEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [initialBlockId, initialSectionId, layout]);

  const bordersDirty = useMemo(
    () =>
      !!persistedBordersRef.current &&
      (persistedBordersRef.current.cardBorders !== cardBorders ||
        persistedBordersRef.current.cardBorderColor !== (cardBorderColor || "")),
    [cardBorderColor, cardBorders],
  );

  const dirty = useMemo(
    () =>
      !!layout &&
      !!savedLayout &&
      !!config &&
      !!savedConfig &&
      (JSON.stringify(normalizeLayout(layout)) !== JSON.stringify(savedLayout) ||
        JSON.stringify(config) !== JSON.stringify(savedConfig) ||
        bordersDirty),
    [bordersDirty, config, layout, savedConfig, savedLayout],
  );

  // Card-border preference lives on the member's appearance, not the page
  // config. Seed once from the profile; the canvas previews drafts and the
  // save path persists them to `profiles.background`.
  useEffect(() => {
    if (!me || cardBorderSeededRef.current) return;
    cardBorderSeededRef.current = true;
    const seeded = {
      cardBorders: me.background?.cardBorders ?? "neutral",
      cardBorderColor: me.background?.cardBorderColor ?? "",
    };
    setCardBorders(seeded.cardBorders);
    setCardBorderColor(seeded.cardBorderColor);
    persistedBordersRef.current = seeded;
  }, [me]);

  // `hasUnpublishedChanges`: the working layout or appearance differs from the
  // latest published snapshot (versions carry layout, theme, and config).
  // Never published → treat as unpublished.
  const latestPublishedLayout = useMemo<PageLayout | null>(
    () => page?.versions[0]?.layout ?? null,
    [page],
  );
  const themeChanged = Boolean(page?.published && page.themeId !== page.published.themeId);
  const appearanceChanged = useMemo(
    () =>
      Boolean(
        page?.published &&
        config &&
        JSON.stringify(normalizeStudioConfig(config)) !== JSON.stringify(page.published.config),
      ),
    [config, page],
  );
  const hasUnpublishedChanges = useMemo(
    () =>
      !latestPublishedLayout ||
      themeChanged ||
      appearanceChanged ||
      // Compared as the public page sees it: auto-fit heights would otherwise
      // flag every area the creator never arranged by hand.
      !layout ||
      publicLayoutSignature(layout) !== publicLayoutSignature(latestPublishedLayout),
    [appearanceChanged, latestPublishedLayout, layout, themeChanged],
  );

  /** The editor state as one undo step: layout, config, theme and borders. */
  const snapshot = useCallback(
    (): HistoryEntry | null =>
      layout && config
        ? {
            ...createHistoryEntry(layout, config),
            themeId: themeIdRef.current,
            borders: { cardBorders, cardBorderColor },
            arranged: [...touchedGridRef.current],
          }
        : null,
    [cardBorderColor, cardBorders, config, layout],
  );

  // Rapid edits to the same thing (typing in a field, dragging a slider) are
  // one undo step: an edit with the same key within a second of the last one
  // extends that step instead of pushing a new one. Typing a sentence used to
  // fill the 50-step history one letter at a time.
  const lastEditRef = useRef<{ key: string; at: number } | null>(null);
  const pushHistory = useCallback(
    (key?: string) => {
      const now = Date.now();
      const last = lastEditRef.current;
      lastEditRef.current = key ? { key, at: now } : null;
      if (key && last && last.key === key && now - last.at < 1000) return;
      const entry = snapshot();
      if (!entry) return;
      setHistory((entries) => [...entries.slice(-49), entry]);
      setFuture([]);
    },
    [snapshot],
  );

  const commit = useCallback(
    (nextLayout: PageLayout, nextConfig?: GStudioConfig, mergeKey?: string) => {
      if (!layout || !config) return;
      // Capture the state before the change. Using the next config here
      // makes appearance undo restore the setting the user just changed.
      pushHistory(mergeKey);
      setLayout(normalizeLayout(nextLayout));
      setConfig({ ...(nextConfig ?? config) });
    },
    [config, layout, pushHistory],
  );

  // Undo, redo and removals can take selected blocks away; drop them.
  useEffect(() => {
    if (!layout) return;
    const present = new Set(layout.sections.flatMap((s) => s.blocks.map((b) => b.id)));
    setSelectedBlockIds((current) =>
      current.every((id) => present.has(id)) ? current : current.filter((id) => present.has(id)),
    );
  }, [layout]);

  const findBlock = useCallback(
    (blockId: string) =>
      layout?.sections.flatMap((section) => section.blocks).find((block) => block.id === blockId),
    [layout],
  );

  // Toast actions outlive the render that created them, so they call the
  // latest undo through a ref (assigned once `undo` is defined below).
  const undoRef = useRef<() => void>(() => {});
  const saveRef = useRef<() => void>(() => {});
  const toastUndoable = useCallback((message: string) => {
    toast(message, {
      id: "studio-undoable",
      action: { label: "Undo", onClick: () => undoRef.current() },
    });
  }, []);

  /** One style patch on several blocks, as a single undo step. */
  const applyBlockStyle = useCallback(
    (blockIds: string[], patch: Partial<LayoutBlockInstance>, message?: string) => {
      if (!layout || blockIds.length === 0) return;
      const ids = new Set(blockIds);
      commit({
        sections: layout.sections.map((section) => ({
          ...section,
          blocks: section.blocks.map((block) =>
            ids.has(block.id) ? { ...block, ...patch } : block,
          ),
        })),
      });
      if (blockIds.length > 1) {
        toastUndoable(message ?? `Style applied to ${blockIds.length} blocks`);
      }
    },
    [commit, layout, toastUndoable],
  );

  const updateBlock = useCallback(
    (blockId: string, patch: Partial<LayoutBlockInstance>) => {
      if (!layout) return;
      commit(
        {
          sections: layout.sections.map((section) => ({
            ...section,
            blocks: section.blocks.map((block) =>
              block.id === blockId ? { ...block, ...patch } : block,
            ),
          })),
        },
        undefined,
        `block:${blockId}:${Object.keys(patch).sort().join(",")}`,
      );
    },
    [commit, layout],
  );

  const updateBlockConfig = useCallback(
    (blockId: string, nextConfig: BlockConfig) => updateBlock(blockId, { config: nextConfig }),
    [updateBlock],
  );

  /** Save the page theme now (themes aren't part of the draft save). */
  const applyTheme = useCallback(
    (next: string | null) => {
      themeIdRef.current = next;
      setThemeId(next);
      const pageId = page?.id;
      if (!pageId) return;
      serialWrite(async () => {
        await updateTheme.mutateAsync({
          pageId,
          themeId: next,
          ownerId: userId,
          ownerType: "profile",
        });
        await refreshBaselineRef.current();
      }).catch(() => toast.error("Could not change the theme"));
    },
    [page?.id, serialWrite, updateTheme, userId],
  );

  const changeTheme = useCallback(
    (next: string | null) => {
      if ((next || null) === themeIdRef.current) return;
      pushHistory();
      applyTheme(next || null);
    },
    [applyTheme, pushHistory],
  );

  const changeCardBorders = useCallback(
    (next: CardBorderPreference) => {
      pushHistory("borders");
      setCardBorders(next);
    },
    [pushHistory],
  );
  const changeCardBorderColor = useCallback(
    (next: string) => {
      pushHistory("borders");
      setCardBorderColor(next);
    },
    [pushHistory],
  );

  const addBlock = useCallback(
    (type: string, targetSectionId?: string, placement?: LayoutGridItem) => {
      if (!layout) return;
      const created = createBlockInstance(type);
      if (!created) return;
      const next = cloneLayout(layout);
      let section = next.sections.find((candidate) => candidate.id === targetSectionId);
      if (!section) section = next.sections[next.sections.length - 1];
      if (!section) {
        section = {
          id: `section-${Date.now()}`,
          position: 0,
          layout: "full",
          blocks: [],
          grid: [],
        };
        next.sections.push(section);
      }
      const block: LayoutBlockInstance = {
        id: makeId("block"),
        type: created.type,
        position: section.blocks.length,
        config: created.config,
        visible: true,
      };
      section.blocks.push(block);
      const [defaultW, defaultH, minW, minH] = blockSize(type);
      section.grid = [
        ...(section.grid ?? []),
        placement
          ? normalizeGridItem(
              { ...placement, i: block.id },
              block.id,
              defaultW,
              defaultH,
              minW,
              minH,
            )
          : nextGridItem(
              block.id,
              section.grid ?? [],
              preferredGridWidth(section.layout, section.blocks.length - 1, minW),
              defaultH,
              minW,
              minH,
            ),
      ];
      touchedGridRef.current.add(section.id);
      commit(next);
      setSelectedBlockIds([block.id]);
      // Bring the new block into view (it lands at the bottom of its area)
      // and focus it, so it's obvious where it went.
      window.setTimeout(() => {
        const el = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(block.id)}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        el?.focus({ preventScroll: true });
      }, 60);
    },
    [commit, layout],
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      for (const section of next.sections) {
        if (section.blocks.some((b) => b.id === blockId)) {
          touchedGridRef.current.add(section.id);
        }
      }
      commit({
        sections: next.sections.map((section) => ({
          ...section,
          blocks: section.blocks.filter((block) => block.id !== blockId),
          grid: section.grid?.filter((item) => item.i !== blockId),
        })),
      });
      setSelectedBlockIds([]);
      toastUndoable("Block removed");
    },
    [commit, layout, toastUndoable],
  );

  const duplicateBlock = useCallback(
    (blockId: string) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      for (const section of next.sections) {
        const sourceIndex = section.blocks.findIndex((block) => block.id === blockId);
        if (sourceIndex < 0) continue;
        const source = section.blocks[sourceIndex];
        const duplicate: LayoutBlockInstance = {
          ...source,
          id: makeId("block"),
          position: sourceIndex + 1,
          config: { ...source.config },
        };
        section.blocks.splice(sourceIndex + 1, 0, duplicate);
        section.blocks.forEach((block, index) => {
          block.position = index;
        });
        const sourceGrid = section.grid?.find((item) => item.i === source.id);
        section.grid = placeDuplicateGridItem(
          section.grid ?? [],
          sourceGrid,
          duplicate.id,
          blockSize(source.type),
        );
        touchedGridRef.current.add(section.id);
        commit(next);
        setSelectedBlockIds([duplicate.id]);
        return;
      }
    },
    [commit, layout],
  );

  const moveBlock = useCallback(
    (blockId: string, direction: -1 | 1) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      for (const section of next.sections) {
        const index = section.blocks.findIndex((block) => block.id === blockId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= section.blocks.length) continue;
        [section.blocks[index], section.blocks[target]] = [
          section.blocks[target],
          section.blocks[index],
        ];
        section.blocks.forEach((block, blockIndex) => {
          block.position = blockIndex;
        });
        // Rebuild the moved block's grid slot so the reorder is visible on the
        // canvas; other blocks keep their existing positions.
        if (section.grid && section.grid.length > 0) {
          const movedBlock = section.blocks[index];
          const [w, h, minW, minH] = blockSize(movedBlock.type);
          const others = section.grid.filter((item) => item.i !== movedBlock.id);
          const { x, y } = firstFreePosition(movedBlock.id, others, w, h);
          section.grid = [
            ...others,
            normalizeGridItem({ i: movedBlock.id, x, y, w, h }, movedBlock.id, w, h, minW, minH),
          ];
          touchedGridRef.current.add(section.id);
        }
        commit(next);
        return;
      }
    },
    [commit, layout],
  );

  const moveToSection = useCallback(
    (blockId: string, targetSectionId: string, placement?: { col: number; row: number }) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      const sourceSection = next.sections.find((section) =>
        section.blocks.some((block) => block.id === blockId),
      );
      const targetSection = next.sections.find((section) => section.id === targetSectionId);
      if (!sourceSection || !targetSection || sourceSection.id === targetSection.id) return;
      const blockIndex = sourceSection.blocks.findIndex((block) => block.id === blockId);
      const [block] = sourceSection.blocks.splice(blockIndex, 1);
      if (!block) return;
      block.position = targetSection.blocks.length;
      targetSection.blocks.push(block);
      const sourceGridItem = sourceSection.grid?.find((item) => item.i === blockId);
      sourceSection.grid = sourceSection.grid?.filter((item) => item.i !== blockId);
      const [defaultW, defaultH, minW, minH] = blockSize(block.type);
      const w = Math.max(minW, Math.min(12, sourceGridItem?.w ?? defaultW));
      const h = Math.max(minH, sourceGridItem?.h ?? defaultH);
      const existing = targetSection.grid ?? [];
      const dropped =
        placement !== undefined
          ? normalizeGridItem(
              { i: block.id, x: placement.col, y: placement.row, w, h },
              block.id,
              w,
              h,
              minW,
              minH,
            )
          : nextGridItem(block.id, existing, w, h, minW, minH);
      if (existing.some((item) => overlapsGridItems(dropped, item))) {
        const { x: freeX, y: freeY } = firstFreePosition(block.id, existing, dropped.w, dropped.h);
        dropped.x = freeX;
        dropped.y = freeY;
      }
      targetSection.grid = [...existing, dropped];
      touchedGridRef.current.add(sourceSection.id);
      touchedGridRef.current.add(targetSection.id);
      next.sections.forEach((section) =>
        section.blocks.forEach((item, index) => (item.position = index)),
      );
      commit(next);
    },
    [commit, layout],
  );

  /** Remove several blocks as one undo step. Locked blocks stay put. */
  const removeBlocks = useCallback(
    (blockIds: string[]) => {
      if (!layout) return;
      const locked = new Set(
        layout.sections
          .flatMap((s) => s.blocks)
          .filter((b) => b.locked)
          .map((b) => b.id),
      );
      const ids = new Set(blockIds.filter((id) => !locked.has(id)));
      if (ids.size === 0) {
        toast("Locked blocks can't be removed — unlock them first.");
        return;
      }
      for (const section of layout.sections) {
        if (section.blocks.some((b) => ids.has(b.id))) touchedGridRef.current.add(section.id);
      }
      commit({
        sections: layout.sections.map((section) => ({
          ...section,
          blocks: section.blocks
            .filter((block) => !ids.has(block.id))
            .map((block, index) => ({ ...block, position: index })),
          grid: section.grid?.filter((item) => !ids.has(item.i)),
        })),
      });
      const kept = blockIds.length - ids.size;
      setSelectedBlockIds(blockIds.filter((id) => locked.has(id)));
      toastUndoable(
        `${ids.size} block${ids.size === 1 ? "" : "s"} removed` +
          (kept ? ` — ${kept} locked kept` : ""),
      );
    },
    [commit, layout, toastUndoable],
  );

  /** Move the selected blocks into a new area placed after the first one's. */
  const groupIntoArea = useCallback(
    (blockIds: string[]) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      const ids = new Set(blockIds);
      const moving: Array<{ block: LayoutBlockInstance; item?: LayoutGridItem }> = [];
      let afterIndex = -1;
      next.sections.forEach((section, sectionIndex) => {
        const taken = section.blocks.filter(
          (block) => ids.has(block.id) && !block.locked && block.type !== "profile-header",
        );
        if (taken.length === 0) return;
        if (taken.some((block) => block.id === blockIds[0]) || afterIndex < 0) {
          afterIndex = sectionIndex;
        }
        const takenIds = new Set(taken.map((block) => block.id));
        const grid = section.grid ?? [];
        moving.push(
          ...[...taken]
            .map((block) => ({ block, item: grid.find((item) => item.i === block.id) }))
            .sort(
              (a, b) => (a.item?.y ?? 0) - (b.item?.y ?? 0) || (a.item?.x ?? 0) - (b.item?.x ?? 0),
            ),
        );
        section.blocks = section.blocks.filter((block) => !takenIds.has(block.id));
        section.grid = grid.filter((item) => !takenIds.has(item.i));
        touchedGridRef.current.add(section.id);
      });
      if (moving.length === 0) {
        toast("Locked blocks and the header stay where they are.");
        return;
      }
      const id = makeId("section");
      const grid: LayoutGridItem[] = [];
      for (const { block, item } of moving) {
        const [defaultW, defaultH, minW, minH] = blockSize(block.type);
        grid.push(
          nextGridItem(block.id, grid, item?.w ?? defaultW, item?.h ?? defaultH, minW, minH),
        );
      }
      next.sections.splice(afterIndex + 1, 0, {
        id,
        position: 0,
        layout: "full",
        title: `Area ${next.sections.length + 1}`,
        visible: true,
        blocks: moving.map(({ block }, index) => ({ ...block, position: index })),
        grid,
      });
      next.sections.forEach((section, index) => {
        section.position = index;
        section.blocks.forEach((block, blockIndex) => (block.position = blockIndex));
      });
      touchedGridRef.current.add(id);
      commit(next);
      setRenameFocusId(id);
      toastUndoable(`Moved ${moving.length} blocks into a new area`);
    },
    [commit, layout, toastUndoable],
  );

  const addSection = useCallback(() => {
    if (!layout) return;
    const next = cloneLayout(layout);
    const id = makeId("section");
    next.sections.push({
      id,
      position: next.sections.length,
      layout: "full",
      title: `Area ${next.sections.length + 1}`,
      visible: true,
      blocks: [],
      grid: [],
    });
    commit(next);
    setSelectedBlockIds([]);
    setRenameFocusId(id);
    // Keep the new area in view so the rename happens where you can see it.
    setTimeout(
      () =>
        document
          .getElementById("studio-add-section")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0,
    );
  }, [commit, layout]);

  const moveSection = useCallback(
    (sectionId: string, direction: -1 | 1) => {
      if (!layout) return;
      const sections = cloneLayout(layout).sections;
      const index = sections.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sections.length) return;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      commit({ sections });
    },
    [commit, layout],
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      if (!layout) return;
      commit({
        sections: layout.sections.map((section) =>
          section.id === sectionId ? { ...section, visible: section.visible === false } : section,
        ),
      });
    },
    [commit, layout],
  );

  const removeSection = useCallback(
    (sectionId: string) => {
      if (!layout) return;
      const section = layout.sections.find((candidate) => candidate.id === sectionId);
      // Only empty areas: blocks are never removed as a side effect.
      if (!section || section.blocks.length > 0) return;
      commit({
        sections: layout.sections
          .filter((candidate) => candidate.id !== sectionId)
          .map((candidate, index) => ({ ...candidate, position: index })),
      });
      toastUndoable("Area removed");
    },
    [commit, layout, toastUndoable],
  );

  const renameSection = useCallback(
    (sectionId: string, title: string) => {
      if (!layout || !title.trim()) return;
      const clean = title.trim().slice(0, 40);
      // Leaving the rename box unchanged isn't an edit (or an undo step).
      if (layout.sections.find((section) => section.id === sectionId)?.title === clean) return;
      commit({
        sections: layout.sections.map((section) =>
          section.id === sectionId ? { ...section, title: clean } : section,
        ),
      });
    },
    [commit, layout],
  );

  const setSectionLayout = useCallback(
    (sectionId: string, newLayout: LayoutSection["layout"]) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      const section = next.sections.find((candidate) => candidate.id === sectionId);
      if (!section || section.layout === newLayout) return;
      section.layout = newLayout;
      section.grid = seedGridFromLayout(section, newLayout);
      section.blocks.forEach((block, index) => (block.position = index));
      touchedGridRef.current.add(sectionId);
      commit(next);
      setSelectedBlockIds([]);
      toastUndoable("Area layout changed — blocks were rearranged");
    },
    [commit, layout, toastUndoable],
  );

  /** The layout with one area's grid replaced, or null when nothing changes. */
  /** `base` with one area's grid replaced, or null when nothing changes. */
  const gridOn = useCallback(
    (base: PageLayout, sectionId: string, nextGrid: LayoutGridItem[]): PageLayout | null => {
      const layout = base;
      const section = layout.sections.find((candidate) => candidate.id === sectionId);
      if (!section) return null;
      const validIds = new Set(section.blocks.map((block) => block.id));
      const normalized = nextGrid
        .filter((item) => item.i !== "__dropping-elem__" && validIds.has(item.i))
        .map((item) =>
          normalizeGridItem(item, item.i, item.w, item.h, item.minW ?? 2, item.minH ?? 2),
        );
      if (sameGrid(section.grid ?? [], normalized)) return null;
      touchedGridRef.current.add(sectionId);
      const positions = new Map(normalized.map((item, index) => [item.i, { item, index }]));
      return {
        ...layout,
        sections: layout.sections.map((candidate) =>
          candidate.id !== sectionId
            ? candidate
            : {
                ...candidate,
                grid: normalized,
                blocks: candidate.blocks.map((block) => {
                  const position = positions.get(block.id);
                  return position
                    ? {
                        ...block,
                        position: position.index,
                        span: position.item.w,
                        height: position.item.h,
                      }
                    : block;
                }),
              },
        ),
      };
    },
    [],
  );
  const layoutWithGrid = useCallback(
    (sectionId: string, nextGrid: LayoutGridItem[]) =>
      layout ? gridOn(layout, sectionId, nextGrid) : null,
    [gridOn, layout],
  );

  /** Lay the selection out relative to the first block picked. */
  const arrangeBlocks = useCallback(
    (blockIds: string[], how: GridArrangement) => {
      if (!layout || blockIds.length < 2) return;
      const anchorId = blockIds[0];
      const anchor = layout.sections
        .flatMap((section) => section.grid ?? [])
        .find((item) => item.i === anchorId);
      if (!anchor) return;
      const locked = new Set(
        layout.sections
          .flatMap((s) => s.blocks)
          .filter((b) => b.locked)
          .map((b) => b.id),
      );
      const ids = new Set(blockIds.filter((id) => !locked.has(id)));
      let next: PageLayout = layout;
      let changed = false;
      for (const section of layout.sections) {
        // Tops and rows only mean something inside one area.
        const sameArea = section.grid?.some((item) => item.i === anchorId);
        if ((how === "align-top" || how === "row") && !sameArea) continue;
        const arranged = arrangeGrid(section.grid ?? [], ids, anchor, how);
        if (!arranged) continue;
        // Locked blocks only move if a selected block now sits on them.
        const updated = gridOn(next, section.id, arranged);
        if (updated) {
          next = updated;
          changed = true;
        }
      }
      if (!changed) {
        toast(how === "row" ? "Those blocks can't share one row." : "Already lined up.");
        return;
      }
      commit(next);
      toastUndoable(`Arranged ${blockIds.length} blocks`);
    },
    [commit, gridOn, layout, toastUndoable],
  );

  // Live grid updates: drag/resize frames (history was recorded when the
  // gesture began) and content auto-fit (deliberately not an undo step).
  const setSectionAppearance = useCallback(
    (sectionId: string, patch: AreaAppearance) => {
      if (!layout) return;
      commit(
        {
          sections: layout.sections.map((section) =>
            section.id === sectionId
              ? { ...section, appearance: { ...section.appearance, ...patch } }
              : section,
          ),
        },
        undefined,
        `area:${sectionId}`,
      );
    },
    [commit, layout],
  );

  // Applied to the latest layout, not the one this callback closed over: a
  // drop's snap correction arrives a tick after the drop itself, and against
  // the stale layout a snap back to the starting cell looked like "no change"
  // and was dropped — which is why Snap appeared to do nothing.
  const applyGrid = useCallback(
    (sectionId: string, nextGrid: LayoutGridItem[]) => {
      setLayout((current) =>
        current ? (gridOn(current, sectionId, nextGrid) ?? current) : current,
      );
    },
    [gridOn],
  );

  // Content auto-fit: patch the working layout and the saved baseline alike,
  // so measuring heights never marks the draft dirty, autosaves, or marks an
  // area as hand-arranged (which would change how the public page lays it out).
  const fitGrid = useCallback((sectionId: string, fitted: LayoutGridItem[]) => {
    const patch = (source: PageLayout | null) =>
      source ? (withFittedGrid(source, sectionId, fitted) ?? source) : source;
    setLayout(patch);
    setSavedLayout(patch);
  }, []);

  // Discrete grid edits (the width stepper) are their own undo step.
  const commitGrid = useCallback(
    (sectionId: string, nextGrid: LayoutGridItem[]) => {
      const next = layoutWithGrid(sectionId, nextGrid);
      if (next) commit(next);
    },
    [commit, layoutWithGrid],
  );

  const beginGridInteraction = useCallback(() => {
    if (gridInteraction || !layout || !config) return;
    setGridInteraction(true);
    pushHistory();
  }, [config, gridInteraction, layout, pushHistory]);

  const endGridInteraction = useCallback(() => setGridInteraction(false), []);

  /** Put the editor back to a history entry, theme and borders included. */
  const restoreEntry = useCallback(
    (entry: HistoryEntry) => {
      lastEditRef.current = null;
      setLayout(cloneLayout(entry.layout));
      setConfig(cloneConfig(entry.config));
      if (entry.themeId !== undefined && entry.themeId !== themeIdRef.current) {
        applyTheme(entry.themeId);
      }
      if (entry.borders) {
        setCardBorders(entry.borders.cardBorders);
        setCardBorderColor(entry.borders.cardBorderColor);
      }
      if (entry.arranged) touchedGridRef.current = new Set(entry.arranged);
    },
    [applyTheme],
  );

  const undo = useCallback(() => {
    const previous = history[history.length - 1];
    const current = snapshot();
    if (!previous || !current) return;
    setFuture((entries) => [current, ...entries]);
    setHistory((entries) => entries.slice(0, -1));
    restoreEntry(previous);
  }, [history, restoreEntry, snapshot]);

  const redo = useCallback(() => {
    const next = future[0];
    const current = snapshot();
    if (!next || !current) return;
    setHistory((entries) => [...entries, current]);
    setFuture((entries) => entries.slice(1));
    restoreEntry(next);
  }, [future, restoreEntry, snapshot]);

  undoRef.current = undo;

  // Keyboard shortcuts: undo/redo history and escape to clear block selection.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const mod = event.metaKey || event.ctrlKey;
      // Save works from anywhere, mid-typing included (it's what people try).
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current();
        return;
      }
      if (mod && event.key.toLowerCase() === "j") {
        event.preventDefault();
        // Inside another dialog it only closes the palette, never stacks one.
        const inDialog = !!target?.closest?.('[role="dialog"]');
        setCommandsOpen((open) => (inDialog ? false : !open));
        return;
      }
      if (editable || target?.closest?.('[role="dialog"]')) return;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (event.key === "Escape") {
        setSelectedBlockIds([]);
      } else if (mod && event.key.toLowerCase() === "d" && mode === "edit" && selectedBlockId) {
        event.preventDefault();
        duplicateBlock(selectedBlockId);
      } else if (
        !mod &&
        mode === "edit" &&
        selectedBlockId &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        if (selectedBlockIds.length > 1) return removeBlocks(selectedBlockIds);
        // Locked blocks ignore the keyboard's destructive and moving keys.
        if (findBlock(selectedBlockId)?.locked) return;
        removeBlock(selectedBlockId);
      } else if (
        !mod &&
        mode === "edit" &&
        layout &&
        selectedBlockId &&
        selectedBlockIds.length === 1 &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        const section = layout.sections.find((candidate) =>
          candidate.blocks.some((block) => block.id === selectedBlockId),
        );
        const item = section?.grid?.find((gridItem) => gridItem.i === selectedBlockId);
        if (!section || !item || findBlock(selectedBlockId)?.locked) return;
        event.preventDefault();
        const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        let candidate: LayoutGridItem;
        if (event.shiftKey) {
          // Shift+arrows resize from the bottom-right corner instead.
          const [, , minW, minH] = blockSize(findBlock(selectedBlockId)?.type ?? "");
          const w = Math.max(item.minW ?? minW, Math.min(12 - item.x, item.w + dx));
          const h = Math.max(item.minH ?? minH, item.h + dy);
          if (w === item.w && h === item.h) return;
          candidate = { ...item, w, h };
        } else {
          const x = Math.max(0, Math.min(12 - item.w, item.x + dx));
          const y = Math.max(0, item.y + dy);
          if (x === item.x && y === item.y) return;
          candidate = { ...item, x, y };
        }
        const others = (section.grid ?? []).filter((gridItem) => gridItem.i !== item.i);
        if (others.some((other) => overlapsGridItems(candidate, other))) return;
        const next = cloneLayout(layout);
        const targetSection = next.sections.find((s) => s.id === section.id);
        if (!targetSection) return;
        targetSection.grid = (targetSection.grid ?? []).map((gridItem) =>
          gridItem.i === item.i ? candidate : gridItem,
        );
        touchedGridRef.current.add(section.id);
        commit(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    commit,
    duplicateBlock,
    findBlock,
    layout,
    mode,
    redo,
    removeBlock,
    removeBlocks,
    selectedBlockId,
    selectedBlockIds,
    undo,
  ]);

  // Replace the draft with a published version via the rollback RPC, then
  // re-seed the editor from the restored row. Without the re-seed the canvas
  // kept showing the old draft and the next autosave wrote it straight back.
  // The pre-restore state stays one undo away.
  const rollback = useCallback(
    async (version: number) => {
      if (!page || saving) return;
      const before = snapshot() ?? undefined;
      setSaving(true);
      try {
        await rollbackPage.mutateAsync({
          pageId: page.id,
          version,
          ownerId: userId,
          ownerType: "profile",
        });
        const { data: restored } = await pageQuery.refetch();
        if (restored) seedFromPage(restored, before);
        toast.success(`Draft replaced with version ${version}`, {
          id: "studio-undoable",
          description: "Visitors still see the live version until you publish.",
          action: before ? { label: "Undo", onClick: () => undoRef.current() } : undefined,
        });
      } catch {
        toast.error("Could not restore that version");
      } finally {
        setSaving(false);
      }
    },
    [page, pageQuery, rollbackPage, saving, seedFromPage, snapshot, userId],
  );

  // Writes the card-border preference to the member's appearance. Silent and
  // non-blocking: failures surface on the next edit/save attempt.
  const persistBorderPreference = useCallback(async () => {
    if (!persistedBordersRef.current) return;
    const next = { cardBorders, cardBorderColor: cardBorderColor || "" };
    if (
      persistedBordersRef.current.cardBorders === next.cardBorders &&
      persistedBordersRef.current.cardBorderColor === next.cardBorderColor
    ) {
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        background: withCardBorderPreference(me?.background, cardBorders, cardBorderColor),
      })
      .eq("id", userId);
    if (error) return;
    persistedBordersRef.current = next;
    void refreshMe();
  }, [cardBorderColor, cardBorders, me?.background, refreshMe, userId]);

  /** Write a draft snapshot (layout + config) and the border preference. */
  const persistDraft = useCallback(
    (snapshotLayout: PageLayout, snapshotConfig: GStudioConfig) =>
      serialWrite(async () => {
        if (!page) return;
        if (conflictRef.current) throw new StudioConflictError();
        const remote = await readUpdatedAt();
        if (baselineRef.current && remote && remote !== baselineRef.current) {
          conflictRef.current = true;
          setConflict(true);
          throw new StudioConflictError();
        }
        await applyComposition.mutateAsync({
          pageId: page.id,
          layoutId: page.layoutId,
          // Sections the user never arranged on the grid are persisted without
          // a `grid`, so the public page keeps their template-based layout.
          layout: {
            ...snapshotLayout,
            sections: snapshotLayout.sections.map((section) =>
              !touchedGridRef.current.has(section.id) ? { ...section, grid: undefined } : section,
            ),
          },
          config: toTethyrConfig(snapshotConfig, page.config),
          ownerId: userId,
          ownerType: "profile",
        });
        await persistBorderPreference();
        await refreshBaselineRef.current();
      }),
    [applyComposition, page, persistBorderPreference, readUpdatedAt, serialWrite, userId],
  );

  const save = useCallback(
    async ({ announce = true }: { announce?: boolean } = {}) => {
      if (!page || !layout || !config || saving || !dirty) return;
      const snapshotLayout = normalizeLayout(layout);
      const snapshotConfig = { ...config };
      setSaving(true);
      try {
        await persistDraft(snapshotLayout, snapshotConfig);
        // Do not mark newer edits as saved when they happened while this
        // request was in flight. The autosave effect will persist those next.
        if (
          JSON.stringify(layoutRef.current && normalizeLayout(layoutRef.current)) ===
            JSON.stringify(snapshotLayout) &&
          JSON.stringify(configRef.current) === JSON.stringify(snapshotConfig)
        ) {
          setSavedLayout(cloneLayout(snapshotLayout));
          setSavedConfig({ ...snapshotConfig });
        }
        if (announce) toast.success("Draft saved");
        setLastSavedAt(Date.now());
      } catch (error) {
        if (error instanceof StudioConflictError) return;
        if (announce) toast.error("Could not save your Studio draft");
      } finally {
        setSaving(false);
      }
    },
    [config, dirty, layout, page, persistDraft, saving],
  );

  saveRef.current = () => void save();

  // Persist the current draft after a short pause, rather than making every
  // field edit a network request. Manual Save draft remains available.
  useEffect(() => {
    if (!page || !layout || !config || !dirty || saving || conflict) return;
    const snapshot = JSON.stringify({ layout: normalizeLayout(layout), config });
    // A failed autosave should not produce a toast/retry loop. A later edit
    // creates a new snapshot and schedules another attempt.
    if (autosaveSnapshotRef.current === snapshot) return;
    const timer = window.setTimeout(() => {
      autosaveSnapshotRef.current = snapshot;
      void save({ announce: false });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [
    cardBorderColor,
    cardBorders,
    config,
    conflict,
    dirty,
    layout,
    page,
    persistBorderPreference,
    save,
    saving,
  ]);

  // Protect against closing or refreshing the tab with a draft still in the
  // editor. The explicit Studio exit is guarded separately below.
  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  // Leaving the editor by any route (sidebar, bottom nav, a link, the back
  // arrow) unmounts it before the 1s autosave fires. Flush whatever is still
  // unsaved on the way out instead of dropping it. The mutation outlives the
  // component; only the toast reports a failure.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (!dirty || !layout || !config || conflictRef.current) return;
    persistDraft(normalizeLayout(layout), { ...config }).catch(() =>
      toast.error("Your last Studio change didn't save", {
        description: "Open the Studio editor again to redo it.",
      }),
    );
  };
  useEffect(() => () => flushRef.current(), []);

  const leave = useCallback((destination?: () => void) => destination?.(), []);
  const exit = useCallback(() => leave(onExit), [leave, onExit]);
  const completeProfile = useCallback(() => leave(onCompleteProfile), [leave, onCompleteProfile]);

  const doPublish = useCallback(
    async (note?: string) => {
      if (!page || !layout || !config) return;
      setSaving(true);
      try {
        if (dirty) {
          const snapshotLayout = normalizeLayout(layout);
          await persistDraft(snapshotLayout, config);
          setSavedLayout(cloneLayout(snapshotLayout));
          setSavedConfig(cloneConfig(config));
        }
        const pageId = page.id;
        await serialWrite(async () => {
          await publishPage.mutateAsync({ pageId, ownerId: userId, ownerType: "profile", note });
          await refreshBaselineRef.current();
        });
        toast.success("Studio published");
        setLastSavedAt(Date.now());
        setPublishNote("");
      } catch (error) {
        if (error instanceof StudioConflictError) return;
        toast.error("Could not publish your Studio");
      } finally {
        setSaving(false);
      }
    },
    [config, dirty, layout, page, persistDraft, publishPage, serialWrite, userId],
  );

  // Publishing is allowed mid-autosave: writes queue behind each other, so
  // the click is never swallowed (it used to do nothing while a save ran).
  const requestPublish = useCallback(() => {
    if (!page || !layout || !config) return;
    setPublishNote("");
    setPublishConfirmOpen(true);
  }, [config, layout, page]);

  /** What will change for visitors when this draft goes live — shown in the
   *  publish dialog so publishing is deliberate, not blind. */
  const publishChanges = useMemo(() => {
    if (!layout) return [];
    if (!latestPublishedLayout) return ["First publish — your Studio goes live."];
    const current = normalizeLayout(layout);
    const previous = normalizeLayout(latestPublishedLayout);
    const lines: string[] = [];
    const currentSectionIds = new Set(current.sections.map((s) => s.id));
    const previousSectionIds = new Set(previous.sections.map((s) => s.id));
    const addedSections = current.sections.filter((s) => !previousSectionIds.has(s.id)).length;
    const removedSections = previous.sections.filter((s) => !currentSectionIds.has(s.id)).length;
    if (addedSections) lines.push(`Added ${addedSections} area${addedSections === 1 ? "" : "s"}`);
    if (removedSections)
      lines.push(`Removed ${removedSections} area${removedSections === 1 ? "" : "s"}`);
    const blockCounts = (sections: PageLayout["sections"]) => {
      const map = new Map<string, number>();
      for (const section of sections) {
        for (const block of section.blocks) {
          const label = getBlock(block.type)?.label ?? block.type;
          map.set(label, (map.get(label) ?? 0) + 1);
        }
      }
      return map;
    };
    const currentBlocks = blockCounts(current.sections);
    const previousBlocks = blockCounts(previous.sections);
    for (const [label, count] of currentBlocks) {
      const delta = count - (previousBlocks.get(label) ?? 0);
      if (delta > 0) lines.push(`Added ${delta} ${label} block${delta === 1 ? "" : "s"}`);
    }
    for (const [label, count] of previousBlocks) {
      const delta = count - (currentBlocks.get(label) ?? 0);
      if (delta > 0) lines.push(`Removed ${delta} ${label} block${delta === 1 ? "" : "s"}`);
    }
    if (themeChanged) lines.push("Changed theme");
    if (appearanceChanged) lines.push("Updated appearance");
    if (lines.length === 0) lines.push("Arrangement changes");
    return lines.slice(0, 4);
  }, [appearanceChanged, latestPublishedLayout, layout, themeChanged]);

  const chooseStarter = useCallback(
    (starter: StudioStarter) => {
      if (!layout || !config) return;
      const next = applyStarter(layout, starter);
      commit(next, starterConfig(starter, config));
      // A layout's placement *is* its grid: save every area's grid, or the
      // public page would fall back to a plain stack. Marked after the commit
      // so the undo step records the areas as they were before.
      for (const section of next.sections) touchedGridRef.current.add(section.id);
    },
    [commit, config, layout],
  );

  const resetStudio = useCallback(
    () => commit(createDefaultProfileLayout(), { ...DEFAULT_STUDIO_CONFIG }),
    [commit],
  );

  // ── Community templates ─────────────────────────────────────────────────
  // Application is client-side through commit() — same non-destructive, one-
  // undo path as the built-in starters. The fork is what persists a copy to
  // the member's account; it never touches the live Studio by itself.
  const applyTemplate = useCallback(
    (sections: ReturnType<typeof sanitizeTemplateSections>, themeId: string | null) => {
      if (!layout || !config) return;
      if (sections.length === 0) {
        toast.error("That template has no renderable sections.");
        return;
      }
      commit(applyTemplateSections(layout, sections), { ...config, starterId: null });
      // Same undo step as the sections: the history entry above holds the
      // previous theme, so "one undo puts it back" covers the theme too.
      if (themeId) applyTheme(themeId);
    },
    [applyTheme, commit, config, layout],
  );

  const applyCommunityTemplate = useCallback(
    (template: CommunityTemplate) => {
      void (async () => {
        try {
          const fetched = await fetchTemplateSections(template.id);
          applyTemplate(fetched.sections, fetched.themeId);
          toast.success(`“${template.name}” applied — one undo puts it back.`);
        } catch (err) {
          console.error("[applyTemplate]", err);
          toast.error("That template could not be applied.");
        }
      })();
    },
    [applyTemplate],
  );

  const saveCommunityTemplate = useCallback(
    (template: CommunityTemplate) => {
      forkTemplate.mutate(
        { templateId: template.id, templateName: template.name },
        {
          onSuccess: () => toast.success(`“${template.name}” saved to My templates.`),
          onError: () => toast.error("Could not save that template."),
        },
      );
    },
    [forkTemplate],
  );

  const useMyTemplateRow = useCallback(
    (template: CommunityTemplate) => {
      applyCommunityTemplate(template);
    },
    [applyCommunityTemplate],
  );

  const shareTemplate = useCallback(
    (name: string, description: string) => {
      if (!page?.layoutId) {
        toast.error("Open your Studio once before submitting it as a template.");
        return;
      }
      const layoutId = page.layoutId;
      // The template is this layout row, so save pending edits first.
      void (async () => {
        if (dirty) await save({ announce: false });
        publishTemplate.mutate(
          {
            layoutId,
            name,
            description: description || "A Studio direction shared with the community.",
          },
          {
            onSuccess: () => {
              setShareTemplateOpen(false);
              toast.success(
                "Template submitted for review. It appears in the community once approved.",
              );
            },
            onError: () => toast.error("Could not submit the template."),
          },
        );
      })();
    },
    [dirty, page?.layoutId, publishTemplate, save],
  );

  const savedTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const template of communityTemplates ?? []) {
      if (template.isMine) ids.add(template.id);
    }
    return ids;
  }, [communityTemplates]);
  const savingTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    if (forkTemplate.isPending && forkTemplate.variables) {
      ids.add(forkTemplate.variables.templateId);
    }
    return ids;
  }, [forkTemplate.isPending, forkTemplate.variables]);

  // Everything the command palette (Ctrl/⌘+J) can do, built from the same
  // handlers the toolbar, rail and keyboard use.
  const commands = useMemo<StudioCommand[]>(() => {
    if (!layout) return [];
    const list: StudioCommand[] = [];
    const add = (command: StudioCommand) => list.push(command);
    const selected = selectedBlockId ? findBlock(selectedBlockId) : undefined;
    if (mode === "edit" && selectedBlockIds.length > 1) {
      const ids = selectedBlockIds;
      const count = `${ids.length} blocks`;
      add({
        id: "multi-group",
        label: "Group selection into a new area",
        group: "Selection",
        run: () => groupIntoArea(ids),
      });
      add({
        id: "multi-width",
        label: "Match widths",
        group: "Selection",
        keywords: "size",
        run: () => arrangeBlocks(ids, "match-width"),
      });
      add({
        id: "multi-height",
        label: "Match heights",
        group: "Selection",
        keywords: "size",
        run: () => arrangeBlocks(ids, "match-height"),
      });
      add({
        id: "multi-left",
        label: "Align left edges",
        group: "Selection",
        run: () => arrangeBlocks(ids, "align-left"),
      });
      add({
        id: "multi-top",
        label: "Align tops",
        group: "Selection",
        run: () => arrangeBlocks(ids, "align-top"),
      });
      add({
        id: "multi-row",
        label: "Put side by side",
        group: "Selection",
        keywords: "row",
        run: () => arrangeBlocks(ids, "row"),
      });
      add({
        id: "multi-hide",
        label: `Hide ${count}`,
        group: "Selection",
        run: () => applyBlockStyle(ids, { visible: false }, `Hid ${count}`),
      });
      add({
        id: "multi-show",
        label: `Show ${count}`,
        group: "Selection",
        run: () => applyBlockStyle(ids, { visible: true }, `Showing ${count}`),
      });
      add({
        id: "multi-remove",
        label: `Remove ${count}`,
        group: "Selection",
        keywords: "delete",
        shortcut: "Del",
        run: () => removeBlocks(ids),
      });
    } else if (mode === "edit" && selected) {
      const name = getBlock(selected.type)?.label ?? selected.type;
      add({
        id: "sel-duplicate",
        label: `Duplicate ${name}`,
        group: "Selection",
        keywords: "copy",
        shortcut: "Ctrl+D",
        run: () => duplicateBlock(selected.id),
      });
      add({
        id: "sel-visible",
        label: `${selected.visible === false ? "Show" : "Hide"} ${name}`,
        group: "Selection",
        run: () => updateBlock(selected.id, { visible: selected.visible === false }),
      });
      add({
        id: "sel-lock",
        label: `${selected.locked ? "Unlock" : "Lock"} ${name}`,
        group: "Selection",
        keywords: "pin",
        run: () => updateBlock(selected.id, { locked: !selected.locked }),
      });
      if (!selected.locked) {
        add({
          id: "sel-remove",
          label: `Remove ${name}`,
          group: "Selection",
          keywords: "delete",
          shortcut: "Del",
          run: () => removeBlock(selected.id),
        });
      }
    }
    if (selectedBlockIds.length > 0) {
      add({
        id: "sel-clear",
        label: "Clear selection",
        group: "Selection",
        keywords: "deselect",
        shortcut: "Esc",
        run: () => setSelectedBlockIds([]),
      });
    }
    add({ id: "undo", label: "Undo", group: "Page", shortcut: "Ctrl+Z", run: undo });
    add({ id: "redo", label: "Redo", group: "Page", shortcut: "Ctrl+Shift+Z", run: redo });
    add({
      id: "save",
      label: "Save now",
      group: "Page",
      shortcut: "Ctrl+S",
      run: () => void save(),
    });
    add({
      id: "publish",
      label: "Publish",
      group: "Page",
      keywords: "go live",
      run: requestPublish,
    });
    add({
      id: "mode",
      label: mode === "edit" ? "Preview the page" : "Back to editing",
      group: "Page",
      keywords: "edit preview",
      run: () => {
        setMode(mode === "edit" ? "preview" : "edit");
        if (mode === "edit" && dirty) void save({ announce: false });
      },
    });
    add({
      id: "device",
      label: device === "desktop" ? "Show the phone layout" : "Show the desktop layout",
      group: "Page",
      keywords: "mobile device",
      run: () => setDevice(device === "desktop" ? "mobile" : "desktop"),
    });
    if (mode === "edit") {
      add({
        id: "area",
        label: "Add an area",
        group: "Page",
        keywords: "section",
        run: addSection,
      });
    }
    add({
      id: "templates",
      label: "Browse templates",
      group: "Page",
      keywords: "starter",
      run: () => setIntroStarterOpen(true),
    });
    add({
      id: "background",
      label: "Background and appearance",
      group: "Page",
      keywords: "backdrop pattern",
      run: () => setAppearanceOpen(true),
    });
    if (mode === "edit") {
      const target = selectedBlockId
        ? layout.sections.find((section) => section.blocks.some((b) => b.id === selectedBlockId))
            ?.id
        : undefined;
      const used = new Set(layout.sections.flatMap((section) => section.blocks.map((b) => b.type)));
      for (const block of getAllBlocks()) {
        if (block.ownerContext === "project" || !dedupeSharedReadmeBlocks(block.type, used))
          continue;
        add({
          id: `add-${block.type}`,
          label: `Add ${block.label}`,
          group: "Add a block",
          keywords: block.description,
          run: () => addBlock(block.type, target),
        });
      }
    }
    for (const section of layout.sections) {
      for (const block of section.blocks) {
        add({
          id: `go-${block.id}`,
          label: `${getBlock(block.type)?.label ?? block.type} · ${sectionLabel(section)}`,
          group: "Go to a block",
          keywords: "select find",
          run: () => {
            setMode("edit");
            setSelectedBlockIds([block.id]);
            window.setTimeout(() => {
              const el = document.querySelector<HTMLElement>(
                `[data-block-id="${CSS.escape(block.id)}"]`,
              );
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              el?.focus({ preventScroll: true });
            }, 60);
          },
        });
      }
    }
    return list;
  }, [
    addBlock,
    addSection,
    applyBlockStyle,
    arrangeBlocks,
    device,
    dirty,
    duplicateBlock,
    findBlock,
    groupIntoArea,
    layout,
    mode,
    redo,
    removeBlock,
    removeBlocks,
    requestPublish,
    save,
    selectedBlockId,
    selectedBlockIds,
    undo,
    updateBlock,
  ]);

  // Conflict resolution. "Load latest" discards this tab's unsaved edits;
  // "Keep mine" adopts the remote timestamp and saves over it.
  const loadLatest = async () => {
    const { data: latest } = await pageQuery.refetch();
    conflictRef.current = false;
    setConflict(false);
    if (latest) seedFromPage(latest);
  };
  const keepMine = async () => {
    baselineRef.current = await readUpdatedAt();
    conflictRef.current = false;
    setConflict(false);
    autosaveSnapshotRef.current = null;
  };

  if (!layout || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8 text-sm text-muted-foreground">
        {pageQuery.isError ? "Studio could not load." : "Preparing your Studio canvas…"}
      </div>
    );
  }

  return (
    <>
      <GStudioSurface
        layout={layout}
        config={config}
        mode={mode}
        device={device}
        selectedBlockId={selectedBlockId}
        selectedBlockIds={selectedBlockIds}
        dragType={dragType}
        paletteTarget={paletteTarget}
        dirty={dirty}
        saving={saving}
        published={page?.status === "published"}
        hasUnpublishedChanges={hasUnpublishedChanges}
        versions={page?.versions ?? []}
        publishedVersion={page?.publishedVersion ?? null}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        profile={profile}
        userId={userId}
        onModeChange={(next) => {
          setMode(next);
          // The preview frames the saved draft, so save pending edits first.
          if (next === "preview" && dirty) void save({ announce: false });
        }}
        onDeviceChange={setDevice}
        onSelect={selectBlock}
        onGridChange={applyGrid}
        onResizeBlock={commitGrid}
        onGridFit={fitGrid}
        onGridInteractionStart={beginGridInteraction}
        onGridInteractionEnd={endGridInteraction}
        onUpdateBlockConfig={updateBlockConfig}
        onBlockAction={updateBlock}
        onDuplicate={duplicateBlock}
        onRemove={removeBlock}
        onMove={moveBlock}
        onMoveSection={moveSection}
        onToggleSection={toggleSection}
        onRemoveSection={removeSection}
        onOpenCommands={() => setCommandsOpen(true)}
        onRenameSection={renameSection}
        onSectionLayoutChange={setSectionLayout}
        onSectionAppearanceChange={setSectionAppearance}
        onApplyBlockStyle={applyBlockStyle}
        onRemoveBlocks={removeBlocks}
        onArrangeBlocks={arrangeBlocks}
        onGroupIntoArea={groupIntoArea}
        onAddSection={addSection}
        onMoveToSection={moveToSection}
        onAdd={addBlock}
        onDragTypeChange={setDragType}
        onPaletteTargetChange={setPaletteTarget}
        onCustomizeChange={(patch) =>
          commit(layout, { ...config, ...patch }, `style:${Object.keys(patch).sort().join(",")}`)
        }
        themeId={themeId}
        onThemeChange={changeTheme}
        cardBorders={cardBorders}
        cardBorderColor={cardBorderColor}
        onCardBordersChange={changeCardBorders}
        onCardBorderColorChange={changeCardBorderColor}
        onSave={() => void save()}
        onPublish={requestPublish}
        onRollback={setRestoreTarget}
        onUndo={undo}
        onRedo={redo}
        onCompleteProfile={onCompleteProfile ? completeProfile : undefined}
        onOpenAppearance={() => setAppearanceOpen(true)}
        onOpenTemplates={() => setIntroStarterOpen(true)}
        starterPrompt={
          starterStripVisible
            ? { onBrowse: () => setIntroStarterOpen(true), onDismiss: dismissStarterIntro }
            : undefined
        }
        onSaveAsTemplate={() => setShareTemplateOpen(true)}
        unpublishedSummary={publishChanges}
        onAddProject={() => setProjectDialogOpen(true)}
        onExit={onExit ? exit : undefined}
        lastSavedAt={lastSavedAt}
        autoRenameId={renameFocusId}
        onRenameFocusHandled={() => setRenameFocusId(null)}
        onReset={() => setResetConfirmOpen(true)}
      />
      <StudioResetDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        onConfirm={resetStudio}
      />
      <StudioShareTemplateDialog
        open={shareTemplateOpen}
        defaultName={profile?.display_name ? `${profile.display_name}'s Studio` : "My Studio"}
        pending={publishTemplate.isPending}
        onOpenChange={setShareTemplateOpen}
        onSubmit={shareTemplate}
      />
      <StudioConflictDialog
        open={conflict}
        onLoadLatest={() => void loadLatest()}
        onKeepMine={() => void keepMine()}
      />
      <StudioRestoreDialog
        version={restoreTarget}
        live={restoreTarget !== null && restoreTarget === page?.publishedVersion}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        onConfirm={() => {
          if (restoreTarget !== null) void rollback(restoreTarget);
          setRestoreTarget(null);
        }}
      />
      <StudioCommandPalette
        open={commandsOpen}
        onOpenChange={setCommandsOpen}
        commands={commands}
      />
      <StudioPublishDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        changes={publishChanges}
        note={publishNote}
        onNoteChange={setPublishNote}
        onConfirm={() => void doPublish(publishNote)}
      />
      <ProjectDialog
        project={null}
        userId={userId}
        allSkills={allSkills}
        initialSkillIds={[]}
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onSaved={() => {
          setProjectDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
        }}
      />
      <BackgroundPickerDialog
        open={appearanceOpen}
        onOpenChange={setAppearanceOpen}
        background={me?.background ?? null}
        publicBackground={me?.profile?.public_background ?? null}
        userId={userId}
        bannerUrl={me?.bannerSigned ?? null}
        onSaved={() => {
          setAppearanceOpen(false);
          refreshMe();
        }}
      />
      {introStarterOpen && (
        <StarterPicker
          currentId={config.starterId}
          layout={layout}
          config={config}
          canUndo={history.length > 0}
          onUndo={undo}
          firstRun={!config.starterId && page?.status !== "published"}
          onUseTemplate={applyCommunityTemplate}
          onSaveTemplate={saveCommunityTemplate}
          onUseMyTemplate={useMyTemplateRow}
          savingTemplateIds={savingTemplateIds}
          savedTemplateIds={savedTemplateIds}
          onChoose={(starter) => {
            chooseStarter(starter);
            setIntroStarterOpen(false);
            dismissStarterIntro();
          }}
          onStartFromScratch={() => {
            setIntroStarterOpen(false);
            dismissStarterIntro();
            resetStudio();
          }}
          onClose={() => setIntroStarterOpen(false)}
        />
      )}
    </>
  );
}
