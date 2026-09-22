import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemePresets, presetSwatch } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Theme switcher. `variant="icon"` is the compact header button,
 * `variant="row"` is a full-width row for sidebars.
 *
 * The dropdown has two sections: an appearance **Mode** (light / dark / system)
 * and a global **Style** preset (Minimal, Terminal, Paper…) applied app-wide.
 * The Style list shares the "theme-presets" query cache with the Studio
 * customize panel, so both pickers always agree without duplicate fetches.
 */
export function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "row";
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme, themePreset, setThemePreset } = useTheme();
  const Icon = resolvedTheme === "dark" ? Moon : Sun;
  const activeLabel = options.find((o) => o.value === theme)?.label ?? "System";

  const { data: presets = [] } = useThemePresets();
  const activePresetName = presets.find((p) => p.id === themePreset)?.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <button
            type="button"
            aria-label={activePresetName ? `Theme: ${activePresetName}` : `Theme: ${activeLabel}`}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              className,
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground",
              className,
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">Theme</span>
            <span className="ml-auto text-[11px] text-muted-foreground-subtle">
              {activePresetName ?? activeLabel}
            </span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground-subtle">
          Mode
        </DropdownMenuLabel>
        {options.map(({ value, label, icon: OptionIcon }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setTheme(value)}
            className={cn("gap-2 text-[13px]", theme === value && "text-foreground font-medium")}
          >
            <OptionIcon className="h-3.5 w-3.5" />
            {label}
            {theme === value && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-learning" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5 text-[11px] text-muted-foreground-subtle">
          <Palette className="h-3 w-3" />
          Style
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => setThemePreset(null)}
          className={cn("gap-2 text-[13px]", !themePreset && "text-foreground font-medium")}
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-border bg-background" />
          Default
          {!themePreset && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-learning" />}
        </DropdownMenuItem>
        {presets.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onSelect={() => setThemePreset(preset.id)}
            className={cn(
              "gap-2 text-[13px]",
              themePreset === preset.id && "text-foreground font-medium",
            )}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: presetSwatch(preset) }}
            />
            {preset.name}
            {themePreset === preset.id && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-learning" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
