import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveals a landing section with a subtle fade + rise once it scrolls into
 * view. Implemented with IntersectionObserver + CSS transitions instead of
 * framer-motion — same visuals, no animation-library eval on the landing's
 * critical path.
 *
 * Content is visible by default (SSR, no-JS, reduced-motion) and only hidden
 * post-mount when it starts below the viewport, so nothing ever flashes and
 * crawlers/no-JS users always get the full page.
 */
export function SectionReveal({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // true = visible. SSR and no-JS render visible; JS may opt a below-fold
  // section into the reveal animation after mount.
  const [reveal, setReveal] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    // Already in (or near) the viewport → no animation, stay visible.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setReveal(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    setReveal(false); // start hidden now that the observer is armed
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={`scroll-mt-20 transition-[opacity,transform] duration-500 ease-out ${
        reveal ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
