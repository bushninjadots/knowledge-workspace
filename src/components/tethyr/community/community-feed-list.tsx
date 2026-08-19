import { memo, type CSSProperties } from "react";
import { Heart, Search, Users, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/tethyr/empty-state";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/tethyr/community/post-card";
import { useComments, type PostWithAuthor } from "@/hooks/use-community";
import type { CommunityNavId } from "@/components/tethyr/community/left-sidebar";
import type { CommunitySpace } from "@/hooks/use-community-spaces";
import type { SortMode } from "@/components/tethyr/community/community-header";

/**
 * Memoized so the heavy PostCard (markdown parsing, hover cards, comments)
 * only re-renders when its own data changes. Handlers are keyed by post id
 * and referentially stable in the parent, so a save/comment/offer toggle on
 * one card never re-renders the rest of the feed.
 */
const PostCardWithComments = memo(function PostCardWithComments({
  post,
  searchQuery,
  showComments,
  onToggleComments,
  onDelete,
  onEdit,
  onToggleAction,
  className,
  index,
  highlighted,
  skillOverlap,
  canModerate,
  reportCount,
  dimThreshold,
}: {
  post: PostWithAuthor;
  searchQuery?: string;
  showComments: boolean;
  onToggleComments: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (post: PostWithAuthor) => void;
  onToggleAction: (id: string, action: "like" | "helpful" | "save" | "offer") => void;
  className?: string;
  /** Feed position — drives the entrance stagger delay. */
  index: number;
  highlighted?: boolean;
  skillOverlap?: number;
  /** True when the current user moderates this post's space. */
  canModerate?: boolean;
  /** Number of open reports on this post (visible to the space's moderators). */
  reportCount?: number;
  /** Report count at which a post gets auto-dimmed. */
  dimThreshold?: number;
}) {
  const { data: comments = [] } = useComments(showComments ? post.id : "");

  return (
    <div
      id={`post-${post.id}`}
      className={className}
      style={{ animationDelay: `${index * 60}ms` } as CSSProperties}
    >
      <PostCard
        post={post}
        searchQuery={searchQuery}
        comments={comments}
        showComments={showComments}
        onToggleComments={() => onToggleComments(post.id)}
        onDelete={() => onDelete(post.id)}
        onEdit={() => onEdit(post)}
        onToggleAction={(action) => onToggleAction(post.id, action)}
        highlighted={highlighted}
        skillOverlap={skillOverlap}
        canModerate={canModerate}
        reportCount={reportCount}
        dimThreshold={dimThreshold}
      />
    </div>
  );
});

function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-border animate-pulse rounded-xl border bg-surface p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-surface-elevated" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-surface-elevated" />
              <div className="h-3 w-48 rounded bg-surface-elevated" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full rounded bg-surface-elevated" />
            <div className="h-3 w-3/4 rounded bg-surface-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Memoized feed renderer. Receives the already-filtered/sorted post list plus
 * stable, id-keyed handlers, so it only re-renders when the underlying data or
 * a card's own UI state (save/comment/highlight) changes — never on unrelated
 * page state like drawer toggles.
 */
export const CommunityFeedList = memo(function CommunityFeedList({
  posts,
  loading,
  nav,
  isSearching,
  searchQuery,
  openComments,
  highlightedPostId,
  sortMode,
  mySkillNames,
  activeSpace,
  reportedPostCounts,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onToggleComments,
  onDelete,
  onEdit,
  onToggleAction,
  onClearSearch,
  onGoHome,
  focusComposer,
}: {
  /** Posts to render — pre-filtered and sorted by the feed owner. */
  posts: PostWithAuthor[];
  loading: boolean;
  nav: CommunityNavId;
  isSearching: boolean;
  /** Undefined when the following feed is shown (it is never highlighted). */
  searchQuery?: string;
  openComments: Set<string>;
  highlightedPostId: string | null;
  sortMode: SortMode;
  mySkillNames: Set<string>;
  activeSpace?: CommunitySpace;
  /** Post id → open report count — badges and dims reported posts for moderators. */
  reportedPostCounts?: Map<string, number>;
  /** Whether more posts are available beyond the current page. */
  hasMore: boolean;
  /** A subsequent page is currently loading. */
  isLoadingMore: boolean;
  /** Fetch the next page of posts. */
  onLoadMore: () => void;
  onToggleComments: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (post: PostWithAuthor) => void;
  onToggleAction: (id: string, action: "like" | "helpful" | "save" | "offer") => void;
  onClearSearch: () => void;
  onGoHome: () => void;
  focusComposer: (presetType?: string) => void;
}) {
  if (loading) return <FeedSkeleton />;

  if (posts.length === 0 && nav === "following") {
    return (
      <EmptyState
        icon={<Heart className="h-5 w-5" />}
        title="You're not following anyone yet"
        description="Follow collaborators to see their posts here. Visit a profile and click Follow to get started."
        actionLabel="Find projects & people"
        actionHref="/explore"
      />
    );
  }

  if (posts.length === 0 && isSearching) {
    return (
      <EmptyState
        icon={<Search className="h-5 w-5" />}
        title="No results found"
        description={`Nothing matches "${searchQuery}". Try different keywords — project names, skill tags, or collaborator handles.`}
        actionLabel="Clear search"
        onAction={onClearSearch}
      />
    );
  }

  if (posts.length === 0 && activeSpace) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="This space is quiet"
        description={`Say hi in ${activeSpace.name} — everyone who's joined can chat here. No post types, no titles, just hit Enter.`}
        actionLabel="Start chatting"
        onAction={focusComposer}
      />
    );
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title={
          nav === "saved"
            ? "Nothing saved yet"
            : nav === "help"
              ? "No help requests"
              : nav === "collab"
                ? "No collaboration requests"
                : nav === "showcase"
                  ? "No showcases yet"
                  : nav === "tip"
                    ? "No tips yet"
                    : nav === "discussion"
                      ? "No discussions yet"
                      : "The community is quiet"
        }
        description={
          nav === "saved"
            ? "Save a post to pin it here for quick access."
            : nav === "help"
              ? "When someone needs a hand, their request will appear here."
              : nav === "collab"
                ? "Post an open call for teammates and start building together."
                : nav === "showcase"
                  ? "Share what you've built — a project, an artifact, a milestone worth seeing."
                  : nav === "tip"
                    ? "Share a useful tip or lesson learned with the community."
                    : nav === "discussion"
                      ? "Start a conversation — an idea, a tradeoff, an open question."
                      : "Be the first to share a project update, ask a question, or request collaboration."
        }
        actionLabel={
          nav === "saved"
            ? "Discover posts"
            : nav === "help"
              ? "Ask for help"
              : nav === "collab"
                ? "Request collaboration"
                : nav === "showcase"
                  ? "Share a showcase"
                  : nav === "tip"
                    ? "Share a tip"
                    : nav === "discussion"
                      ? "Start a discussion"
                      : "Share the first post"
        }
        onAction={
          nav === "saved"
            ? onGoHome
            : nav === "help"
              ? () => focusComposer("help_request")
              : nav === "collab"
                ? () => focusComposer("collaboration_request")
                : nav === "showcase"
                  ? () => focusComposer("showcase")
                  : nav === "tip"
                    ? () => focusComposer("lesson_learned")
                    : nav === "discussion"
                      ? () => focusComposer("discussion")
                      : focusComposer
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {posts.map((post, index) => {
        const overlap =
          sortMode === "recommended"
            ? post.skills.filter((s) => mySkillNames.has(s.toLowerCase())).length
            : undefined;
        // Native space posts can be removed by the space's owners/moderators;
        // shared posts belong to another space and are handled via unshare.
        const isShared = (post as { is_shared?: boolean }).is_shared === true;
        const canModerate =
          !!activeSpace &&
          !isShared &&
          (activeSpace.my_role === "owner" || activeSpace.my_role === "moderator");
        return (
          <PostCardWithComments
            key={post.id}
            post={post}
            searchQuery={searchQuery}
            showComments={openComments.has(post.id)}
            onToggleComments={onToggleComments}
            onDelete={onDelete}
            onEdit={onEdit}
            onToggleAction={onToggleAction}
            className="transition-lift animate-stagger"
            index={index}
            highlighted={post.id === highlightedPostId}
            skillOverlap={overlap}
            canModerate={canModerate}
            reportCount={canModerate ? (reportedPostCounts?.get(post.id) ?? 0) : undefined}
            dimThreshold={activeSpace?.report_auto_dim_threshold ?? 3}
          />
        );
      })}

      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-full text-muted-foreground"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
});
