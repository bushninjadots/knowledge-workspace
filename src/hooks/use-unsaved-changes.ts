import { useEffect } from "react";
import { useBlocker } from "@tanstack/react-router";

/**
 * Guard against losing unsaved work: blocks in-app navigation with a confirm
 * dialog and warns on tab close/refresh while `isDirty` is true. The Studio
 * editor rolls its own version; this covers the surfaces that were silently
 * losing edits (settings forms, the library editor, the message composer).
 */
export function useUnsavedChangesGuard(isDirty: boolean, message?: string) {
  const text = message ?? "You have unsaved changes. Leave anyway?";

  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set to show the dialog.
      e.returnValue = text;
      return text;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, text]);

  useBlocker(() => {
    if (!isDirty) return false;
    // window.confirm is the app-wide pattern (Studio, GitHub sync, mode
    // switch all use it); a custom dialog would be a larger surface change.
    return !window.confirm(text);
  }, isDirty);
}
