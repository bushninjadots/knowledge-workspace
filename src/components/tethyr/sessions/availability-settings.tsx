import { Clock } from "lucide-react";
import type { useSessionAvailability } from "@/hooks/use-sessions";

type Availability = Awaited<ReturnType<typeof useSessionAvailability>>["data"][number];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  available: { bg: "bg-brand-green/10", text: "text-brand-green", border: "border-brand-green/30" },
  unavailable: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
  tentative: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
};

export function AvailabilitySettings({
  availability,
}: {
  availability: Availability[];
}) {
  if (availability.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border/40 bg-surface/20 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated">
            <Clock className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No availability set</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure your weekly availability so others can schedule sessions with you.
          </p>
          <button className="mt-4 rounded-xl bg-brand-green px-4 py-2 text-xs font-semibold text-background transition-all hover:bg-brand-green/90">
            Set Availability
          </button>
        </div>

        {/* Weekly template */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Weekly Schedule</h3>
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-surface/30 p-3"
              >
                <span className="text-[11px] font-semibold text-muted-foreground">{day}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-[10px] text-muted-foreground/60">
                  —
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4 rounded-2xl border border-border/40 bg-surface/30 p-6">
          <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Timezone</label>
              <p className="mt-1 text-sm text-foreground">UTC</p>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Buffer Time</label>
              <p className="mt-1 text-sm text-foreground">15 min between sessions</p>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Max Sessions / Day</label>
              <p className="mt-1 text-sm text-foreground">5</p>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Preferred Length</label>
              <p className="mt-1 text-sm text-foreground">60 min</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Group by day
  const byDay: Record<number, Availability[]> = {};
  for (const slot of availability) {
    if (!byDay[slot.day_of_week]) byDay[slot.day_of_week] = [];
    byDay[slot.day_of_week].push(slot);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Weekly Schedule</h3>
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((day, idx) => {
            const slots = byDay[idx] ?? [];
            const statusStyle = slots[0]
              ? STATUS_STYLES[slots[0].status] ?? STATUS_STYLES.available
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
                      <p key={s.id} className={`text-[10px] font-medium ${statusStyle?.text}`}>
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-[10px] text-muted-foreground/60">
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
