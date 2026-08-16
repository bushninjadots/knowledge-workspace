import { Link } from "@tanstack/react-router";
import { ArrowRight, Heart, MessageSquare } from "lucide-react";
import { POST_TYPE_LABEL } from "@/lib/community-data";
import { timeAgo } from "@/lib/time";
import { TYPE_ACCENT, TYPE_ICON } from "../community/post-card";
import { ActivityAuthor, useRecentActivity } from "./data";

export function RecentActivity() {
  const { data: posts, isLoading } = useRecentActivity();

  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-border/60 bg-surface"
            />
          ))}
        </div>
      </section>
    );
  }
  if (!posts || posts.length === 0) return null;

  return (
    <section className="border-y border-border/60 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-label mb-3">Real activity</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              What the community is talking about
            </h2>
            <p className="mt-3 text-muted-foreground">
              Showcases, project updates, collaboration requests, and discussions — live from
              builders across the network.
            </p>
          </div>
          <Link
            to="/community"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary"
          >
            Join the conversation <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {" "}
          {posts.map((post) => {
            const TypeIcon = TYPE_ICON[post.type];
            const name = post.author.display_name || post.author.handle || "Member";
            return (
              <Link
                key={post.id}
                to="/community"
                className="group flex flex-col rounded-xl bg-surface-elevated/30 p-5 transition hover:bg-surface-elevated/50"
              >
                <div className="flex items-center gap-2.5">
                  <ActivityAuthor author={post.author} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                  <TypeIcon className={`h-3 w-3 ${TYPE_ACCENT[post.type]}`} />
                  <span className={TYPE_ACCENT[post.type]}>{POST_TYPE_LABEL[post.type]}</span>
                </div>
                <h3 className="mt-2 line-clamp-2 font-display text-base font-semibold group-hover:text-primary">
                  {post.title}
                </h3>
                {post.body && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
                )}
                <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5" /> {post.likes}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> {post.comments}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
