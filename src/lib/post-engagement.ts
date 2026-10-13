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

/** One row of the `post_engagement_counts` aggregate. */
type EngagementCountRow = {
  post_id: string;
  likes: number | string;
  helpful: number | string;
  saves: number | string;
  offers: number | string;
  comment_count: number | string;
  user_actions: string[] | null;
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

  // Call through the client. `sb.rpc` is a bound method — detaching it into a
  // local (`const rpc = sb.rpc`) and calling that throws, because it reads
  // `this.rest`. That throw rejected every caller's query, which is why the
  // community feed, space rooms, and following feed all rendered empty despite
  // the posts query itself returning rows. Called via `sb.` with a fallback.
  let aggregated: EngagementCountRow[] | null = null;
  let aggregateError: Error | null = null;
  try {
    const response = await sb.rpc("post_engagement_counts", { p_post_ids: postIds });
    aggregated = response.data as EngagementCountRow[] | null;
    aggregateError = response.error;
  } catch (error) {
    aggregateError = error as Error;
  }
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
