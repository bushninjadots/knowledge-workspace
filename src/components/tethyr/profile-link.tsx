import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

/**
 * Links to a public Studio at /u/:handle. People without a handle render as a
 * non-interactive element instead of navigating to /u/ (a 404), which several
 * card grids used to do with `params={{ handle: c.handle ?? "" }}`.
 */
export function ProfileLink({
  handle,
  className,
  children,
  title,
  style,
}: {
  handle: string | null | undefined;
  className?: string;
  children: ReactNode;
  title?: string;
  style?: CSSProperties;
}) {
  if (!handle) {
    return (
      <span className={className} title={title} style={style}>
        {children}
      </span>
    );
  }
  return (
    <Link to="/u/$handle" params={{ handle }} className={className} title={title} style={style}>
      {children}
    </Link>
  );
}
