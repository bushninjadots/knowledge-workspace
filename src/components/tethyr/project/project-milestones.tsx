import { useState } from "react";
import { CheckCircle2, Circle, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { MilestoneRow } from "@/hooks/use-projects";
import { useCreateMilestone, useUpdateMilestone, useDeleteMilestone } from "@/hooks/use-projects";

const STATUS_ICON: Record<MilestoneRow["status"], typeof Circle> = {
  done: CheckCircle2,
  in_progress: Clock,
  pending: Circle,
};

const STATUS_STYLE: Record<MilestoneRow["status"], string> = {
  done: "text-brand-green",
  in_progress: "text-primary",
  pending: "text-muted-foreground",
};

const STATUS_BG: Record<MilestoneRow["status"], string> = {
  done: "bg-brand-green",
  in_progress: "bg-primary",
  pending: "bg-muted-foreground/40",
};

export function MilestonesTimeline({
  milestones,
  projectId,
  isOwner,
}: {
  milestones: MilestoneRow[];
  projectId: string;
  isOwner: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const createMutation = useCreateMilestone();
  const updateMutation = useUpdateMilestone();
  const deleteMutation = useDeleteMilestone();

  const doneCount = milestones.filter((m) => m.status === "done").length;
  const total = milestones.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const handleAdd = async () => {
    if (!title.trim()) return;
    try {
      await createMutation.mutateAsync({
        projectId,
        title: title.trim(),
        description: desc.trim() || undefined,
      });
      setTitle("");
      setDesc("");
      setShowAdd(false);
      toast.success("Milestone added");
    } catch {
      toast.error("Failed to add milestone");
    }
  };

  const handleToggle = async (m: MilestoneRow) => {
    const next = m.status === "done" ? "pending" : "done";
    try {
      await updateMutation.mutateAsync({ id: m.id, projectId, status: next });
    } catch {
      toast.error("Failed to update milestone");
    }
  };

  const handleAdvance = async (m: MilestoneRow) => {
    const next = m.status === "pending" ? "in_progress" : "done";
    try {
      await updateMutation.mutateAsync({ id: m.id, projectId, status: next });
    } catch {
      toast.error("Failed to update milestone");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id, projectId });
      toast.success("Milestone removed");
    } catch {
      toast.error("Failed to delete milestone");
    }
  };

  return (
    <div className="card-border rounded-3xl border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground/80">Milestones</h3>
          {total > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {doneCount} of {total} complete ({progress}%)
            </p>
          )}
        </div>
        {isOwner && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-2xl border border-border/60 bg-background/40 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Milestone title"
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!title.trim()}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
            >
              Save
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

      {total > 0 && (
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-gradient-brand transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No milestones yet.</p>
      ) : (
        <div className="space-y-3">
          {milestones.map((m) => {
            const Icon = STATUS_ICON[m.status];
            return (
              <div key={m.id} className="flex items-start gap-3">
                <button
                  onClick={() => (isOwner ? handleToggle(m) : undefined)}
                  className={`mt-0.5 shrink-0 ${STATUS_STYLE[m.status]} ${isOwner ? "cursor-pointer hover:opacity-70" : ""}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${m.status === "done" ? "text-muted-foreground line-through" : ""}`}
                  >
                    {m.title}
                  </p>
                  {m.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
                  )}
                  {m.due_date && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Due {new Date(m.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isOwner && m.status !== "done" && (
                    <button
                      onClick={() => handleAdvance(m)}
                      className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
                    >
                      {m.status === "pending" ? "Start" : "Complete"}
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
