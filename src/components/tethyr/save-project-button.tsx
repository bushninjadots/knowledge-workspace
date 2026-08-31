import { Bookmark, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCreateItem, useLibraryItems, useUpdateItem } from "@/hooks/use-library";
import { useCurrentUser } from "@/hooks/use-current-user";

export function SaveProjectButton({
  projectId,
  title,
  description,
  size = "sm",
}: {
  projectId: string;
  title: string;
  description?: string | null;
  size?: "sm" | "default";
}) {
  const { data: me } = useCurrentUser();
  const { data: items = [] } = useLibraryItems({ type: "link" });
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const existing = items.find((item) => item.project_id === projectId);
  const busy = createItem.isPending || updateItem.isPending;

  if (!me?.userId) return null;

  const save = () => {
    if (existing) {
      updateItem.mutate(
        { id: existing.id, is_favorite: !existing.is_favorite },
        {
          onSuccess: () => toast.success(existing.is_favorite ? "Removed from saved" : "Saved"),
          onError: () => toast.error("Couldn't update saved project"),
        },
      );
      return;
    }

    createItem.mutate(
      {
        title,
        content: description ?? "",
        type: "link",
        project_id: projectId,
        url: `${window.location.origin}/projects/${projectId}`,
      },
      {
        onSuccess: () => toast.success("Project saved to your Library"),
        onError: () => toast.error("Couldn't save project"),
      },
    );
  };

  const saved = !!existing?.is_favorite;
  return (
    <Button
      type="button"
      size={size}
      variant={saved ? "default" : "outline"}
      onClick={save}
      busy={busy}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      className="gap-1.5 rounded-full"
    >
      {saved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
