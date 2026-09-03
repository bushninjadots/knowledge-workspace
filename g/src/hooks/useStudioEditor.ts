import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { blockMap } from '../data/blockCatalog';
import { defaultConfig, defaultLayout } from '../data/defaultLayout';
import { applyStarter, starterConfig, starterMap } from '../data/starters';
import type { Starter } from '../data/starters';
import type {
  BlockInstance,
  BlockProps,
  BlockType,
  GridItem,
  PageData,
  PreviewDevice,
  StarterId,
  StudioConfig,
  StudioMode,
  StudioSnapshot } from
'../types/studio';
import { cloneSnapshot, pushHistory, type HistoryEntry } from '../utils/history';
import {
  createBlockInstance,
  findBlock,
  insertBlock,
  mapBlock,
  maxBottom,
  moveBlockToSection,
  moveSection,
  newId,
  removeBlock as removeBlockFromLayout,
  updateSection } from
'../utils/layout';

const STORAGE_KEY = 'tethyr.studio.v2';

const initialPage: PageData = {
  id: 'page_studio_1',
  ownerId: 'p_1',
  ownerType: 'profile',
  status: 'published',
  layout: defaultLayout,
  config: defaultConfig,
  publishedVersion: 3,
  versions: [
  {
    version: 3,
    label: 'Added the Halyard shelf',
    publishedAt: '2026-08-27',
    snapshot: cloneSnapshot({ layout: defaultLayout, config: defaultConfig })
  },
  {
    version: 2,
    label: 'Moved contributions above credits',
    publishedAt: '2026-07-04',
    snapshot: cloneSnapshot({ layout: defaultLayout, config: { ...defaultConfig, personality: 'editorial' } })
  },
  {
    version: 1,
    label: 'First published Studio',
    publishedAt: '2026-05-19',
    snapshot: cloneSnapshot({ layout: defaultLayout, config: { ...defaultConfig, structure: 'single', density: 'spacious' } })
  }]

};

function loadPage(): PageData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialPage;
    const parsed = JSON.parse(raw) as StudioSnapshot;
    if (!parsed?.layout?.sections) return initialPage;
    return { ...initialPage, layout: parsed.layout, config: { ...defaultConfig, ...parsed.config } };
  } catch {
    return initialPage;
  }
}

export interface StudioEditor {
  page: PageData;
  mode: StudioMode;
  previewDevice: PreviewDevice;
  isEditing: boolean;
  selectedBlockId: string | null;
  selectedBlock: BlockInstance | null;
  selectedSectionId: string | null;
  starterPickerOpen: boolean;
  customizeOpen: boolean;
  paletteOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  lastAction: string | null;
  hasUnpublishedChanges: boolean;
  setMode: (mode: StudioMode) => void;
  setPreviewDevice: (device: PreviewDevice) => void;
  setStarterPickerOpen: (open: boolean) => void;
  setCustomizeOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  select: (blockId: string | null) => void;
  beginInteraction: (label: string) => void;
  applyGrid: (sectionId: string, grid: GridItem[]) => void;
  growBlock: (sectionId: string, blockId: string, rows: number) => void;
  addBlock: (sectionId: string, type: BlockType, atIndex?: number) => void;
  duplicateBlock: (blockId: string) => void;
  deleteBlock: (blockId: string) => void;
  toggleBlockVisible: (blockId: string) => void;
  updateBlockProps: (blockId: string, props: BlockProps) => void;
  moveBlock: (blockId: string, sectionId: string) => void;
  nudgeSection: (sectionId: string, direction: -1 | 1) => void;
  toggleSectionVisible: (sectionId: string) => void;
  renameSection: (sectionId: string, title: string) => void;
  addSection: () => void;
  setConfig: (patch: Partial<StudioConfig>) => void;
  chooseStarter: (id: StarterId) => void;
  undo: () => void;
  redo: () => void;
  publish: () => void;
  rollback: (version: number) => void;
  reset: () => void;
}

export function useStudioEditor(): StudioEditor {
  const [page, setPage] = useState<PageData>(() => loadPage());
  const [mode, setModeState] = useState<StudioMode>('view');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [starterPickerOpen, setStarterPickerOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const pendingLabel = useRef<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ layout: page.layout, config: page.config })
      );
    } catch {

      /* storage unavailable — the Studio still works in memory */}
  }, [page.layout, page.config]);

  const snapshot = useCallback(
    (source: PageData): StudioSnapshot => cloneSnapshot({ layout: source.layout, config: source.config }),
    []
  );

  /** Record the current state, then mutate. Every edit lands in history. */
  const commit = useCallback(
    (label: string, updater: (current: PageData) => PageData) => {
      setPage((current) => {
        setPast((stack) => pushHistory(stack, { snapshot: snapshot(current), label }));
        setFuture([]);
        setLastAction(label);
        return updater(current);
      });
    },
    [snapshot]
  );

  /** Drag/resize: snapshot once at gesture start, then stream grid updates. */
  const beginInteraction = useCallback(
    (label: string) => {
      pendingLabel.current = label;
      setPage((current) => {
        setPast((stack) => pushHistory(stack, { snapshot: snapshot(current), label }));
        setFuture([]);
        setLastAction(label);
        return current;
      });
    },
    [snapshot]
  );

  const applyGrid = useCallback((sectionId: string, grid: GridItem[]) => {
    setPage((current) => {
      const section = current.layout.sections.find((s) => s.id === sectionId);
      if (!section) return current;
      const known = new Set(section.blocks.map((b) => b.id));
      const next = grid.
      filter((g) => known.has(g.i)).
      map((g) => {
        const block = section.blocks.find((b) => b.id === g.i);
        const def = block ? blockMap[block.type] : undefined;
        return { i: g.i, x: g.x, y: g.y, w: g.w, h: g.h, minW: def?.minW, minH: def?.minH };
      });
      // Bail out when nothing actually moved — otherwise the grid and React
      // would ping-pong new object identities forever.
      if (JSON.stringify(next) === JSON.stringify(section.grid)) return current;
      return {
        ...current,
        layout: updateSection(current.layout, sectionId, (s) => ({ ...s, grid: next }))
      };
    });
  }, []);

  /** Content measured taller than its frame — grow silently, never shrink. */
  const growBlock = useCallback((sectionId: string, blockId: string, rows: number) => {
    setPage((current) => {
      const section = current.layout.sections.find((s) => s.id === sectionId);
      const item = section?.grid.find((g) => g.i === blockId);
      if (!section || !item || item.h >= rows) return current;
      return {
        ...current,
        layout: updateSection(current.layout, sectionId, (s) => ({
          ...s,
          grid: s.grid.map((g) => g.i === blockId ? { ...g, h: rows } : g)
        }))
      };
    });
  }, []);

  const addBlock = useCallback(
    (sectionId: string, type: BlockType, atIndex?: number) => {
      const instance = createBlockInstance(
        type,
        type === 'profile-projects' ?
        { filter: 'building', presentation: 'minimal-list', showSignals: true, title: 'Projects' } :
        type === 'content-heading' ?
        { text: 'New heading' } :
        type === 'content-text' ?
        { text: 'Write something about the work.' } :
        {}
      );
      commit(`Added ${blockMap[type].label}`, (current) => ({
        ...current,
        layout: updateSection(current.layout, sectionId, (section) => insertBlock(section, instance, atIndex))
      }));
      setSelectedBlockId(instance.id);
      setPaletteOpen(false);
    },
    [commit]
  );

  const duplicateBlock = useCallback(
    (blockId: string) => {
      setPage((current) => {
        const found = findBlock(current.layout, blockId);
        if (!found) return current;
        setPast((stack) => pushHistory(stack, { snapshot: snapshot(current), label: 'Duplicated block' }));
        setFuture([]);
        setLastAction('Duplicated block');
        const copy: BlockInstance = { ...found.block, id: newId(), props: { ...found.block.props } };
        return {
          ...current,
          layout: updateSection(current.layout, found.section.id, (section) => {
            const item = section.grid.find((g) => g.i === blockId);
            return {
              ...section,
              blocks: [...section.blocks, copy],
              grid: [
              ...section.grid,
              {
                i: copy.id,
                x: 0,
                y: maxBottom(section.grid),
                w: item?.w ?? 6,
                h: item?.h ?? 4,
                minW: blockMap[copy.type].minW,
                minH: blockMap[copy.type].minH
              }]

            };
          })
        };
      });
    },
    [snapshot]
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      commit('Removed block', (current) => ({
        ...current,
        layout: removeBlockFromLayout(current.layout, blockId)
      }));
      setSelectedBlockId(null);
    },
    [commit]
  );

  const toggleBlockVisible = useCallback(
    (blockId: string) => {
      commit('Changed visibility', (current) => ({
        ...current,
        layout: mapBlock(current.layout, blockId, (block) => ({ ...block, visible: !block.visible }))
      }));
    },
    [commit]
  );

  const updateBlockProps = useCallback(
    (blockId: string, props: BlockProps) => {
      commit('Edited block', (current) => ({
        ...current,
        layout: mapBlock(current.layout, blockId, (block) => ({ ...block, props: { ...block.props, ...props } }))
      }));
    },
    [commit]
  );

  const moveBlock = useCallback(
    (blockId: string, sectionId: string) => {
      commit('Moved block', (current) => ({
        ...current,
        layout: moveBlockToSection(current.layout, blockId, sectionId)
      }));
    },
    [commit]
  );

  const nudgeSection = useCallback(
    (sectionId: string, direction: -1 | 1) => {
      commit('Reordered sections', (current) => ({
        ...current,
        layout: moveSection(current.layout, sectionId, direction)
      }));
    },
    [commit]
  );

  const toggleSectionVisible = useCallback(
    (sectionId: string) => {
      commit('Changed section visibility', (current) => ({
        ...current,
        layout: updateSection(current.layout, sectionId, (section) => ({ ...section, visible: !section.visible }))
      }));
    },
    [commit]
  );

  const renameSection = useCallback(
    (sectionId: string, title: string) => {
      commit('Renamed section', (current) => ({
        ...current,
        layout: updateSection(current.layout, sectionId, (section) => ({ ...section, title }))
      }));
    },
    [commit]
  );

  const addSection = useCallback(() => {
    const id = newId('sec');
    commit('Added section', (current) => ({
      ...current,
      layout: {
        sections: [
        ...current.layout.sections,
        { id, title: 'New section', kind: 'standard', visible: true, blocks: [], grid: [] }]

      }
    }));
  }, [commit]);

  const setConfig = useCallback(
    (patch: Partial<StudioConfig>) => {
      commit('Changed appearance', (current) => ({ ...current, config: { ...current.config, ...patch } }));
    },
    [commit]
  );

  const chooseStarter = useCallback(
    (id: StarterId) => {
      const starter: Starter = starterMap[id];
      commit(`Applied ${starter.name}`, (current) => ({
        ...current,
        layout: applyStarter(current.layout, starter),
        config: starterConfig(starter, current.config)
      }));
      setStarterPickerOpen(false);
    },
    [commit]
  );

  const undo = useCallback(() => {
    setPast((stack) => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      setPage((current) => {
        setFuture((f) => pushHistory(f, { snapshot: snapshot(current), label: entry.label }));
        return { ...current, layout: entry.snapshot.layout, config: entry.snapshot.config };
      });
      setLastAction(`Undid ${entry.label.toLowerCase()}`);
      return stack.slice(0, -1);
    });
  }, [snapshot]);

  const redo = useCallback(() => {
    setFuture((stack) => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      setPage((current) => {
        setPast((p) => pushHistory(p, { snapshot: snapshot(current), label: entry.label }));
        return { ...current, layout: entry.snapshot.layout, config: entry.snapshot.config };
      });
      setLastAction(`Redid ${entry.label.toLowerCase()}`);
      return stack.slice(0, -1);
    });
  }, [snapshot]);

  const publish = useCallback(() => {
    setPage((current) => {
      const version = (current.publishedVersion ?? 0) + 1;
      return {
        ...current,
        status: 'published',
        publishedVersion: version,
        versions: [
        { version, label: lastAction ?? 'Studio update', publishedAt: new Date().toISOString().slice(0, 10), snapshot: snapshot(current) },
        ...current.versions]

      };
    });
    setLastAction('Published');
  }, [lastAction, snapshot]);

  const rollback = useCallback(
    (version: number) => {
      commit(`Rolled back to v${version}`, (current) => {
        const target = current.versions.find((v) => v.version === version);
        if (!target) return current;
        return { ...current, layout: target.snapshot.layout, config: target.snapshot.config };
      });
    },
    [commit]
  );

  const reset = useCallback(() => {
    commit('Reset Studio', (current) => ({ ...current, layout: defaultLayout, config: defaultConfig }));
  }, [commit]);

  const setMode = useCallback((next: StudioMode) => {
    setModeState(next);
    if (next !== 'edit') {
      setSelectedBlockId(null);
      setPaletteOpen(false);
      setCustomizeOpen(false);
    }
  }, []);

  const publishedSnapshot = useMemo(
    () => page.versions.find((v) => v.version === page.publishedVersion)?.snapshot ?? null,
    [page.versions, page.publishedVersion]
  );

  const hasUnpublishedChanges = useMemo(() => {
    if (!publishedSnapshot) return true;
    return JSON.stringify({ layout: page.layout, config: page.config }) !== JSON.stringify(publishedSnapshot);
  }, [page.layout, page.config, publishedSnapshot]);

  const selectedBlock = useMemo(
    () => selectedBlockId ? findBlock(page.layout, selectedBlockId)?.block ?? null : null,
    [page.layout, selectedBlockId]
  );

  const selectedSectionId = useMemo(
    () => selectedBlockId ? findBlock(page.layout, selectedBlockId)?.section.id ?? null : null,
    [page.layout, selectedBlockId]
  );

  return {
    page,
    mode,
    previewDevice,
    isEditing: mode === 'edit',
    selectedBlockId,
    selectedBlock,
    selectedSectionId,
    starterPickerOpen,
    customizeOpen,
    paletteOpen,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    lastAction,
    hasUnpublishedChanges,
    setMode,
    setPreviewDevice,
    setStarterPickerOpen,
    setCustomizeOpen,
    setPaletteOpen,
    select: setSelectedBlockId,
    beginInteraction,
    applyGrid,
    growBlock,
    addBlock,
    duplicateBlock,
    deleteBlock,
    toggleBlockVisible,
    updateBlockProps,
    moveBlock,
    nudgeSection,
    toggleSectionVisible,
    renameSection,
    addSection,
    setConfig,
    chooseStarter,
    undo,
    redo,
    publish,
    rollback,
    reset
  };
}