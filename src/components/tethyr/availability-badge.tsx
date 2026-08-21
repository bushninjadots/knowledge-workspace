import { useState } from "react";
import { Circle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AvailabilityStatus } from "@/lib/skill-match";
import { AVAILABILITY_OPTIONS } from "@/data/mocks/availability";

export function getStatusDisplay(status: AvailabilityStatus) {
  return AVAILABILITY_OPTIONS.find((s) => s.value === status) ?? null;
}

export function AvailabilityBadge({
  status,
  size = "sm",
}: {
  status: AvailabilityStatus;
  size?: "xs" | "sm" | "md";
}) {
  const display = getStatusDisplay(status);
  if (!display) return null;
  const Icon = display.icon;
  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-[11px] gap-1",
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${display.bg} ${display.color} ${sizeClasses[size]}`}
    >
      <Icon className={`${size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"}`} />
      {display.label}
    </span>
  );
}

export function AvailabilitySelector({
  current,
  onSave,
  openUp = false,
}: {
  current: AvailabilityStatus;
  onSave: (status: AvailabilityStatus) => void;
  /** Open the menu above the trigger (for bottom-anchored placements like the sidebar). */
  openUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currentDisplay = getStatusDisplay(current);
  const CurrentIcon = currentDisplay?.icon ?? Circle;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Set availability status"
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-80 ${
          currentDisplay
            ? `${currentDisplay.bg} ${currentDisplay.color}`
            : "border-border/60 bg-background text-muted-foreground"
        }`}
      >
        <CurrentIcon className="h-3 w-3" />
        {currentDisplay?.label ?? "Set status"}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            aria-label="Availability statuses"
            className={`absolute right-0 z-50 w-52 rounded-xl border border-border/60 bg-surface p-1.5 shadow-xl ${
              openUp ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            {AVAILABILITY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = current === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onSave(opt.value);
                    setOpen(false);
                    toast.success(`Status set to ${opt.label}`);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
                    isActive
                      ? `${opt.bg} ${opt.color} font-medium`
                      : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? opt.color : ""}`} />
                  {opt.label}
                </button>
              );
            })}
            {current && (
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onSave(null);
                  setOpen(false);
                  toast.success("Status cleared");
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              >
                Clear status
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function useUpdateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: AvailabilityStatus) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ availability: status })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["current-user"] });
    },
  });
}
