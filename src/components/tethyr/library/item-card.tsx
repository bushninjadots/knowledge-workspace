import { Link } from "@tanstack/react-router";
import { FileText, Globe, Upload, Star, Pin, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDeleteItem,
  useToggleFavorite,
  useTogglePin,
  type LibraryItem,
} from "@/hooks/use-library";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  document: FileText,
  link: Globe,
  upload: Upload,
};

const TYPE_COLORS: Record<string, string> = {
  note: "text-brand-green",
  document: "text-learning",
  link: "text-teaching",
  upload: "text-ai",
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getExcerpt(content: string): string {
  if (!content) return "";
  // Strip HTML tags
  const text = content.replace(/<[^>]+>/g, "").trim();
  return text.length > 120 ? text.slice(0, 120) + "…" : text;
}

export function ItemCard({
  item,
  layout = "grid",
}: {
  item: LibraryItem;
  layout?: "grid" | "list";
}) {
  const deleteItem = useDeleteItem();
  const toggleFav = useToggleFavorite();
  const togglePin = useTogglePin();

  const Icon = TYPE_ICONS[item.type] ?? FileText;
  const iconColor = TYPE_COLORS[item.type] ?? "text-muted-foreground";
  const excerpt = getExcerpt(item.content);

  if (layout === "list") {
    return (
      <div className="group relative flex items-center gap-4 rounded-2xl border card-border bg-surface px-4 py-3 transition-all duration-200 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated/50">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>

        <div className="min-w-0 flex-1">
          <Link
            to="/library/$id"
            params={{ id: item.id }}
            className="block truncate text-sm font-medium hover:underline"
            title={item.title}
          >
            {item.title}
          </Link>
          {excerpt && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={excerpt}>
              {excerpt}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.is_pinned && <Pin className="h-3 w-3 text-brand-purple" />}
          {item.is_favorite && <Star className="h-3 w-3 fill-teaching text-teaching" />}
          <span>{formatRelativeTime(item.updated_at)}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => toggleFav.mutate({ id: item.id, is_favorite: !item.is_favorite })}
            >
              <Star className="h-3.5 w-3.5" />
              {item.is_favorite ? "Unfavorite" : "Favorite"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => togglePin.mutate({ id: item.id, is_pinned: !item.is_pinned })}
            >
              <Pin className="h-3.5 w-3.5" />
              {item.is_pinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => deleteItem.mutate(item.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col rounded-2xl border card-border bg-surface p-4 transition-all duration-200 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated/50 hover:shadow-soft">
      {/* Top row: type icon + actions */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-elevated">
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>

        <div className="flex items-center gap-1">
          {item.is_pinned && <Pin className="h-3 w-3 text-brand-purple" />}
          {item.is_favorite && <Star className="h-3 w-3 fill-teaching text-teaching" />}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => toggleFav.mutate({ id: item.id, is_favorite: !item.is_favorite })}
              >
                <Star className="h-3.5 w-3.5" />
                {item.is_favorite ? "Unfavorite" : "Favorite"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => togglePin.mutate({ id: item.id, is_pinned: !item.is_pinned })}
              >
                <Pin className="h-3.5 w-3.5" />
                {item.is_pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => deleteItem.mutate(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <Link
        to="/library/$id"
        params={{ id: item.id }}
        className="mb-1 block truncate text-sm font-medium hover:underline"
        title={item.title}
      >
        {item.title}
      </Link>

      {/* Excerpt */}
      {excerpt && (
        <p className="mb-3 flex-1 text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {excerpt}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{item.type}</span>
        <span>{formatRelativeTime(item.updated_at)}</span>
      </div>
    </div>
  );
}
