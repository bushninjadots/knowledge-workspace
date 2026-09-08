import { supabase } from "@/integrations/supabase/client";

const sb = supabase;

type PostEngagement = {
  likes: number;
  helpful: number;
  saves: number;
  offers: number;
  comment_count: number;
  myActions: string[];
};

/**
 * Fetch engagement totals for a bounded set of posts. The aggregate RPC keeps
 * high-volume action/comment rows in Postgres; the fallback preserves
 * compatibility with databases that have not applied the performance
 * migration yet.
 */
export async function fetchPostEngagement(
  postIds: string[],
  userId?: string | null,
): Promise<Map<string, PostEngagement>> {
  const result = new Map<string, PostEngagement>();
  if (postIds.length === 0) return result;

  const rpc = sb.rpc;
  const { data: aggregated, error: aggregateError } =
    typeof rpc === "function"
      ? await rpc("post_engagement_counts", { p_post_ids: postIds })
      : { data: null, error: new Error("RPC unavailable") };
  if (!aggregateError && aggregated) {
    for (const row of aggregated) {
      result.set(row.post_id, {
        likes: Number(row.likes),
        helpful: Number(row.helpful),
        saves: Number(row.saves),
        offers: Number(row.offers),
        comment_count: Number(row.comment_count),
        myActions: row.user_actions ?? [],
      });
    }
    return result;
  }

  const [{ data: rawActions }, { data: rawComments }] = await Promise.all([
    sb.from("post_actions").select("post_id, action, user_id").in("post_id", postIds),
    sb.from("comments").select("post_id").in("post_id", postIds),
  ]);
  const resolvedUserId =
    userId === undefined ? (await supabase.auth.getUser()).data.user?.id : userId;

  for (const postId of postIds) {
    result.set(postId, {
      likes: 0,
      helpful: 0,
      saves: 0,
      offers: 0,
      comment_count: 0,
      myActions: [],
    });
  }
  for (const action of (rawActions ?? []) as {
    post_id: string;
    action: string;
    user_id: string;
  }[]) {
    const engagement = result.get(action.post_id);
    if (!engagement) continue;
    if (action.action === "like") engagement.likes++;
    if (action.action === "helpful") engagement.helpful++;
    if (action.action === "save") engagement.saves++;
    if (action.action === "offer") engagement.offers++;
    if (action.user_id === resolvedUserId) engagement.myActions.push(action.action);
  }
  for (const comment of (rawComments ?? []) as { post_id: string }[]) {
    const engagement = result.get(comment.post_id);
    if (engagement) engagement.comment_count++;
  }
  return result;
}
