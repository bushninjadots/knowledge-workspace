// ── Edit Mode Context ─────────────────────────────────────────────────────────
// Lightweight React context that holds whether the page editor is active.
// Any component within the tree can read `isEditing` and toggle it via
// `useEditMode()` without prop drilling.

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface EditModeState {
  /** Whether the page is currently in edit mode. */
  isEditing: boolean;
  /** Enter or exit edit mode. */
  toggleEditing: () => void;
  /** Enter edit mode. */
  startEditing: () => void;
  /** Exit edit mode (cancel unsaved changes warning). */
  stopEditing: () => void;
}

const EditModeContext = createContext<EditModeState | null>(null);

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);

  const toggleEditing = useCallback(() => setIsEditing((prev) => !prev), []);
  const startEditing = useCallback(() => setIsEditing(true), []);
  const stopEditing = useCallback(() => setIsEditing(false), []);

  const value = useMemo<EditModeState>(
    () => ({ isEditing, toggleEditing, startEditing, stopEditing }),
    [isEditing, toggleEditing, startEditing, stopEditing],
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

/** Access the edit mode state. Must be used within an EditModeProvider. */
export function useEditMode(): EditModeState {
  const ctx = useContext(EditModeContext);
  if (!ctx) throw new Error("useEditMode must be used within <EditModeProvider>");
  return ctx;
}