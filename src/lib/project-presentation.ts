export type ProjectPresentationPreset =
  "story-first" | "demo-first" | "process-first" | "collaboration-first";

export type ProjectSectionKey = "overview" | "work" | "people" | "conversation" | "evidence";

export type ProjectPresentationOption = {
  id: ProjectPresentationPreset;
  label: string;
  description: string;
  sectionOrder: ProjectSectionKey[];
};

export const DEFAULT_PROJECT_PRESENTATION: ProjectPresentationPreset = "story-first";

export const PROJECT_PRESENTATION_OPTIONS: ProjectPresentationOption[] = [
  {
    id: "demo-first",
    label: "Demo first",
    description: "Put the proof of the work in front before the longer story.",
    sectionOrder: ["overview", "work", "people", "conversation", "evidence"],
  },
  {
    id: "story-first",
    label: "Story first",
    description: "Lead with the idea, intent, and README context.",
    sectionOrder: ["overview", "people", "work", "conversation", "evidence"],
  },
  {
    id: "process-first",
    label: "Process first",
    description: "Make progress, milestones, and current work easier to find.",
    sectionOrder: ["overview", "work", "conversation", "people", "evidence"],
  },
  {
    id: "collaboration-first",
    label: "Collaboration first",
    description: "Put people, open roles, and contribution paths within reach.",
    sectionOrder: ["overview", "people", "conversation", "work", "evidence"],
  },
];

export function getProjectPresentationOption(
  value: string | null | undefined,
): ProjectPresentationOption {
  return (
    PROJECT_PRESENTATION_OPTIONS.find((option) => option.id === value) ??
    PROJECT_PRESENTATION_OPTIONS.find((option) => option.id === DEFAULT_PROJECT_PRESENTATION)!
  );
}

export function isProjectPresentationPreset(value: unknown): value is ProjectPresentationPreset {
  return (
    typeof value === "string" && PROJECT_PRESENTATION_OPTIONS.some((option) => option.id === value)
  );
}
