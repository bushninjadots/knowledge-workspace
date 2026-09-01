// ── Composition Picker ────────────────────────────────────────────────────────
// Picks a whole-page personality composition. Applying is destructive for the
// section ARRANGEMENT (it replaces the page's sections) and records the preset,
// but preserves any manually chosen appearance so edits stay sticky. Because a
// chosen composition can wipe custom arrangement work, we confirm before
// applying whenever the current arrangement already has a personality preset.

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
import type { StudioConfig } from "@/lib/studio-config";
import { useApplyStudioComposition } from "@/hooks/use-page-editor";

interface CompositionPickerProps {
  page: PageData;
  onClose: () => void;
  onApplied?: () => void;
}

export function CompositionPicker({ page, onClose, onApplied }: CompositionPickerProps) {
  const applyComposition = useApplyStudioComposition();
  const [confirming, setConfirming] = useState<StudioPersonality | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const activeId = page.config.compositionId;
  const hasExistingArrangement = page.layout.sections.some((section) => section.blocks.length > 0);

  function apply(personality: StudioPersonality) {
    const applied = applyStudioPersonality(personality);
    const nextConfig: StudioConfig = {
      ...page.config,
      // A composition swap changes the arrangement and records the preset, but
      // preserves any manually chosen appearance so it stays sticky across swaps.
      compositionId: personality.id,
      // Preserve the legacy field for older readers; Vibe remains independent.
      personalityId: page.config.personalityId,
    };
    setApplyingId(personality.id);
    applyComposition.mutate(
      {
        pageId: page.id,
        layoutId: page.layoutId,
        layout: applied.layout,
        config: nextConfig,
      },
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
    if (activeId || hasExistingArrangement) {
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
        aria-label="Close composition picker"
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Composition
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Choose the arrangement of your Studio. Vibe and Appearance control its visual tone.
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
              <span className="mb-2 block h-8" aria-hidden="true">
                <CompositionPreview personality={personality} />
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
            <DialogTitle>Replace your composition?</DialogTitle>
            <DialogDescription>
              Applying the {confirming?.label ?? ""} personality replaces your current section
              arrangement. Your custom appearance stays the same. Publish keeps your page live until
              you are done.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                const personality = confirming;
                setConfirming(null);
                if (personality) apply(personality);
              }}
            >
              Replace composition
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

function CompositionPreview({ personality }: { personality: StudioPersonality }) {
  const sections = personality.composition().sections.slice(0, 3);
  return (
    <div className="flex h-8 items-end gap-1 opacity-70">
      {sections.map((section, index) => (
        <span
          key={`${section.layout}-${index}`}
          className={[
            "block rounded-sm bg-[var(--user-accent,var(--trust))]/35",
            section.layout === "full" || section.layout === "compact_list"
              ? "w-full"
              : section.layout === "featured_work"
                ? "w-3/4"
                : "w-1/2",
          ].join(" ")}
          style={{ height: `${Math.max(10, 28 - index * 5)}px` }}
        />
      ))}
    </div>
  );
}
