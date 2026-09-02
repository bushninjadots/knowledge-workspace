// ── Edit Mode Context ─────────────────────────────────────────────────────────
// Holds edit mode and the shared session history used by the Studio toolbar,
// canvas, and contextual inspectors.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createStudioHistory, type StudioSnapshot } from "@/lib/studio-history";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

interface EditModeState {
  /** Whether the page is currently in edit mode. */
  isEditing: boolean;
  /** Whether the owner is viewing the Studio in preview mode. */
  isPreviewing: boolean;
  /** Device frame used by preview mode. */
  previewDevice: PreviewDevice;
  /** Enter or exit edit mode. */
  toggleEditing: () => void;
  /** Enter edit mode. */
  startEditing: () => void;
  /** Exit edit mode. */
  stopEditing: () => void;
  /** Enter preview mode without exposing editor controls on the canvas. */
  startPreview: (device?: PreviewDevice) => void;
  /** Return from preview mode to the editor. */
  stopPreview: () => void;
  /** Change the preview device frame. */
  setPreviewDevice: (device: PreviewDevice) => void;
  /** Record the current page state before a user-initiated change. */
  recordSnapshot: (snapshot: StudioSnapshot) => void;
  /** Take the previous state and expose it to the registered page restorer. */
  undo: (current: StudioSnapshot) => StudioSnapshot | null;
  /** Take the next state and expose it to the registered page restorer. */
  redo: (current: StudioSnapshot) => StudioSnapshot | null;
  /** Restore a snapshot through the page owner. */
  restoreSnapshot: (snapshot: StudioSnapshot) => void;
  /** Register the persistence owner for undo/redo restores. */
  registerRestoreHandler: (handler: (snapshot: StudioSnapshot) => void) => () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const EditModeContext = createContext<EditModeState | null>(null);

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewDevice, setPreviewDeviceState] = useState<PreviewDevice>("desktop");
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const historyRef = useRef(createStudioHistory());
  const restoreHandlerRef = useRef<((snapshot: StudioSnapshot) => void) | null>(null);

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    });
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current.clear();
    syncHistoryState();
  }, [syncHistoryState]);

  const toggleEditing = useCallback(() => {
    setIsEditing((prev) => {
      const next = !prev;
      setIsPreviewing(false);
      if (next) clearHistory();
      return next;
    });
  }, [clearHistory]);

  const startEditing = useCallback(() => {
    clearHistory();
    setIsPreviewing(false);
    setIsEditing(true);
  }, [clearHistory]);
  const stopEditing = useCallback(() => {
    clearHistory();
    setIsPreviewing(false);
    setIsEditing(false);
  }, [clearHistory]);
  const startPreview = useCallback(
    (device: PreviewDevice = "desktop") => {
      clearHistory();
      setPreviewDeviceState(device);
      setIsEditing(false);
      setIsPreviewing(true);
    },
    [clearHistory],
  );
  const stopPreview = useCallback(() => {
    clearHistory();
    setIsPreviewing(false);
    setIsEditing(true);
  }, [clearHistory]);
  const setPreviewDevice = useCallback((device: PreviewDevice) => {
    setPreviewDeviceState(device);
  }, []);

  const recordSnapshot = useCallback(
    (snapshot: StudioSnapshot) => {
      historyRef.current.record(snapshot);
      syncHistoryState();
    },
    [syncHistoryState],
  );

  const undo = useCallback(
    (current: StudioSnapshot) => {
      const snapshot = historyRef.current.undo(current);
      if (snapshot) syncHistoryState();
      return snapshot;
    },
    [syncHistoryState],
  );

  const redo = useCallback(
    (current: StudioSnapshot) => {
      const snapshot = historyRef.current.redo(current);
      if (snapshot) syncHistoryState();
      return snapshot;
    },
    [syncHistoryState],
  );

  const restoreSnapshot = useCallback((snapshot: StudioSnapshot) => {
    restoreHandlerRef.current?.(snapshot);
  }, []);

  const registerRestoreHandler = useCallback((handler: (snapshot: StudioSnapshot) => void) => {
    restoreHandlerRef.current = handler;
    return () => {
      if (restoreHandlerRef.current === handler) restoreHandlerRef.current = null;
    };
  }, []);

  const value = useMemo<EditModeState>(
    () => ({
      isEditing,
      isPreviewing,
      previewDevice,
      toggleEditing,
      startEditing,
      stopEditing,
      startPreview,
      stopPreview,
      setPreviewDevice,
      recordSnapshot,
      undo,
      redo,
      restoreSnapshot,
      registerRestoreHandler,
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
    }),
    [
      isEditing,
      isPreviewing,
      previewDevice,
      toggleEditing,
      startEditing,
      stopEditing,
      startPreview,
      stopPreview,
      setPreviewDevice,
      recordSnapshot,
      undo,
      redo,
      restoreSnapshot,
      registerRestoreHandler,
      historyState,
    ],
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

/** Access the edit mode state. Must be used within an EditModeProvider. */
export function useEditMode(): EditModeState {
  const ctx = useContext(EditModeContext);
  if (!ctx) throw new Error("useEditMode must be used within <EditModeProvider>");
  return ctx;
}
