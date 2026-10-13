// A skill's community: open asks tagged with it that still need an answer,
// and the spaces where people who work in it gather. Turns a skill page from
// a directory into somewhere to help.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, HelpCircle, MessagesSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ASK_TYPES } from "@/hooks/use-community-help";
import { fetchPostEngagement } from "@/lib/post-engagement";
import { timeAgo } from "@/lib/time";

const sb = supabase;
const OPEN_ASKS_SHOWN = 5;
const SPACES_SHOWN = 4;

const ASK_LABEL: Record<string, string> = {
  question: "Question",
  help_request: "Help",
  feedback_request: "Feedback",
};

type OpenAsk = {
  id: string;
  title: string;
  type: string;
  created_at: string;
  space_slug: string | null;
  replies: number;
  author: string;
};

type SkillSpace = { id: string; slug: string; name: string; tagline: string | null };

/** A space is "for" a skill when one of its topics names it. */
export function topicMatchesSkill(topic: string, skill: { slug: string; name: string }) {
  const t = topic.trim().toLowerCase();
  return t === skill.name.toLowerCase() || t.replace(/\s+/g, "-") === skill.slug.toLowerCase();
}

function useOpenAsks(slug: string) {
  return useQuery({
    queryKey: ["skill-open-asks", slug],
    staleTime: 60_000,
    queryFn: async (): Promise<OpenAsk[]> => {
      const { data, error } = await sb
        .from("posts")
        .select(
          "id, title, type, created_at, space_id, author:profiles!author_id(display_name, handle)",
        )
        .contains("skills", [slug])
        .in("type", [...ASK_TYPES] as ("question" | "help_request" | "feedback_request")[])
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];
      const engagement = await fetchPostEngagement(rows.map((r) => r.id));
      const spaceIds = [...new Set(rows.map((r) => r.space_id).filter(Boolean))] as string[];
      const { data: spaces } = spaceIds.length
        ? await sb.from("community_spaces").select("id, slug").in("id", spaceIds)
        : { data: [] as { id: string; slug: string }[] };
      const slugs = new Map((spaces ?? []).map((s) => [s.id, s.slug]));
      return rows
        .filter((r) => !engagement.get(r.id)?.solved)
        .slice(0, OPEN_ASKS_SHOWN)
        .map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          created_at: r.created_at,
          space_slug: r.space_id ? (slugs.get(r.space_id) ?? null) : null,
          replies: engagement.get(r.id)?.comment_count ?? 0,
          author:
            (r.author as { display_name: string | null; handle: string | null } | null)
              ?.display_name ?? "Someone",
        }));
    },
  });
}

function useSkillSpaces(skill: { slug: string; name: string }) {
  return useQuery({
    queryKey: ["skill-spaces", skill.slug],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SkillSpace[]> => {
      const { data, error } = await sb
        .from("community_spaces")
        .select("id, slug, name, tagline, topics")
        .eq("visibility", "public")
        .not("topics", "eq", "{}")
        .limit(200);
      if (error) throw error;
      return (data ?? [])
        .filter((s) => (s.topics ?? []).some((t: string) => topicMatchesSkill(t, skill)))
        .slice(0, SPACES_SHOWN)
        .map(({ id, slug, name, tagline }) => ({ id, slug, name, tagline }));
    },
  });
}

export function SkillCommunity({ skillSlug, skillName }: { skillSlug: string; skillName: string }) {
  const { data: asks = [] } = useOpenAsks(skillSlug);
  const { data: spaces = [] } = useSkillSpaces({ slug: skillSlug, name: skillName });

  return (
    <section aria-labelledby="overview-community" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-caution" aria-hidden="true" />
          <h3 id="overview-community" className="font-display text-base font-semibold">
            Help someone with {skillName}
          </h3>
        </div>
        <Link
          to="/community"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Ask about {skillName}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {asks.length > 0 ? (
        <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/40 bg-surface/40">
          {asks.map((ask) => (
            <li key={ask.id}>
              <Link
                to="/community"
                search={
                  (ask.space_slug
                    ? { post: ask.id, space: ask.space_slug }
                    : { post: ask.id }) as Record<string, string>
                }
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-sunken"
              >
                <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--caution)_16%,transparent)] px-2 py-0.5 text-[11px] font-medium">
                  {ASK_LABEL[ask.type] ?? "Ask"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{ask.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {ask.author} · {timeAgo(ask.created_at)} ·{" "}
                    {ask.replies === 0
                      ? "no replies yet"
                      : `${ask.replies} ${ask.replies === 1 ? "reply" : "replies"}, not solved`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No open questions about {skillName} right now.
        </p>
      )}

      {spaces.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
            Spaces for {skillName}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {spaces.map((space) => (
              <li key={space.id}>
                <Link
                  to="/community"
                  search={{ space: space.slug } as Record<string, string>}
                  className="block rounded-xl border border-border/40 bg-surface/40 px-3 py-2.5 transition-colors hover:bg-surface-sunken"
                >
                  <span className="block truncate text-sm font-medium">{space.name}</span>
                  {space.tagline && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {space.tagline}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
