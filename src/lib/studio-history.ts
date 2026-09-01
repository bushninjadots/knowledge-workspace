import type { PageLayout } from "@/lib/page-blocks";
import type { StudioConfig } from "@/lib/studio-config";

interface StudioSnapshot {
  layout: PageLayout;
  config: StudioConfig;
}

function cloneStudioSnapshot(snapshot: StudioSnapshot): StudioSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as StudioSnapshot;
}

export function createStudioHistory() {
  let previous: StudioSnapshot | null = null;

  return {
    capture(snapshot: StudioSnapshot) {
      previous = cloneStudioSnapshot(snapshot);
    },
    take(): StudioSnapshot | null {
      const snapshot = previous;
      previous = null;
      return snapshot ? cloneStudioSnapshot(snapshot) : null;
    },
    clear() {
      previous = null;
    },
    get canUndo() {
      return previous !== null;
    },
  };
}
