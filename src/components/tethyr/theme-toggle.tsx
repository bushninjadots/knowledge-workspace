import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Theme switcher.`variant="icon"`is the compact header button,
 *`variant="row"`is a full-width row for sidebars.
 */
export function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "row";
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const Icon = resolvedTheme === "dark" ? Moon : Sun;
  const activeLabel = options.find((o) => o.value === theme)?.label ?? "System";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <button
            type="button"
            aria-label={`Theme: ${activeLabel}`}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground",
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
            <span className="ml-auto text-[11px] text-muted-foreground-subtle">{activeLabel}</span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
