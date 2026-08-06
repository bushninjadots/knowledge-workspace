import { Palette, Code, Video, Camera, Music, Pen, Megaphone, type LucideIcon } from "lucide-react";

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  Design: Palette,
  Development: Code,
  Video: Video,
  Photography: Camera,
  Music: Music,
  Writing: Pen,
  Marketing: Megaphone,
};

export const CATEGORY_COLORS: Record<string, { hue: number; sat: number }> = {
  Design: { hue: 270, sat: 60 },
  Development: { hue: 142, sat: 80 },
  Video: { hue: 0, sat: 70 },
  Photography: { hue: 40, sat: 70 },
  Music: { hue: 300, sat: 60 },
  Writing: { hue: 200, sat: 50 },
  Marketing: { hue: 20, sat: 70 },
};

export function inferCategory(tags: string[]): string {
  const known = Object.keys(CATEGORY_ICON);
  return tags.find((t) => known.includes(t)) ?? "Design";
}
