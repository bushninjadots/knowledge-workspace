import { useEffect, useState } from "react";

// The README article's DOM id — shared between the progress bar and the scope
// it measures. Kept here so the two stay in step even if layout changed.
export const README_ARTICLE_ID = "project-readme-article";

/**
 * A 2px reading-progress line pinned under the project page header. Tracks the
 * user's position through the README article only — it stays empty above the
 * article and full once the user has read past it. aria-hidden: purely
 * decorative; the user never needs its state as data.
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;

    const measure = () => {
      raf = 0;
      const article = document.getElementById(README_ARTICLE_ID);
      if (!article) {
        setProgress(0);
        return;
      }
      const rect = article.getBoundingClientRect();
      const viewport = window.innerHeight;
      const total = rect.height - viewport;
      if (total <= 0) {
        setProgress(rect.top < 0 ? 100 : 0);
        return;
      }
      const ratio = Math.min(Math.max(-rect.top / total, 0), 1);
      setProgress(Math.round(ratio * 100));
    };

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(measure);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  if (progress <= 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-16 z-30 h-0.5 bg-background/0"
    >
      <div
        className="h-full bg-[var(--user-accent,var(--primary))] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
