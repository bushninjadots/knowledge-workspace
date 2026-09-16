import { cn } from "@/lib/utils";
import { ProfileLink } from "@/components/tethyr/profile-link";

export const PERSON_ROLE_LABEL: Record<string, string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};

/**
 * Compact "person" chip: avatar + name (linked to /u/:handle) with an optional
 * role/title caption. Used wherever a person is surfaced next to their work —
 * project headers, collaborator strips, and "people they build with" sections.
 * Renders a non-interactive element when the person has no handle.
 */
export function PersonPill({
  handle,
  name,
  role,
  title,
  avatarSrc,
  size = "md",
  className,
}: {
  handle?: string | null;
  name?: string | null;
  title?: string | null;
  role?: string | null;
  avatarSrc?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeCls =
    size === "sm"
      ? "h-6 w-6 text-[9px]"
      : size === "lg"
        ? "h-10 w-10 text-xs"
        : "h-7 w-7 text-[10px]";
  const initial = (name ?? handle ?? "?").charAt(0).toUpperCase();
  const caption = role ? (PERSON_ROLE_LABEL[role] ?? role) : title;

  return (
    <ProfileLink
      handle={handle}
      className={cn(
        "group inline-flex min-w-0 items-center gap-1.5 rounded-full transition-lift",
        className,
      )}
      title={caption ? `${name ?? handle ?? ""}: ${caption}` : (name ?? undefined)}
    >
      <span
        className={cn(
          "shrink-0 overflow-hidden rounded-full bg-foreground text-background ring-2 ring-background",
          sizeCls,
        )}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            width="40"
            height="40"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-semibold text-background">
            {initial}
          </span>
        )}
      </span>
      <span className="hidden min-w-0 flex-col gap-0.5 leading-tight sm:flex">
        <span className="truncate text-xs font-medium text-foreground group-hover:text-[var(--user-accent,var(--trust))]">
          {name ?? handle ?? "Unknown"}
        </span>
        {caption && <span className="truncate text-[10px] text-muted-foreground">{caption}</span>}
      </span>
    </ProfileLink>
  );
}
