import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

type ProjectMatch = { id: string; title: string };

/**
 * A lightweight project picker for linking lineage (previous/next project).
 * Searches the owner's projects by title instead of asking for a raw UUID,
 * so the link is discoverable and can't silently point at a dead ID.
 */
export function ProjectLinkPicker({
  value,
  onChange,
  placeholder,
  ariaLabel,
  excludeProjectId,
  ownerId,
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  placeholder: string;
  ariaLabel: string;
  excludeProjectId: string;
  ownerId: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: selected } = useQuery({
    queryKey: ["project-link-title", value],
    queryFn: async () => {
      if (!value) return null;
      const { data } = await supabase
        .from("projects")
        .select("id, title")
        .eq("id", value)
        .maybeSingle();
      return (data as ProjectMatch | null) ?? null;
    },
    enabled: !!value,
  });

  const { data: results = [] } = useQuery({
    queryKey: ["project-link-search", ownerId, query],
    queryFn: async () => {
      const trimmed = query.trim();
      if (trimmed.length < 2) return [];
      const { data } = await supabase
        .from("projects")
        .select("id, title")
        .eq("profile_id", ownerId)
        .neq("id", excludeProjectId)
        .ilike("title", `%${trimmed}%`)
        .order("updated_at", { ascending: false })
        .limit(6);
      return (data ?? []) as ProjectMatch[];
    },
    enabled: open && query.trim().length >= 2,
  });

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const display = open ? query : (selected?.title ?? "");

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={display}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (!event.target.value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="pl-8 pr-8"
        />
        {value && !open && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            aria-label={`Clear ${ariaLabel}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-background shadow-sm">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No matching projects</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {results.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(project.id);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-foreground transition hover:bg-surface-elevated/60"
                  >
                    {project.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
