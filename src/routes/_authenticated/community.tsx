// Community — a knowledge-sharing feed built around skills and growth, not
// popularity. Currently UI-first with realistic placeholder data (see
// src/lib/community-data.ts); the shapes are chosen so a real posts table
// can slot in later without reshaping these components.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Users, Trophy, SlidersHorizontal, Search, X, ArrowUpDown } from "lucide-react";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import { EmptyState } from "@/components/tethyr/empty-state";
import { ComposerBar } from "@/components/tethyr/community/composer-bar";
import { PostCard } from "@/components/tethyr/community/post-card";
import {
  CommunityLeftSidebar,
  COMMUNITY_ICON,
  formatMembers,
  type CommunityNavId,
} from "@/components/tethyr/community/left-sidebar";
import { CommunityRightSidebar } from "@/components/tethyr/community/right-sidebar";
import { MobileBottomNav } from "@/components/tethyr/community/mobile-bottom-nav";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  CHALLENGES,
  COMMUNITIES,
  DISCOVERY_FILTERS,
  INITIAL_POSTS,
  POST_TYPE_LABEL,
  type DiscoveryFocus,
  type Post,
  type PostType,
} from "@/lib/community-data";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({
    meta: [
      { title: "Community — Tethyr" },
      {
        name: "description",
        content: "Teach, learn, build and collaborate — a feed built around skills and growth.",
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

const NAV_TO_POST_TYPE: Partial<Record<CommunityNavId, PostType>> = {
  projects: "project_update",
  questions: "question",
  resources: "resource",
  help: "help_request",
  collab: "collaboration_request",
};

const TYPE_FILTERS: { label: string; value: PostType | "all" }[] = [
  { label: "All", value: "all" },
  ...(Object.entries(POST_TYPE_LABEL) as [PostType, string][]).map(([value, label]) => ({
    label,
    value,
  })),
];

type SortMode = "latest" | "helpful" | "discussed";

const SORT_OPTIONS: { label: string; value: SortMode }[] = [
  { label: "Latest", value: "latest" },
  { label: "Most helpful", value: "helpful" },
  { label: "Most discussed", value: "discussed" },
];

function CommunityPage() {
  const [nav, setNav] = useState<CommunityNavId>("home");
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<PostType | "all">("all");
  const [focusFilter, setFocusFilter] = useState<DiscoveryFocus | "all">("all");
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileTrendingOpen, setMobileTrendingOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  function toggleSave(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPost(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }

  const communityName = activeCommunity
    ? (COMMUNITIES.find((c) => c.id === activeCommunity)?.name ?? null)
    : null;

  const effectiveTypeFilter = NAV_TO_POST_TYPE[nav] ?? (nav === "home" ? typeFilter : null);

  const feed = useMemo(() => {
    let list = posts;
    if (nav === "saved") {
      list = list.filter((p) => savedIds.has(p.id));
    } else if (nav === "following") {
      list = [];
    } else {
      if (communityName) list = list.filter((p) => p.community === communityName);
      if (effectiveTypeFilter && effectiveTypeFilter !== "all") {
        list = list.filter((p) => p.type === effectiveTypeFilter);
      }
      if (focusFilter !== "all") {
        list = list.filter((p) => p.focus === focusFilter);
      }
      if (activeSkill) {
        list = list.filter((p) =>
          p.skills.some((s) => s.toLowerCase() === activeSkill.toLowerCase()),
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.author.name.toLowerCase().includes(q) ||
          p.skills.some((s) => s.toLowerCase().includes(q)),
      );
    }

    if (nav === "trending") {
      list = [...list].sort((a, b) => b.stats.likes - a.stats.likes);
    } else if (sortMode === "helpful") {
      list = [...list].sort((a, b) => b.stats.helpful - a.stats.helpful);
    } else if (sortMode === "discussed") {
      list = [...list].sort((a, b) => b.stats.comments - a.stats.comments);
    }

    return list;
  }, [
    posts,
    nav,
    communityName,
    effectiveTypeFilter,
    focusFilter,
    savedIds,
    searchQuery,
    sortMode,
    activeSkill,
  ]);

  const isSearching = searchQuery.trim().length > 0;
  const showComposer = nav === "home" && !isSearching;
  const showTypeTabs = nav === "home" && !isSearching;

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>
      <main className="flex-1 pb-20 lg:pb-0">
        <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-8">
          <CommunityLeftSidebar
            active={nav}
            onSelect={setNav}
            activeCommunity={activeCommunity}
            onSelectCommunity={setActiveCommunity}
            activeSkill={activeSkill}
            onSelectSkill={setActiveSkill}
          />

          <div className="min-w-0 flex-1">
            <header className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Community
                  </p>
                  <h1 className="font-display text-2xl font-semibold">
                    {communityName ?? navTitle(nav)}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Teach, learn, build and collaborate — everything here revolves around skills and
                    growth, not popularity.
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
                  placeholder="Search posts, skills, or people..."
                  className="h-10 rounded-xl border-border/60 bg-surface pl-9 pr-9 text-sm"
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
                <ComposerBar onPost={addPost} />
              </div>
            )}

            {showTypeTabs && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      typeFilter === f.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {showTypeTabs && (
              <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setFocusFilter("all")}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    focusFilter === "all"
                      ? "bg-surface-elevated text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Any focus
                </button>
                {DISCOVERY_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFocusFilter(focusFilter === f ? "all" : f)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                      focusFilter === f
                        ? "bg-surface-elevated text-foreground"
                        : "text-muted-foreground hover:text-foreground"
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
                    className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                      sortMode === opt.value
                        ? "bg-surface-elevated text-foreground"
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
                {COMMUNITIES.map((c) => {
                  const Icon = COMMUNITY_ICON[c.id] ?? Users;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveCommunity(c.id);
                        setNav("home");
                      }}
                      className="card-border flex items-center gap-3 rounded-3xl border bg-surface p-4 text-left transition hover:border-primary/40"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMembers(c.members)} members
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : nav === "challenges" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {CHALLENGES.map((c) => (
                  <div key={c.id} className="card-border rounded-3xl border bg-surface p-5">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-brand-green" />
                      <p className="font-medium">{c.title}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{c.participants} participants</span>
                      <span>{c.timeLeft}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                      <div
                        className="h-full rounded-full bg-gradient-brand"
                        style={{ width: `${c.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {c.progress}% of participants on track
                    </p>
                  </div>
                ))}
              </div>
            ) : nav === "following" ? (
              <EmptyState
                icon={<Heart className="h-5 w-5" />}
                title="Following is coming soon"
                description="Once you follow creators, their posts will show up here first."
              />
            ) : feed.length === 0 && isSearching ? (
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="No results found"
                description={`Nothing matches "${searchQuery}". Try a different search term.`}
              />
            ) : feed.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title={nav === "saved" ? "Nothing saved yet" : "No posts match yet"}
                description={
                  nav === "saved"
                    ? "Tap Save on a post to keep it here for later."
                    : "Try a different community or post type."
                }
              />
            ) : (
              <div className="flex flex-col gap-4">
                {feed.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    saved={savedIds.has(post.id)}
                    onToggleSave={() => toggleSave(post.id)}
                    searchQuery={isSearching ? searchQuery : undefined}
                  />
                ))}
              </div>
            )}
          </div>

          <CommunityRightSidebar />
        </div>
      </main>

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
              activeCommunity={activeCommunity}
              onSelectCommunity={(id) => {
                setActiveCommunity(id);
                setMobileSidebarOpen(false);
              }}
              activeSkill={activeSkill}
              onSelectSkill={(skill) => {
                setActiveSkill(skill);
                setMobileSidebarOpen(false);
              }}
              mobile
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

function navTitle(nav: CommunityNavId): string {
  switch (nav) {
    case "home":
      return "Home Feed";
    case "communities":
      return "Communities";
    case "help":
      return "Help Requests";
    case "collab":
      return "Collaborations";
    case "projects":
      return "Projects";
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
      return "Community";
  }
}
