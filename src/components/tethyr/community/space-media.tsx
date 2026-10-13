// A space's picture and banner, shared by the space header, the Spaces grid
// and the settings preview. Both fall back to the space's colour, so a space
// without images still has a look of its own.
import type { CSSProperties } from "react";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { cn } from "@/lib/utils";

/** Paths are signed from their bucket; legacy full URLs pass through. */
function useImage(bucket: "avatars" | "banners", path: string | null | undefined) {
  const isUrl = !!path && /^https?:\/\//.test(path);
  const { data } = useSignedStorageUrl(bucket, isUrl ? null : path);
  return isUrl ? path : (data ?? null);
}

export function SpaceAvatar({
  name,
  path,
  accent,
  className,
  previewUrl,
}: {
  name: string;
  path: string | null | undefined;
  accent: string;
  className?: string;
  /** A local object URL to show instead (settings preview before upload). */
  previewUrl?: string | null;
}) {
  const signed = useImage("avatars", path);
  const src = previewUrl ?? signed;
  return (
    <div
      className={cn(
        // relative + z-10: it overlaps a (positioned) banner and must sit above it.
        "relative z-10 flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-display font-semibold",
        className,
      )}
      style={{
        background: `color-mix(in oklab, ${accent} 16%, var(--card))`,
        color: `color-mix(in oklab, ${accent} 75%, var(--foreground))`,
      }}
    >
      {src ? (
        <img src={src} alt="" decoding="async" className="h-full w-full object-cover" />
      ) : (
        (name.trim().charAt(0) || "?").toUpperCase()
      )}
    </div>
  );
}

export function SpaceBanner({
  path,
  accent,
  className,
  previewUrl,
  style,
}: {
  path: string | null | undefined;
  accent: string;
  className?: string;
  previewUrl?: string | null;
  style?: CSSProperties;
}) {
  const signed = useImage("banners", path);
  const src = previewUrl ?? signed;
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        // The fallback is the space's colour as a soft diagonal, with a fine
        // grid so it reads as a deliberate cover rather than an empty box.
        background: `linear-gradient(120deg, color-mix(in oklab, ${accent} 45%, var(--card)) 0%, color-mix(in oklab, ${accent} 14%, var(--card)) 60%, var(--card) 100%)`,
        ...style,
      }}
    >
      {src ? (
        <img src={src} alt="" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_12%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_12%,transparent)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom_right,black,transparent_75%)]"
        />
      )}
    </div>
  );
}
