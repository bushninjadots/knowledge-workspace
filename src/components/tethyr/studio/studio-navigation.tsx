import { useEffect, useState } from "react";
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";

const items = [
  ["profile-header", "Header"],
  ["profile-projects", "Your work"],
  ["profile-bio", "About you"],
  ["profile-skills", "Skills"],
  ["profile-gallery", "Gallery"],
  ["profile-links", "Links"],
  ["profile-tools", "Tools"],
] as const;

export function StudioNavigation() {
  const [active, setActive] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.getAttribute("data-block-type") ?? "");
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: [0.1, 0.4, 0.8] },
    );
    const nodes = items.map(([type]) => document.querySelector(`[data-block-type="${type}"]`)).filter(Boolean) as Element[];
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  function jump(type: string) {
    document.querySelector(`[data-block-type="${type}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <aside className="hidden w-48 shrink-0 lg:block" aria-label="Studio sections">
      <div className="sticky top-6 border-r border-border/40 pr-5">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <List className="h-4 w-4 text-muted-foreground" />
          Studio contents
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">Jump to a part of your public space.</p>
        <nav className="space-y-0.5">
          {items.map(([type, label]) => (
            <Button
              key={type}
              type="button"
              variant="ghost"
              size="sm"
              className={`h-9 w-full justify-start rounded-md border-l-2 px-3 text-xs ${active === type ? "border-[var(--user-accent,var(--trust))] bg-surface font-medium text-foreground" : "border-transparent text-muted-foreground hover:bg-surface/60 hover:text-foreground"}`}
              onClick={() => jump(type)}
            >
              {label}
            </Button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
