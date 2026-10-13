// A space's owner-set identity: its colour, topics and links. The limits here
// mirror the database CHECKs in 20261013120000_space_identity.sql, so the form
// rejects exactly what the database would.
import type { CommunitySpace, SpaceLink } from "@/hooks/community-space-types";
import { safeHref } from "@/lib/validators";

export const TAGLINE_MAX = 80;
export const DESCRIPTION_MAX = 300;
export const ABOUT_MAX = 4000;
export const WELCOME_MAX = 500;
export const TOPICS_MAX = 8;
export const TOPIC_MAX = 30;
export const LINKS_MAX = 5;
export const LINK_LABEL_MAX = 40;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Hand-picked space colours that read on light and dark cards alike. */
export const SPACE_ACCENT_SWATCHES: { value: string; label: string }[] = [
  { value: "#7c3aed", label: "Violet" },
  { value: "#2563eb", label: "Blue" },
  { value: "#0891b2", label: "Teal" },
  { value: "#16a34a", label: "Green" },
  { value: "#ca8a04", label: "Gold" },
  { value: "#ea580c", label: "Orange" },
  { value: "#e11d48", label: "Rose" },
  { value: "#475569", label: "Slate" },
];

export function isHexColor(value: string | null | undefined): value is string {
  return !!value && HEX.test(value);
}

/** The space's colour: the owner's choice, else a default from its kind. */
export function spaceAccent(
  space: Pick<CommunitySpace, "accent_color" | "visibility" | "join_type">,
): string {
  if (isHexColor(space.accent_color)) return space.accent_color;
  if (space.visibility === "private") return "var(--ai)";
  if (space.join_type === "review") return "var(--primary)";
  return "var(--trust)";
}

/** Trim, drop blanks and duplicates (case-insensitive), cap length and count. */
export function normalizeTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of topics) {
    const topic = raw.trim().replace(/\s+/g, " ").slice(0, TOPIC_MAX);
    const key = topic.toLowerCase();
    if (!topic || seen.has(key)) continue;
    seen.add(key);
    out.push(topic);
    if (out.length === TOPICS_MAX) break;
  }
  return out;
}

/** Add `https://` to bare domains; null when it still isn't a web URL. */
export function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!/^https?:\/\/[^\s]{3,}$/i.test(withScheme) || withScheme.length > 300) return null;
  return safeHref(withScheme) === withScheme ? withScheme : null;
}

export type LinkDraft = { label: string; url: string };

/** Links ready to save, plus the rows that can't be saved and why. */
export function normalizeLinks(drafts: LinkDraft[]): {
  links: SpaceLink[];
  problems: { index: number; message: string }[];
} {
  const links: SpaceLink[] = [];
  const problems: { index: number; message: string }[] = [];
  drafts.forEach((draft, index) => {
    const label = draft.label.trim();
    if (!label && !draft.url.trim()) return; // an empty row is fine — skip it
    const url = normalizeLinkUrl(draft.url);
    if (!label) problems.push({ index, message: "Give the link a label" });
    else if (label.length > LINK_LABEL_MAX)
      problems.push({ index, message: `Labels are ${LINK_LABEL_MAX} characters at most` });
    else if (!url) problems.push({ index, message: "That isn't a web address" });
    else links.push({ label, url });
  });
  if (links.length > LINKS_MAX) {
    problems.push({ index: LINKS_MAX, message: `Up to ${LINKS_MAX} links` });
  }
  return { links: links.slice(0, LINKS_MAX), problems };
}
