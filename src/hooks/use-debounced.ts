import { useEffect, useState } from "react";

/**
 * Debounce a fast-changing value (search input, resize listeners). 200ms
 * matches GlobalSearch's tuning — long enough to skip keystroke-sized query
 * bursts, short enough that results never feel laggy.
 */
export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
