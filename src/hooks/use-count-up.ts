import { useEffect, useRef, useState } from "react";

type CountUpOptions = { duration?: number };

/**
 * "Become known" counters — people, projects, endorsements — read as
 * accumulated work, so they ease up from 0 when the element scrolls into
 * view instead of snapping to a static number. Motion is a single
 * easeOutCubic run (no bounce), respects `prefers-reduced-motion` by
 * reporting the final value immediately, and never re-runs once seen.
 *
 * Attach the returned `ref` to the element holding the number.
 */
export function useCountUp(target: number, { duration = 700 }: CountUpOptions = {}) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [value, setValue] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (hasRun.current) {
      setValue(target);
      return;
    }

    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        // easeOutCubic — motion with a landing, not a bounce (per motion policy).
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(target * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
        else setValue(target);
      };
      raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          hasRun.current = true;
          run();
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, duration]);

  return { ref, value };
}
