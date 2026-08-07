import { useState, useEffect, useCallback } from "react";

const OBSERVER_OPTIONS = { rootMargin: "-40% 0px -55% 0px", threshold: 0 };

/**
 * Tracks which page section is currently in view and provides a scrollTo
 * helper. `sectionIds` should be memoized by the caller so the observer
 * isn't re-created on every render.
 */
export function useProjectScrollSpy(sectionIds: string[]) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) setActiveSection(visible[0].target.id);
    }, OBSERVER_OPTIONS);

    elements.forEach((el) => observer.observe(el));
    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [sectionIds]);

  const scrollTo = useCallback((sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return { activeSection, scrollTo };
}
