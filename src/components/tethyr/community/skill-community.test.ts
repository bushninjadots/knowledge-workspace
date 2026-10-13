import { describe, expect, it } from "vitest";
import { topicMatchesSkill } from "./skill-community";

describe("topicMatchesSkill", () => {
  const skill = { slug: "ui-design", name: "UI Design" };
  it("matches a topic by the skill's name or slug, ignoring case and spacing", () => {
    expect(topicMatchesSkill("UI design", skill)).toBe(true);
    expect(topicMatchesSkill(" ui design ", skill)).toBe(true);
    expect(topicMatchesSkill("ui-design", skill)).toBe(true);
  });
  it("does not match other topics", () => {
    expect(topicMatchesSkill("Design", skill)).toBe(false);
    expect(topicMatchesSkill("UI", skill)).toBe(false);
  });
});
