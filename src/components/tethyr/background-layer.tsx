import { useMemo } from "react";
import {
  backgroundStyle,
  imageOpacityFor,
  isBackgroundActive,
  type ProfileBackground,
} from "@/lib/background-themes";

/**
 * The member's custom backdrop. Render as the first child of a `relative`
 * page root (which must not paint its own opaque background) so the layer
 * sits behind every surface. Images are dimmed to a readable wallpaper level.
 */
export function BackgroundLayer({
  background,
  imageUrl,
  bannerColor,
}: {
  background: ProfileBackground | null | undefined;
  imageUrl?: string | null;
  /** Dominant colour resolved from the member's banner — used when the
   *  background tint is set to follow the banner (`colorSource: "banner"`). */
  bannerColor?: string | null;
}) {
  const style = useMemo(
    () => backgroundStyle(background, imageUrl, bannerColor),
    [background, imageUrl, bannerColor],
  );
  const isImage = background?.mode === "image";

  if (!isBackgroundActive(background) || Object.keys(style).length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      style={
        isImage
          ? { ...style, opacity: imageOpacityFor(background.strength), filter: "saturate(0.9)" }
          : style
      }
    />
  );
}
