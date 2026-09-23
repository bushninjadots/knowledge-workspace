import { useCallback, useEffect, useState } from "react";

const SIDEBAR_STORAGE_KEY = "tethyr:sidebar-collapsed";

/**
 * Sidebar width preference, remembered per browser. Starts expanded so the
 * server-rendered markup matches the first client render; the stored value is
 * applied right after mount (same pattern as `useOnlineStatus`).
 *
 * Shared by the authenticated shell and the public section shell so the rail
 * state is consistent across both chrome frames.
 */
export function useSidebarRail() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
    } catch {
      // Private mode or blocked storage — stay expanded.
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Preference simply won't persist.
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
