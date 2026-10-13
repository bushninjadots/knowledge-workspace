// What the community says about a project: every post that carries it, with
// the best replies brought back to the project page — the solution first,
// then the most-thanked — so feedback lands where the work is. Contributors
// can ask for more from here (AskFeedbackDialog).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Heart, MessageCircle, MessageSquarePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AskFeedbackDialog,
  type FeedbackProject,
} from "@/components/tethyr/project/ask-feedback-dialog";
import { isAsk } from "@/hooks/use-community-help";
import { timeAgo } from "@/lib/time";

const sb = supabase;

const POST_TYPE_LABEL: Record<string, string> = {
  showcase: "Showcase",
  question: "Question",
  project_update: "Update",
  tutorial: "Tutorial",
  resource: "Resource",
  achievement: "Achievement",
  discussion: "Discussion",
  help_request: "Help",
  collaboration_request: "Collab",
  progress_update: "Progress",
  lesson_learned: "Lesson",
  feedback_request: "Feedback",
  open_role: "Open Role",
  poll: "Poll",
};

/** Replies shown per post on the project page. */
const PREVIEW_REPLIES = 2;

type Person = { display_name: string | null; handle: string | null };

type ReplyPreview = {
  id: string;
  body: string;
  is_best_answer: boolean;
  created_at: string;
  thanks: number;
  author: Person;
};

type ProjectPost = {
  id: string;
  title: string;
  type: string;
  created_at: string;
  space_slug: string | null;
  author: Person;
  replyCount: number;
  solved: boolean;
  replies: ReplyPreview[];
};

const nameOf = (p: Person | undefined) => p?.display_name || p?.handle || "Someone";

/** Solution first, then most thanked, then newest. */
export function rankReplies<
  T extends { is_best_answer: boolean; thanks: number; created_at: string },
>(replies: T[]): T[] {
  return [...replies].sort(
    (a, b) =>
      Number(b.is_best_answer) - Number(a.is_best_answer) ||
      b.thanks - a.thanks ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

async function fetchProjectPosts(projectId: string): Promise<ProjectPost[]> {
  const { data: raw, error } = await sb
    .from("posts")
    .select("id, title, type, author_id, space_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  const posts = raw ?? [];
  if (posts.length === 0) return [];
  const postIds = posts.map((p) => p.id);
  const spaceIds = [...new Set(posts.map((p) => p.space_id).filter(Boolean))] as string[];

  const [{ data: comments }, { data: kudos }, { data: spaces }] = await Promise.all([
    sb
      .from("comments")
      .select("id, post_id, author_id, body, is_best_answer, created_at, parent_id")
      .in("post_id", postIds)
      .order("created_at", { ascending: true })
      .limit(300),
    sb.from("community_kudos").select("comment_id").in("post_id", postIds),
    spaceIds.length
      ? sb.from("community_spaces").select("id, slug").in("id", spaceIds)
      : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
  ]);

  const authorIds = [
    ...new Set([...posts.map((p) => p.author_id), ...(comments ?? []).map((c) => c.author_id)]),
  ];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, display_name, handle")
    .in("id", authorIds);
  const people = new Map((profiles ?? []).map((p) => [p.id, p as Person]));
  const slugs = new Map((spaces ?? []).map((s) => [s.id, s.slug]));
  const thanksBy = new Map<string, number>();
  for (const k of kudos ?? []) thanksBy.set(k.comment_id, (thanksBy.get(k.comment_id) ?? 0) + 1);

  return posts.map((post) => {
    const own = (comments ?? []).filter((c) => c.post_id === post.id);
    const topLevel = own
      .filter((c) => !c.parent_id)
      .map((c): ReplyPreview => ({
        id: c.id,
        body: c.body,
        is_best_answer: c.is_best_answer,
        created_at: c.created_at,
        thanks: thanksBy.get(c.id) ?? 0,
        author: people.get(c.author_id) ?? { display_name: null, handle: null },
      }));
    return {
      id: post.id,
      title: post.title,
      type: post.type,
      created_at: post.created_at,
      space_slug: post.space_id ? (slugs.get(post.space_id) ?? null) : null,
      author: people.get(post.author_id) ?? { display_name: null, handle: null },
      replyCount: own.length,
      solved: own.some((c) => c.is_best_answer),
      replies: rankReplies(topLevel).slice(0, PREVIEW_REPLIES),
    };
  });
}

export function ProjectCommunityPosts({
  projectId,
  project,
  canAsk = false,
}: {
  projectId: string;
  /** Needed to ask for feedback; omit to show the list only. */
  project?: FeedbackProject;
  canAsk?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["project-community-posts", projectId],
    queryFn: () => fetchProjectPosts(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
  const showAsk = canAsk && !!project;

  return (
    <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
          <MessageCircle className="h-4 w-4" aria-hidden />
          From the community
        </div>
        {showAsk && (
          <Button size="sm" variant="outline" onClick={() => setAsking(true)}>
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
            Ask for feedback
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading community posts…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showAsk
            ? "Nobody's talking about this project yet. Ask for feedback — replies land right here."
            : "No community posts about this project yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li key={post.id} className="rounded-xl p-2">
              <Link
                to="/community"
                search={
                  {
                    post: post.id,
                    ...(post.space_slug ? { space: post.space_slug } : {}),
                  } as Record<string, string>
                }
                className="group flex items-center gap-3"
              >
                <span className="shrink-0 rounded-full border border-border/60 px-1.5 py-0 text-[11px] text-muted-foreground">
                  {POST_TYPE_LABEL[post.type] ?? post.type}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:underline">
                  {post.title}
                </span>
                {post.solved && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-trust">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    Solved
                  </span>
                )}
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" aria-hidden />
                  {timeAgo(post.created_at)}
                </span>
              </Link>
              <p className="mt-0.5 pl-0.5 text-[11px] text-muted-foreground">
                {nameOf(post.author)} ·{" "}
                {post.replyCount === 0
                  ? isAsk(post.type)
                    ? "waiting for replies"
                    : "no replies yet"
                  : `${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}`}
              </p>
              {post.replies.length > 0 && (
                <ul className="mt-2 space-y-1.5 border-l-2 border-border/50 pl-3">
                  {post.replies.map((reply) => (
                    <li key={reply.id} className="text-sm">
                      <p className="line-clamp-2 text-foreground/90">{reply.body}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/80">
                          {nameOf(reply.author)}
                        </span>
                        {reply.is_best_answer && (
                          <span className="inline-flex items-center gap-1 font-medium text-trust">
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                            Solution
                          </span>
                        )}
                        {reply.thanks > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3 w-3 fill-current text-caution" aria-hidden />
                            {reply.thanks} thanked
                          </span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {showAsk && project && (
        <AskFeedbackDialog project={project} open={asking} onOpenChange={setAsking} />
      )}
    </div>
  );
}
