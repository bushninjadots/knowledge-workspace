import { useCallback, useRef, useState } from "react";
import type { PageLayout, ThemeTokens } from "@/lib/page-blocks";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function useStudioDraft(
  initialLayout: PageLayout = { sections: [] },
  initialOverrides: ThemeTokens | null = null,
) {
  const [layout, setLayout] = useState<PageLayout>(initialLayout);
  const [overrides, setOverrides] = useState<ThemeTokens | null>(initialOverrides);
  const [history, setHistory] = useState<PageLayout[]>([initialLayout]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const savedLayoutRef = useRef(initialLayout);
  const savedOverridesRef = useRef(initialOverrides);
  const overridesDirtyRef = useRef(false);

  const reset = useCallback((nextLayout: PageLayout, nextOverrides: ThemeTokens | null = null) => {
    setLayout(nextLayout);
    setOverrides(nextOverrides);
    setHistory([nextLayout]);
    setHistoryIndex(0);
    setDirty(false);
    savedLayoutRef.current = nextLayout;
    savedOverridesRef.current = nextOverrides;
    overridesDirtyRef.current = false;
  }, []);

  const apply = useCallback((nextLayout: PageLayout) => {
    const normalized: PageLayout = {
      sections: nextLayout.sections.map((section, index) => ({
        ...section,
        position: index,
        blocks: section.blocks.map((block, blockIndex) => ({ ...block, position: blockIndex })),
      })),
    };
    setLayout(normalized);
    setDirty(true);
    setHistory((current) => {
      const next = [...current.slice(0, historyIndex + 1), normalized].slice(-100);
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [historyIndex]);

  const updateOverrides = useCallback((next: ThemeTokens | null) => {
    setOverrides(next);
    setDirty(true);
    overridesDirtyRef.current = true;
  }, []);

  const syncDirty = useCallback((nextLayout: PageLayout, nextOverrides = overrides) => {
    setDirty(!equal(nextLayout, savedLayoutRef.current) || !equal(nextOverrides, savedOverridesRef.current));
  }, [overrides]);

  const undo = useCallback(() => {
    setHistoryIndex((current) => {
      const nextIndex = Math.max(0, current - 1);
      const nextLayout = history[nextIndex];
      if (nextLayout) {
        setLayout(nextLayout);
        syncDirty(nextLayout);
      }
      return nextIndex;
    });
  }, [history, syncDirty]);

  const redo = useCallback(() => {
    setHistoryIndex((current) => {
      const nextIndex = Math.min(history.length - 1, current + 1);
      const nextLayout = history[nextIndex];
      if (nextLayout) {
        setLayout(nextLayout);
        syncDirty(nextLayout);
      }
      return nextIndex;
    });
  }, [history, syncDirty]);

  const markSaved = useCallback(() => {
    savedLayoutRef.current = clone(layout);
    savedOverridesRef.current = clone(overrides);
    setDirty(false);
    overridesDirtyRef.current = false;
  }, [layout, overrides]);

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
