// An app's tile: its colour with an icon or monogram (never a copied logo).
import { Link2 } from "lucide-react";
import type { AppDef } from "@/lib/app-catalog";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "h-4 w-4 rounded text-[8px] [&_svg]:h-2.5 [&_svg]:w-2.5",
  sm: "h-6 w-6 rounded-md text-[10px] [&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "h-9 w-9 rounded-lg text-xs [&_svg]:h-4 [&_svg]:w-4",
  lg: "h-12 w-12 rounded-xl text-sm [&_svg]:h-5 [&_svg]:w-5",
};

export function AppIcon({
  app,
  size = "sm",
  className,
}: {
  app: AppDef | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = app?.icon;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold text-white shadow-sm ring-1 ring-black/10 ring-inset",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: app?.color ?? "var(--muted-foreground)" }}
    >
      {Icon ? <Icon /> : app?.mono ? app.mono : <Link2 />}
    </span>
  );
}
