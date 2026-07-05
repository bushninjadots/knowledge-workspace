// Community — a knowledge-sharing feed built around skills and growth, not
// popularity. Currently UI-first with realistic placeholder data (see
// src/lib/community-data.ts); the shapes are chosen so a real posts table
// can slot in later without reshaping these components.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Users, Trophy } from "lucide-react";
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
import {
  CHALLENGES,
  COMMUNITIES,
  INITIAL_POSTS,
  POST_TYPE_LABEL,
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
});

const NAV_TO_POST_TYPE: Partial<Record<CommunityNavId, PostType>> = {
  projects: "project_update",
  questions: "question",
  resources: "resource",
};

const TYPE_FILTERS: { label: string; value: PostType | "all" }[] = [
  { label: "All", value: "all" },
  ...(Object.entries(POST_TYPE_LABEL) as [PostType, string][]).map(([value, label]) => ({
    label,
    value,
  })),
];

function CommunityPage() {
  const [nav, setNav] = useState<CommunityNavId>("home");
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<PostType | "all">("all");
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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
    ? COMMUNITIES.find((c) => c.id === activeCommunity)?.name ?? null
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
    }
    if (nav === "trending") {
      list = [...list].sort((a, b) => b.stats.likes - a.stats.likes);
    }
    return list;
  }, [posts, nav, communityName, effectiveTypeFilter, savedIds]);

  const showComposer = nav === "home";
  const showTypeTabs = nav === "home";

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>
      <main className="flex-1">
        <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-8">
          <CommunityLeftSidebar
            active={nav}
            onSelect={setNav}
            activeCommunity={activeCommunity}
            onSelectCommunity={setActiveCommunity}
          />

          <div className="min-w-0 flex-1">
            <header className="mb-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Community</p>
              <h1 className="font-display text-2xl font-semibold">
                {communityName ?? navTitle(nav)}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Teach, learn, build and collaborate — everything here revolves around skills and
                growth, not popularity.
              </p>
            </header>

            {showComposer && (
              <div className="mb-6">
                <ComposerBar onPost={addPost} />
              </div>
            )}

            {showTypeTabs && (
              <div className="mb-6 flex flex-wrap gap-2">
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
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
                    <p className="mt-1 text-[11px] text-muted-foreground">{c.progress}% of participants on track</p>
                  </div>
                ))}
              </div>
            ) : nav === "following" ? (
              <EmptyState
                icon={<Heart className="h-5 w-5" />}
                title="Following is coming soon"
                description="Once you follow creators, their posts will show up here first."
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
                  />
                ))}
              </div>
            )}
          </div>

          <CommunityRightSidebar />
        </div>
      </main>
    </div>
  );
}

function navTitle(nav: CommunityNavId): string {
  switch (nav) {
    case "home":
      return "Home Feed";
    case "communities":
      return "Communities";
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
