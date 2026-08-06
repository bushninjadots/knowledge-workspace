import { Folder, ChevronRight, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteCollection, type LibraryCollection } from "@/hooks/use-library";

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

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-border/40 bg-surface/40 px-4 py-3 text-left transition-all duration-200 hover:border-border/60 hover:bg-surface/60 hover:shadow-soft"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${collection.color}20` }}
      >
        <Folder className="h-4 w-4" style={{ color: collection.color }} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{collection.name}</p>
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
          <DropdownMenuContent align="end" className="w-44">
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
  );
}
