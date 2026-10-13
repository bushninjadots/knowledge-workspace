// Area layout menu: wireframe thumbnails of each column arrangement, so the
// creator sees what they're choosing. Used in each area's header on the canvas.

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LayoutSection } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";

/** Layout presets exposed in the section header. Choosing one seeds the grid. */
const SECTION_LAYOUT_OPTIONS: Array<{ value: LayoutSection["layout"]; label: string }> = [
  { value: "full", label: "Full" },
  { value: "two_column", label: "Two columns" },
  { value: "three_column", label: "Three columns" },
  { value: "sidebar_left", label: "Sidebar left" },
  { value: "sidebar_right", label: "Sidebar right" },
  { value: "feature", label: "Feature" },
  { value: "side_by_side", label: "Side by side" },
];

/** Tiny SVG wireframe showing a section's column arrangement. */
function LayoutThumbnail({ layout, small }: { layout: LayoutSection["layout"]; small?: boolean }) {
  const w = 36;
  const h = 24;
  const p = 2;
  const inner = { x: p, y: p, w: w - p * 2, h: h - p * 2 };
  const stroke = "var(--border-strong)";
  const accent = "var(--user-accent,var(--primary))";
  const rects: Array<{ x: number; y: number; w: number; h: number; fill?: string }> = [];

  switch (layout) {
    case "full":
      rects.push({ x: inner.x, y: inner.y, w: inner.w, h: inner.h });
      break;
    case "two_column":
      rects.push({ x: inner.x, y: inner.y, w: inner.w / 2 - 1, h: inner.h });
      rects.push({ x: inner.x + inner.w / 2 + 1, y: inner.y, w: inner.w / 2 - 1, h: inner.h });
      break;
    case "three_column":
      rects.push({ x: inner.x, y: inner.y, w: inner.w / 3 - 1, h: inner.h });
      rects.push({ x: inner.x + inner.w / 3 + 0.5, y: inner.y, w: inner.w / 3 - 1, h: inner.h });
      rects.push({
        x: inner.x + (inner.w / 3) * 2 + 1,
        y: inner.y,
        w: inner.w / 3 - 1,
        h: inner.h,
      });
      break;
    case "sidebar_left":
      rects.push({ x: inner.x, y: inner.y, w: inner.w * 0.3, h: inner.h });
      rects.push({ x: inner.x + inner.w * 0.3 + 2, y: inner.y, w: inner.w * 0.7 - 2, h: inner.h });
      break;
    case "sidebar_right":
      rects.push({ x: inner.x, y: inner.y, w: inner.w * 0.7 - 2, h: inner.h });
      rects.push({ x: inner.x + inner.w * 0.7, y: inner.y, w: inner.w * 0.3, h: inner.h });
      break;
    case "feature":
      rects.push({ x: inner.x, y: inner.y, w: inner.w * 0.65 - 1, h: inner.h, fill: accent });
      rects.push({
        x: inner.x + inner.w * 0.65 + 1,
        y: inner.y,
        w: inner.w * 0.35 - 1,
        h: inner.h,
      });
      break;
    case "side_by_side":
      rects.push({ x: inner.x, y: inner.y, w: inner.w / 2 - 1, h: inner.h });
      rects.push({ x: inner.x + inner.w / 2 + 1, y: inner.y, w: inner.w / 2 - 1, h: inner.h });
      break;
    default:
      rects.push({ x: inner.x, y: inner.y, w: inner.w, h: inner.h });
  }

  return (
    <svg
      width={small ? 18 : w}
      height={small ? 12 : h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
      aria-hidden
    >
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={1.5}
          fill={r.fill ?? "none"}
          stroke={r.fill ? "none" : stroke}
          strokeWidth={0.8}
        />
      ))}
    </svg>
  );
}

/** Area layout menu: wireframe thumbnails so the creator sees what they're
 *  choosing. A real menu (Escape, arrow keys, focus return), not a hand-rolled
 *  popover. */
export function SectionLayoutPicker({
  value,
  areaName,
  onChange,
}: {
  value: LayoutSection["layout"];
  areaName: string;
  onChange: (layout: LayoutSection["layout"]) => void;
}) {
  const current = SECTION_LAYOUT_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Layout of ${areaName}: ${current}. Change layout`}
          className="flex h-6 pointer-coarse:h-10 items-center gap-1 rounded-sm border border-border bg-[var(--surface-sunken)] px-1.5 text-2xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-[var(--user-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1"
        >
          <LayoutThumbnail layout={value} small />
          {current}
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="studio-editor-chrome grid w-64 grid-cols-3 gap-1 p-2"
      >
        {SECTION_LAYOUT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border p-1.5 text-center",
              option.value === value
                ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)]"
                : "border-transparent",
            )}
          >
            <LayoutThumbnail layout={option.value} />
            <span className="text-2xs leading-tight text-muted-foreground">{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
