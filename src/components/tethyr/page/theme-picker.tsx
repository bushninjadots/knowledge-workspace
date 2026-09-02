// ── Theme Picker ──────────────────────────────────────────────────────────────
// A panel that shows all available themes as preview cards. Each card shows
// a miniature visual preview (color swatches + shape hints). Clicking a card
// applies the theme to the current page. The active theme is highlighted.

import { useState } from "react";
import { Check, PaintBucket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useThemeCatalog } from "@/hooks/use-theme-catalog";
import { useUpdatePageTheme } from "@/hooks/use-page-editor";
import type { PageData, PageOwnerType } from "@/lib/page-blocks";
import { DEFAULT_THEME_ID } from "@/lib/constants";

interface ThemePickerProps {
  page: PageData;
  ownerId: string;
  ownerType: PageOwnerType;
  onClose: () => void;
  onBeforeApply?: () => void;
  onApplied: () => void;
}

export function ThemePicker({
  page,
  ownerId,
  ownerType,
  onClose,
  onBeforeApply,
  onApplied,
}: ThemePickerProps) {
  const { data: themes = [], isLoading } = useThemeCatalog();
  const updateTheme = useUpdatePageTheme();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const currentThemeId = page.themeId || DEFAULT_THEME_ID;

  function handleApply(themeId: string) {
    onBeforeApply?.();
    setApplyingId(themeId);
    updateTheme.mutate(
      { pageId: page.id, ownerId, ownerType, themeId },
      {
        onSuccess: () => {
          setApplyingId(null);
          onApplied();
        },
        onError: () => {
          setApplyingId(null);
        },
      },
    );
  }

  function handleReset() {
    // Reset to Tethyr Default by setting theme_id to null.
    onBeforeApply?.();
    setApplyingId("default");
    updateTheme.mutate(
      { pageId: page.id, ownerId, ownerType, themeId: null },
      {
        onSuccess: () => {
          setApplyingId(null);
          onApplied();
        },
        onError: () => {
          setApplyingId(null);
        },
      },
    );
  }

  return (
    <div className="relative mb-4 rounded-xl border border-card-border bg-surface-elevated p-4">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        onClick={onClose}
        aria-label="Close theme picker"
      >
        <X className="h-3.5 w-3.5" />
      </Button>

      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Theme
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Pick a look for your page. Changes apply instantly.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Reset to default */}
          <button
            type="button"
            className={`mb-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              currentThemeId === DEFAULT_THEME_ID
                ? "border-[var(--user-accent,var(--trust))] bg-[var(--user-accent,var(--trust))]/5"
                : "border-transparent bg-surface/50 hover:border-card-border hover:bg-surface"
            }`}
            onClick={handleReset}
          >
            <PaintBucket className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium">Tethyr Default</span>
            {currentThemeId === DEFAULT_THEME_ID && (
              <Check className="ml-auto h-3.5 w-3.5 text-[var(--user-accent,var(--trust))]" />
            )}
          </button>

          {/* Theme grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {themes
              .filter((t) => t.id !== DEFAULT_THEME_ID)
              .map((theme) => {
                const isActive = currentThemeId === theme.id;
                const isApplying = applyingId === theme.id;

                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
                      isActive
                        ? "border-[var(--user-accent,var(--trust))] ring-1 ring-[var(--user-accent,var(--trust))]/30"
                        : "border-transparent bg-surface/50 hover:border-card-border hover:bg-surface"
                    }`}
                    onClick={() => handleApply(theme.id)}
                    disabled={isApplying}
                    title={theme.description ?? theme.name}
                  >
                    {/* Mini preview swatch */}
                    <MiniPreview vars={theme.previewVars} />
                    <span className="text-[10px] font-medium leading-tight text-center">
                      {isApplying ? "Applying..." : theme.name}
                    </span>
                    {isActive && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--user-accent,var(--trust))]">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Mini Preview Swatch ──────────────────────────────────────────────────────

/**
 * A tiny 40×24 visual preview showing the background, foreground, primary,
 * and surface colors as horizontal bars.
 */
function MiniPreview({ vars }: { vars: Record<string, string> }) {
  const bg = vars["--background"] ?? "#ffffff";
  const fg = vars["--foreground"] ?? "#000000";
  const surface = vars["--surface"] ?? "#f5f5f5";
  const primary = vars["--primary"] ?? "#3b82f6";
  const radius = vars["--radius-lg"] ?? "4px";

  return (
    <div
      className="h-6 w-10 overflow-hidden rounded-sm"
      style={{
        background: bg,
        borderRadius: radius,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex h-full flex-col">
        <div className="h-2" style={{ background: primary }} />
        <div className="flex-1" style={{ background: surface }}>
          <div className="mx-0.5 mt-0.5 h-0.5 w-2 rounded-full" style={{ background: fg }} />
        </div>
      </div>
    </div>
  );
}
