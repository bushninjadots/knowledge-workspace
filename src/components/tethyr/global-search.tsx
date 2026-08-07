import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  User,
  GraduationCap,
  FolderOpen,
  BookOpen,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

type ProfileHit = {
  id: string;
  handle: string | null;
  display_name: string | null;
  category: string | null;
  creator_title: string | null;
};
type SkillHit = { id: string; name: string; category: string };
type ProjectHit = { id: string; title: string; description: string | null; tags: string[] };
type LibraryHit = { id: string; title: string; content: string; type: string };
type PostHit = { id: string; title: string; body: string; type: string };
type SessionHit = { id: string; title: string; description: string | null; session_type: string };

function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function GlobalSearch({
  variant = "inline",
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  variant?: "inline" | "dialog";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [q, setQ] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounced = useDebounced(q.trim(), 200);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();

  useEffect(() => {
    if (variant !== "inline") return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [variant, setOpen]);

  useEffect(() => {
    if (variant !== "inline") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [variant, setOpen]);

  function escapeForOr(value: string): string {
    return value.replace(/[,%()\\|]/g, (c) => `\\${c}`);
  }

  const enabled = debounced.length >= 1;
  const safeTerm = escapeForOr(debounced);
  const like = `%${safeTerm}%`;

  const profiles = useQuery({
    queryKey: ["search", "profiles", debounced],
    enabled,
    queryFn: async (): Promise<ProfileHit[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, handle, display_name, category, creator_title")
        .or(
          `display_name.ilike.${like},handle.ilike.${like},category.ilike.${like},creator_title.ilike.${like}`,
        )
        .limit(4);
      if (error) throw error;
      return (data ?? []) as ProfileHit[];
    },
  });

  const skills = useQuery({
    queryKey: ["search", "skills", debounced],
    enabled,
    queryFn: async (): Promise<SkillHit[]> => {
      const { data, error } = await supabase
        .from("skills")
        .select("id, name, category")
        .ilike("name", like)
        .limit(4);
      if (error) throw error;
      return (data ?? []) as SkillHit[];
    },
  });

  const projects = useQuery({
    queryKey: ["search", "projects", debounced],
    enabled,
    queryFn: async (): Promise<ProjectHit[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, tags")
        .or(`title.ilike.${like},description.ilike.${like}`)
        .limit(4);
      if (error) throw error;
      return (data ?? []) as ProjectHit[];
    },
  });

  const libraryItems = useQuery({
    queryKey: ["search", "library", debounced, me?.profile?.id],
    enabled: enabled && !!me?.profile?.id,
    queryFn: async (): Promise<LibraryHit[]> => {
      if (!me?.profile?.id) return [];
      const { data, error } = await supabase
        .from("library_items")
        .select("id, title, content, type")
        .eq("user_id", me.profile.id)
        .or(`title.ilike.${like},content.ilike.${like}`)
        .limit(4);
      if (error) throw error;
      return (data ?? []) as LibraryHit[];
    },
  });

  const posts = useQuery({
    queryKey: ["search", "posts", debounced],
    enabled,
    queryFn: async (): Promise<PostHit[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, body, type")
        .or(`title.ilike.${like},body.ilike.${like}`)
        .limit(4);
      if (error) throw error;
      return (data ?? []) as PostHit[];
    },
  });

  const sessions = useQuery({
    queryKey: ["search", "sessions", debounced, me?.profile?.id],
    enabled: enabled && !!me?.profile?.id,
    queryFn: async (): Promise<SessionHit[]> => {
      if (!me?.profile?.id) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("id, title, description, session_type")
        .eq("organizer_id", me.profile.id)
        .or(`title.ilike.${like},description.ilike.${like}`)
        .limit(4);
      if (error) throw error;
      return (data ?? []) as SessionHit[];
    },
  });

  const profileHits = profiles.data ?? [];
  const skillHits = skills.data ?? [];
  const projectHits = projects.data ?? [];
  const libraryHits = libraryItems.data ?? [];
  const postHits = posts.data ?? [];
  const sessionHits = sessions.data ?? [];

  const isLoading =
    profiles.isLoading ||
    skills.isLoading ||
    projects.isLoading ||
    libraryItems.isLoading ||
    posts.isLoading ||
    sessions.isLoading;
  const noResults =
    enabled &&
    !isLoading &&
    profileHits.length === 0 &&
    skillHits.length === 0 &&
    projectHits.length === 0 &&
    libraryHits.length === 0 &&
    postHits.length === 0 &&
    sessionHits.length === 0;

  function flatItems() {
    const items: Array<{ type: string }> = [];
    profileHits.forEach(() => items.push({ type: "profile" }));
    skillHits.forEach(() => items.push({ type: "skill" }));
    projectHits.forEach(() => items.push({ type: "project" }));
    libraryHits.forEach(() => items.push({ type: "library" }));
    postHits.forEach(() => items.push({ type: "post" }));
    sessionHits.forEach(() => items.push({ type: "session" }));
    return items;
  }

  const flat = flatItems();

  function resultOffset(type: string): number {
    for (let i = 0; i < flat.length; i++) {
      if (flat[i].type === type) return i;
    }
    return flat.length;
  }

  function isSelected(type: string, idx: number): boolean {
    return selectedIndex === resultOffset(type) + idx;
  }

  function totalResults(): number {
    return flat.length;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const total = totalResults();
    if (total === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      activateItem(selectedIndex);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function activateItem(index: number) {
    const allHits: Array<{ to: () => { to: string; params?: Record<string, string> } | null }> = [
      ...profileHits.map((h) => ({
        to: () => (h.handle ? { to: "/u/$handle" as const, params: { handle: h.handle } } : null),
      })),
      ...skillHits.map((h) => ({
        to: () => ({
          to: "/skills/$slug" as const,
          params: {
            slug: h.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, ""),
          },
        }),
      })),
      ...projectHits.map(() => ({ to: () => ({ to: "/explore" as const }) })),
      ...libraryHits.map((h) => ({
        to: () => ({ to: "/library/$id" as const, params: { id: h.id } }),
      })),
      ...postHits.map(() => ({ to: () => ({ to: "/community" as const }) })),
      ...sessionHits.map((h) => ({
        to: () => ({ to: "/sessions/$id" as const, params: { id: h.id } }),
      })),
    ];
    const hit = allHits[index];
    if (!hit) return;
    const route = hit.to();
    if (!route) return;
    setQ("");
    setOpen(false);
    navigate(route as any);
  }

  function renderResults() {
    let idx = 0;
    const items: React.ReactNode[] = [];

    function sectionHeader(label: string) {
      return (
        <p
          key={`header-${label}`}
          className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </p>
      );
    }

    if (profileHits.length > 0) {
      items.push(sectionHeader("People"));
      profileHits.forEach((p) => {
        const i = idx++;
        items.push(
          <button
            key={`profile-${p.id}`}
            disabled={!p.handle}
            onClick={() => activateItem(i)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface disabled:opacity-50 ${isSelected("profile", i - resultOffset("profile")) ? "bg-surface" : ""}`}
          >
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm" title={p.display_name || p.handle || undefined}>{p.display_name || p.handle || "Untitled member"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[p.creator_title, p.category].filter(Boolean).join("·") || "—"}
              </p>
            </div>
          </button>,
        );
      });
    }

    if (skillHits.length > 0) {
      items.push(sectionHeader("Skills"));
      skillHits.forEach((s) => {
        const i = idx++;
        items.push(
          <button
            key={`skill-${s.id}`}
            onClick={() => activateItem(i)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface ${isSelected("skill", i - resultOffset("skill")) ? "bg-surface" : ""}`}
          >
            <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm" title={s.name}>{s.name}</p>
              <p className="truncate text-xs text-muted-foreground">{s.category}</p>
            </div>
          </button>,
        );
      });
    }

    if (projectHits.length > 0) {
      items.push(sectionHeader("Projects"));
      projectHits.forEach((p) => {
        const i = idx++;
        items.push(
          <button
            key={`project-${p.id}`}
            onClick={() => activateItem(i)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface ${isSelected("project", i - resultOffset("project")) ? "bg-surface" : ""}`}
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm">{p.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.description?.slice(0, 80) || "—"}
              </p>
            </div>
          </button>,
        );
      });
    }

    if (libraryHits.length > 0) {
      items.push(sectionHeader("Library"));
      libraryHits.forEach((l) => {
        const i = idx++;
        items.push(
          <button
            key={`library-${l.id}`}
            onClick={() => activateItem(i)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface ${isSelected("library", i - resultOffset("library")) ? "bg-surface" : ""}`}
          >
            <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm" title={l.title}>{l.title}</p>
              <p className="truncate text-xs text-muted-foreground">{l.type}</p>
            </div>
          </button>,
        );
      });
    }

    if (postHits.length > 0) {
      items.push(sectionHeader("Community Posts"));
      postHits.forEach((p) => {
        const i = idx++;
        items.push(
          <button
            key={`post-${p.id}`}
            onClick={() => activateItem(i)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface ${isSelected("post", i - resultOffset("post")) ? "bg-surface" : ""}`}
          >
            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm">{p.title}</p>
              <p className="truncate text-xs text-muted-foreground">{p.type}</p>
            </div>
          </button>,
        );
      });
    }

    if (sessionHits.length > 0) {
      items.push(sectionHeader("Sessions"));
      sessionHits.forEach((s) => {
        const i = idx++;
        items.push(
          <button
            key={`session-${s.id}`}
            onClick={() => activateItem(i)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface ${isSelected("session", i - resultOffset("session")) ? "bg-surface" : ""}`}
          >
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm">{s.title}</p>
              <p className="truncate text-xs text-muted-foreground">{s.session_type || "—"}</p>
            </div>
          </button>,
        );
      });
    }

    if (isLoading) {
      items.push(
        <p key="loading" className="px-3 py-2 text-xs text-muted-foreground">
          Searching…
        </p>,
      );
    }

    if (noResults) {
      items.push(
        <p key="no-results" className="px-3 py-4 text-center text-sm text-muted-foreground">
          No results for "{debounced}".
        </p>,
      );
    }

    return items;
  }

  if (variant === "inline") {
    return (
      <div ref={rootRef} className={`relative ${className ?? ""}`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => q && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search the network…"
            className="h-9 rounded-xl border-border/40 bg-background/40 pl-9 text-xs placeholder:text-xs"
          />
        </div>
        {open && enabled && (
          <div className="absolute left-0 right-0 top-11 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
            {renderResults()}
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <div className="flex items-center border-b border-border/60 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search the network…"
            className="h-12 border-0 bg-transparent px-3 text-base shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-1 pb-2">
          {enabled ? (
            renderResults()
          ) : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Search people, skills, projects, library items, community posts, and sessions…
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
