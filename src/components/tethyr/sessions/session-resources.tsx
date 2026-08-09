import { useState } from "react";
import { Link, FileText, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAddSessionResource, useDeleteSessionResource } from "@/hooks/use-sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SessionResource = {
  id: string;
  session_id: string;
  title: string;
  url: string | null;
  resource_type: string;
  created_at: string;
};

function ResourceIcon({ type }: { type: string }) {
  switch (type) {
    case "link":
      return <Link className="h-4 w-4" />;
    case "document":
      return <FileText className="h-4 w-4" />;
    default:
      return <Link className="h-4 w-4" />;
  }
}

export function SessionResources({
  sessionId,
  resources,
  isOrganizer,
}: {
  sessionId: string;
  resources: SessionResource[];
  isOrganizer: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const addResource = useAddSessionResource();
  const deleteResource = useDeleteSessionResource();

  async function handleAdd() {
    if (!title.trim()) return;
    try {
      await addResource.mutateAsync({
        sessionId,
        title: title.trim(),
        url: url.trim() || undefined,
        resourceType: url.trim() ? "link" : "document",
      });
      toast.success("Resource added");
      setTitle("");
      setUrl("");
      setIsAdding(false);
    } catch {
      toast.error("Failed to add resource");
    }
  }

  async function handleDelete(resourceId: string) {
    try {
      await deleteResource.mutateAsync({ resourceId, sessionId });
      toast.success("Resource removed");
    } catch {
      toast.error("Failed to remove resource");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Resources</h2>
        </div>
        {isOrganizer && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            className="h-7 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="rounded-2xl border card-border bg-surface/30 p-3 space-y-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              placeholder="Resource title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">URL (optional)</Label>
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!title.trim() || addResource.isPending}
              className="h-7 text-xs bg-brand-green text-background hover:bg-brand-green/90"
            >
              {addResource.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                "Add Resource"
              )}
            </Button>
          </div>
        </div>
      )}

      {resources.length === 0 ? (
        <p className="text-sm text-muted-foreground">No resources yet.</p>
      ) : (
        <div className="space-y-2">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="flex items-center gap-3 rounded-2xl border card-border bg-surface/30 px-3 py-2"
            >
              <ResourceIcon type={resource.resource_type} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{resource.title}</div>
                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs text-primary hover:underline"
                  >
                    {resource.url}
                  </a>
                )}
              </div>
              {resource.url && (
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {isOrganizer && (
                <button
                  onClick={() => handleDelete(resource.id)}
                  disabled={deleteResource.isPending}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-warning hover:text-warning"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
