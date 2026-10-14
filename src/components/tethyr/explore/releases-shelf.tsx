// Explore's "Launching soon" (live countdowns) and "Just shipped" (the last
// 30 days) — public projects whose owner chose to list their release.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Rocket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { countdownLabel } from "@/lib/release";
import { timeAgo } from "@/lib/time";

type ReleaseRow = {
  id: string;
  title: string;
  description: string | null;
  release_at: string;
  profiles: { display_name: string | null; handle: string | null } | null;
};

const SELECT =
  "id, title, description, release_at, profiles!projects_profile_id_fkey(display_name, handle)";

function useReleases() {
  return useQuery({
    queryKey: ["explore-releases"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const base = () =>
        supabase
          .from("projects")
          .select(SELECT)
          .eq("visibility", "public")
          .eq("release_public", true)
          .not("release_at", "is", null);
      const [soon, shipped] = await Promise.all([
        base().gt("release_at", now).order("release_at", { ascending: true }).limit(6),
        base()
          .lte("release_at", now)
          .gte("release_at", monthAgo)
          .order("release_at", { ascending: false })
          .limit(6),
      ]);
      return {
        soon: (soon.data ?? []) as unknown as ReleaseRow[],
        shipped: (shipped.data ?? []) as unknown as ReleaseRow[],
      };
    },
    staleTime: 60_000,
  });
}

function Row({ project, upcoming, now }: { project: ReleaseRow; upcoming: boolean; now: number }) {
  const by = project.profiles?.display_name || project.profiles?.handle;
  return (
    <li>
      <Link
        to="/projects/$id"
        params={{ id: project.id }}
        className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-elevated"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{project.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {by ? `by ${by}` : project.description}
          </span>
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {upcoming ? countdownLabel(project.release_at, now) : timeAgo(project.release_at)}
        </span>
      </Link>
    </li>
  );
}

export function ReleasesShelf() {
  const { data } = useReleases();
  const [now, setNow] = useState(() => Date.now());
  const hasSoon = (data?.soon.length ?? 0) > 0;
  useEffect(() => {
    if (!hasSoon) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasSoon]);
  if (!data || (!data.soon.length && !data.shipped.length)) return null;
  return (
    <div className="mb-6 grid gap-4 md:grid-cols-2">
      {data.soon.length > 0 && (
        <section aria-labelledby="launching-soon" className="surface-card p-4">
          <h2 id="launching-soon" className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
            Launching soon
          </h2>
          <ul className="mt-2">
            {data.soon.map((p) => (
              <Row key={p.id} project={p} upcoming now={now} />
            ))}
          </ul>
        </section>
      )}
      {data.shipped.length > 0 && (
        <section aria-labelledby="just-shipped" className="surface-card p-4">
          <h2 id="just-shipped" className="flex items-center gap-2 text-sm font-semibold">
            <Rocket className="h-4 w-4 text-caution" aria-hidden />
            Just shipped
          </h2>
          <ul className="mt-2">
            {data.shipped.map((p) => (
              <Row key={p.id} project={p} upcoming={false} now={now} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
