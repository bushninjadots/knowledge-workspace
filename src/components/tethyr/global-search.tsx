// Reusable global search. Currently searches creators (display_name, handle,
// category) and the skill catalog. Extend by adding another `useQuery` block
// and rendering it in the results panel.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search, User, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type ProfileHit = {
  id: string;
  handle: string | null;
  display_name: string | null;
  category: string | null;
  creator_title: string | null;
};
type SkillHit = { id: string; name: string; category: string };

function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function GlobalSearch({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q.trim(), 200);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const enabled = debounced.length >= 1;
  const like = `%${debounced}%`;

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
        .limit(6);
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
        .limit(6);
      if (error) throw error;
      return (data ?? []) as SkillHit[];
    },
  });

  const profileHits = profiles.data ?? [];
  const skillHits = skills.data ?? [];
  const noResults =
    enabled && !profiles.isLoading && !skills.isLoading && profileHits.length === 0 && skillHits.length === 0;

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => q && setOpen(true)}
        placeholder="Search creators, skills, categories…"
        className="h-10 rounded-full border-border/60 bg-surface/60 pl-9"
        aria-label="Global search"
      />

      {open && enabled && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
          {(profiles.isLoading || skills.isLoading) && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          )}

          {profileHits.length > 0 && (
            <div className="mb-1">
              <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Creators
              </p>
              {profileHits.map((p) => (
                <button
                  key={p.id}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {p.display_name || p.handle || "Untitled creator"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.creator_title, p.category].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {skillHits.length > 0 && (
            <div>
              <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Skills
              </p>
              {skillHits.map((s) => (
                <button
                  key={s.id}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface"
                >
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.category}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {noResults && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results for "{debounced}".
            </p>
          )}
        </div>
      )}
    </div>
  );
}
