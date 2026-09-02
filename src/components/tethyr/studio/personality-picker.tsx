// ── Personality Picker ───────────────────────────────────────────────────────
// Applies a personality's visual tone (appearance + accent) WITHOUT touching
// the section arrangement. Composition controls structure; Vibe controls the
// look. A confirm is shown only when it would replace another vibe.

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STUDIO_PERSONALITIES, type StudioPersonality } from "@/lib/studio-personalities";
import type { PageData, PageOwnerType } from "@/lib/page-blocks";
import { useUpdatePageConfig } from "@/hooks/use-page-editor";
import { friendlyError } from "@/lib/error-message";

interface PersonalityPickerProps {
  page: PageData;
  ownerId: string;
  ownerType: PageOwnerType;
  onClose: () => void;
  onBeforeApply?: () => void;
  onApplied?: () => void;
}

export function PersonalityPicker({
  page,
  ownerId,
  ownerType,
  onClose,
  onBeforeApply,
  onApplied,
}: PersonalityPickerProps) {
  const updateConfig = useUpdatePageConfig();
  const [confirming, setConfirming] = useState<StudioPersonality | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const activeId = page.config.vibeId;

  function apply(personality: StudioPersonality) {
    onBeforeApply?.();
    setApplyingId(personality.id);
    // Only overwrite the accent when this vibe intentionally supplies one.
    // Otherwise a manually-tuned accent color survives the vibe switch.
    const personalityHasAccent =
      personality.appearance.accentMode === "person" && !!personality.appearance.accentColor;
    updateConfig.mutate(
      {
        pageId: page.id,
        ownerId,
        ownerType,
        config: {
          ...page.config,
          vibeId: personality.id,
          // Preserve the legacy field for older readers; Composition remains independent.
          personalityId: page.config.personalityId,
          radius: personality.appearance.radius,
          typography: personality.appearance.typography,
          density: personality.appearance.density,
          accentMode: personalityHasAccent
            ? personality.appearance.accentMode
            : page.config.accentMode,
          accentColor: personalityHasAccent
            ? personality.appearance.accentColor
            : page.config.accentColor,
        },
      },
      {
        onSuccess: () => {
          setApplyingId(null);
          onClose();
          onApplied?.();
        },
        onError: (err) => {
          setApplyingId(null);
          toast.error(friendlyError(err, "Couldn't apply this vibe"));
        },
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
        Vibe
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Set the visual tone — rhythm, type, and accent — without changing your arrangement.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
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
              <span className="mb-2 flex h-8 items-center gap-1" aria-hidden="true">
                <span className="h-5 w-5 rounded-sm bg-[var(--user-accent,var(--trust))]/25" />
                <span className="h-6 w-10 rounded-md border border-[var(--user-accent,var(--trust))]/35" />
                <span className="h-3 w-3 rounded-full bg-[var(--user-accent,var(--trust))]" />
              </span>
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
            <DialogTitle>Switch vibe?</DialogTitle>
            <DialogDescription>
              This restyles your Studio with the {confirming?.label ?? ""} vibe. Your arrangement
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
              Switch vibe
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
