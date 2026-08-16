import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { TYPE_ACCENT, TYPE_ICON } from "../community/post-card";
import { ActivityAuthor, useRecentActivity } from "./data";

export function HeroActivityPanel() {
  const { data: posts, isLoading } = useRecentActivity();

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl bg-surface-elevated/30 p-5 backdrop-blur-sm">
        <div className="mb-4 h-4 w-44 rounded bg-surface-elevated" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-4 flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-surface-elevated" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded bg-surface-elevated" />
              <div className="h-3 w-full rounded bg-surface-elevated" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!posts || posts.length === 0) return null;
  const featured = posts.slice(0, 3);

  return (
    <div className="rounded-xl bg-surface-elevated/30 p-5 backdrop-blur-sm transition hover:bg-surface-elevated/50">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Live from the community
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {featured.map((post) => {
          const TypeIcon = TYPE_ICON[post.type];
          const name = post.author.display_name || post.author.handle || "Member";
          return (
            <Link
              key={post.id}
              to="/community"
              className="group -mx-2 rounded-xl px-2 py-2.5 transition hover:bg-surface-elevated/60"
            >
              <div className="flex items-center gap-2.5">
                <ActivityAuthor author={post.author} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      · {timeAgo(post.created_at)}
                    </span>
                  </div>
                  <p className="truncate text-xs font-medium text-muted-foreground transition group-hover:text-primary">
                    {post.title}
                  </p>
                </div>{" "}
                <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${TYPE_ACCENT[post.type]}`} />
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        to="/community"
        className="mt-3 flex items-center justify-between rounded-xl border border-border/60 bg-surface-elevated/50 px-3 py-2 text-xs font-medium text-primary transition hover:bg-surface-elevated"
      >
        Open the community <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
