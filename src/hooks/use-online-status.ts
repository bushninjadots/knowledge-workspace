import { useEffect, useState } from "react";

/**
 * Live browser connection status.
 * Defaults to online (matches SSR) to avoid hydration mismatch; the effect
 * syncs the real browser state right after mount, same pattern as use-mobile.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
