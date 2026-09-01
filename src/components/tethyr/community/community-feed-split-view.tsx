import { memo } from "react";
import { MessageCircle, X } from "lucide-react";
import { useComments, type PostWithAuthor } from "@/hooks/use-community";
import { POST_TYPE_LABEL } from "@/lib/community-data";
import { CommentThreadInline } from "@/components/tethyr/community/post-comments";
import { PostCard } from "@/components/tethyr/community/post-card";
import type { CommunityNavId } from "@/components/tethyr/community/left-sidebar";
import type { SortMode } from "@/components/tethyr/community/community-header";
import type { CommunitySpace } from "@/hooks/use-community-spaces";

function PostRowCompact({
  post,
  selected,
  searchQuery,
  onSelect,
}: {
  post: PostWithAuthor;
  selected: boolean;
  searchQuery?: string;
  onSelect: () => void;
}) {
  const authorName = post.author.display_name || post.author.handle || "Unknown";
  const excerpt = post.body
    .replace(/[#*_`>\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={`w-full border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-surface-elevated/70 ${
        selected ? "bg-surface-elevated" : "bg-transparent"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-green text-xs font-semibold text-background">
          {authorName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium">{authorName}</span>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {POST_TYPE_LABEL[post.type]}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {highlightExcerpt(post.title || excerpt, searchQuery)}
          </p>
          {post.title && excerpt && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{excerpt}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{post.stats.likes} appreciation</span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" /> {post.stats.comment_count}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function highlightExcerpt(text: string, query?: string) {
  if (!query?.trim()) return text;
  const normalized = query.trim();
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${escaped})`, "gi")).map((part, index) =>
    part.toLowerCase() === normalized.toLowerCase() ? (
      <mark key={index} className="rounded bg-primary/20 px-0.5 text-primary">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

const CompactRow = memo(PostRowCompact);

export function CommunityFeedSplitView({
  posts,
  selectedPostId,
  searchQuery,
  nav: _nav,
  sortMode,
  mySkillNames,
  activeSpace,
  reportedPostCounts,
  onSelectPost,
  onClose,
  onToggleComments,
  onDelete,
  onEdit,
  onToggleAction,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  posts: PostWithAuthor[];
  selectedPostId: string;
  searchQuery?: string;
  nav: CommunityNavId;
  sortMode: SortMode;
  mySkillNames: Set<string>;
  activeSpace?: CommunitySpace;
  reportedPostCounts?: Map<string, number>;
  onSelectPost: (id: string) => void;
  onClose: () => void;
  onToggleComments: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (post: PostWithAuthor) => void;
  onToggleAction: (id: string, action: "like" | "helpful" | "save" | "offer") => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  const selectedPost = posts.find((post) => post.id === selectedPostId);
  const { data: comments = [] } = useComments(selectedPost?.id ?? "");

  if (!selectedPost) return null;

  const canModerate =
    !!activeSpace && (activeSpace.my_role === "owner" || activeSpace.my_role === "moderator");
  const overlap =
    sortMode === "recommended"
      ? selectedPost.skills.filter((skill) => mySkillNames.has(skill.toLowerCase())).length
      : undefined;

  return (
    <div className="hidden min-h-[min(72vh,760px)] grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] overflow-hidden rounded-xl border card-border bg-surface/30 lg:grid">
      <aside className="min-h-0 overflow-y-auto border-r border-border/60" aria-label="Posts">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-surface/95 px-4 py-3 backdrop-blur-sm">
          <div>
            <p className="section-label">Reading list</p>
            <p className="mt-1 text-xs text-muted-foreground">{posts.length} loaded posts</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            aria-label="Close reading mode"
            title="Close reading mode"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {posts.map((post) => (
          <CompactRow
            key={post.id}
            post={post}
            selected={post.id === selectedPostId}
            searchQuery={searchQuery}
            onSelect={() => onSelectPost(post.id)}
          />
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full px-4 py-3 text-xs font-medium text-primary hover:bg-surface-elevated disabled:opacity-50"
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </aside>

      <section className="min-w-0 overflow-y-auto" aria-label="Selected post">
        <div className="p-4 sm:p-6">
          <PostCard
            post={selectedPost}
            searchQuery={searchQuery}
            comments={comments}
            showComments
            onToggleComments={() => onToggleComments(selectedPost.id)}
            onDelete={() => onDelete(selectedPost.id)}
            onEdit={() => onEdit(selectedPost)}
            onToggleAction={(action) => onToggleAction(selectedPost.id, action)}
            skillOverlap={overlap}
            canModerate={canModerate}
            reportCount={canModerate ? (reportedPostCounts?.get(selectedPost.id) ?? 0) : undefined}
            dimThreshold={activeSpace?.report_auto_dim_threshold ?? 3}
          />
          <CommentThreadInline
            postId={selectedPost.id}
            comments={comments}
            isQuestion={selectedPost.type === "question"}
          />
        </div>
      </section>
    </div>
  );
}
