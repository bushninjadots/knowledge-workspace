// One hue per kind of post, from theme tokens (so light, dark and every
// visual direction get matching values). Asks are warm — the things that need
// a response stand out — questions and how-tos are blue, people-finding is
// purple, shown work is green, open talk is neutral.
import type { CSSProperties } from "react";
import type { PostType } from "@/hooks/use-community";

export const POST_TONE: Record<PostType, string> = {
  help_request: "var(--caution)",
  feedback_request: "var(--caution)",
  question: "var(--learning)",
  tutorial: "var(--learning)",
  resource: "var(--learning)",
  collaboration_request: "var(--ai)",
  open_role: "var(--ai)",
  lesson_learned: "var(--ai)",
  poll: "var(--ai)",
  showcase: "var(--trust)",
  project_update: "var(--trust)",
  progress_update: "var(--trust)",
  achievement: "var(--trust)",
  discussion: "var(--muted-foreground)",
};

/** Sets `--post-tone` for a card and the classes/styles that read it. */
export function postToneStyle(type: PostType): CSSProperties {
  return { "--post-tone": POST_TONE[type] ?? "var(--muted-foreground)" } as CSSProperties;
}

/** Tone as readable text: pulled towards the foreground for contrast. */
export const TONE_TEXT = "text-[color-mix(in_oklab,var(--post-tone)_70%,var(--foreground))]";
/** A soft tinted chip behind the type label. */
export const TONE_CHIP = "bg-[color-mix(in_oklab,var(--post-tone)_14%,transparent)]";
