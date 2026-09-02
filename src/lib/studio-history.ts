import type { PageLayout, ThemeTokens } from "@/lib/page-blocks";
import type { StudioConfig } from "@/lib/studio-config";

export interface StudioSnapshot {
  layout: PageLayout;
  config: StudioConfig;
  themeId: string;
  theme?: ThemeTokens | null;
}

function cloneStudioSnapshot(snapshot: StudioSnapshot): StudioSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as StudioSnapshot;
}

export function createStudioHistory(limit = 50) {
  const undoStack: StudioSnapshot[] = [];
  const redoStack: StudioSnapshot[] = [];

  function push(stack: StudioSnapshot[], snapshot: StudioSnapshot) {
    stack.push(cloneStudioSnapshot(snapshot));
    if (stack.length > limit) stack.splice(0, stack.length - limit);
  }

  function record(snapshot: StudioSnapshot) {
    push(undoStack, snapshot);
    redoStack.length = 0;
  }

  function takeLegacySnapshot(): StudioSnapshot | null {
    const snapshot = undoStack.pop() ?? null;
    redoStack.length = 0;
    return snapshot ? cloneStudioSnapshot(snapshot) : null;
  }

  return {
    record,
    // Kept for compatibility with the original one-step utility API.
    capture: record,
    take: takeLegacySnapshot,
    undo(current: StudioSnapshot): StudioSnapshot | null {
      const snapshot = undoStack.pop();
      if (!snapshot) return null;
      push(redoStack, current);
      return cloneStudioSnapshot(snapshot);
    },
    redo(current: StudioSnapshot): StudioSnapshot | null {
      const snapshot = redoStack.pop();
      if (!snapshot) return null;
      push(undoStack, current);
      return cloneStudioSnapshot(snapshot);
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
  };
}
