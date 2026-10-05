// Reusable profile completeness calculation.
// Setup completeness answers “can people understand who you are?” while
// showcase completeness answers “is there work here worth exploring?”

type CompletenessInput = {
  profile: {
    avatar_url: string | null;
    banner_url: string | null;
    display_name: string | null;
    creator_title: string | null;
    bio: string | null;
    country: string | null;
    timezone: string | null;
    languages: string[] | null;
    category: string | null;
    years_experience: number | null;
    favourite_tools: string[] | null;
    software_stack: string[] | null;
    available_days: string[] | null;
    available_times: string[] | null;
    teaching_style: string | null;
    learning_goals: string | null;
    social_links: Record<string, string> | null;
    portfolio_links: { label: string; url: string }[] | null;
  } | null;
  teachCount: number;
  learnCount: number;
  projectsCount: number;
};

export type Section = {
  key: string;
  label: string;
  done: boolean;
  cta?: { label: string; href: string };
};

// Trimmed: a field a user opened and left as spaces is not filled in, though
// the checklist used to count it as done (and report a percentage for it).
const has = <T>(value: T | null | undefined) =>
  typeof value === "string" ? value.trim() !== "" : value != null;
const arr = (value: unknown[] | null | undefined) => (value?.length ?? 0) > 0;

export function sections({
  profile: p,
  teachCount,
  learnCount,
  projectsCount,
}: CompletenessInput): Section[] {
  const cta = (href = "/profile") => ({ label: "Edit profile", href });
  return [
    { key: "teach", label: "Add your first skill to share", done: teachCount > 0, cta: cta() },
    { key: "learn", label: "Add a skill you're growing", done: learnCount > 0, cta: cta() },
    { key: "project", label: "Publish your first project", done: projectsCount > 0, cta: cta() },
    { key: "name", label: "Add your display name", done: has(p?.display_name), cta: cta() },
    { key: "title", label: "Write a title", done: has(p?.creator_title), cta: cta() },
    { key: "bio", label: "Write a short bio", done: has(p?.bio), cta: cta() },
    { key: "category", label: "Pick a category", done: has(p?.category), cta: cta() },
    { key: "avatar", label: "Upload profile photo", done: has(p?.avatar_url), cta: cta() },
    { key: "banner", label: "Add a banner image", done: has(p?.banner_url), cta: cta() },
    { key: "country", label: "Set your location", done: has(p?.country), cta: cta() },
    { key: "timezone", label: "Set your timezone", done: has(p?.timezone), cta: cta() },
    { key: "languages", label: "Add languages you speak", done: arr(p?.languages), cta: cta() },
    {
      key: "experience",
      label: "Add years of experience",
      done: p?.years_experience != null,
      cta: cta(),
    },
    {
      key: "tools",
      label: "List your favourite tools",
      done: arr(p?.favourite_tools) || arr(p?.software_stack),
      cta: cta(),
    },
    {
      key: "availability",
      label: "Set your availability",
      done: arr(p?.available_days) && arr(p?.available_times),
      cta: cta(),
    },
    {
      key: "style",
      label: "Describe your sharing style",
      done: has(p?.teaching_style),
      cta: cta(),
    },
    { key: "goals", label: "Share your growth goals", done: has(p?.learning_goals), cta: cta() },
    {
      key: "links",
      label: "Connect a social or portfolio link",
      done: Object.keys(p?.social_links ?? {}).length > 0 || arr(p?.portfolio_links),
      cta: cta(),
    },
  ];
}

export function setupCompletenessPercent(input: CompletenessInput): number {
  const setupKeys = new Set([
    "name",
    "title",
    "bio",
    "category",
    "avatar",
    "country",
    "timezone",
    "languages",
  ]);
  const items = sections(input).filter((item) => setupKeys.has(item.key));
  return Math.round((items.filter((item) => item.done).length / items.length) * 100);
}

export function showcaseCompletenessPercent(input: CompletenessInput): number {
  const showcaseKeys = new Set([
    "teach",
    "learn",
    "project",
    "banner",
    "tools",
    "style",
    "goals",
    "links",
  ]);
  const items = sections(input).filter((item) => showcaseKeys.has(item.key));
  return Math.round((items.filter((item) => item.done).length / items.length) * 100);
}

export function completenessPercent(input: CompletenessInput): number {
  const items = sections(input);
  return Math.round((items.filter((s) => s.done).length / items.length) * 100);
}

export function nextSteps(input: CompletenessInput, limit = 5): Section[] {
  return sections(input)
    .filter((s) => !s.done)
    .slice(0, limit);
}

// ── Essentials ───────────────────────────────────────────────────────────────
// The three steps that switch Tethyr on for a new member: an identity people
// can read, a project to point at, and a skill that drives matching. Every
// onboarding surface (dashboard, Studio, community) reads these so a new
// member sees one list with one count, not a different number per page.
// The 18 detail sections above are optional polish once these are done.

type EssentialsInput = {
  profile: { display_name: string | null; creator_title: string | null; bio: string | null } | null;
  projectsCount: number;
  teachCount: number;
};

type EssentialStep = {
  id: "studio" | "project" | "skill";
  label: string;
  caption: string;
  done: boolean;
};

export function essentialSteps({
  profile,
  projectsCount,
  teachCount,
}: EssentialsInput): EssentialStep[] {
  return [
    {
      id: "studio",
      label: "Set up your Studio",
      caption: "Your name and what you make, so people can find you.",
      done: has(profile?.display_name) && (has(profile?.creator_title) || has(profile?.bio)),
    },
    {
      id: "project",
      label: "Start your first project",
      caption: "Give your work a home — something people can read and join.",
      done: projectsCount > 0,
    },
    {
      id: "skill",
      label: "Share a skill you teach",
      caption: "Skills are the signal that switches on matching projects and people.",
      done: teachCount > 0,
    },
  ];
}

export function essentialsComplete(input: EssentialsInput): boolean {
  return essentialSteps(input).every((step) => step.done);
}
