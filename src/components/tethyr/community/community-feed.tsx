import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { ComposerBar } from "@/components/tethyr/community/composer-bar";
// Space chat mounts only when a member is inside a space — lazy so its chunk
// (and the post-creation hooks it pulls in) isn't part of the feed's initial
// render.
const SpaceChatComposer = lazy(() =>
  import("@/components/tethyr/community/space-chat-composer").then((m) => ({
    default: m.SpaceChatComposer,
  })),
);
import { CommunityHeader, type SortMode } from "@/components/tethyr/community/community-header";
import { CommunityFeedList } from "@/components/tethyr/community/community-feed-list";
import { SpaceHeader, type SpaceSortMode } from "@/components/tethyr/community/space-header";
import { ChallengesSection } from "@/components/tethyr/community/challenges-section";
import { CommunitiesSection } from "@/components/tethyr/community/communities-section";
import type { CommunityNavId } from "@/components/tethyr/community/left-sidebar";
import {
  useInfinitePosts,
  flattenPosts,
  useDeletePost,
  useTogglePostAction,
  type PostWithAuthor,
} from "@/hooks/use-community";
import { useCurrentUser, useSkillsCatalog } from "@/hooks/use-current-user";
import { useFollowingFeed } from "@/hooks/use-follow";
import { useSpaceReadState } from "@/hooks/use-space-read-state";
import { useSpaceTyping } from "@/hooks/use-space-typing";
import type { DiscoveryFocus } from "@/lib/community-data";
import { useSpaceReportedPostCounts, type CommunitySpace } from "@/hooks/use-community-spaces";

const NAV_TO_POST_TYPE: Partial<Record<CommunityNavId, string>> = {
  projects: "project_update",
  questions: "question",
  resources: "resource",
  help: "help_request",
  collab: "collaboration_request",
  showcase: "showcase",
  tip: "lesson_learned", // "tip" isn't a post type — lessons learned are the community's tips
  discussion: "discussion",
};

/**
 * Owns everything about the feed: post/following data, filter + persistence,
 * the feed memo, and all per-card handlers. Keeps the page shell thin and
 * gives the memoized header + list stable props so unrelated page state
 * (drawers, nav) never cascades into the feed.
 */
export function CommunityFeed({
  nav,
  onNavChange,
  searchQuery,
  onSearchChange,
  activeSpace,
  spacePosts,
  spacePostsLoading,
  composerPresetType,
  focusComposer,
  deepLinkedPostId,
  onBackSpace,
  onOpenTrending,
  onOpenSpace,
}: {
  nav: CommunityNavId;
  onNavChange: (nav: CommunityNavId) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeSpace?: CommunitySpace;
  spacePosts: PostWithAuthor[];
  spacePostsLoading: boolean;
  composerPresetType: string | null;
  focusComposer: (presetType?: string) => void;
  deepLinkedPostId?: string;
  onBackSpace: () => void;
  onOpenTrending: () => void;
  onOpenSpace: (space: CommunitySpace) => void;
}) {
  const { data: me } = useCurrentUser();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfinitePosts();
  const posts = useMemo(() => flattenPosts(data?.pages), [data]);
  const { data: followingFeed = [], isLoading: isLoadingFollowing } = useFollowingFeed();
  // Moderators see a red “Reported” badge on posts with open reports, and
  // posts with several reports are dimmed until reviewed. RLS scopes the
  // query to the current space, so it is safe to fetch whenever a space is
  // active.
  const { data: reportedPostCounts = new Map<string, number>() } = useSpaceReportedPostCounts(
    activeSpace?.id ?? "",
  );
  const deletePost = useDeletePost();
  const toggleAction = useTogglePostAction();
  const { data: skillCatalog = [] } = useSkillsCatalog();
  // Read receipts: the member's last-read cursor for the open space, used to
  // draw an "Unread" divider, plus the live typing presence for its chat.
  // The typing channel subscription is owned here (single subscription per
  // space) and its announce function is passed down to the chat composer.
  const memberSpaceId = activeSpace?.is_member ? activeSpace.id : null;
  const { lastReadAt, markRead } = useSpaceReadState(memberSpaceId);
  const { typers, announceTyping } = useSpaceTyping(memberSpaceId);

  const FILTER_STORE_KEY = "tethyr-community-filters";

  function loadFilters() {
    try {
      const raw = localStorage.getItem(FILTER_STORE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  function saveFilters(state: Record<string, unknown>) {
    try {
      localStorage.setItem(FILTER_STORE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  const savedFilters = loadFilters();
  const [focusFilter, setFocusFilter] = useState<DiscoveryFocus | "all">(
    (savedFilters.focusFilter as DiscoveryFocus) ?? "all",
  );
  const [sortMode, setSortMode] = useState<SortMode>(
    (savedFilters.sortMode as SortMode) ?? "latest",
  );
  const [mySkillsOnly, setMySkillsOnly] = useState((savedFilters.mySkillsOnly as boolean) ?? false);
  const [spaceSortMode, setSpaceSortMode] = useState<SpaceSortMode>("latest");

  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<PostWithAuthor | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  // Persist filters to localStorage on change
  useEffect(() => {
    saveFilters({ focusFilter, sortMode, mySkillsOnly });
  }, [focusFilter, sortMode, mySkillsOnly]);

  // If deep-linked to a post, highlight it after a short delay
  useEffect(() => {
    if (deepLinkedPostId) {
      const timer = setTimeout(() => {
        setHighlightedPostId(deepLinkedPostId);
        const el = document.getElementById(`post-${deepLinkedPostId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        // Clear highlight after 3 seconds
        const clearTimer = setTimeout(() => setHighlightedPostId(null), 3000);
        return () => clearTimeout(clearTimer);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [deepLinkedPostId]);

  // Build a set of skill NAMES the user teaches or learns
  const mySkillNames = useMemo(() => {
    const names = new Set<string>();
    if (!me) return names;
    const allUserSkillIds = new Set([...(me.teachIds ?? []), ...(me.learnIds ?? [])]);
    for (const skill of skillCatalog) {
      if (allUserSkillIds.has(skill.id)) {
        names.add(skill.name.toLowerCase());
      }
    }
    return names;
  }, [me, skillCatalog]);

  const activeFilterCount = [
    focusFilter !== "all" ? 1 : 0,
    mySkillsOnly ? 1 : 0,
    sortMode !== "latest" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Handlers are referentially stable so the memoized feed list only
  // re-renders when a card's own data changes (save/comment/offer toggles,
  // highlights) instead of on every keystroke or filter click.
  const deletePostHandler = useCallback(
    (id: string) => {
      deletePost.mutate(id, {
        onSuccess: () => toast.success("Post deleted"),
        onError: () => toast.error("Failed to delete"),
      });
    },
    [deletePost],
  );

  const editPost = useCallback((post: PostWithAuthor) => {
    setEditingPost(post);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const cancelEdit = useCallback(() => setEditingPost(null), []);

  const toggleComments = useCallback((postId: string) => {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }, []);

  const handleToggleAction = useCallback(
    (postId: string, action: "like" | "helpful" | "save" | "offer") => {
      if (!me?.userId) return;
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      const isActive = post.myActions.includes(action);
      toggleAction.mutate(
        { postId, action, currentUserId: me.userId, isActive },
        {
          onSuccess: () => {
            if (action === "save") {
              toast.success(isActive ? "Removed from saved" : "Saved");
            }
          },
          onError: () => toast.error("Failed"),
        },
      );
    },
    [me, posts, toggleAction],
  );

  const clearSearch = useCallback(() => onSearchChange(""), [onSearchChange]);
  const goHome = useCallback(() => onNavChange("home"), [onNavChange]);

  const effectiveTypeFilter = NAV_TO_POST_TYPE[nav] ?? null;

  const feed = useMemo(() => {
    // A space is its own room: keep its conversation separate from general
    // feed filters, while still offering a small local sort for scale.
    if (activeSpace) {
      const pinned = spacePosts.filter((post) => post.is_pinned);
      const regular = spacePosts.filter((post) => !post.is_pinned);
      const ordered = [...pinned, ...regular];
      if (spaceSortMode === "latest") return ordered;
      if (spaceSortMode === "unanswered") {
        return ordered.filter((post) => post.title.trim() && post.stats.comment_count === 0);
      }
      return [...ordered].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        const aScore = a.stats.likes + a.stats.helpful * 2 + a.stats.comment_count * 2;
        const bScore = b.stats.likes + b.stats.helpful * 2 + b.stats.comment_count * 2;
        return (
          bScore - aScore || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    }

    let list = posts;
    if (nav === "saved") {
      list = list.filter((p) => p.myActions.includes("save"));
    } else if (nav === "following") {
      list = followingFeed;
    } else {
      if (effectiveTypeFilter && effectiveTypeFilter !== "all") {
        list = list.filter((p) => p.type === effectiveTypeFilter);
      }
      if (focusFilter !== "all") {
        list = list.filter((p) => p.focus === focusFilter);
      }
    }

    if (mySkillsOnly && mySkillNames.size > 0) {
      list = list.filter((p) => p.skills.some((s) => mySkillNames.has(s.toLowerCase())));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          (p.author.display_name ?? "").toLowerCase().includes(q) ||
          (p.author.handle ?? "").toLowerCase().includes(q) ||
          p.skills.some((s) => s.toLowerCase().includes(q)),
      );
    }

    if (nav === "trending") {
      list = [...list].sort((a, b) => b.stats.likes - a.stats.likes);
    } else if (sortMode === "hot") {
      // Reddit-style hot ranking: engagement (likes + 2×helpful + offers) with
      // a time decay so fresh posts surface but strong posts stay visible.
      // Ages are clamped ≥ 0 (clock skew can make created_at slightly future).
      const now = Date.now();
      const hotScore = new Map<string, number>();
      for (const p of list) {
        const score = p.stats.likes + p.stats.helpful * 2 + p.stats.offers * 3 + p.stats.saves;
        const ageHours = Math.max(0, (now - new Date(p.created_at).getTime()) / 3_600_000);
        hotScore.set(p.id, score / Math.pow(ageHours + 2, 1.5));
      }
      list = [...list].sort((a, b) => (hotScore.get(b.id) ?? 0) - (hotScore.get(a.id) ?? 0));
    } else if (sortMode === "recommended" && mySkillNames.size > 0) {
      list = [...list].sort((a, b) => {
        const aOverlap = a.skills.filter((s) => mySkillNames.has(s.toLowerCase())).length;
        const bOverlap = b.skills.filter((s) => mySkillNames.has(s.toLowerCase())).length;
        if (bOverlap !== aOverlap) return bOverlap - aOverlap;
        return b.stats.likes - a.stats.likes;
      });
    } else if (sortMode === "helpful") {
      list = [...list].sort((a, b) => b.stats.helpful - a.stats.helpful);
    } else if (sortMode === "offers") {
      list = [...list].sort((a, b) => b.stats.offers - a.stats.offers);
    }

    return list;
  }, [
    posts,
    nav,
    effectiveTypeFilter,
    focusFilter,
    searchQuery,
    sortMode,
    followingFeed,
    activeSpace,
    spacePosts,
    mySkillsOnly,
    mySkillNames,
    spaceSortMode,
  ]);

  // Advance the read cursor shortly after the space opens (and only when there
  // are actually messages newer than it), so the divider shows briefly, then
  // clears on the next visit.
  useEffect(() => {
    if (!activeSpace || spacePosts.length === 0) return;
    const newest = spacePosts.reduce((a, b) =>
      new Date(a.created_at).getTime() > new Date(b.created_at).getTime() ? a : b,
    );
    if (lastReadAt && new Date(newest.created_at).getTime() <= new Date(lastReadAt).getTime()) {
      return;
    }
    const timer = window.setTimeout(() => {
      markRead(newest.created_at);
    }, 2_500);
    return () => window.clearTimeout(timer);
  }, [activeSpace, spacePosts, lastReadAt, markRead]);

  const typingNames = useMemo(
    () =>
      [...typers.values()]
        .map((u) => u.name)
        .filter((n) => n && n !== (me?.profile?.display_name || me?.profile?.handle)),
    [typers, me],
  );

  const isSearching = searchQuery.trim().length > 0;
  const showComposer = (nav === "home" && !isSearching) || !!editingPost;
  const isSpaceMember = activeSpace?.is_member === true;
  // Inside a joined space the composer is a lightweight room message — just
  // type and hit Enter. The full composer is still used when editing a post.
  const showChatComposer = showComposer && isSpaceMember && !!activeSpace && !editingPost;
  // The following view renders the raw following feed (no search/sort), so it
  // needs its own loading flag and post list.
  const loading = activeSpace
    ? spacePostsLoading
    : nav === "following"
      ? isLoadingFollowing
      : isLoading;
  const visiblePosts = nav === "following" ? followingFeed : feed;
  const composer =
    activeSpace && showChatComposer ? (
      <Suspense fallback={null}>
        <SpaceChatComposer space={activeSpace} announceTyping={announceTyping} />
      </Suspense>
    ) : showComposer ? (
      <ComposerBar
        editingPost={editingPost}
        onCancelEdit={cancelEdit}
        spaceId={activeSpace?.id}
        presetType={composerPresetType}
      />
    ) : null;

  return (
    <div className="min-w-0 flex-1">
      {!activeSpace && (
        <CommunityHeader
          nav={nav}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          isSearching={isSearching}
          resultCount={feed.length}
          activeFilterCount={activeFilterCount}
          focusFilter={focusFilter}
          onFocusFilterChange={setFocusFilter}
          mySkillsOnly={mySkillsOnly}
          onMySkillsOnlyChange={setMySkillsOnly}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          onNavChange={onNavChange}
          onOpenTrending={onOpenTrending}
        />
      )}

      {nav === "challenges" ? (
        <ChallengesSection />
      ) : nav === "communities" ? (
        <CommunitiesSection onOpenSpace={onOpenSpace} />
      ) : (
        <>
          {activeSpace && (
            <SpaceHeader
              space={activeSpace}
              myRole={activeSpace.my_role ?? null}
              onBack={onBackSpace}
              sortMode={spaceSortMode}
              onSortModeChange={setSpaceSortMode}
            />
          )}

          {activeSpace && !isSpaceMember && (
            <div className="mb-5 flex items-start gap-3 border-y border-border/60 py-3 text-sm">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                {activeSpace.has_pending_request
                  ? "Your join request is waiting for approval."
                  : `Join ${activeSpace.name} to post and reply in this room.`}
              </p>
            </div>
          )}

          {composer && <div className="mb-6">{composer}</div>}

          {activeSpace && typingNames.length > 0 && (
            <div className="mb-3 flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
              </span>
              <span>
                {typingNames.length === 1
                  ? `${typingNames[0]} is typing…`
                  : typingNames.length === 2
                    ? `${typingNames[0]} and ${typingNames[1]} are typing…`
                    : "Several people are typing…"}
              </span>
            </div>
          )}

          <CommunityFeedList
            lastReadAt={activeSpace ? lastReadAt : null}
            posts={visiblePosts}
            loading={loading}
            nav={nav}
            isSearching={isSearching}
            searchQuery={nav === "following" ? undefined : isSearching ? searchQuery : undefined}
            openComments={openComments}
            highlightedPostId={highlightedPostId}
            sortMode={sortMode}
            spaceSortMode={activeSpace ? spaceSortMode : undefined}
            mySkillNames={mySkillNames}
            activeSpace={activeSpace}
            reportedPostCounts={reportedPostCounts}
            hasMore={nav !== "following" && !activeSpace && hasNextPage}
            isLoadingMore={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
            onToggleComments={toggleComments}
            onDelete={deletePostHandler}
            onEdit={editPost}
            onToggleAction={handleToggleAction}
            onClearSearch={clearSearch}
            onGoHome={goHome}
            focusComposer={focusComposer}
            onSpaceSortChange={setSpaceSortMode}
          />
        </>
      )}
    </div>
  );
}
