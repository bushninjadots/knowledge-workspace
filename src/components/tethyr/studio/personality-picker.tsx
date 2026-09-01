// ── Personality Picker ───────────────────────────────────────────────────────
// Applies a personality's look (appearance + accent) WITHOUT touching the
// section arrangement. Composition (the layout) is applied destructively via
// the CompositionPicker; this panel only restyles, so it is safe to switch at
// any time. A confirm is shown only when it would replace another personality.

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applyStudioPersonality,
  STUDIO_PERSONALITIES,
  type StudioPersonality,
} from "@/lib/studio-personalities";
import type { PageData } from "@/lib/page-blocks";
import { useUpdatePageConfig } from "@/hooks/use-page-editor";

interface PersonalityPickerProps {
  page: PageData;
  onClose: () => void;
  onApplied?: () => void;
}

export function PersonalityPicker({ page, onClose, onApplied }: PersonalityPickerProps) {
  const updateConfig = useUpdatePageConfig();
  const [confirming, setConfirming] = useState<StudioPersonality | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const activeId = page.config.personalityId;

  function apply(personality: StudioPersonality) {
    const applied = applyStudioPersonality(personality);
    setApplyingId(personality.id);
    updateConfig.mutate(
      { pageId: page.id, config: applied.config },
      {
        onSuccess: () => {
          setApplyingId(null);
          onClose();
          onApplied?.();
        },
        onError: () => setApplyingId(null),
      },
    );
  }

  function onSelect(personality: StudioPersonality) {
    if (activeId && activeId !== personality.id) {
      setConfirming(personality);
      return;
    }
    apply(personality);
  }

  return (
    <div className="relative mb-4 rounded-xl border border-card-border bg-surface-elevated p-4">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        aria-label="Close personality picker"
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Personality
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Restyles your Studio — rhythm, type, and accent — without changing your arrangement.
      </p>
      <div className="flex flex-col gap-1.5">
        {STUDIO_PERSONALITIES.map((personality) => {
          const isActive = personality.id === activeId;
          const isApplying = applyingId === personality.id;
          return (
            <button
              key={personality.id}
              type="button"
              onClick={() => onSelect(personality)}
              disabled={isApplying}
              className={[
                "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                isActive
                  ? "border-[var(--user-accent,var(--trust))] bg-[var(--user-accent,var(--trust))]/5"
                  : "border-transparent bg-surface/50 hover:border-card-border hover:bg-surface",
                isApplying ? "opacity-60" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="font-medium text-foreground">
                {personality.label}
                {isActive ? " · Applied" : ""}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {personality.description}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Switch personality?</DialogTitle>
            <DialogDescription>
              This restyles your Studio with the {confirming?.label ?? ""} look. Your arrangement
              stays exactly as you left it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              size="sm"
              onClick={() => {
                const personality = confirming;
                setConfirming(null);
                if (personality) apply(personality);
              }}
            >
              Switch personality
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
