import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, ListFilter, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import type { MilestoneRow } from "@/hooks/use-projects";
import { useCreateMilestone, useUpdateMilestone, useDeleteMilestone } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COLUMNS: { status: MilestoneRow["status"]; label: string; icon: typeof Circle }[] = [
  { status: "pending", label: "Up next", icon: Circle },
  { status: "in_progress", label: "In motion", icon: Clock },
  { status: "done", label: "Complete", icon: CheckCircle2 },
];

const STATUS_STYLE: Record<MilestoneRow["status"], string> = {
  pending: "text-muted-foreground",
  in_progress: "text-primary",
  done: "text-trust",
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
  const [view, setView] = useState<"all" | "active">("all");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneRow | null>(null);
  const [dragMilestone, setDragMilestone] = useState<MilestoneRow | null>(null);
  const createMutation = useCreateMilestone();
  const updateMutation = useUpdateMilestone();
  const deleteMutation = useDeleteMilestone();

  // Drags start after a 6px threshold so clicks still open the milestone
  // dialog; keyboard drag is supported for reduced-mobility users.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const doneCount = milestones.filter((m) => m.status === "done").length;
  const progress = milestones.length ? Math.round((doneCount / milestones.length) * 100) : 0;
  const visibleMilestones = useMemo(
    () =>
      view === "active"
        ? milestones.filter((milestone) => milestone.status !== "done")
        : milestones,
    [milestones, view],
  );

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

  const moveMilestone = async (milestone: MilestoneRow, status: MilestoneRow["status"]) => {
    if (milestone.status === status) return;
    try {
      await updateMutation.mutateAsync({ id: milestone.id, projectId, status });
    } catch {
      toast.error("Failed to update milestone");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id, projectId });
      setSelectedMilestone(null);
      toast.success("Milestone removed");
    } catch {
      toast.error("Failed to delete milestone");
    }
  };

  function handleDragStart(event: DragStartEvent) {
    setDragMilestone(milestones.find((m) => m.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragMilestone(null);
    const { active, over } = event;
    if (!over) return;
    const milestone = milestones.find((m) => m.id === active.id);
    if (!milestone) return;
    // The drop target is either a column or another card — both carry their
    // current status in data, so one resolution path covers both.
    const targetStatus = over.data.current?.status as MilestoneRow["status"] | undefined;
    if (!targetStatus || !COLUMNS.some((column) => column.status === targetStatus)) return;
    void moveMilestone(milestone, targetStatus);
  }

  const handlePanelStatus = async (status: MilestoneRow["status"]) => {
    if (!selectedMilestone || selectedMilestone.status === status) return;
    try {
      await updateMutation.mutateAsync({ id: selectedMilestone.id, projectId, status });
      setSelectedMilestone({ ...selectedMilestone, status });
    } catch {
      toast.error("Failed to update milestone");
    }
  };

  return (
    <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-foreground">Roadmap</h3>
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {doneCount}/{milestones.length} complete
            </Badge>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            A shared view of what the team is moving through next.
          </p>
        </div>
        {isOwner && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAdd((value) => !value)}
            aria-expanded={showAdd}
            aria-controls="add-milestone-form"
          >
            <Plus data-icon="inline-start" />
            {showAdd ? "Close" : "Add milestone"}
          </Button>
        )}
      </div>

      {showAdd && (
        <div
          id="add-milestone-form"
          className="mt-4 flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-3"
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What are you building toward?"
            aria-label="Milestone title"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                void handleAdd();
              }
            }}
          />
          <Input
            value={desc}
            onChange={(event) => setDesc(event.target.value)}
            placeholder="A little context (optional)"
            aria-label="Milestone description"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleAdd()}
              disabled={!title.trim() || createMutation.isPending}
            >
              Save milestone
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {milestones.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2" aria-label="Roadmap view">
            <ListFilter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setView("all")}
              aria-pressed={view === "all"}
              className={
                view === "all"
                  ? "text-xs font-medium text-foreground"
                  : "text-xs text-muted-foreground hover:text-foreground"
              }
            >
              All work
            </button>
            <span className="text-muted-foreground/50">/</span>
            <button
              type="button"
              onClick={() => setView("active")}
              aria-pressed={view === "active"}
              className={
                view === "active"
                  ? "text-xs font-medium text-foreground"
                  : "text-xs text-muted-foreground hover:text-foreground"
              }
            >
              Now & next
            </button>
          </div>
          <div className="flex min-w-[12rem] flex-1 items-center justify-end gap-3">
            <div
              className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-surface-elevated"
              role="progressbar"
              aria-label={`${progress}% complete`}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-foreground transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
          </div>
        </div>
      )}

      {milestones.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No milestones yet.</p>
          {isOwner && (
            <p className="mt-1 text-xs text-muted-foreground">
              Add the first marker for the team&apos;s next move.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 -mx-1 overflow-x-auto px-1 pb-2" aria-label="Project roadmap board">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragMilestone(null)}
          >
            <div className="grid min-w-[48rem] grid-cols-3 gap-3">
              {COLUMNS.map(({ status, label, icon }) => (
                <MilestoneColumn
                  key={status}
                  status={status}
                  label={label}
                  icon={icon}
                  items={visibleMilestones.filter((milestone) => milestone.status === status)}
                  isOwner={isOwner}
                  deletePending={deleteMutation.isPending}
                  onOpen={(milestone) => setSelectedMilestone(milestone)}
                  onDelete={(milestone) => void handleDelete(milestone.id)}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {dragMilestone ? (
                <div className="w-64 -rotate-1 rounded-lg border border-border/80 bg-surface-elevated/95 p-3 shadow-lg shadow-black/10">
                  <div className="min-w-0">
                    <h5
                      className={`text-sm ${
                        dragMilestone.status === "done"
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {dragMilestone.title}
                    </h5>
                    {dragMilestone.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {dragMilestone.description}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      <Dialog
        open={selectedMilestone !== null}
        onOpenChange={(open) => !open && setSelectedMilestone(null)}
      >
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          {selectedMilestone && (
            <>
              <DialogHeader className="border-b border-border/60 px-5 py-5 text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {COLUMNS.find((column) => column.status === selectedMilestone.status)?.label}
                  </Badge>
                  {selectedMilestone.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Due {new Date(selectedMilestone.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <DialogTitle className="pt-1 text-xl tracking-tight">
                  {selectedMilestone.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedMilestone.description ||
                    "Add context to help collaborators understand this piece of work."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-5 px-5 py-5">
                <section aria-labelledby="work-status-heading">
                  <h4
                    id="work-status-heading"
                    className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Move this work
                  </h4>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {COLUMNS.map(({ status, label, icon: Icon }) => (
                      <Button
                        key={status}
                        type="button"
                        variant={selectedMilestone.status === status ? "default" : "outline"}
                        className="h-auto flex-col gap-1 px-2 py-3 text-xs"
                        onClick={() => void handlePanelStatus(status)}
                        disabled={updateMutation.isPending}
                      >
                        <Icon data-icon="inline-start" className={STATUS_STYLE[status]} />
                        {label}
                      </Button>
                    ))}
                  </div>
                </section>
                {isOwner && (
                  <div className="flex items-center justify-between border-t border-border/60 pt-4">
                    <p className="text-xs text-muted-foreground">
                      This work is part of the project roadmap.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(selectedMilestone.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 data-icon="inline-start" />
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MilestoneColumn({
  status,
  label,
  icon,
  items,
  isOwner,
  deletePending,
  onOpen,
  onDelete,
}: {
  status: MilestoneRow["status"];
  label: string;
  icon: typeof Circle;
  items: MilestoneRow[];
  isOwner: boolean;
  deletePending: boolean;
  onOpen: (milestone: MilestoneRow) => void;
  onDelete: (milestone: MilestoneRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });
  const Icon = icon;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`roadmap-${status}`}
      className={`flex min-h-44 flex-col rounded-lg p-3 transition-colors ${
        isOver
          ? "bg-surface-elevated/70 ring-1 ring-inset ring-[var(--user-accent-border,var(--border-strong))]"
          : "bg-background/45"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${STATUS_STYLE[status]}`} aria-hidden="true" />
          <h4 id={`roadmap-${status}`} className="text-sm font-medium text-foreground">
            {label}
          </h4>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Nothing here yet.</p>
        ) : (
          items.map((milestone) => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              draggable={isOwner}
              showDelete={isOwner}
              deletePending={deletePending}
              onOpen={() => onOpen(milestone)}
              onDelete={() => onDelete(milestone)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function MilestoneCard({
  milestone,
  draggable,
  showDelete,
  deletePending,
  onOpen,
  onDelete,
}: {
  milestone: MilestoneRow;
  draggable: boolean;
  showDelete: boolean;
  deletePending: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: milestone.id,
    data: { status: milestone.status },
    disabled: !draggable,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  // The card is always reachable as a button (open the milestone); when it is
  // draggable, dnd-kit's own attributes (role/tabIndex/aria) apply on top.
  const interactiveAttributes = {
    role: "button" as const,
    tabIndex: 0,
    ...(draggable ? attributes : {}),
  };

  return (
    <div
      ref={setNodeRef}
      aria-label={`Open milestone ${milestone.title}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      {...interactiveAttributes}
      {...listeners}
      style={style}
      className={`rounded-lg border border-border/60 bg-surface-elevated/35 p-3 transition-colors hover:border-border hover:bg-surface-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isDragging ? "opacity-40" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h5
            className={`text-sm ${
              milestone.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {milestone.title}
          </h5>
          {milestone.description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {milestone.description}
            </p>
          )}
          {milestone.due_date && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Due {new Date(milestone.due_date).toLocaleDateString()}
            </p>
          )}
        </div>
        {showDelete && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 shrink-0"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            disabled={deletePending}
            aria-label={`Delete milestone ${milestone.title}`}
          >
            <Trash2 data-icon="inline-start" />
          </Button>
        )}
      </div>
    </div>
  );
}
