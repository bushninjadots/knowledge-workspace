// What global search can find without a query: result shapes, the app's
// destinations, quick actions, and the matchers that rank them for a term.
// Used by GlobalSearch (global-search.tsx).

export type ProfileHit = {
  id: string;
  handle: string | null;
  display_name: string | null;
  category: string | null;
  creator_title: string | null;
};

export type SkillHit = { id: string; slug: string; name: string; category: string };

export type ProjectHit = { id: string; title: string; description: string | null; tags: string[] };

export type LibraryHit = { id: string; title: string; content: string; type: string };

export type PostHit = { id: string; title: string; body: string; type: string };

export type SessionHit = {
  id: string;
  title: string;
  description: string | null;
  session_type: string;
};

export type SearchRoute =
  | { to: "/dashboard" }
  | { to: "/profile" }
  | { to: "/explore" }
  | { to: "/skills" }
  | { to: "/challenges" }
  | { to: "/sessions" }
  | { to: "/community" }
  | { to: "/studio" }
  | { to: "/library" }
  | { to: "/teams" }
  | { to: "/connections" }
  | { to: "/messages" }
  | { to: "/notifications" }
  | { to: "/u/$handle"; params: { handle: string } }
  | { to: "/skills/$slug"; params: { slug: string } }
  | { to: "/projects/$id"; params: { id: string } }
  | { to: "/library/$id"; params: { id: string } }
  | { to: "/community"; search: { post: string } }
  | { to: "/sessions"; search: { schedule: "1" } }
  | { to: "/sessions/$id"; params: { id: string } };

// Feature destinations make the search a discovery tool: people who don't yet
// know a surface exists can type its name and land on it. Keywords are the
// everyday words members use for a feature, not just its title.
export const DESTINATIONS: ReadonlyArray<{
  label: string;
  description: string;
  keywords: readonly string[];
  to: () => SearchRoute;
}> = [
  {
    label: "Your Studio",
    description: "Build and manage your profile and layout",
    keywords: [
      "studio",
      "profile",
      "builder",
      "layout",
      "blocks",
      "customize",
      "design",
      "edit",
      "portfolio",
      "public",
      "handle",
    ],
    to: () => ({ to: "/profile" }),
  },
  {
    label: "Edit Studio",
    description: "Customize your profile layout and blocks",
    keywords: ["studio editor", "edit studio", "studio builder", "blocks", "layout editor"],
    to: () => ({ to: "/studio" }),
  },
  {
    label: "Explore",
    description: "Projects, people, and open roles",
    keywords: ["explore", "discover", "browse", "projects", "people", "hire", "recruit"],
    to: () => ({ to: "/explore" }),
  },
  {
    label: "Skills",
    description: "Browse the skill directory by category",
    keywords: ["skills", "skills directory", "categories", "teach", "learn", "expertise"],
    to: () => ({ to: "/skills" }),
  },
  {
    label: "Roadmap",
    description: "Your projects' work tracked as a board",
    keywords: ["roadmap", "kanban", "board", "milestones", "track", "progress"],
    to: () => ({ to: "/dashboard" }),
  },
  {
    label: "Challenges",
    description: "Build in public against a brief",
    keywords: ["challenge", "compete", "contest", "hackathon"],
    to: () => ({ to: "/challenges" }),
  },
  {
    label: "Sessions",
    description: "Book and run sessions with builders",
    keywords: ["session", "meet", "book", "schedule", "call"],
    to: () => ({ to: "/sessions" }),
  },
  {
    label: "Community",
    description: "Posts and conversation across the network",
    keywords: ["community", "posts", "discussion", "forum", "feed"],
    to: () => ({ to: "/community" }),
  },
  {
    label: "Teams",
    description: "Join or start a crew",
    keywords: ["team", "crew", "group", "collective"],
    to: () => ({ to: "/teams" }),
  },
  {
    label: "Connections",
    description: "People you know and collaborate with",
    keywords: ["connections", "connect", "network", "follow"],
    to: () => ({ to: "/connections" }),
  },
  {
    label: "Library",
    description: "Saved work, notes, and resources",
    keywords: ["library", "saved", "notes", "resources", "learn"],
    to: () => ({ to: "/library" }),
  },
  {
    label: "Messages",
    description: "Chat with collaborators",
    keywords: ["messages", "chat", "dm", "inbox"],
    to: () => ({ to: "/messages" }),
  },
  {
    label: "Notifications",
    description: "Alerts about your work and network",
    keywords: ["notifications", "alerts", "updates", "bell"],
    to: () => ({ to: "/notifications" }),
  },
  {
    label: "Dashboard",
    description: "Your workspace hub",
    keywords: ["dashboard", "home", "workspace", "overview"],
    to: () => ({ to: "/dashboard" }),
  },
];

// Shown before the member types anything: a few high-intent places to jump to,
// so an opened search is a launcher rather than a blank box.
export const SUGGESTED_LABELS = ["Explore", "Your Studio", "Challenges", "Community"] as const;

export const SUGGESTED_DESTINATIONS = SUGGESTED_LABELS.map((label) =>
  DESTINATIONS.find((d) => d.label === label)!,
).filter(Boolean);

// Commands turn the palette into a launcher, not just a search box: typed
// keywords like "create" / "new" / "schedule" surface the actions below, and
// they're always listed in the zero state so an opened palette offers something
// to do even before anyone types.
export type PaletteActionKind =
  | "createProject"
  | "communityPost"
  | "scheduleSession"
  | "addToLibrary"
  | "openWatchlist"
  | "toggleTheme";

export const ACTIONS: ReadonlyArray<{
  kind: PaletteActionKind;
  label: string;
  description: string;
  keywords: readonly string[];
}> = [
  {
    kind: "createProject",
    label: "Create a project",
    description: "Start a new project in Tethyr",
    keywords: ["create", "new", "start", "project", "make", "build"],
  },
  {
    kind: "communityPost",
    label: "Write a community post",
    description: "Share an update, ask for help, or showcase work",
    keywords: ["create", "new", "post", "write", "share", "update", "compose"],
  },
  {
    kind: "scheduleSession",
    label: "Schedule a session",
    description: "Plan a collaboration or mentoring call",
    keywords: ["create", "new", "schedule", "session", "book", "mentor", "call", "meet"],
  },
  {
    kind: "addToLibrary",
    label: "Add to your Library",
    description: "Save a resource, note, or file",
    keywords: ["create", "new", "add", "library", "save", "note", "upload"],
  },
  {
    kind: "openWatchlist",
    label: "Open your watchlist",
    description: "Jump to the projects you're watching",
    keywords: ["watchlist", "watch", "watched", "shortlist", "starred", "shelf", "return"],
  },
  {
    kind: "toggleTheme",
    label: "Toggle theme",
    description: "Switch between light and dark",
    keywords: ["theme", "dark", "light", "mode", "appearance", "color", "colour"],
  },
];

export function actionHitsFor(term: string, limit = 4): ReadonlyArray<(typeof ACTIONS)[number]> {
  if (!term) return ACTIONS.slice(0, limit);
  const needle = term.toLowerCase();
  return ACTIONS.filter(
    (a) =>
      a.label.toLowerCase().includes(needle) ||
      a.description.toLowerCase().includes(needle) ||
      a.keywords.some((k) => k.includes(needle)),
  ).slice(0, limit);
}

export function destinationHitsFor(term: string, limit = 4): Array<(typeof DESTINATIONS)[number]> {
  if (!term) return [];
  const needle = term.toLowerCase();
  return DESTINATIONS.filter(
    (d) =>
      d.label.toLowerCase().includes(needle) ||
      d.description.toLowerCase().includes(needle) ||
      d.keywords.some((k) => k.includes(needle)),
  ).slice(0, limit);
}
