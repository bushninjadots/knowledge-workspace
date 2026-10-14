// ── App catalog ───────────────────────────────────────────────────────────────
// The tools builders work in, in one list: where a project lives (repo, design
// file, docs, board, deploy, community), where a member can be found, and the
// apps on their dashboard launcher. Each app has a colour + icon or monogram
// (no third-party logos), the hosts that identify its links, and — for
// desktop apps — a deep link that opens the app itself (obsidian://, vscode://).
//
// Public surfaces (projects, profiles) only ever store https links; deep links
// live in the member's private launcher (member_apps).
import {
  AppWindow,
  BookOpen,
  Box,
  Cloud,
  Code2,
  Codepen,
  Codesandbox,
  Database,
  Dribbble,
  Figma,
  FileText,
  Framer,
  Gamepad2,
  Github,
  Gitlab,
  Globe,
  Instagram,
  Kanban,
  Linkedin,
  MessagesSquare,
  Package,
  PenTool,
  Rocket,
  Slack,
  Smartphone,
  Sparkles,
  Terminal,
  Trello,
  Twitch,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";

type AppCategory =
  "code" | "editor" | "ai" | "notes" | "planning" | "design" | "ship" | "community" | "social";

export const CATEGORY_LABELS: Record<AppCategory, string> = {
  code: "Code & repos",
  editor: "Editors",
  ai: "AI tools",
  notes: "Notes & docs",
  planning: "Planning",
  design: "Design",
  ship: "Deploy & publish",
  community: "Community",
  social: "Social",
};

type DeepLink = {
  /** What the member types ("Vault name", "Folder path"). */
  inputLabel: string;
  placeholder: string;
  build: (input: string) => string;
  /** URL schemes this app's launcher links may use. */
  schemes: string[];
  /** Where the tile goes when the app isn't installed on this device. */
  webFallback: string;
  webFallbackHint: string;
};

export type AppDef = {
  id: string;
  name: string;
  category: AppCategory;
  color: string;
  icon?: LucideIcon;
  /** Shown when there's no icon (1–2 letters). */
  mono?: string;
  /** Link hosts that identify this app (subdomains match too). */
  hosts: string[];
  placeholder: string;
  deepLink?: DeepLink;
  /** Can it be where a project lives? (false for purely personal apps) */
  forProjects?: boolean;
};

const folder = (scheme: string, webFallback: string, webFallbackHint: string): DeepLink => ({
  inputLabel: "Folder path",
  placeholder: "/Users/you/code/my-app",
  schemes: [scheme],
  webFallback,
  webFallbackHint,
  build: (input) => {
    const path = input.trim().replace(/^~(?=\/)/, "");
    return `${scheme}://file${path.startsWith("/") ? "" : "/"}${path.split("/").map(encodeURIComponent).join("/").replace(/%3A/gi, ":")}`;
  },
});

export const APPS: AppDef[] = [
  // Code & repos
  {
    id: "github",
    name: "GitHub",
    category: "code",
    color: "#24292f",
    icon: Github,
    hosts: ["github.com"],
    placeholder: "https://github.com/you/repo",
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "code",
    color: "#fc6d26",
    icon: Gitlab,
    hosts: ["gitlab.com"],
    placeholder: "https://gitlab.com/you/repo",
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    category: "code",
    color: "#0052cc",
    mono: "Bb",
    hosts: ["bitbucket.org"],
    placeholder: "https://bitbucket.org/you/repo",
  },
  {
    id: "codeberg",
    name: "Codeberg",
    category: "code",
    color: "#2185d0",
    mono: "Cb",
    hosts: ["codeberg.org"],
    placeholder: "https://codeberg.org/you/repo",
  },
  {
    id: "replit",
    name: "Replit",
    category: "code",
    color: "#f26207",
    mono: "R",
    hosts: ["replit.com"],
    placeholder: "https://replit.com/@you/app",
  },
  {
    id: "codesandbox",
    name: "CodeSandbox",
    category: "code",
    color: "#151515",
    icon: Codesandbox,
    hosts: ["codesandbox.io"],
    placeholder: "https://codesandbox.io/p/…",
  },
  {
    id: "codepen",
    name: "CodePen",
    category: "code",
    color: "#1e1f26",
    icon: Codepen,
    hosts: ["codepen.io"],
    placeholder: "https://codepen.io/you/pen/…",
  },
  {
    id: "stackblitz",
    name: "StackBlitz",
    category: "code",
    color: "#1389fd",
    mono: "SB",
    hosts: ["stackblitz.com"],
    placeholder: "https://stackblitz.com/edit/…",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    category: "code",
    color: "#ff9d00",
    mono: "HF",
    hosts: ["huggingface.co"],
    placeholder: "https://huggingface.co/you/model",
  },
  {
    id: "kaggle",
    name: "Kaggle",
    category: "code",
    color: "#20beff",
    mono: "K",
    hosts: ["kaggle.com"],
    placeholder: "https://kaggle.com/you",
  },

  // Editors (desktop — open the folder)
  {
    id: "vscode",
    name: "VS Code",
    category: "editor",
    color: "#007acc",
    icon: Code2,
    hosts: ["vscode.dev"],
    placeholder: "https://vscode.dev/github/you/repo",
    deepLink: folder("vscode", "https://vscode.dev", "e.g. https://vscode.dev/github/you/repo"),
    forProjects: false,
  },
  {
    id: "cursor",
    name: "Cursor",
    category: "editor",
    color: "#111111",
    mono: "Cu",
    hosts: ["cursor.com"],
    placeholder: "https://cursor.com",
    deepLink: folder("cursor", "https://cursor.com", "e.g. your repo on GitHub"),
    forProjects: false,
  },
  {
    id: "zed",
    name: "Zed",
    category: "editor",
    color: "#084ccf",
    mono: "Z",
    hosts: ["zed.dev"],
    placeholder: "https://zed.dev",
    deepLink: {
      inputLabel: "Folder path",
      placeholder: "/Users/you/code/my-app",
      schemes: ["zed"],
      webFallback: "https://zed.dev",
      webFallbackHint: "e.g. your repo on GitHub",
      build: (p) => `zed://file${p.startsWith("/") ? "" : "/"}${p}`,
    },
    forProjects: false,
  },
  {
    id: "jetbrains",
    name: "JetBrains",
    category: "editor",
    color: "#000000",
    mono: "JB",
    hosts: ["jetbrains.com"],
    placeholder: "https://www.jetbrains.com",
    forProjects: false,
  },
  {
    id: "terminal",
    name: "Terminal",
    category: "editor",
    color: "#2b2b2b",
    icon: Terminal,
    hosts: [],
    placeholder: "https://…",
    forProjects: false,
  },

  // AI
  {
    id: "claude",
    name: "Claude",
    category: "ai",
    color: "#d97757",
    icon: Sparkles,
    hosts: ["claude.ai"],
    placeholder: "https://claude.ai/project/…",
    forProjects: false,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    category: "ai",
    color: "#10a37f",
    mono: "GP",
    hosts: ["chatgpt.com", "chat.openai.com"],
    placeholder: "https://chatgpt.com",
    forProjects: false,
  },
  {
    id: "v0",
    name: "v0",
    category: "ai",
    color: "#000000",
    mono: "v0",
    hosts: ["v0.dev", "v0.app"],
    placeholder: "https://v0.dev/chat/…",
  },
  {
    id: "lovable",
    name: "Lovable",
    category: "ai",
    color: "#ff5e5b",
    mono: "Lv",
    hosts: ["lovable.dev", "lovable.app"],
    placeholder: "https://lovable.dev/projects/…",
  },
  {
    id: "bolt",
    name: "Bolt",
    category: "ai",
    color: "#1488fc",
    mono: "Bo",
    hosts: ["bolt.new"],
    placeholder: "https://bolt.new/~/…",
  },

  // Notes & docs
  {
    id: "obsidian",
    name: "Obsidian",
    category: "notes",
    color: "#7c3aed",
    mono: "Ob",
    hosts: ["obsidian.md", "publish.obsidian.md"],
    placeholder: "https://publish.obsidian.md/you",
    deepLink: {
      inputLabel: "Vault name",
      placeholder: "Work notes",
      schemes: ["obsidian"],
      webFallback: "https://obsidian.md",
      webFallbackHint: "e.g. your Obsidian Publish site",
      build: (v) => `obsidian://open?vault=${encodeURIComponent(v.trim())}`,
    },
  },
  {
    id: "notion",
    name: "Notion",
    category: "notes",
    color: "#191919",
    mono: "N",
    hosts: ["notion.so", "notion.site"],
    placeholder: "https://www.notion.so/your-page",
  },
  {
    id: "google-docs",
    name: "Google Docs",
    category: "notes",
    color: "#4285f4",
    icon: FileText,
    hosts: ["docs.google.com"],
    placeholder: "https://docs.google.com/document/d/…",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "notes",
    color: "#0f9d58",
    icon: Cloud,
    hosts: ["drive.google.com"],
    placeholder: "https://drive.google.com/drive/folders/…",
  },
  {
    id: "confluence",
    name: "Confluence",
    category: "notes",
    color: "#1868db",
    mono: "Cf",
    hosts: ["atlassian.net/wiki"],
    placeholder: "https://you.atlassian.net/wiki/…",
  },
  {
    id: "docs",
    name: "Docs site",
    category: "notes",
    color: "#475569",
    icon: BookOpen,
    hosts: ["readthedocs.io", "gitbook.io", "mintlify.app"],
    placeholder: "https://docs.your-app.com",
  },

  // Planning
  {
    id: "linear",
    name: "Linear",
    category: "planning",
    color: "#5e6ad2",
    mono: "Li",
    hosts: ["linear.app"],
    placeholder: "https://linear.app/team/project/…",
  },
  {
    id: "jira",
    name: "Jira",
    category: "planning",
    color: "#0052cc",
    mono: "Ji",
    hosts: ["atlassian.net"],
    placeholder: "https://you.atlassian.net/jira/…",
  },
  {
    id: "trello",
    name: "Trello",
    category: "planning",
    color: "#0079bf",
    icon: Trello,
    hosts: ["trello.com"],
    placeholder: "https://trello.com/b/…",
  },
  {
    id: "asana",
    name: "Asana",
    category: "planning",
    color: "#f06a6a",
    mono: "As",
    hosts: ["asana.com"],
    placeholder: "https://app.asana.com/0/…",
  },
  {
    id: "clickup",
    name: "ClickUp",
    category: "planning",
    color: "#7b68ee",
    mono: "CU",
    hosts: ["clickup.com"],
    placeholder: "https://app.clickup.com/…",
  },
  {
    id: "github-projects",
    name: "GitHub Projects",
    category: "planning",
    color: "#24292f",
    icon: Kanban,
    hosts: ["github.com/orgs", "github.com/users"],
    placeholder: "https://github.com/users/you/projects/1",
  },

  // Design
  {
    id: "figma",
    name: "Figma",
    category: "design",
    color: "#a259ff",
    icon: Figma,
    hosts: ["figma.com"],
    placeholder: "https://figma.com/design/…",
  },
  {
    id: "framer",
    name: "Framer",
    category: "design",
    color: "#0055ff",
    icon: Framer,
    hosts: ["framer.com", "framer.website"],
    placeholder: "https://framer.com/projects/…",
  },
  {
    id: "penpot",
    name: "Penpot",
    category: "design",
    color: "#31efb8",
    mono: "Pp",
    hosts: ["penpot.app"],
    placeholder: "https://design.penpot.app/…",
  },
  {
    id: "canva",
    name: "Canva",
    category: "design",
    color: "#00c4cc",
    mono: "Ca",
    hosts: ["canva.com"],
    placeholder: "https://canva.com/design/…",
  },
  {
    id: "dribbble",
    name: "Dribbble",
    category: "design",
    color: "#ea4c89",
    icon: Dribbble,
    hosts: ["dribbble.com"],
    placeholder: "https://dribbble.com/you",
  },
  {
    id: "behance",
    name: "Behance",
    category: "design",
    color: "#1769ff",
    mono: "Bē",
    hosts: ["behance.net"],
    placeholder: "https://behance.net/you",
  },
  {
    id: "storybook",
    name: "Storybook",
    category: "design",
    color: "#ff4785",
    icon: PenTool,
    hosts: ["chromatic.com", "storybook.js.org"],
    placeholder: "https://main--you.chromatic.com",
  },

  // Deploy & publish
  {
    id: "website",
    name: "Website",
    category: "ship",
    color: "#334155",
    icon: Globe,
    hosts: [],
    placeholder: "https://your-app.com",
  },
  {
    id: "vercel",
    name: "Vercel",
    category: "ship",
    color: "#000000",
    mono: "▲",
    hosts: ["vercel.app", "vercel.com"],
    placeholder: "https://your-app.vercel.app",
  },
  {
    id: "netlify",
    name: "Netlify",
    category: "ship",
    color: "#00ad9f",
    mono: "Nf",
    hosts: ["netlify.app", "netlify.com"],
    placeholder: "https://your-app.netlify.app",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "ship",
    color: "#f38020",
    icon: Cloud,
    hosts: ["pages.dev", "workers.dev"],
    placeholder: "https://your-app.pages.dev",
  },
  {
    id: "railway",
    name: "Railway",
    category: "ship",
    color: "#0b0d0e",
    mono: "Rw",
    hosts: ["railway.app", "up.railway.app"],
    placeholder: "https://your-app.up.railway.app",
  },
  {
    id: "render",
    name: "Render",
    category: "ship",
    color: "#46e3b7",
    mono: "Rd",
    hosts: ["onrender.com"],
    placeholder: "https://your-app.onrender.com",
  },
  {
    id: "fly",
    name: "Fly.io",
    category: "ship",
    color: "#7b3fe4",
    mono: "Fl",
    hosts: ["fly.dev"],
    placeholder: "https://your-app.fly.dev",
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "ship",
    color: "#3ecf8e",
    icon: Database,
    hosts: ["supabase.com"],
    placeholder: "https://supabase.com/dashboard/project/…",
  },
  {
    id: "npm",
    name: "npm",
    category: "ship",
    color: "#cb3837",
    icon: Package,
    hosts: ["npmjs.com"],
    placeholder: "https://npmjs.com/package/…",
  },
  {
    id: "pypi",
    name: "PyPI",
    category: "ship",
    color: "#3775a9",
    icon: Package,
    hosts: ["pypi.org"],
    placeholder: "https://pypi.org/project/…",
  },
  {
    id: "crates",
    name: "crates.io",
    category: "ship",
    color: "#e45e1b",
    icon: Box,
    hosts: ["crates.io"],
    placeholder: "https://crates.io/crates/…",
  },
  {
    id: "docker",
    name: "Docker Hub",
    category: "ship",
    color: "#1d63ed",
    icon: Box,
    hosts: ["hub.docker.com"],
    placeholder: "https://hub.docker.com/r/you/app",
  },
  {
    id: "app-store",
    name: "App Store",
    category: "ship",
    color: "#0d96f6",
    icon: Smartphone,
    hosts: ["apps.apple.com"],
    placeholder: "https://apps.apple.com/app/…",
  },
  {
    id: "google-play",
    name: "Google Play",
    category: "ship",
    color: "#01875f",
    icon: Smartphone,
    hosts: ["play.google.com"],
    placeholder: "https://play.google.com/store/apps/details?id=…",
  },
  {
    id: "chrome-web-store",
    name: "Chrome Web Store",
    category: "ship",
    color: "#4285f4",
    icon: AppWindow,
    hosts: ["chromewebstore.google.com", "chrome.google.com"],
    placeholder: "https://chromewebstore.google.com/detail/…",
  },
  {
    id: "itch",
    name: "itch.io",
    category: "ship",
    color: "#fa5c5c",
    icon: Gamepad2,
    hosts: ["itch.io"],
    placeholder: "https://you.itch.io/game",
  },
  {
    id: "steam",
    name: "Steam",
    category: "ship",
    color: "#171a21",
    icon: Gamepad2,
    hosts: ["store.steampowered.com"],
    placeholder: "https://store.steampowered.com/app/…",
  },
  {
    id: "product-hunt",
    name: "Product Hunt",
    category: "ship",
    color: "#da552f",
    icon: Rocket,
    hosts: ["producthunt.com"],
    placeholder: "https://producthunt.com/products/…",
  },

  // Community
  {
    id: "discord",
    name: "Discord",
    category: "community",
    color: "#5865f2",
    icon: MessagesSquare,
    hosts: ["discord.gg", "discord.com"],
    placeholder: "https://discord.gg/…",
  },
  {
    id: "slack",
    name: "Slack",
    category: "community",
    color: "#4a154b",
    icon: Slack,
    hosts: ["slack.com"],
    placeholder: "https://you.slack.com",
  },
  {
    id: "reddit",
    name: "Reddit",
    category: "community",
    color: "#ff4500",
    mono: "r/",
    hosts: ["reddit.com"],
    placeholder: "https://reddit.com/r/…",
  },
  {
    id: "github-discussions",
    name: "GitHub Discussions",
    category: "community",
    color: "#24292f",
    icon: MessagesSquare,
    hosts: [],
    placeholder: "https://github.com/you/repo/discussions",
  },

  // Social
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "social",
    color: "#0a66c2",
    icon: Linkedin,
    hosts: ["linkedin.com"],
    placeholder: "https://linkedin.com/in/you",
    forProjects: false,
  },
  {
    id: "x",
    name: "X",
    category: "social",
    color: "#000000",
    icon: Twitter,
    hosts: ["x.com", "twitter.com"],
    placeholder: "https://x.com/you",
  },
  {
    id: "bluesky",
    name: "Bluesky",
    category: "social",
    color: "#1185fe",
    mono: "🦋",
    hosts: ["bsky.app"],
    placeholder: "https://bsky.app/profile/you",
  },
  {
    id: "mastodon",
    name: "Mastodon",
    category: "social",
    color: "#6364ff",
    mono: "M",
    hosts: ["mastodon.social", "hachyderm.io", "fosstodon.org"],
    placeholder: "https://mastodon.social/@you",
  },
  {
    id: "youtube",
    name: "YouTube",
    category: "social",
    color: "#ff0000",
    icon: Youtube,
    hosts: ["youtube.com", "youtu.be"],
    placeholder: "https://youtube.com/@you",
  },
  {
    id: "twitch",
    name: "Twitch",
    category: "social",
    color: "#9146ff",
    icon: Twitch,
    hosts: ["twitch.tv"],
    placeholder: "https://twitch.tv/you",
  },
  {
    id: "tiktok",
    name: "TikTok",
    category: "social",
    color: "#010101",
    mono: "Tk",
    hosts: ["tiktok.com"],
    placeholder: "https://tiktok.com/@you",
  },
  {
    id: "instagram",
    name: "Instagram",
    category: "social",
    color: "#e1306c",
    icon: Instagram,
    hosts: ["instagram.com"],
    placeholder: "https://instagram.com/you",
  },
  {
    id: "devto",
    name: "DEV",
    category: "social",
    color: "#0a0a0a",
    mono: "DEV",
    hosts: ["dev.to"],
    placeholder: "https://dev.to/you",
  },
  {
    id: "hashnode",
    name: "Hashnode",
    category: "social",
    color: "#2962ff",
    mono: "H",
    hosts: ["hashnode.dev", "hashnode.com"],
    placeholder: "https://you.hashnode.dev",
  },
  {
    id: "medium",
    name: "Medium",
    category: "social",
    color: "#000000",
    mono: "M",
    hosts: ["medium.com"],
    placeholder: "https://medium.com/@you",
  },
  {
    id: "substack",
    name: "Substack",
    category: "social",
    color: "#ff6719",
    mono: "S",
    hosts: ["substack.com"],
    placeholder: "https://you.substack.com",
  },
];

const BY_ID = new Map(APPS.map((a) => [a.id, a]));

/** Older link keys that predate the catalog. */
const ALIASES: Record<string, string> = { twitter: "x" };

export function getApp(id: string): AppDef | undefined {
  return BY_ID.get(ALIASES[id] ?? id);
}

/** Apps a project can link to (everything but purely personal tools). */
export const PROJECT_APPS = APPS.filter((a) => a.forProjects !== false);

/** The app a link belongs to, from its host (longest match wins), or null. */
export function detectApp(url: string, among: AppDef[] = APPS): AppDef | null {
  let host: string;
  let path: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      const scheme = u.protocol.slice(0, -1);
      return among.find((a) => a.deepLink?.schemes.includes(scheme)) ?? null;
    }
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    return null;
  }
  // "atlassian.net/wiki" = that host (or a subdomain of it) with that path.
  let best: { app: AppDef; len: number } | null = null;
  for (const app of among) {
    for (const h of app.hosts) {
      const slash = h.indexOf("/");
      const hostPart = slash === -1 ? h : h.slice(0, slash);
      const pathPart = slash === -1 ? "" : h.slice(slash);
      const hostMatch = host === hostPart || host.endsWith(`.${hostPart}`);
      if (hostMatch && path.startsWith(pathPart) && (!best || h.length > best.len))
        best = { app, len: h.length };
    }
  }
  return best?.app ?? null;
}

/** An https link, or — for apps that open locally — one of that app's schemes. */
export function isLaunchableUrl(url: string, app?: AppDef | null): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === "https:") return true;
    const scheme = u.protocol.slice(0, -1);
    return !!app?.deepLink?.schemes.includes(scheme);
  } catch {
    return false;
  }
}

export function isDeepLink(url: string): boolean {
  return !/^https?:\/\//i.test(url);
}

/** Catalog apps grouped by category, in catalog order, filtered by a query. */
export function groupApps(apps: AppDef[], query = ""): { category: AppCategory; apps: AppDef[] }[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? apps.filter((a) => a.name.toLowerCase().includes(q) || a.id.includes(q))
    : apps;
  const groups = new Map<AppCategory, AppDef[]>();
  for (const app of filtered) {
    const list = groups.get(app.category);
    if (list) list.push(app);
    else groups.set(app.category, [app]);
  }
  return [...groups.entries()].map(([category, list]) => ({ category, apps: list }));
}

/** The web page a launcher tile opens when its desktop app isn't installed. */
export function webFallbackFor(appId: string, saved?: string | null): string | null {
  if (saved && /^https:\/\//.test(saved)) return saved;
  return getApp(appId)?.deepLink?.webFallback ?? null;
}
