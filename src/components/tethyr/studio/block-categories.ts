// Palette groups, shared by the desktop Add tab and the phone edit sheet.

import type { BlockCategory } from "@/lib/page-blocks";

/** Palette groups, in the order a Studio usually reads: who you are, what
 *  you've made, what you know, who you build with, then free-form content. */
export const BLOCK_CATEGORY_ORDER: BlockCategory[] = [
  "identity",
  "work",
  "skills",
  "network",
  "content",
  "media",
  "people",
  "project",
  "community",
  "utility",
];
export const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  identity: "About you",
  work: "Work & proof",
  skills: "Skills",
  network: "Network",
  content: "Text & layout",
  media: "Media",
  people: "People",
  project: "Projects",
  community: "Community",
  utility: "Utility",
};
