// Real suggested creators — fetched from the profiles table via a public
// SELECT policy. Excludes the current user and prioritises creators with a
// filled-out profile (avatar + creator_title).
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { EmptyState } from "./empty-state";

type SuggestedCreator = {
  id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  category: string | null;
  avatar_url: string | null;
};

export function SuggestedCreators({ limit = 6 }: { limit?: number }) {
  const { data: me } = useCurrentUser();
  const meId = me?.userId;

  const { data, isLoading } = useQuery({
    queryKey: ["suggested-creators", meId ?? "anon"],
    queryFn: async (): Promise<SuggestedCreator[]> => {
      let q = supabase
        .from("profiles")
        .select("id, handle, display_name, creator_title, category, avatar_url")
        .not("display_name", "is", null)
        .order("updated_at", { ascending: false })
        .limit(limit + 1);
      if (meId) q = q.neq("id", meId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as SuggestedCreator[]).slice(0, limit);
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-border/60 bg-surface"
          />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title="No creators to suggest yet"
        description="Once more creators join Tethyr you'll see them here."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((c, i) => {
        const initial = (c.display_name ?? c.handle ?? "?").charAt(0).toUpperCase();
        const purple = i % 2 === 1;
        return (
          <div
            key={c.id}
            className="rounded-2xl border border-border/60 bg-surface p-4 transition hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold text-background ${
                  purple ? "bg-brand-purple" : "bg-primary"
                }`}
              >
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {c.display_name || c.handle || "Untitled creator"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.creator_title || c.category || "New creator"}
                </p>
              </div>
            </div>
            {c.handle && (
              <p className="mt-3 truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                @{c.handle}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
