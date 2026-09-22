import { describe, it, expect } from "vitest";
import {
  completenessPercent,
  nextSteps,
  sections,
  setupCompletenessPercent,
  showcaseCompletenessPercent,
} from "@/lib/profile-completeness";

/**
 * Drives the "Your Studio" setup checklist and its percentages. Two rules are
 * easy to break silently: a whitespace-only field must not count as filled,
 * and availability needs *both* days and times (the old check accepted either,
 * so a half-answered availability read as complete).
 */
type Input = Parameters<typeof sections>[0];

const base: Input = {
  profile: {
    avatar_url: null,
    banner_url: null,
    display_name: null,
    creator_title: null,
    bio: null,
    country: null,
    timezone: null,
    languages: null,
    category: null,
    years_experience: null,
    favourite_tools: null,
    software_stack: null,
    available_days: null,
    available_times: null,
    teaching_style: null,
    learning_goals: null,
    social_links: null,
    portfolio_links: null,
  },
  teachCount: 0,
  learnCount: 0,
  projectsCount: 0,
};

type ProfileRow = NonNullable<Input["profile"]>;

const input = (overrides: Partial<ProfileRow> = {}, counts: Partial<Input> = {}): Input => ({
  profile: { ...(base.profile as ProfileRow), ...overrides },
  teachCount: 0,
  learnCount: 0,
  projectsCount: 0,
  ...counts,
});

const done = (result: ReturnType<typeof sections>, key: string) =>
  result.find((section) => section.key === key)?.done;

describe("sections", () => {
  it("starts empty for a blank profile and empty counts", () => {
    expect(sections(base).every((section) => !section.done)).toBe(true);
    expect(completenessPercent(base)).toBe(0);
  });

  it("counts a whitespace-only field as missing but a real value as done", () => {
    expect(done(sections(input({ bio: "   " })), "bio")).toBe(false);
    expect(done(sections(input({ bio: "Designer" })), "bio")).toBe(true);
  });

  it("counts a zero years-of-experience value as answered", () => {
    // `!= null`, not truthiness: "just starting out" is a real answer.
    expect(done(sections(input({ years_experience: 0 })), "experience")).toBe(true);
  });

  it("requires both halves of availability", () => {
    expect(done(sections(input({ available_days: ["mon"] })), "availability")).toBe(false);
    expect(done(sections(input({ available_times: ["evenings"] })), "availability")).toBe(false);
    expect(
      done(
        sections(input({ available_days: ["mon"], available_times: ["evenings"] })),
        "availability",
      ),
    ).toBe(true);
  });

  it("accepts either tools list but needs at least one entry", () => {
    expect(done(sections(input({ favourite_tools: [] })), "tools")).toBe(false);
    expect(done(sections(input({ software_stack: ["Figma"] })), "tools")).toBe(true);
    expect(done(sections(input({ favourite_tools: ["Vim"] })), "tools")).toBe(true);
  });

  it("accepts either a social link or a portfolio link", () => {
    expect(done(sections(input({ social_links: {} })), "links")).toBe(false);
    expect(
      done(sections(input({ social_links: { github: "https://github.com/x" } })), "links"),
    ).toBe(true);
    expect(
      done(
        sections(input({ portfolio_links: [{ label: "Site", url: "https://x.test" }] })),
        "links",
      ),
    ).toBe(true);
  });

  it("maps contribution counts onto teach, learn, and project", () => {
    const result = sections({ ...base, teachCount: 2, learnCount: 0, projectsCount: 1 });
    expect(done(result, "teach")).toBe(true);
    expect(done(result, "learn")).toBe(false);
    expect(done(result, "project")).toBe(true);
  });

  it("gives every section a label and an edit CTA", () => {
    for (const section of sections(base)) {
      expect(section.label.length, section.key).toBeGreaterThan(0);
      expect(section.cta?.href, section.key).toBe("/profile");
    }
  });
});

describe("percentages", () => {
  it("scores setup and showcase from their own subsets", () => {
    // Avatar is setup; banner is showcase — the split is what lets the UI say
    // "people can find you" separately from "there is work here".
    const profile = input({
      avatar_url: "https://cdn.test/a.png",
      banner_url: "https://cdn.test/b.png",
    });
    expect(setupCompletenessPercent(profile)).toBe(13); // 1 of 8 setup items
    expect(showcaseCompletenessPercent(profile)).toBe(13); // 1 of 8 showcase items
    expect(completenessPercent(profile)).toBe(11); // 2 of 18 overall
  });

  it("reaches 100 at most once every section is done", () => {
    const complete = input(
      {
        avatar_url: "a",
        banner_url: "b",
        display_name: "Maya",
        creator_title: "Designer",
        bio: "Hi",
        country: "ES",
        timezone: "Europe/Madrid",
        languages: ["en"],
        category: "design",
        years_experience: 5,
        favourite_tools: ["Figma"],
        available_days: ["mon"],
        available_times: ["evenings"],
        teaching_style: "Pairing",
        learning_goals: "Systems",
        social_links: { github: "https://github.com/maya" },
      },
      { teachCount: 1, learnCount: 1, projectsCount: 1 },
    );
    expect(completenessPercent(complete)).toBe(100);
    expect(setupCompletenessPercent(complete)).toBe(100);
    expect(showcaseCompletenessPercent(complete)).toBe(100);
  });
});

describe("nextSteps", () => {
  it("returns the first undone sections in order, capped by the limit", () => {
    const result = nextSteps(base, 3);
    expect(result).toHaveLength(3);
    expect(result.map((section) => section.key)).toEqual(["teach", "learn", "project"]);
  });

  it("returns nothing when everything is done", () => {
    const complete = input(
      {
        avatar_url: "a",
        banner_url: "b",
        display_name: "Maya",
        creator_title: "Designer",
        bio: "Hi",
        country: "ES",
        timezone: "Europe/Madrid",
        languages: ["en"],
        category: "design",
        years_experience: 5,
        favourite_tools: ["Figma"],
        available_days: ["mon"],
        available_times: ["evenings"],
        teaching_style: "Pairing",
        learning_goals: "Systems",
        social_links: { github: "https://github.com/maya" },
      },
      { teachCount: 1, learnCount: 1, projectsCount: 1 },
    );
    expect(nextSteps(complete, 5)).toEqual([]);
  });
});
