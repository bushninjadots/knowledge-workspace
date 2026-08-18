import { useState } from "react";
import { Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { useSessionAvailability } from "@/hooks/use-sessions";
import { useSetSessionAvailability } from "@/hooks/use-sessions";

type Availability = NonNullable<Awaited<ReturnType<typeof useSessionAvailability>>["data"]>[number];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  available: { bg: "bg-brand-green/10", text: "text-brand-green", border: "border-brand-green/30" },
  unavailable: { bg: "bg-warning", text: "text-warning", border: "border-warning/40" },
  tentative: { bg: "bg-teaching", text: "text-teaching", border: "border-teaching/40" },
};

interface SlotInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: "available" | "unavailable" | "tentative";
}

function AvailabilityEditorDialog({
  availability,
  onSaved,
}: {
  availability: Availability[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<SlotInput[]>(() =>
    availability.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time.slice(0, 5),
      end_time: a.end_time.slice(0, 5),
      status: a.status as SlotInput["status"],
    })),
  );
  const setAvailability = useSetSessionAvailability();

  const addSlot = (day: number) => {
    setSlots((prev) => [
      ...prev,
      { day_of_week: day, start_time: "09:00", end_time: "10:00", status: "available" },
    ]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof SlotInput, value: string | number) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const overlaps = (a: SlotInput, b: SlotInput) =>
    a.day_of_week === b.day_of_week && a.start_time < b.end_time && b.start_time < a.end_time;

  const hasOverlaps = slots.some((a, i) => slots.some((b, j) => i !== j && overlaps(a, b)));

  const handleSave = async () => {
    if (hasOverlaps) {
      toast.error("Fix overlapping slots before saving");
      return;
    }
    setAvailability.mutate(slots, {
      onSuccess: () => {
        toast.success("Availability saved");
        setOpen(false);
        onSaved();
      },
      onError: () => toast.error("Failed to save availability"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit Availability
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Weekly Availability</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((label, dayIdx) => (
            <div key={dayIdx} className="space-y-1">
              <div className="text-xs font-medium text-center text-muted-foreground">{label}</div>
              {slots
                .filter((s) => s.day_of_week === dayIdx)
                .map((slot, i) => {
                  const globalIdx = slots.indexOf(slot);
                  return (
                    <div key={i} className="flex items-center gap-1 rounded border p-1 text-xs">
                      <input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) => updateSlot(globalIdx, "start_time", e.target.value)}
                        className="w-14 bg-transparent"
                        step="900"
                      />
                      <span>-</span>
                      <input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) => updateSlot(globalIdx, "end_time", e.target.value)}
                        className="w-14 bg-transparent"
                        step="900"
                      />
                      <select
                        value={slot.status}
                        onChange={(e) => updateSlot(globalIdx, "status", e.target.value)}
                        className="w-16 bg-transparent text-xs"
                      >
                        <option value="available">Free</option>
                        <option value="tentative">Maybe</option>
                        <option value="unavailable">Busy</option>
                      </select>
                      <button
                        onClick={() => removeSlot(globalIdx)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              <button
                onClick={() => addSlot(dayIdx)}
                className="w-full rounded border border-dashed py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                + Add
              </button>
            </div>
          ))}
        </div>
        {hasOverlaps && (
          <p className="text-xs text-destructive">Some slots overlap — fix before saving</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={setAvailability.isPending}>
            {setAvailability.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AvailabilitySettings({ availability }: { availability: Availability[] }) {
  if (availability.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border card-border bg-surface/20 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No availability set</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure your weekly availability so others can schedule sessions with you.
          </p>
          <AvailabilityEditorDialog availability={availability} onSaved={() => {}} />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Weekly Schedule</h3>
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="flex flex-col items-center gap-2 rounded-xl border card-border bg-surface/30 p-3"
              >
                <span className="text-[11px] font-semibold text-muted-foreground">{day}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-[11px] text-muted-foreground">
                  —
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const byDay: Record<number, Availability[]> = {};
  for (const slot of availability) {
    if (!byDay[slot.day_of_week]) byDay[slot.day_of_week] = [];
    byDay[slot.day_of_week].push(slot);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Weekly Schedule</h3>
          <AvailabilityEditorDialog availability={availability} onSaved={() => {}} />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((day, idx) => {
            const slots = byDay[idx] ?? [];
            const statusStyle = slots[0]
              ? (STATUS_STYLES[slots[0].status] ?? STATUS_STYLES.available)
              : null;
            return (
              <div
                key={day}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                  statusStyle
                    ? `${statusStyle.border} ${statusStyle.bg}`
                    : "border-border/40 bg-surface/30"
                }`}
              >
                <span className="text-[11px] font-semibold text-muted-foreground">{day}</span>
                {slots.length > 0 ? (
                  <div className="space-y-1 text-center">
                    {slots.map((s) => (
                      <p key={s.id} className={`text-[11px] font-medium ${statusStyle?.text}`}>
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-[10px] text-muted-foreground">
                    —
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
