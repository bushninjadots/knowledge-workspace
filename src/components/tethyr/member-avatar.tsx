// A member's face wherever their name appears in a list (posts, the composer,
// message popups). `avatar_url` is a path in the private `avatars` bucket (or,
// for older rows, a full URL); signed URLs are cached per path, so a feed
// signs each author once. Falls back to the initial on a
// stable per-person hue.
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { cn } from "@/lib/utils";

/** A stable hue per name, so initial-only avatars aren't all the same circle. */
export function nameHue(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) | 0;
  return Math.abs(hash) % 360;
}

export function MemberAvatar({
  name,
  avatarPath,
  className,
}: {
  name: string;
  avatarPath: string | null | undefined;
  className?: string;
}) {
  const isUrl = !!avatarPath && /^https?:\/\//.test(avatarPath);
  const { data: signed } = useSignedStorageUrl("avatars", isUrl ? null : avatarPath);
  const src = isUrl ? avatarPath : signed;
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const hue = nameHue(name.trim() || "?");

  return (
    <Avatar className={cn("h-10 w-10", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback
        className="text-sm font-semibold"
        // Mixed with the card and foreground colours so it holds up in light
        // and dark themes alike.
        style={{
          background: `color-mix(in oklab, oklch(0.66 0.14 ${hue}) 24%, var(--card))`,
          color: `color-mix(in oklab, oklch(0.55 0.16 ${hue}) 70%, var(--foreground))`,
        }}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
