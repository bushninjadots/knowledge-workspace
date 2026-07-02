import { Sparkles } from "lucide-react";
import { EmptyState } from "./empty-state";

// Placeholder creators — swap for real matches once matching lands.
const PLACEHOLDER = [
  { name: "Ari Nakamura", title: "Motion Designer", skills: ["After Effects", "Cinema 4D"], hue: "green" },
  { name: "Lena Ortiz", title: "YouTuber & Editor", skills: ["Premiere Pro", "YouTube Growth"], hue: "purple" },
  { name: "Sam Whitfield", title: "SEO Specialist", skills: ["SEO", "WordPress"], hue: "green" },
] as const;

export function SuggestedCreators() {
  if (PLACEHOLDER.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title="No creators to suggest yet"
        description="Finish your profile and we'll match you with creators who complement your skills."
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {PLACEHOLDER.map((c) => (
        <div
          key={c.name}
          className="rounded-2xl border border-border/60 bg-surface p-4 transition hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold text-background ${
                c.hue === "green" ? "bg-primary" : "bg-brand-purple"
              }`}
            >
              {c.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">{c.title}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.skills.map((s) => (
              <span
                key={s}
                className="rounded-full border border-border/60 bg-surface-elevated px-2.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            Coming soon
          </p>
        </div>
      ))}
    </div>
  );
}
