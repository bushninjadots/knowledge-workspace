import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ProjectUpdateRow } from "@/hooks/use-projects";
import { useCreateProjectUpdate, useDeleteProjectUpdate } from "@/hooks/use-projects";
import { timeAgo } from "@/lib/time";

export function ProjectUpdatesJournal({
  updates,
  projectId,
  isContributor,
}: {
  updates: ProjectUpdateRow[];
  projectId: string;
  isContributor: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [weekNumber, setWeekNumber] = useState("");
  const createMutation = useCreateProjectUpdate();
  const deleteMutation = useDeleteProjectUpdate();

  const handleAdd = async () => {
    if (!title.trim() || !body.trim()) return;
    try {
      await createMutation.mutateAsync({
        projectId,
        title: title.trim(),
        body: body.trim(),
        week_number: weekNumber ? parseInt(weekNumber) : undefined,
      });
      setTitle("");
      setBody("");
      setWeekNumber("");
      setShowAdd(false);
      toast.success("Update posted");
    } catch {
      toast.error("Failed to post update");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id, projectId });
      toast.success("Update deleted");
    } catch {
      toast.error("Failed to delete update");
    }
  };

  return (
    <div className="card-border rounded-3xl border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground/80">Development Journal</h3>
        {isContributor && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            New Update
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-2xl border border-border/60 bg-background/40 p-3">
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Update title"
              className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              placeholder="Week #"
              className="w-20 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              type="number"
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened this week? (Markdown supported)"
            rows={4}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!title.trim() || !body.trim()}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
            >
              Post Update
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {updates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No updates yet.</p>
      ) : (
        <div className="space-y-4">
          {updates.map((u) => {
            const name = u.author?.display_name || u.author?.handle || "Unknown";
            return (
              <div key={u.id} className="rounded-2xl border border-border/60 bg-background/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {u.week_number != null && (
                        <span className="rounded-full border border-border/60 bg-surface-elevated px-2 py-0.5 text-[10px] font-medium tabular-nums">
                          Week {u.week_number}
                        </span>
                      )}
                      <h4 className="text-sm font-medium">{u.title}</h4>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Link
                        to="/u/$handle"
                        params={{ handle: u.author?.handle ?? "unknown" }}
                        className="hover:underline"
                      >
                        {name}
                      </Link>
                      <span aria-hidden>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(u.created_at)}
                      </span>
                    </div>
                  </div>
                  {isContributor && (
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="prose-custom mt-2 text-sm text-foreground/90">
                  <Markdown remarkPlugins={[remarkGfm]}>{u.body}</Markdown>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
