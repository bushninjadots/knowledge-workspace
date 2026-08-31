import { useCallback, useRef, useState } from "react";
import type { PageLayout, ThemeTokens } from "@/lib/page-blocks";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Reindex every section and block position to match its array index. */
function normalizeLayout(layout: PageLayout): PageLayout {
  return {
    sections: layout.sections.map((section, index) => ({
      ...section,
      position: index,
      blocks: section.blocks.map((block, blockIndex) => ({
        ...block,
        position: blockIndex,
      })),
    })),
  };
}

export function useStudioDraft(
  initialLayout: PageLayout = { sections: [] },
  initialOverrides: ThemeTokens | null = null,
) {
  // Live mirrors of state, updated by every mutator below. Callbacks read
  // these refs (never render-closure state) so undo/redo/apply/markSaved are
  // stable and can't observe a stale history, index, layout, or overrides
  // value — which previously risked lost edits and incorrect dirty detection.
  const layoutRef = useRef<PageLayout>(initialLayout);
  const overridesRef = useRef<ThemeTokens | null>(initialOverrides);
  const historyRef = useRef<PageLayout[]>([initialLayout]);
  const historyIndexRef = useRef(0);
  const savedLayoutRef = useRef<PageLayout>(initialLayout);
  const savedOverridesRef = useRef<ThemeTokens | null>(initialOverrides);
  const overridesDirtyRef = useRef(false);

  const [layout, setLayoutState] = useState<PageLayout>(initialLayout);
  const [overrides, setOverridesState] = useState<ThemeTokens | null>(initialOverrides);
  const [history, setHistoryState] = useState<PageLayout[]>([initialLayout]);
  const [historyIndex, setHistoryIndexState] = useState(0);
  const [dirty, setDirty] = useState(false);

  const commitHistory = useCallback((next: PageLayout[], nextIndex: number) => {
    historyRef.current = next;
    historyIndexRef.current = nextIndex;
    setHistoryState(next);
    setHistoryIndexState(nextIndex);
  }, []);

  const reset = useCallback(
    (nextLayout: PageLayout, nextOverrides: ThemeTokens | null = null) => {
      const normalized = normalizeLayout(nextLayout);
      layoutRef.current = normalized;
      overridesRef.current = nextOverrides;
      savedLayoutRef.current = normalized;
      savedOverridesRef.current = nextOverrides;
      overridesDirtyRef.current = false;
      setLayoutState(normalized);
      setOverridesState(nextOverrides);
      setDirty(false);
      commitHistory([normalized], 0);
    },
    [commitHistory],
  );

  const apply = useCallback(
    (nextLayout: PageLayout) => {
      const normalized = normalizeLayout(nextLayout);
      layoutRef.current = normalized;
      setLayoutState(normalized);
      setDirty(true);
      // Reading the current index from the ref (not a closure) keeps redo-tail
      // truncation correct immediately after undo/redo.
      const nextHistory = [
        ...historyRef.current.slice(0, historyIndexRef.current + 1),
        normalized,
      ].slice(-100);
      commitHistory(nextHistory, nextHistory.length - 1);
    },
    [commitHistory],
  );

  const updateOverrides = useCallback((next: ThemeTokens | null) => {
    overridesRef.current = next;
    setOverridesState(next);
    setDirty(true);
    overridesDirtyRef.current = true;
  }, []);

  const syncDirty = useCallback((nextLayout: PageLayout, nextOverrides: ThemeTokens | null) => {
    setDirty(
      !equal(nextLayout, savedLayoutRef.current) ||
        !equal(nextOverrides, savedOverridesRef.current),
    );
  }, []);

  const undo = useCallback(() => {
    const nextIndex = Math.max(0, historyIndexRef.current - 1);
    const nextLayout = historyRef.current[nextIndex];
    if (nextLayout) {
      layoutRef.current = nextLayout;
      setLayoutState(nextLayout);
      syncDirty(nextLayout, overridesRef.current);
    }
    historyIndexRef.current = nextIndex;
    setHistoryIndexState(nextIndex);
  }, [syncDirty]);

  const redo = useCallback(() => {
    const nextIndex = Math.min(historyRef.current.length - 1, historyIndexRef.current + 1);
    const nextLayout = historyRef.current[nextIndex];
    if (nextLayout) {
      layoutRef.current = nextLayout;
      setLayoutState(nextLayout);
      syncDirty(nextLayout, overridesRef.current);
    }
    historyIndexRef.current = nextIndex;
    setHistoryIndexState(nextIndex);
  }, [syncDirty]);

  const markSaved = useCallback(() => {
    savedLayoutRef.current = clone(layoutRef.current);
    savedOverridesRef.current = clone(overridesRef.current);
    overridesDirtyRef.current = false;
    setDirty(false);
  }, []);

  const setLayout = useCallback((next: PageLayout) => {
    const normalized = normalizeLayout(next);
    layoutRef.current = normalized;
    setLayoutState(normalized);
  }, []);

  const setOverrides = useCallback((next: ThemeTokens | null) => {
    overridesRef.current = next;
    setOverridesState(next);
  }, []);

  return {
    layout,
    overrides,
    dirty,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    overridesDirtyRef,
    reset,
    apply,
    updateOverrides,
    undo,
    redo,
    markSaved,
    setLayout,
    setOverrides,
  };
}
