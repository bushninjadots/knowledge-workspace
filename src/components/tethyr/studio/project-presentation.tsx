// ── Profile Projects Presentation ─────────────────────────────────────────────
// Selectable presentation styles for the profile-projects block. These are
// distinct from the project-PAGE arrangement presets in src/lib/project-presentation.ts
// (story-first etc.), which govern the layout of a single project page.

type ProfileProjectPresentationId =
  "spotlight" | "editorial-grid" | "horizontal-scroll" | "minimal-list";

interface ProfileProjectPresentation {
  id: ProfileProjectPresentationId;
  label: string;
  description: string;
}

export const PROFILE_PROJECT_PRESENTATIONS: readonly ProfileProjectPresentation[] = [
  {
    id: "spotlight",
    label: "Spotlight",
    description: "One featured project up front, supported by the rest.",
  },
  {
    id: "editorial-grid",
    label: "Editorial Grid",
    description: "An asymmetric, image-led gallery.",
  },
  {
    id: "horizontal-scroll",
    label: "Horizontal Scroll",
    description: "A browsable row that keeps the block compact.",
  },
  {
    id: "minimal-list",
    label: "Minimal List",
    description: "Dense rows of title, role, and status.",
  },
];

export function getProfileProjectPresentation(value: unknown): ProfileProjectPresentation {
  const match = PROFILE_PROJECT_PRESENTATIONS.find((p) => p.id === value);
  return match ?? PROFILE_PROJECT_PRESENTATIONS[0];
}
