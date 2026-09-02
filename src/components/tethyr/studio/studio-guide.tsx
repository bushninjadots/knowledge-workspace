import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const GUIDE_KEY = "tethyr:studio-guide-seen";

const steps = [
  ["Build", "Add content blocks such as projects, bio, skills, and links."],
  ["Arrange", "Change section layouts, reorder blocks, and adjust block widths."],
  ["Style", "Choose a theme and adjust appearance, radius, density, and transparency."],
  ["Review", "Preview the result, then publish when your Studio is ready to share."],
] as const;

export function StudioGuide() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(GUIDE_KEY) !== "1";
  });

  function dismiss() {
    window.localStorage.setItem(GUIDE_KEY, "1");
    setOpen(false);
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <HelpCircle className="h-3.5 w-3.5" /> How Studio works
      </Button>
    );
  }

  return (
    <div className="relative mb-5 border-b border-border/50 pb-5" role="region" aria-label="How Studio works">
      <button type="button" onClick={dismiss} className="absolute right-0 top-0 rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground" aria-label="Close Studio guide">
        <X className="h-4 w-4" />
      </button>
      <p className="section-label">A quick orientation</p>
      <h2 className="mt-1 pr-8 font-display text-xl font-semibold">How to shape your Studio</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Start with the content, arrange it into a story, choose a visual tone, then preview before sharing.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([title, description], index) => (
          <div key={title} className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--user-accent,var(--trust))]/10 text-[10px] font-semibold text-[var(--user-accent,var(--trust))]">{index + 1}</span>
              <p className="text-sm font-medium text-foreground">{title}</p>
            </div>
            <p className="mt-2 pl-8 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
      <Button type="button" variant="ghost" size="sm" className="mt-4 h-8 px-0 text-xs text-muted-foreground hover:text-foreground" onClick={dismiss}>Dismiss guide</Button>
    </div>
  );
}
