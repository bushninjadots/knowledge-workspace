import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
  const pageIdRef = useRef<string | null>(null);
  const createAttempted = useRef(false);

  const pageQuery = usePage({ ownerId: userId, ownerType: "profile", includeDraft: true });
  const createPage = useCreatePage();
  const applyComposition = useApplyStudioComposition();
  const publishPage = usePublishPage();
  const rollbackPage = useRollbackPageVersion();
  const page = pageQuery.data;

  useEffect(() => {
    if (!page || pageIdRef.current === page.id) return;
    const nextLayout = normalizeLayout(page.layout);
    const nextConfig = fromTethyrConfig(page.config);
    pageIdRef.current = page.id;
    setLayout(cloneLayout(nextLayout));
    setSavedLayout(cloneLayout(nextLayout));
    setConfig({ ...nextConfig });
    setSavedConfig({ ...nextConfig });
    setHistory([]);
    setFuture([]);
    setSelectedBlockId(null);
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
      (JSON.stringify(layout) !== JSON.stringify(savedLayout) ||
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
      !latestPublishedLayout || JSON.stringify(layout) !== JSON.stringify(latestPublishedLayout),
    [latestPublishedLayout, layout],
  );

  const commit = useCallback(
    (nextLayout: PageLayout, nextConfig = config) => {
      if (!layout || !nextConfig) return;
      setHistory((entries) => [
        ...entries.slice(-49),
        { layout: cloneLayout(layout), config: { ...nextConfig } },
      ]);
      setFuture([]);
      setLayout(normalizeLayout(nextLayout));
      setConfig({ ...nextConfig });
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
      commit(next);
      setSelectedBlockId(block.id);
    },
    [commit, layout],
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      if (!layout) return;
      commit({
        sections: layout.sections.map((section) => ({
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
    next.sections.push({
      id: makeId("section"),
      position: next.sections.length,
      layout: "full",
      title: `Area ${next.sections.length + 1}`,
      visible: true,
      blocks: [],
      grid: [],
    });
    commit(next);
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
    setConfig({ ...previous.config });
  }, [config, history, layout]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next || !layout || !config) return;
    setHistory((entries) => [...entries, { layout: cloneLayout(layout), config: { ...config } }]);
    setFuture((entries) => entries.slice(1));
    setLayout(cloneLayout(next.layout));
    setConfig({ ...next.config });
  }, [config, future, layout]);

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

  const save = useCallback(async () => {
    if (!page || !layout || !config || saving || !dirty) return;
    setSaving(true);
    try {
      await applyComposition.mutateAsync({
        pageId: page.id,
        layoutId: page.layoutId,
        layout: normalizeLayout(layout),
        config: toTethyrConfig(config, page.config),
        ownerId: userId,
        ownerType: "profile",
      });
      setSavedLayout(cloneLayout(layout));
      setSavedConfig({ ...config });
      toast.success("Draft saved");
    } catch {
      toast.error("Could not save your Studio draft");
    } finally {
      setSaving(false);
    }
  }, [applyComposition, config, dirty, layout, page, saving, userId]);

  const publish = useCallback(async () => {
    if (!page || !layout || !config || saving) return;
    setSaving(true);
    try {
      if (dirty) {
        await applyComposition.mutateAsync({
          pageId: page.id,
          layoutId: page.layoutId,
          layout: normalizeLayout(layout),
          config: toTethyrConfig(config, page.config),
          ownerId: userId,
          ownerType: "profile",
        });
        setSavedLayout(cloneLayout(layout));
        setSavedConfig({ ...config });
      }
      await publishPage.mutateAsync({ pageId: page.id, ownerId: userId, ownerType: "profile" });
      toast.success("Studio published");
    } catch {
      toast.error("Could not publish your Studio");
    } finally {
      setSaving(false);
    }
  }, [applyComposition, config, dirty, layout, page, publishPage, saving, userId]);

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
      onAddSection={addSection}
      onMoveToSection={moveToSection}
      onAdd={addBlock}
      onDragTypeChange={setDragType}
      onPaletteTargetChange={setPaletteTarget}
      onCustomizeChange={(patch) => commit(layout, { ...config, ...patch })}
      onSave={save}
      onPublish={publish}
      onRollback={rollback}
      onChooseStarter={chooseStarter}
      onUndo={undo}
      onRedo={redo}
      onCompleteProfile={onCompleteProfile}
      onExit={onExit}
      onReset={() => commit(createDefaultProfileLayout(), { ...DEFAULT_STUDIO_CONFIG })}
    />
  );
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

function nextGridItem(
  id: string,
  existing: LayoutGridItem[],
  width: number,
  height: number,
  minW: number,
  minH: number,
): LayoutGridItem {
  const bottom = existing.reduce((value, item) => Math.max(value, item.y + item.h), 0);
  return normalizeGridItem(
    { i: id, x: 0, y: bottom, w: width, h: height },
    id,
    width,
    height,
    minW,
    minH,
  );
}

function placeDuplicateGridItem(
  grid: LayoutGridItem[],
  source: LayoutGridItem | undefined,
  duplicateId: string,
  size: [number, number, number, number],
): LayoutGridItem[] {
  const [defaultW, defaultH, minW, minH] = size;
  if (!source) return [...grid, nextGridItem(duplicateId, grid, defaultW, defaultH, minW, minH)];
  const x = source.x + source.w + defaultW <= 12 ? source.x + source.w : 0;
  const y = x === 0 ? Math.max(...grid.map((item) => item.y + item.h), 0) : source.y;
  return [
    ...grid,
    normalizeGridItem(
      { i: duplicateId, x, y, w: source.w, h: source.h },
      duplicateId,
      defaultW,
      defaultH,
      minW,
      minH,
    ),
  ];
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
      const grid = blocks.map((block, index) => {
        const existing = section.grid?.find((item) => item.i === block.id);
        const [w, h, minW, minH] = blockSize(block.type);
        return existing
          ? normalizeGridItem(existing, block.id, w, h, minW, minH)
          : nextGridItem(
              block.id,
              section.grid ??
                blocks.slice(0, index).map((item) => ({ i: item.id, x: 0, y: 0, w: 12, h: 1 })),
              w,
              h,
              minW,
              minH,
            );
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
  return {
    sections: layout.sections.map((section) => ({
      ...section,
      grid: section.grid?.map((item) => ({ ...item })),
      blocks: section.blocks.map((block) => ({ ...block, config: { ...block.config } })),
    })),
  };
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
  const persisted = new Map((section.grid ?? []).map((item) => [item.i, item]));
  return blocks.map((block, position) => {
    const existing = persisted.get(block.id);
    if (existing) return { ...existing, minW: existing.minW ?? 2, minH: existing.minH ?? 2 };
    const [width, height, minW, minH] = blockSize(block.type);
    return normalizeGridItem(
      {
        i: block.id,
        x: width >= 12 ? 0 : position % 2 === 0 ? 0 : 6,
        y: Math.floor(position / 2) * 5,
        w: width,
        h: height,
      },
      block.id,
      width,
      height,
      minW,
      minH,
    );
  });
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
  duplicate.x = Math.min(12 - duplicate.w, sourceItem.x + sourceItem.w);
  duplicate.y = sourceItem.y;
  return [...grid, duplicate];
}

export { cloneLayout, normalizeLayout, normalizeGridItem };
