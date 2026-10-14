// Who can see this project: Public / Crew only / Selected people / Private.
// "Selected people" picks members by name or handle; "Crew only" shows which
// crews that means. The share list is saved by syncProjectViewers() once the
// project exists.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MemberAvatar } from "@/components/tethyr/member-avatar";
import { PROJECT_ACCESS, type ProjectAccess } from "@/lib/project-access";
import { ilikeOrFilter } from "@/lib/search";
import { cn } from "@/lib/utils";

export type Viewer = { id: string; name: string; handle: string | null; avatar_url: string | null };

/** The people a project is shared with. */
export function useProjectViewers(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-viewers", projectId ?? ""],
    queryFn: async (): Promise<Viewer[]> => {
      const { data, error } = await supabase
        .from("project_viewers")
        .select("profile:profiles!profile_id(id, display_name, handle, avatar_url)")
        .eq("project_id", projectId!);
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const p = (
          row as unknown as {
            profile: {
              id: string;
              display_name: string | null;
              handle: string | null;
              avatar_url: string | null;
            } | null;
          }
        ).profile;
        return p
          ? [
              {
                id: p.id,
                name: p.display_name || p.handle || "Member",
                handle: p.handle,
                avatar_url: p.avatar_url,
              },
            ]
          : [];
      });
    },
    enabled: !!projectId,
  });
}

/** Make the share list match `next` (adds and removes only the difference). */
export async function syncProjectViewers(projectId: string, previous: string[], next: string[]) {
  const add = next.filter((id) => !previous.includes(id));
  const remove = previous.filter((id) => !next.includes(id));
  if (remove.length)
    await supabase
      .from("project_viewers")
      .delete()
      .eq("project_id", projectId)
      .in("profile_id", remove);
  if (add.length)
    await supabase
      .from("project_viewers")
      .insert(add.map((profile_id) => ({ project_id: projectId, profile_id })));
}

function useCrews(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-crews", projectId ?? ""],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_projects")
        .select("team:teams(id, name, slug)")
        .eq("project_id", projectId!);
      return (data ?? [])
        .map((r) => (r as unknown as { team: { id: string; name: string } | null }).team)
        .filter((t): t is { id: string; name: string } => !!t);
    },
    enabled: !!projectId,
  });
}

export function ProjectAccessField({
  value,
  onChange,
  projectId,
  ownerId,
  viewers,
  onViewersChange,
}: {
  value: ProjectAccess;
  onChange: (value: ProjectAccess) => void;
  projectId?: string | null;
  ownerId: string;
  viewers: Viewer[];
  onViewersChange: (viewers: Viewer[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const { data: crews } = useCrews(value === "crew" ? projectId : null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const { data: matches } = useQuery({
    queryKey: ["member-search", debounced],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .or(ilikeOrFilter(["display_name", "handle"], debounced))
        .neq("id", ownerId)
        .limit(8);
      return (data ?? []) as {
        id: string;
        display_name: string | null;
        handle: string | null;
        avatar_url: string | null;
      }[];
    },
    enabled: value === "people" && debounced.length >= 2,
  });

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Who can see it" className="grid gap-1.5 sm:grid-cols-2">
        {PROJECT_ACCESS.map((a) => (
          <button
            key={a.value}
            type="button"
            role="radio"
            aria-checked={value === a.value}
            onClick={() => onChange(a.value)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-colors",
              value === a.value
                ? "border-border-strong bg-surface-elevated"
                : "border-border/60 hover:border-border-strong",
            )}
          >
            <span className="block text-xs font-medium">{a.label}</span>
            <span className="block text-[11px] text-muted-foreground">{a.help}</span>
          </button>
        ))}
      </div>

      {value === "crew" && (
        <p className="text-[11px] text-muted-foreground">
          {crews?.length
            ? `Visible to members of ${crews.map((c) => c.name).join(", ")}.`
            : projectId
              ? "This project isn't in a crew yet — add it from your crew's page, or only contributors will see it."
              : "After you create it, add the project to a crew from the crew's page."}
        </p>
      )}

      {value === "people" && (
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          {viewers.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {viewers.map((v) => (
                <li
                  key={v.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 py-0.5 pr-1 pl-0.5 text-xs"
                >
                  <MemberAvatar name={v.name} avatarPath={v.avatar_url} className="h-5 w-5" />
                  {v.name}
                  <button
                    type="button"
                    aria-label={`Stop sharing with ${v.name}`}
                    onClick={() => onViewersChange(viewers.filter((x) => x.id !== v.id))}
                    className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Add people by name or @handle"
              aria-label="Add people"
              className="h-8 w-full rounded-md border border-input bg-background/60 pl-8 pr-2 text-sm outline-none focus:border-ring"
            />
          </div>
          {(matches ?? [])
            .filter((m) => !viewers.some((v) => v.id === m.id))
            .map((m) => {
              const name = m.display_name || m.handle || "Member";
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onViewersChange([
                      ...viewers,
                      { id: m.id, name, handle: m.handle, avatar_url: m.avatar_url },
                    ]);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-elevated"
                >
                  <MemberAvatar name={name} avatarPath={m.avatar_url} className="h-6 w-6" />
                  <span className="font-medium">{name}</span>
                  {m.handle && <span className="text-muted-foreground">@{m.handle}</span>}
                </button>
              );
            })}
          {viewers.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Nobody added yet — until you add someone, only you and contributors can see it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
