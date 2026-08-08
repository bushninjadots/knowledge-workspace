import { useEffect, useMemo, useRef, useState } from "react";
import { Search, FolderOpen, MessagesSquare, Heading1, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { parseReadmeSections } from "./project-readme";
import type { DiscussionRow } from "@/hooks/use-projects";
import type { ProjectFile } from "./project-files";

type SectionHit = { id: string; text: string; level: number };

export function ProjectSearchDialog({
  open,
  onOpenChange,
  projectFiles,
  discussions,
  readme,
  onJumpFile,
  onJumpDiscussion,
  onJumpSection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectFiles: ProjectFile[];
  discussions: DiscussionRow[];
  readme: string | null | undefined;
  onJumpFile: (path: string) => void;
  onJumpDiscussion: (discussionId: string) => void;
  onJumpSection: (sectionId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setSelectedIndex(0);
      // Focus once the dialog finishes opening.
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const sections = useMemo<SectionHit[]>(
    () => (readme ? parseReadmeSections(readme) : []),
    [readme],
  );

  const qLower = q.trim().toLowerCase(); // Cap each group at 6 results so the rendered rows and the keyboard
  // navigation index always agree (no invisible selectable rows).
  const fileHits = useMemo(() => {
    if (!qLower) return projectFiles.slice(0, 6);
    return projectFiles
      .filter(
        (f) =>
          f.name.toLowerCase().includes(qLower) || (f.dir ?? "").toLowerCase().includes(qLower),
      )
      .slice(0, 6);
  }, [projectFiles, qLower]);

  const discussionHits = useMemo(() => {
    if (!qLower) return discussions.slice(0, 6);
    return discussions
      .filter(
        (d) => d.title.toLowerCase().includes(qLower) || d.body.toLowerCase().includes(qLower),
      )
      .slice(0, 6);
  }, [discussions, qLower]);

  const sectionHits = useMemo(() => {
    if (!qLower) return sections.slice(0, 6);
    return sections.filter((s) => s.text.toLowerCase().includes(qLower)).slice(0, 6);
  }, [sections, qLower]);

  // Flat list for arrow-key navigation, with group boundaries for rendering.
  type Hit =
    | { kind: "file"; file: ProjectFile }
    | { kind: "discussion"; discussion: DiscussionRow }
    | { kind: "section"; section: SectionHit };

  const flat = useMemo<Hit[]>(() => {
    const all: Hit[] = [];
    for (const f of fileHits) all.push({ kind: "file", file: f });
    for (const d of discussionHits) all.push({ kind: "discussion", discussion: d });
    for (const s of sectionHits) all.push({ kind: "section", section: s });
    return all;
  }, [fileHits, discussionHits, sectionHits]);

  const groupStarts = useMemo(() => {
    return {
      files: 0,
      discussions: fileHits.length,
      sections: fileHits.length + discussionHits.length,
    };
  }, [fileHits, discussionHits]);

  const jump = (hit: Hit) => {
    onOpenChange(false);
    if (hit.kind === "file") onJumpFile(hit.file.path ?? `${hit.file.dir ?? ""}/${hit.file.name}`);
    else if (hit.kind === "discussion") onJumpDiscussion(hit.discussion.id);
    else onJumpSection(hit.section.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(flat.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + Math.max(flat.length, 1)) % Math.max(flat.length, 1));
    } else if (e.key === "Enter" && flat.length > 0) {
      e.preventDefault();
      jump(flat[Math.min(selectedIndex, flat.length - 1)]);
    }
  };

  const noResults = qLower !== "" && flat.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="flex items-center gap-2 border-b border-border/60 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search files, discussions, README sections…"
            className="h-12 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
            aria-label="Search this project"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-1 py-2">
          {noResults ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing in this project matches “{q.trim()}”.
            </p>
          ) : q.trim() === "" ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Jump to a file, discussion, or README section in this project.
            </p>
          ) : (
            <>
              <HitGroup label={`Files (${fileHits.length})`} show={fileHits.length > 0}>
                {fileHits.map((f, idx) => {
                  const i = groupStarts.files + idx;
                  const Icon = f.type === "image" || f.type === "video" ? FileText : FolderOpen;
                  return (
                    <HitRow
                      key={`${f.dir ?? ""}/${f.name}`}
                      selected={selectedIndex === i}
                      icon={<Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      title={f.name}
                      sub={`${f.dir ? `${f.dir}/` : ""}${f.name}`}
                      onHover={() => setSelectedIndex(i)}
                      onClick={() => jump(flat[i])}
                    />
                  );
                })}
              </HitGroup>{" "}
              <HitGroup
                label={`Discussions (${discussionHits.length})`}
                show={discussionHits.length > 0}
              >
                {discussionHits.map((d, idx) => {
                  const i = groupStarts.discussions + idx;
                  return (
                    <HitRow
                      key={d.id}
                      selected={selectedIndex === i}
                      icon={<MessagesSquare className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      title={d.title}
                      sub={`${d.category} · ${d.body.slice(0, 60) || "—"}`}
                      onHover={() => setSelectedIndex(i)}
                      onClick={() => jump(flat[i])}
                    />
                  );
                })}
              </HitGroup>{" "}
              <HitGroup
                label={`README sections (${sectionHits.length})`}
                show={sectionHits.length > 0}
              >
                {sectionHits.map((s, idx) => {
                  const i = groupStarts.sections + idx;
                  return (
                    <HitRow
                      key={s.id}
                      selected={selectedIndex === i}
                      icon={<Heading1 className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      title={s.text}
                      sub={`Section H${s.level}`}
                      onHover={() => setSelectedIndex(i)}
                      onClick={() => jump(flat[i])}
                    />
                  );
                })}
              </HitGroup>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ to navigate</span>
          <span>↵ to jump</span>
          <span className="ml-auto">esc to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HitGroup({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div>
      <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function HitRow({
  selected,
  icon,
  title,
  sub,
  onHover,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  sub: string;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <button
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition",
        selected ? "bg-[var(--user-accent-subtle,var(--surface-elevated))]" : "hover:bg-surface",
      )}
    >
      {icon}
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}
