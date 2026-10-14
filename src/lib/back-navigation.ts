// ── Back navigation ───────────────────────────────────────────────────────────
// One rule for the whole site, so Back never appears on one page and goes
// missing on the next: hub pages (one path segment: /dashboard, /skills,
// /community) have no Back; every page below a hub (/projects/x, /u/handle,
// /spaces/x/settings) gets it in the top bar. Pages never draw their own.

/** Where Back goes when there's no history to return to (a shared link). */
const HUB_FOR_SECTION: Record<string, string> = {
  projects: "/explore",
  u: "/explore",
  skills: "/skills",
  teams: "/teams",
  challenges: "/challenges",
  sessions: "/sessions",
  library: "/library",
  spaces: "/community",
};

function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

/** True for detail pages — anything deeper than a hub. */
export function showsBack(pathname: string): boolean {
  return segments(pathname).length >= 2;
}

/** The hub a detail page belongs to; "/" when the section has none. */
export function backFallback(pathname: string): string {
  const [first, second] = segments(pathname);
  // Shared library links are public and reached from outside Tethyr.
  if (first === "library" && second === "shared") return "/";
  return HUB_FOR_SECTION[first ?? ""] ?? "/";
}
