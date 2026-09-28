import { useState } from "react";
import { Folder, ChevronRight, Trash2, MoreHorizontal, Share2, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDeleteCollection,
  useToggleCollectionShared,
  type LibraryCollection,
} from "@/hooks/use-library";

export function CollectionCard({
  collection,
  itemCount,
  onClick,
}: {
  collection: LibraryCollection;
  itemCount?: number;
  onClick: () => void;
}) {
  const deleteCollection = useDeleteCollection();
  const toggleShared = useToggleCollectionShared();
  const [copied, setCopied] = useState(false);

  async function copyShareLink() {
    const url = `${window.location.origin}/library/shared/collection/${collection.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <Card asChild>
      <button
        onClick={onClick}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-lift duration-150 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated/50"
      >
        {/* color may be a raw oklch string (legacy rows) or a CSS var() token; color-mix
            handles both, unlike the old `${color}20` alpha append. */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in oklab, ${collection.color} 12%, transparent)`,
          }}
        >
          <Folder className="h-4 w-4" style={{ color: collection.color }} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            <span className="truncate">{collection.name}</span>
            {collection.shared && (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/60 px-1.5 py-px text-[10px] text-muted-foreground"
                title="Shared — anyone with the link can view"
              >
                <Share2 className="h-2.5 w-2.5" aria-hidden />
                Shared
              </span>
            )}
          </p>
          {itemCount !== undefined && (
            <p className="text-xs text-muted-foreground">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  toggleShared.mutate(
                    { id: collection.id, shared: !collection.shared },
                    {
                      onSuccess: () =>
                        toast.success(
                          collection.shared
                            ? "Sharing turned off — the link no longer works"
                            : "Shared — anyone with the link can view this collection",
                        ),
                    },
                  );
                }}
              >
                <Share2 className="h-3.5 w-3.5" />
                {collection.shared ? "Stop sharing" : "Share collection"}
              </DropdownMenuItem>
              {collection.shared && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyShareLink();
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                  {copied ? "Link copied" : "Copy share link"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCollection.mutate(collection.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete collection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </div>
      </button>
    </Card>
  );
}
