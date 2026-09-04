import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GStudioSurface,
  sizeFor,
  type GStudioConfig,
  type GStudioDevice,
  type GStudioMode,
} from "@/components/tethyr/studio/g-studio-surface";
import { usePage } from "@/hooks/use-page";
import {
  useApplyStudioComposition,
  useCreatePage,
  usePublishPage,
  useRollbackPageVersion,
} from "@/hooks/use-page-editor";
import { createBlockInstance } from "@/lib/block-registry";
import type { StudioStarter } from "@/components/tethyr/studio/starter-picker";
import { applyStarter, starterConfig } from "@/data/starters";
import type {
  BlockConfig,
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
} from "@/lib/page-blocks";
import type { StudioConfig } from "@/lib/studio-config";
import { DEFAULT_STUDIO_CONFIG } from "@/lib/studio-config";
import { createDefaultProfileLayout } from "@/lib/default-layouts";

interface CreationStudioProps {
  userId: string;
  profile: { id: string; handle: string | null; display_name: string | null } | null;
  onCompleteProfile?: () => void;
  /** Return to the Studio view (read-only) — keeps the two pages connected. */
  onExit?: () => void;
}

type HistoryEntry = { layout: PageLayout; config: GStudioConfig };

export function CreationStudio({
  userId,
  profile,
  onCompleteProfile,
  onExit,
}: CreationStudioProps) {
  const [mode, setMode] = useState<GStudioMode>("edit");
  const [device, setDevice] = useState<GStudioDevice>("desktop");
  const [layout, setLayout] = useState<PageLayout | null>(null);
  const [savedLayout, setSavedLayout] = useState<PageLayout | null>(null);
  const [config, setConfig] = useState<GStudioConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<GStudioConfig | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<string | null>(null);
  const [paletteTarget, setPaletteTarget] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [gridInteraction, setGridInteraction] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [renameFocusId, setRenameFocusId] = useState<string | null>(null);
  const pageIdRef = useRef<string | null>(null);
  const layoutRef = useRef<PageLayout | null>(null);
  const configRef = useRef<GStudioConfig | null>(null);
  const autosaveSnapshotRef = useRef<string | null>(null);
  const createAttempted = useRef(false);
  const touchedGridRef = useRef<Set<string>>(new Set());

  const pageQuery = usePage({ ownerId: userId, ownerType: "profile", includeDraft: true });
  const createPage = useCreatePage();
  const applyComposition = useApplyStudioComposition();
  const publishPage = usePublishPage();
  const rollbackPage = useRollbackPageVersion();
  const page = pageQuery.data;

  useEffect(() => {
    layoutRef.current = layout;
    configRef.current = config;
  }, [config, layout]);

  useEffect(() => {
    if (!page || pageIdRef.current === page.id) return;
    const nextLayout = normalizeLayout(page.layout);
    const nextConfig = fromTethyrConfig(page.config);
    pageIdRef.current = page.id;
    setLayout(cloneLayout(nextLayout));
    setSavedLayout(cloneLayout(nextLayout));
    setConfig(cloneConfig(nextConfig));
    setSavedConfig({ ...nextConfig });
    setHistory([]);
    setFuture([]);
    setSelectedBlockId(null);
    autosaveSnapshotRef.current = null;
    touchedGridRef.current = new Set(
      nextLayout.sections.filter((s) => s.grid && s.grid.length > 0).map((s) => s.id),
    );
  }, [page]);

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

  const dirty = useMemo(
    () =>
      !!layout &&
      !!savedLayout &&
      !!config &&
      !!savedConfig &&
      (JSON.stringify(normalizeLayout(layout)) !== JSON.stringify(savedLayout) ||
        JSON.stringify(config) !== JSON.stringify(savedConfig)),
    [config, layout, savedConfig, savedLayout],
  );

  // g/'s `hasUnpublishedChanges`: the working layout differs from the latest
  // published snapshot. Page versions snapshot layout + theme (not config),
  // so compare only the layout. Never published → treat as unpublished.
  const latestPublishedLayout = useMemo<PageLayout | null>(
    () => page?.versions[0]?.layout ?? null,
    [page],
  );
  const hasUnpublishedChanges = useMemo(
    () =>
      !latestPublishedLayout ||
      JSON.stringify(layout ? normalizeLayout(layout) : null) !==
        JSON.stringify(normalizeLayout(latestPublishedLayout)),
    [latestPublishedLayout, layout],
  );

  const commit = useCallback(
    (nextLayout: PageLayout, nextConfig?: GStudioConfig) => {
      if (!layout || !config) return;
      const resolvedConfig = nextConfig ?? config;
      setHistory((entries) => [
        ...entries.slice(-49),
        // Capture the state before the change. Using the next config here
        // makes appearance undo restore the setting the user just changed.
        createHistoryEntry(layout, config),
      ]);
      setFuture([]);
      setLayout(normalizeLayout(nextLayout));
      setConfig({ ...resolvedConfig });
    },
    [config, layout],
  );

  const updateBlock = useCallback(
    (blockId: string, patch: Partial<LayoutBlockInstance>) => {
      if (!layout) return;
      commit({
        sections: layout.sections.map((section) => ({
          ...section,
          blocks: section.blocks.map((block) =>
            block.id === blockId ? { ...block, ...patch } : block,
          ),
        })),
      });
    },
    [commit, layout],
  );

  const updateBlockConfig = useCallback(
    (blockId: string, nextConfig: BlockConfig) => updateBlock(blockId, { config: nextConfig }),
    [updateBlock],
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
          : nextGridItem(block.id, section.grid ?? [], defaultW, defaultH, minW, minH),
      ];
      touchedGridRef.current.add(section.id);
      commit(next);
      setSelectedBlockId(block.id);
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
      setSelectedBlockId(null);
    },
    [commit, layout],
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
        setSelectedBlockId(duplicate.id);
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
    (blockId: string, targetSectionId: string) => {
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
      sourceSection.grid = sourceSection.grid?.filter((item) => item.i !== blockId);
      const [w, h, minW, minH] = blockSize(block.type);
      targetSection.grid = [
        ...(targetSection.grid ?? []),
        nextGridItem(block.id, targetSection.grid ?? [], w, h, minW, minH),
      ];
      touchedGridRef.current.add(sourceSection.id);
      touchedGridRef.current.add(targetSection.id);
      next.sections.forEach((section) =>
        section.blocks.forEach((item, index) => (item.position = index)),
      );
      commit(next);
    },
    [commit, layout],
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
    setSelectedBlockId(null);
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

  const renameSection = useCallback(
    (sectionId: string, title: string) => {
      if (!layout || !title.trim()) return;
      const clean = title.trim().slice(0, 40);
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
      setSelectedBlockId(null);
    },
    [commit, layout],
  );

  const applyGrid = useCallback(
    (sectionId: string, nextGrid: LayoutGridItem[]) => {
      if (!layout) return;
      const normalized = nextGrid
        .filter((item) => item.i !== "__dropping-elem__")
        .map((item) =>
          normalizeGridItem(item, item.i, item.w, item.h, item.minW ?? 2, item.minH ?? 2),
        );
      const section = layout.sections.find((candidate) => candidate.id === sectionId);
      if (!section || sameGrid(section.grid ?? [], normalized)) return;
      touchedGridRef.current.add(sectionId);
      const positions = new Map(normalized.map((item, index) => [item.i, { item, index }]));
      setLayout({
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
      });
    },
    [layout],
  );

  const beginGridInteraction = useCallback(() => {
    if (gridInteraction || !layout || !config) return;
    setGridInteraction(true);
    setHistory((entries) => [
      ...entries.slice(-49),
      { layout: cloneLayout(layout), config: { ...config } },
    ]);
    setFuture([]);
  }, [config, gridInteraction, layout]);

  const endGridInteraction = useCallback(() => setGridInteraction(false), []);

  const undo = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous || !layout || !config) return;
    setFuture((entries) => [{ layout: cloneLayout(layout), config: { ...config } }, ...entries]);
    setHistory((entries) => entries.slice(0, -1));
    setLayout(cloneLayout(previous.layout));
    setConfig(cloneConfig(previous.config));
  }, [config, history, layout]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next || !layout || !config) return;
    setHistory((entries) => [...entries, { layout: cloneLayout(layout), config: { ...config } }]);
    setFuture((entries) => entries.slice(1));
    setLayout(cloneLayout(next.layout));
    setConfig(cloneConfig(next.config));
  }, [config, future, layout]);

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
      if (editable || target?.closest?.('[role="dialog"]')) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (event.key === "Escape") {
        setSelectedBlockId(null);
      } else if (
        !mod &&
        mode === "edit" &&
        layout &&
        selectedBlockId &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        const section = layout.sections.find((candidate) =>
          candidate.blocks.some((block) => block.id === selectedBlockId),
        );
        const item = section?.grid?.find((gridItem) => gridItem.i === selectedBlockId);
        if (!section || !item) return;
        event.preventDefault();
        const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        const x = Math.max(0, Math.min(12 - item.w, item.x + dx));
        const y = Math.max(0, item.y + dy);
        if (x === item.x && y === item.y) return;
        const candidate = { ...item, x, y };
        const others = (section.grid ?? []).filter((gridItem) => gridItem.i !== item.i);
        if (others.some((other) => overlaps(candidate, other))) return;
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
  }, [commit, layout, mode, redo, selectedBlockId, undo]);

  // Restore a previously published version via the rollback RPC. The hook
  // invalidates the page query so the restored layout reloads from Supabase.
  const rollback = useCallback(
    async (version: number) => {
      if (!page || saving) return;
      setSaving(true);
      try {
        await rollbackPage.mutateAsync({
          pageId: page.id,
          version,
          ownerId: userId,
          ownerType: "profile",
        });
        toast.success(`Restored to version ${version}`);
      } catch {
        toast.error("Could not restore that version");
      } finally {
        setSaving(false);
      }
    },
    [page, rollbackPage, saving, userId],
  );

  const save = useCallback(
    async ({ announce = true }: { announce?: boolean } = {}) => {
      if (!page || !layout || !config || saving || !dirty) return;
      const snapshotLayout = normalizeLayout(layout);
      const snapshotConfig = { ...config };
      setSaving(true);
      try {
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
      } catch {
        if (announce) toast.error("Could not save your Studio draft");
      } finally {
        setSaving(false);
      }
    },
    [applyComposition, config, dirty, layout, page, saving, userId],
  );

  // Persist the current draft after a short pause, rather than making every
  // field edit a network request. Manual Save draft remains available.
  useEffect(() => {
    if (!page || !layout || !config || !dirty || saving) return;
    const snapshot = JSON.stringify({ layout: normalizeLayout(layout), config });
    // A failed autosave should not produce a toast/retry loop. A later edit
    // creates a new snapshot and schedules another attempt.
    if (autosaveSnapshotRef.current === snapshot) return;
    const timer = window.setTimeout(() => {
      autosaveSnapshotRef.current = snapshot;
      void save({ announce: false });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [config, dirty, layout, page, save, saving]);

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

  const leave = useCallback(
    (destination?: () => void) => {
      if (!destination) return;
      if (dirty && !window.confirm("You have unsaved Studio changes. Leave anyway?")) return;
      destination();
    },
    [dirty],
  );
  const exit = useCallback(() => leave(onExit), [leave, onExit]);
  const completeProfile = useCallback(() => leave(onCompleteProfile), [leave, onCompleteProfile]);

  const doPublish = useCallback(async () => {
    if (!page || !layout || !config || saving) return;
    setSaving(true);
    try {
      if (dirty) {
        const snapshotLayout = normalizeLayout(layout);
        await applyComposition.mutateAsync({
          pageId: page.id,
          layoutId: page.layoutId,
          layout: {
            ...snapshotLayout,
            sections: snapshotLayout.sections.map((section) =>
              !touchedGridRef.current.has(section.id) ? { ...section, grid: undefined } : section,
            ),
          },
          config: toTethyrConfig(config, page.config),
          ownerId: userId,
          ownerType: "profile",
        });
        setSavedLayout(cloneLayout(snapshotLayout));
        setSavedConfig(cloneConfig(config));
      }
      await publishPage.mutateAsync({ pageId: page.id, ownerId: userId, ownerType: "profile" });
      toast.success("Studio published");
    } catch {
      toast.error("Could not publish your Studio");
    } finally {
      setSaving(false);
    }
  }, [applyComposition, config, dirty, layout, page, publishPage, saving, userId]);

  const requestPublish = useCallback(() => {
    if (!page || !layout || !config || saving) return;
    setPublishConfirmOpen(true);
  }, [config, layout, page, saving]);

  const chooseStarter = useCallback(
    (starter: StudioStarter) => {
      if (!layout || !config) return;
      commit(applyStarter(layout, starter), starterConfig(starter, config));
    },
    [commit, config, layout],
  );

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
        onModeChange={setMode}
        onDeviceChange={setDevice}
        onSelect={setSelectedBlockId}
        onGridChange={applyGrid}
        onGridInteractionStart={beginGridInteraction}
        onGridInteractionEnd={endGridInteraction}
        onUpdateBlockConfig={updateBlockConfig}
        onBlockAction={updateBlock}
        onDuplicate={duplicateBlock}
        onRemove={removeBlock}
        onMove={moveBlock}
        onMoveSection={moveSection}
        onToggleSection={toggleSection}
        onRenameSection={renameSection}
        onSectionLayoutChange={setSectionLayout}
        onAddSection={addSection}
        onMoveToSection={moveToSection}
        onAdd={addBlock}
        onDragTypeChange={setDragType}
        onPaletteTargetChange={setPaletteTarget}
        onCustomizeChange={(patch) => commit(layout, { ...config, ...patch })}
        onSave={() => void save()}
        onPublish={requestPublish}
        onRollback={rollback}
        onChooseStarter={chooseStarter}
        onUndo={undo}
        onRedo={redo}
        onCompleteProfile={onCompleteProfile ? completeProfile : undefined}
        onExit={onExit ? exit : undefined}
        autoRenameId={renameFocusId}
        onRenameFocusHandled={() => setRenameFocusId(null)}
        onReset={() => commit(createDefaultProfileLayout(), { ...DEFAULT_STUDIO_CONFIG })}
      />
      <Dialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <DialogContent className="studio-editor-chrome sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Publish your Studio?</DialogTitle>
            <DialogDescription>
              Your current draft becomes live — visitors on your public page will see the latest
              arrangement, blocks, and appearance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setPublishConfirmOpen(false);
                void doPublish();
              }}
            >
              Publish
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPublishConfirmOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function createHistoryEntry(layout: PageLayout, config: GStudioConfig): HistoryEntry {
  return { layout: cloneLayout(layout), config: cloneConfig(config) };
}

export function makeHistoryEntry(layout: PageLayout, config: GStudioConfig): HistoryEntry {
  return createHistoryEntry(layout, config);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Default canvas size for a block type — single source of truth lives in
 * g-studio-surface's sizeFor() so click-to-add, drag-in placeholders, and the
 * canvas agree on the compact default heights. */
function blockSize(type: string): [number, number, number, number] {
  return sizeFor(type);
}

function overlaps(a: LayoutGridItem, b: LayoutGridItem) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function firstFreePosition(
  id: string,
  existing: LayoutGridItem[],
  width: number,
  height: number,
): { x: number; y: number } {
  const others = existing.filter((item) => item.i !== id);
  const maxY = others.reduce((value, item) => Math.max(value, item.y + item.h), 0);
  for (let y = 0; y <= maxY + height; y++) {
    for (let x = 0; x <= 12 - width; x++) {
      const candidate: LayoutGridItem = { i: id, x, y, w: width, h: height };
      if (!others.some((item) => overlaps(candidate, item))) return { x, y };
    }
  }
  return { x: 0, y: maxY + height };
}

function nextGridItem(
  id: string,
  existing: LayoutGridItem[],
  width: number,
  height: number,
  minW: number,
  minH: number,
): LayoutGridItem {
  const w = Math.max(minW, Math.min(12, width));
  const h = Math.max(minH, height);
  const { x, y } = firstFreePosition(id, existing, w, h);
  return normalizeGridItem({ i: id, x, y, w, h }, id, w, h, minW, minH);
}

function placeDuplicateGridItem(
  grid: LayoutGridItem[],
  source: LayoutGridItem | undefined,
  duplicateId: string,
  size: [number, number, number, number],
): LayoutGridItem[] {
  const [defaultW, defaultH, minW, minH] = size;
  if (!source) return [...grid, nextGridItem(duplicateId, grid, defaultW, defaultH, minW, minH)];
  const w = Math.max(minW, Math.min(12, source.w));
  const h = Math.max(minH, source.h);
  const x = source.x + source.w + w <= 12 ? source.x + source.w : 0;
  const y = x === 0 ? Math.max(...grid.map((item) => item.y + item.h), 0) : source.y;
  const candidate = normalizeGridItem(
    { i: duplicateId, x, y, w, h },
    duplicateId,
    defaultW,
    defaultH,
    minW,
    minH,
  );
  if (grid.some((item) => overlaps(candidate, item))) {
    const { x: freeX, y: freeY } = firstFreePosition(duplicateId, grid, candidate.w, candidate.h);
    candidate.x = freeX;
    candidate.y = freeY;
  }
  return [...grid, candidate];
}

function normalizeGridItem(
  item: LayoutGridItem,
  id: string,
  fallbackW: number,
  fallbackH: number,
  minW = 2,
  minH = 2,
): LayoutGridItem {
  const w = Math.max(minW, Math.min(12, Math.round(item.w || fallbackW)));
  return {
    i: id,
    x: Math.max(0, Math.min(12 - w, Math.round(item.x || 0))),
    y: Math.max(0, Math.round(item.y || 0)),
    w,
    h: Math.max(minH, Math.round(item.h || fallbackH)),
    minW,
    minH,
    maxW: item.maxW,
    maxH: item.maxH,
  };
}

function normalizeLayout(layout: PageLayout): PageLayout {
  return {
    sections: layout.sections.map((section, sectionIndex) => {
      const blocks = [...section.blocks].sort((a, b) => a.position - b.position);
      const seeded = new Map((section.grid ?? []).map((item) => [item.i, item]));
      const grid: LayoutGridItem[] = [];
      blocks.forEach((block) => {
        const [w, h, minW, minH] = blockSize(block.type);
        const existing = seeded.get(block.id);
        if (existing) {
          grid.push(normalizeGridItem(existing, block.id, w, h, minW, minH));
        } else {
          grid.push(nextGridItem(block.id, grid, w, h, minW, minH));
        }
      });
      return {
        ...section,
        position: sectionIndex,
        blocks: blocks.map((block, blockIndex) => ({ ...block, position: blockIndex })),
        grid,
      };
    }),
  };
}

function cloneLayout(layout: PageLayout): PageLayout {
  return JSON.parse(JSON.stringify(layout)) as PageLayout;
}

function cloneConfig(config: GStudioConfig): GStudioConfig {
  return JSON.parse(JSON.stringify(config)) as GStudioConfig;
}

function sameGrid(a: LayoutGridItem[], b: LayoutGridItem[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x.i.localeCompare(y.i));
  const right = [...b].sort((x, y) => x.i.localeCompare(y.i));
  return left.every((item, index) => {
    const other = right[index];
    return (
      item.i === other.i &&
      item.x === other.x &&
      item.y === other.y &&
      item.w === other.w &&
      item.h === other.h
    );
  });
}

// GStudioConfig is now identical to StudioConfig — no conversion needed.
function fromTethyrConfig(value: StudioConfig): GStudioConfig {
  return { ...value };
}

function toTethyrConfig(value: GStudioConfig, _current: StudioConfig): StudioConfig {
  return { ...value };
}

export function sectionGrid(
  section: LayoutSection,
  blocks: LayoutBlockInstance[],
): LayoutGridItem[] {
  const seeded = new Map((section.grid ?? []).map((item) => [item.i, item]));
  const grid: LayoutGridItem[] = [];
  blocks.forEach((block) => {
    const existing = seeded.get(block.id);
    const [width, height, minW, minH] = blockSize(block.type);
    if (existing) {
      grid.push(
        normalizeGridItem(
          existing,
          block.id,
          width,
          height,
          existing.minW ?? 2,
          existing.minH ?? 2,
        ),
      );
    } else {
      grid.push(nextGridItem(block.id, grid, width, height, minW, minH));
    }
  });
  return grid;
}

export function insertDuplicateGridItem(
  grid: LayoutGridItem[],
  sourceId: string,
  duplicateId: string,
  source?: LayoutGridItem,
): LayoutGridItem[] {
  const sourceItem = source ?? grid.find((item) => item.i === sourceId);
  const [width, height, minW, minH] = sourceItem
    ? [sourceItem.w, sourceItem.h, sourceItem.minW ?? 2, sourceItem.minH ?? 2]
    : blockSize("text");
  const duplicate = nextGridItem(duplicateId, grid, width, height, minW, minH);
  if (!sourceItem) return [...grid, duplicate];
  const x = Math.min(12 - duplicate.w, sourceItem.x + sourceItem.w);
  const y = sourceItem.y;
  if (!grid.some((item) => overlaps({ ...duplicate, x, y }, item))) {
    duplicate.x = x;
    duplicate.y = y;
  }
  return [...grid, duplicate];
}

/** Typical column widths per section layout, matched to the public page's
 *  SECTION_GRID proportions so a chosen layout seeds a faithful grid. */
const TRACK_WIDTHS: Record<LayoutSection["layout"], number[]> = {
  full: [12],
  two_column: [6],
  three_column: [4],
  sidebar_left: [3, 9],
  sidebar_right: [9, 3],
  feature: [8, 4],
  side_by_side: [6],
  featured_work: [8, 4],
  asymmetric: [8, 4],
  split: [6],
  image_lead: [5, 7],
  compact_list: [12],
};

/** Build a non-overlapping grid that snapshots a section layout into concrete
 *  column widths (the pattern repeats for blocks beyond the first row). */
export function seedGridFromLayout(
  section: Pick<LayoutSection, "id" | "blocks">,
  layout: LayoutSection["layout"],
): LayoutGridItem[] {
  const widths = TRACK_WIDTHS[layout] ?? [12];
  const ordered = [...section.blocks].sort((a, b) => a.position - b.position);
  const grid: LayoutGridItem[] = [];
  ordered.forEach((block, index) => {
    const [, defaultHeight, minW, minH] = blockSize(block.type);
    const w = Math.max(minW, Math.min(12, widths[index % widths.length]));
    const h = Math.max(minH, defaultHeight);
    const { x, y } = firstFreePosition(block.id, grid, w, h);
    grid.push(normalizeGridItem({ i: block.id, x, y, w, h }, block.id, w, h, minW, minH));
  });
  return grid;
}

export { cloneLayout, normalizeLayout, normalizeGridItem };
