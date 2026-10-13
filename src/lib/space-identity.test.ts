import { describe, expect, it } from "vitest";
import {
  normalizeLinks,
  normalizeLinkUrl,
  normalizeTopics,
  spaceAccent,
  TOPICS_MAX,
} from "./space-identity";

describe("spaceAccent", () => {
  it("uses the owner's colour when it's a valid hex", () => {
    expect(spaceAccent({ accent_color: "#7c3aed", visibility: "public", join_type: "auto" })).toBe(
      "#7c3aed",
    );
  });

  it("falls back by kind of space", () => {
    expect(spaceAccent({ accent_color: "red", visibility: "private", join_type: "auto" })).toBe(
      "var(--ai)",
    );
    expect(spaceAccent({ accent_color: null, visibility: "public", join_type: "review" })).toBe(
      "var(--primary)",
    );
    expect(spaceAccent({ visibility: "public", join_type: "auto" })).toBe("var(--trust)");
  });
});

describe("normalizeTopics", () => {
  it("trims, collapses spaces, drops blanks and duplicates", () => {
    expect(normalizeTopics(["  UI  design ", "ui design", "", "Branding"])).toEqual([
      "UI design",
      "Branding",
    ]);
  });

  it("caps the count and each topic's length", () => {
    const many = Array.from({ length: 12 }, (_, i) => `t${i}`);
    expect(normalizeTopics(many)).toHaveLength(TOPICS_MAX);
    expect(normalizeTopics(["x".repeat(50)])[0]).toHaveLength(30);
  });
});

describe("normalizeLinkUrl", () => {
  it("adds https to a bare domain", () => {
    expect(normalizeLinkUrl("discord.gg/abc")).toBe("https://discord.gg/abc");
  });

  it("rejects non-web and script URLs", () => {
    expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeLinkUrl("mailto:a@b.co")).toBeNull();
    expect(normalizeLinkUrl("   ")).toBeNull();
  });
});

describe("normalizeLinks", () => {
  it("keeps good rows, skips empty ones and explains bad ones", () => {
    const { links, problems } = normalizeLinks([
      { label: "Site", url: "example.com" },
      { label: "", url: "" },
      { label: "", url: "https://a.co" },
      { label: "Bad", url: "javascript:x" },
    ]);
    expect(links).toEqual([{ label: "Site", url: "https://example.com" }]);
    expect(problems.map((p) => p.index)).toEqual([2, 3]);
  });
});
