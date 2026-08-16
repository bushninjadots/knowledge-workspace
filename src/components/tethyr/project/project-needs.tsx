import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ProjectNeedRow } from "@/hooks/use-projects";
import {
  useCreateProjectNeed,
  useDeleteProjectNeed,
  useFillProjectNeed,
} from "@/hooks/use-projects";
import { useSkillsCatalog } from "@/hooks/use-current-user";

const URGENCY_META: Record<
  ProjectNeedRow["urgency"],
  { label: string; dot: string; badge: string }
> = {
  high: {
    label: "High priority",
    dot: "bg-destructive",
    badge: "border-destructive/30 bg-destructive/5 text-destructive",
  },
  normal: {
    label: "Soon",
    dot: "bg-brand-green",
    badge: "border-brand-green/30 bg-brand-green/5 text-brand-green",
  },
  low: {
    label: "Whenever",
    dot: "bg-muted-foreground/40",
    badge: "border-border/60 bg-surface text-muted-foreground",
  },
};

const URGENCIES: ProjectNeedRow["urgency"][] = ["high", "normal", "low"];

export function ProjectNeeds({
  needs,
  projectId,
  canManage,
}: {
  needs: ProjectNeedRow[];
  projectId: string;
  canManage: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [skillId, setSkillId] = useState("");
  const [urgency, setUrgency] = useState<ProjectNeedRow["urgency"]>("normal");
  const createNeed = useCreateProjectNeed();
  const fillNeed = useFillProjectNeed();
  const deleteNeed = useDeleteProjectNeed();
  const { data: catalog = [] } = useSkillsCatalog();

  const sortedSkills = [...catalog].sort((a, b) => a.name.localeCompare(b.name));
  const skillName = (id: string | null) => catalog.find((s) => s.id === id)?.name ?? null;

  const open = needs.filter((n) => !n.is_filled);
  if (open.length === 0 && !canManage) return null;

  const handleAdd = async () => {
    if (!title.trim()) return;
    try {
      await createNeed.mutateAsync({
        projectId,
        title: title.trim(),
        note: note.trim() || undefined,
        skillId: skillId || null,
        urgency,
      });
      setTitle("");
      setNote("");
      setSkillId("");
      setUrgency("normal");
      setShowAdd(false);
      toast.success("Need posted");
    } catch {
      toast.error("Failed to post need");
    }
  };

  const handleFill = async (n: ProjectNeedRow) => {
    try {
      await fillNeed.mutateAsync({ id: n.id, projectId });
      toast.success("Marked as filled");
    } catch {
      toast.error("Failed to mark filled");
    }
  };

  const handleDelete = async (n: ProjectNeedRow) => {
    try {
      await deleteNeed.mutateAsync({ id: n.id, projectId });
      toast.success("Need removed");
    } catch {
      toast.error("Failed to remove need");
    }
  };

  return (
    <section
      aria-labelledby="project-needs-heading"
      className="mt-10 border-t border-border/60 pt-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="project-needs-heading"
            className="font-display text-lg font-semibold tracking-tight"
          >
            Need help now
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Short, time-sensitive asks from the team — urgent ones first.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            aria-expanded={showAdd}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Add need
          </button>
        )}
      </div>

      {showAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleAdd();
          }}
          className="mt-4 space-y-3 rounded-xl border border-border/60 bg-surface/40 p-4"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need? (e.g. A logo designer)"
            aria-label="Need title"
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why, and by when? (optional)"
            aria-label="Need details"
            rows={2}
            className="w-full resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            aria-label="Related skill (optional)"
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">No specific skill</option>
            {sortedSkills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1" role="group" aria-label="Urgency">
              {URGENCIES.map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={urgency === u}
                  onClick={() => setUrgency(u)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    urgency === u
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {URGENCY_META[u].label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
              >
                Post need
              </button>
            </div>
          </div>
        </form>
      )}

      {open.length === 0 ? (
        canManage ? (
          <p className="mt-5 text-sm text-muted-foreground">Nothing needed right now.</p>
        ) : null
      ) : (
        <ul className="mt-4 divide-y divide-border/50">
          {open.map((n) => (
            <li key={n.id} className="flex items-start gap-3 py-3">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${URGENCY_META[n.urgency].dot}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${URGENCY_META[n.urgency].badge}`}
                  >
                    {URGENCY_META[n.urgency].label}
                  </span>
                  {n.skill_id && skillName(n.skill_id) && (
                    <span className="rounded-full border border-brand-purple/30 bg-brand-purple/5 px-2 py-0.5 text-[11px] text-brand-purple">
                      {skillName(n.skill_id)}
                    </span>
                  )}
                </div>
                {n.note && <p className="mt-1 text-sm text-muted-foreground">{n.note}</p>}
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleFill(n)}
                    aria-label={`Mark "${n.title}" filled`}
                    title="Mark filled"
                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-brand-green/10 hover:text-brand-green"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(n)}
                    aria-label={`Delete "${n.title}"`}
                    title="Delete"
                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
