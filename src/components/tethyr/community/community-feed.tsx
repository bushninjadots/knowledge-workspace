import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ComposerBar } from "@/components/tethyr/community/composer-bar";
import { CommunityHeader, type SortMode } from "@/components/tethyr/community/community-header";
import { CommunityFeedList } from "@/components/tethyr/community/community-feed-list";
import { SpaceHeader } from "@/components/tethyr/community/space-header";
import { ChallengesSection } from "@/components/tethyr/community/challenges-section";
import { CommunitiesSection } from "@/components/tethyr/community/communities-section";
import type { CommunityNavId } from "@/components/tethyr/community/left-sidebar";
import {
  usePosts,
  useDeletePost,
  useTogglePostAction,
  type PostWithAuthor,
} from "@/hooks/use-community";
import { useCurrentUser, useSkillsCatalog } from "@/hooks/use-current-user";
import { useFollowingFeed } from "@/hooks/use-follow";
import type { DiscoveryFocus } from "@/lib/community-data";
import type { CommunitySpace } from "@/hooks/use-community-spaces";

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
  composerPresetType: string | null;
  focusComposer: (presetType?: string) => void;
  deepLinkedPostId?: string;
  onBackSpace: () => void;
  onOpenTrending: () => void;
  onOpenSpace: (space: CommunitySpace) => void;
}) {
  const { data: me } = useCurrentUser();
  const { data: posts = [], isLoading } = usePosts();
  const { data: followingFeed = [], isLoading: isLoadingFollowing } = useFollowingFeed();
  const deletePost = useDeletePost();
  const toggleAction = useTogglePostAction();
  const { data: skillCatalog = [] } = useSkillsCatalog();

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
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
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
  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    (postId: string, action: "like" | "helpful" | "offer") => {
      if (!me?.userId) return;
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      const isActive = post.myActions.includes(action);
      toggleAction.mutate(
        { postId, action, currentUserId: me.userId, isActive },
        {
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
    let list = posts;
    if (activeSpace) {
      list = spacePosts;
    } else if (nav === "saved") {
      list = list.filter((p) => savedIds.has(p.id));
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
    savedIds,
    searchQuery,
    sortMode,
    followingFeed,
    activeSpace,
    spacePosts,
    mySkillsOnly,
    mySkillNames,
  ]);

  const isSearching = searchQuery.trim().length > 0;
  const showComposer = (nav === "home" && !isSearching) || !!editingPost;
  // The following view renders the raw following feed (no search/sort), so it
  // needs its own loading flag and post list.
  const loading = nav === "following" ? isLoadingFollowing : isLoading;
  const visiblePosts = nav === "following" ? followingFeed : feed;

  return (
    <div className="min-w-0 flex-1">
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
        onOpenTrending={onOpenTrending}
      />

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
            />
          )}

          {showComposer && (
            <div className="mb-6">
              <ComposerBar
                editingPost={editingPost}
                onCancelEdit={cancelEdit}
                spaceId={activeSpace?.id}
                presetType={composerPresetType}
              />
            </div>
          )}

          <CommunityFeedList
            posts={visiblePosts}
            loading={loading}
            nav={nav}
            isSearching={isSearching}
            searchQuery={nav === "following" ? undefined : isSearching ? searchQuery : undefined}
            savedIds={savedIds}
            openComments={openComments}
            highlightedPostId={highlightedPostId}
            sortMode={sortMode}
            mySkillNames={mySkillNames}
            activeSpace={activeSpace}
            onToggleSave={toggleSave}
            onToggleComments={toggleComments}
            onDelete={deletePostHandler}
            onEdit={editPost}
            onToggleAction={handleToggleAction}
            onClearSearch={clearSearch}
            onGoHome={goHome}
            focusComposer={focusComposer}
          />
        </>
      )}
    </div>
  );
}
