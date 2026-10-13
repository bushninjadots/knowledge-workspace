// A member's face wherever their name appears in a list (posts, the composer,
// message popups). `avatar_url` is a path in the private `avatars` bucket (or,
// for older rows, a full URL); signed URLs are cached per path, so a feed
// signs each author once. Falls back to the initial on the accent tint.
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { cn } from "@/lib/utils";

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

  return (
    <Avatar className={cn("h-10 w-10", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-[var(--user-accent-subtle,var(--surface-elevated))] text-sm font-semibold text-[var(--user-accent-text,var(--foreground))]">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
