// ── Appearance Panel ──────────────────────────────────────────────────────────
// Fine-grained controls for radius, typography, density, and accent. Every
// control writes an immediate partial config update (kept separate from the
// toolbar so honing a tone never needs a personality). Contrast/neutral options
// use the same CSS variables the rest of Tethyr consumes.

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  RADIUS_OPTIONS,
  TYPOGRAPHY_OPTIONS,
  DEFAULT_STUDIO_CONFIG,
  type StudioConfig,
} from "@/lib/studio-config";

interface AppearancePanelProps {
  config: StudioConfig;
  onChange: (partial: Partial<StudioConfig>) => void;
  onClose: () => void;
}

interface Option {
  value: string;
  label: string;
}

function OptionRow({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={[
                "h-7 rounded-lg border px-2.5 text-xs transition-colors",
                active
                  ? "border-[var(--user-accent,var(--trust))] bg-[var(--user-accent,var(--trust))]/5 font-medium text-foreground"
                  : "border-transparent bg-surface/50 text-muted-foreground hover:border-card-border hover:bg-surface hover:text-foreground",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AppearancePanel({ config, onChange, onClose }: AppearancePanelProps) {
  return (
    <div className="relative mb-4 rounded-xl border border-card-border bg-surface-elevated p-4">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        aria-label="Close appearance panel"
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Appearance
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Tune the shape, rhythm, and accent of your Studio.
      </p>

      <OptionRow
        label="Radii"
        value={config.radius}
        options={RADIUS_OPTIONS}
        onSelect={(v) => onChange({ radius: v as StudioConfig["radius"] })}
      />
      <OptionRow
        label="Typography"
        value={config.typography}
        options={TYPOGRAPHY_OPTIONS}
        onSelect={(v) => onChange({ typography: v as StudioConfig["typography"] })}
      />
      <OptionRow
        label="Density"
        value={config.density}
        options={DENSITY_OPTIONS}
        onSelect={(v) => onChange({ density: v as StudioConfig["density"] })}
      />
      <OptionRow
        label="Accent"
        value={config.accentMode}
        options={ACCENT_OPTIONS}
        onSelect={(v) => onChange({ accentMode: v as StudioConfig["accentMode"] })}
      />

      {config.accentMode === "person" && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <label
            htmlFor="appearance-accent-color"
            className="text-[11px] font-medium text-muted-foreground"
          >
            Accent color
          </label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              {config.accentColor ?? "none"}
            </span>
            <input
              id="appearance-accent-color"
              type="color"
              value={config.accentColor ?? "#333333"}
              onChange={(e) => onChange({ accentColor: e.target.value })}
              className="h-7 w-9 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
            />
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-border/30 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() =>
            onChange({
              radius: DEFAULT_STUDIO_CONFIG.radius,
              typography: DEFAULT_STUDIO_CONFIG.typography,
              density: DEFAULT_STUDIO_CONFIG.density,
              accentMode: DEFAULT_STUDIO_CONFIG.accentMode,
              accentColor: DEFAULT_STUDIO_CONFIG.accentColor,
            })
          }
        >
          Reset appearance
        </Button>
      </div>
    </div>
  );
}
