interface ProjectScrollSpyProps {
  sections: { id: string; label: string }[];
  activeSection: string | null;
  onSectionClick: (id: string) => void;
}

export function ProjectScrollSpy({
  sections,
  activeSection,
  onSectionClick,
}: ProjectScrollSpyProps) {
  return (
    <nav
      className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 flex-col items-center gap-3 z-40"
      aria-label="Section navigation"
    >
      <div className="absolute top-0 bottom-0 w-px bg-border/60" />
      {sections.map((s) => {
        const isActive = activeSection === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSectionClick(s.id)}
            className="group relative flex items-center gap-3"
            aria-current={isActive ? "location" : undefined}
            aria-label={s.label}
          >
            <div
              className={`relative z-10 h-2.5 w-2.5 rounded-full border transition-all duration-300 ${
                isActive
                  ? "border-primary bg-primary scale-125"
                  : "border-border/60 bg-surface hover:border-[var(--user-accent-border,var(--border-strong))]"
              }`}
            />
            <span
              className={`absolute left-4 whitespace-nowrap text-[11px] font-medium transition-all duration-200 ${
                isActive
                  ? "text-foreground opacity-100 translate-x-0"
                  : "text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0"
              }`}
            >
              {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
