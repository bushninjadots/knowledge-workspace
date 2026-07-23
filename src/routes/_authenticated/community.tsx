import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Users, SlidersHorizontal, Search, X, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/tethyr/empty-state";
import { ComposerBar } from "@/components/tethyr/community/composer-bar";
import { PostCard } from "@/components/tethyr/community/post-card";
import {
  CommunityLeftSidebar,
  type CommunityNavId,
} from "@/components/tethyr/community/left-sidebar";
import { CommunityRightSidebar } from "@/components/tethyr/community/right-sidebar";
import { MobileBottomNav } from "@/components/tethyr/community/mobile-bottom-nav";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  usePosts,
  useDeletePost,
  useComments,
  useTogglePostAction,
  type PostWithAuthor,
} from "@/hooks/use-community";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  COMMUNITIES,
  DISCOVERY_FILTERS,
  POST_TYPE_LABEL,
  type DiscoveryFocus,
} from "@/lib/community-data";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({
    meta: [
      { title: "Open Collaboration Space — Tethyr" },
      {
        name: "description",
        content:
          "An open workshop floor where creators share ideas, ask for help, and collaborate on projects.",
      },
    ],
  }),
  component: CommunityPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
});

const NAV_TO_POST_TYPE: Partial<Record<CommunityNavId, string>> = {
  projects: "project_update",
  questions: "question",
  resources: "resource",
  help: "help_request",
  collab: "collaboration_request",
};

const TYPE_FILTERS: { label: string; value: string | "all" }[] = [
  { label: "All", value: "all" },
  ...Object.entries(POST_TYPE_LABEL).map(([value, label]) => ({
    label,
    value,
  })),
];

const TYPE_ICONS: Record<string, string> = {
  project_update: "🚀",
  question: "❓",
  resource: "📚",
  help_request: "🤝",
  collaboration_request: "🔨",
  tip: "💡",
  showcase: "✨",
  discussion: "💬",
};

type SortMode = "latest" | "helpful" | "offers";

const SORT_OPTIONS: { label: string; value: SortMode }[] = [
  { label: "Latest", value: "latest" },
  { label: "Most helpful", value: "helpful" },
  { label: "Most offers", value: "offers" },
];

function CommunityPage() {
  const { data: me } = useCurrentUser();
  const { data: posts = [], isLoading } = usePosts();
  const deletePost = useDeletePost();
  const toggleAction = useTogglePostAction();

  const [nav, setNav] = useState<CommunityNavId>("home");
  const [typeFilter, setTypeFilter] = useState<string | "all">("all");
  const [focusFilter, setFocusFilter] = useState<DiscoveryFocus | "all">("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileTrendingOpen, setMobileTrendingOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<PostWithAuthor | null>(null);

  function toggleSave(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deletePostHandler(id: string) {
    deletePost.mutate(id, {
      onSuccess: () => toast.success("Post deleted"),
      onError: () => toast.error("Failed to delete"),
    });
  }

  function editPost(post: PostWithAuthor) {
    setEditingPost(post);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingPost(null);
  }

  function toggleComments(postId: string) {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function handleToggleAction(postId: string, action: "like" | "helpful" | "offer") {
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
  }

  const effectiveTypeFilter = NAV_TO_POST_TYPE[nav] ?? (nav === "home" ? typeFilter : null);

  const feed = useMemo(() => {
    let list = posts;
    if (nav === "saved") {
      list = list.filter((p) => savedIds.has(p.id));
    } else if (nav === "following") {
      list = [];
    } else {
      if (effectiveTypeFilter && effectiveTypeFilter !== "all") {
        list = list.filter((p) => p.type === effectiveTypeFilter);
      }
      if (focusFilter !== "all") {
        list = list.filter((p) => p.focus === focusFilter);
      }
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
    } else if (sortMode === "helpful") {
      list = [...list].sort((a, b) => b.stats.helpful - a.stats.helpful);
    } else if (sortMode === "offers") {
      list = [...list].sort((a, b) => b.stats.offers - a.stats.offers);
    }

    return list;
  }, [posts, nav, effectiveTypeFilter, focusFilter, savedIds, searchQuery, sortMode]);

  const isSearching = searchQuery.trim().length > 0;
  const showComposer = (nav === "home" && !isSearching) || !!editingPost;
  const showTypeTabs = nav === "home" && !isSearching;

  return (
    <div className="animate-room-enter bg-noise">
      <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-8">
        <CommunityLeftSidebar active={nav} onSelect={setNav} />

        <div className="min-w-0 flex-1">
          <header className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-primary/70">
                  Open Collaboration Space
                </p>
                <h1 className="font-display text-2xl font-semibold">{navTitle(nav)}</h1>
                <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                  An open workshop floor — share project updates, ask for help, request
                  collaboration, or drop a resource. Every post has purpose.
                </p>
              </div>
              <button
                onClick={() => setMobileTrendingOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground xl:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Trending
              </button>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, skills, people, or ideas..."
                className="h-10 rounded-xl border-border/60 bg-surface pl-9 pr-9 text-sm transition-shadow focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
              {isSearching && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {isSearching && (
              <p className="mt-2 text-xs text-muted-foreground">
                {feed.length} result{feed.length !== 1 ? "s" : ""} for "{searchQuery}"
              </p>
            )}
          </header>

          {showComposer && (
            <div className="mb-6">
              <ComposerBar editingPost={editingPost} onCancelEdit={cancelEdit} />
            </div>
          )}

          {showTypeTabs && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {TYPE_FILTERS.map((f) => {
                const icon = f.value !== "all" ? TYPE_ICONS[f.value] : null;
                return (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-all duration-200 ${
                      typeFilter === f.value
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-surface-elevated/50"
                    }`}
                  >
                    {icon && <span className="mr-1">{icon}</span>}
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}

          {showTypeTabs && (
            <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setFocusFilter("all")}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition-all duration-200 ${
                  focusFilter === "all"
                    ? "bg-surface-elevated text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated/30"
                }`}
              >
                Any focus
              </button>
              {DISCOVERY_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFocusFilter(focusFilter === f ? "all" : f)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition-all duration-200 ${
                    focusFilter === f
                      ? "bg-surface-elevated text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated/30"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {showTypeTabs && (
            <div className="mb-4 flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortMode(opt.value)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-200 ${
                    sortMode === opt.value
                      ? "bg-surface-elevated text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {nav === "communities" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {COMMUNITIES.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={<Users className="h-5 w-5" />}
                    title="No workshops yet"
                    description="Workshop spaces will appear here once they're created. Start a new one to bring people together."
                  />
                </div>
              ) : null}
            </div>
          ) : nav === "following" ? (
            <EmptyState
              icon={<Heart className="h-5 w-5" />}
              title="Following is coming soon"
              description="Once you follow collaborators, their posts will surface here first."
            />
          ) : isLoading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="card-border animate-pulse rounded-3xl border bg-surface p-5 sm:p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-surface-elevated" />
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
          ) : feed.length === 0 && isSearching ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No results found"
              description={`Nothing matches "${searchQuery}". Try different keywords — project names, skill tags, or collaborator handles.`}
            />
          ) : feed.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={
                nav === "saved"
                  ? "Nothing saved yet"
                  : nav === "help"
                    ? "No help requests"
                    : "The workshop is quiet"
              }
              description={
                nav === "saved"
                  ? "Save a post to pin it here for quick access."
                  : nav === "help"
                    ? "When someone needs a hand, their request will appear here."
                    : "Be the first to share a project update, ask a question, or request collaboration."
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              {feed.map((post, index) => (
                <PostCardWithComments
                  key={post.id}
                  post={post}
                  saved={savedIds.has(post.id)}
                  onToggleSave={() => toggleSave(post.id)}
                  searchQuery={isSearching ? searchQuery : undefined}
                  showComments={openComments.has(post.id)}
                  onToggleComments={() => toggleComments(post.id)}
                  onDelete={() => deletePostHandler(post.id)}
                  onEdit={() => editPost(post)}
                  onToggleAction={(action) => handleToggleAction(post.id, action)}
                  className="transition-lift animate-stagger"
                  style={{ animationDelay: `${index * 60}ms` } as React.CSSProperties}
                />
              ))}
            </div>
          )}
        </div>

        <CommunityRightSidebar />
      </div>

      <MobileBottomNav
        active={nav}
        onSelect={setNav}
        onOpenSidebar={() => setMobileSidebarOpen(true)}
      />

      <Drawer open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Navigation</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <CommunityLeftSidebar
              active={nav}
              onSelect={(id) => {
                setNav(id);
                setMobileSidebarOpen(false);
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={mobileTrendingOpen} onOpenChange={setMobileTrendingOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Trending & Discover</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <CommunityRightSidebar mobile />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function PostCardWithComments({
  post,
  saved,
  onToggleSave,
  searchQuery,
  showComments,
  onToggleComments,
  onDelete,
  onEdit,
  onToggleAction,
  className,
  style,
}: {
  post: PostWithAuthor;
  saved: boolean;
  onToggleSave: () => void;
  searchQuery?: string;
  showComments: boolean;
  onToggleComments: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onToggleAction: (action: "like" | "helpful" | "offer") => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { data: comments = [] } = useComments(showComments ? post.id : "");

  return (
    <div className={className} style={style}>
      <PostCard
        post={post}
        saved={saved}
        onToggleSave={onToggleSave}
        searchQuery={searchQuery}
        comments={comments}
        showComments={showComments}
        onToggleComments={onToggleComments}
        onDelete={onDelete}
        onEdit={onEdit}
        onToggleAction={onToggleAction}
      />
    </div>
  );
}

function navTitle(nav: CommunityNavId): string {
  switch (nav) {
    case "home":
      return "Workshop Floor";
    case "communities":
      return "Workshops";
    case "help":
      return "Help Requests";
    case "collab":
      return "Collaboration Requests";
    case "projects":
      return "Project Updates";
    case "questions":
      return "Questions";
    case "resources":
      return "Resources";
    case "challenges":
      return "Challenges";
    case "following":
      return "Following";
    case "saved":
      return "Saved";
    case "trending":
      return "Trending";
    default:
      return "Open Collaboration Space";
  }
}
