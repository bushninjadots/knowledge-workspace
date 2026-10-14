import { describe, expect, it } from "vitest";
import {
  bragDocMarkdown,
  buildStandup,
  dayLabel,
  entryLine,
  groupByDay,
  normalizeSource,
  parseCommitMessage,
  previousWorkday,
  shipLinesFromJournal,
  sourceLabel,
  type JournalEntryLite,
} from "./journal";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const e = (kind: JournalEntryLite["kind"], body: string, occurred_at: string, extra = {}) =>
  ({ kind, body, occurred_at, ...extra }) as JournalEntryLite;

describe("days", () => {
  it("skips weekends for the previous workday", () => {
    expect(previousWorkday(new Date(2026, 9, 12, 9)).getDay()).toBe(5); // Mon → Fri
    expect(previousWorkday(new Date(2026, 9, 14, 9)).getDate()).toBe(13); // Wed → Tue
  });

  it("labels and groups days newest first", () => {
    const now = new Date(2026, 9, 14, 15);
    expect(dayLabel("2026-10-14", now)).toBe("Today");
    expect(dayLabel("2026-10-13", now)).toBe("Yesterday");
    const groups = groupByDay([
      e("did", "a", at(2026, 10, 13)),
      e("did", "b", at(2026, 10, 14)),
      e("did", "c", at(2026, 10, 13, 9)),
    ]);
    expect(groups.map((g) => [g.day, g.entries.length])).toEqual([
      ["2026-10-14", 1],
      ["2026-10-13", 2],
    ]);
  });
});

describe("entryLine", () => {
  it("prefixes by kind without doubling it", () => {
    expect(entryLine(e("fixed", "The login loop", at(2026, 10, 1)))).toBe("Fixed the login loop");
    expect(entryLine(e("fixed", "Fixed the login loop", at(2026, 10, 1)))).toBe(
      "Fixed the login loop",
    );
    expect(
      entryLine(e("did", "built settings", at(2026, 10, 1), { project_title: "Tethyr" })),
    ).toBe("Built settings (Tethyr)");
    expect(entryLine(e("stuck", "CORS on uploads", at(2026, 10, 1)))).toBe(
      "Stuck on CORS on uploads",
    );
  });
});

describe("buildStandup", () => {
  it("writes yesterday, today and blockers", () => {
    const now = new Date(2026, 9, 14, 9); // Wed
    const text = buildStandup(
      [
        e("did", "Built the settings page", at(2026, 10, 13, 16)),
        e("fixed", "the login loop", at(2026, 10, 14, 8)),
        e("next", "Wire up reminders", at(2026, 10, 13, 18)),
        e("stuck", "flaky e2e test", at(2026, 10, 12)),
        e("stuck", "old thing", at(2026, 10, 12), { resolved_at: at(2026, 10, 13) }),
        e("did", "Too old", at(2026, 10, 9)),
      ],
      now,
    );
    expect(text).toBe(
      [
        "Yesterday",
        "• Built the settings page",
        "• Fixed the login loop",
        "",
        "Today",
        "• Wire up reminders",
        "",
        "Blockers",
        "• Stuck on flaky e2e test",
      ].join("\n"),
    );
  });

  it("says so when nothing was logged", () => {
    expect(buildStandup([], new Date(2026, 9, 14))).toContain("• Nothing logged");
    expect(buildStandup([], new Date(2026, 9, 14))).toContain("Blockers\n• None");
  });
});

describe("shipLinesFromJournal", () => {
  it("orders notable work and picks the latest next", () => {
    const result = shipLinesFromJournal([
      e("learned", "Rust lifetimes", at(2026, 10, 12)),
      e("did", "Launched beta", at(2026, 10, 13)),
      e("next", "older plan", at(2026, 10, 12)),
      e("next", "public launch", at(2026, 10, 14)),
      e("stuck", "not in a ship", at(2026, 10, 14)),
    ]);
    expect(result.lines).toEqual(["Launched beta", "Learned rust lifetimes"]);
    expect(result.nextUp).toBe("public launch");
  });
});

describe("bragDocMarkdown", () => {
  it("groups the month with a summary and links", () => {
    const md = bragDocMarkdown(
      [
        e("did", "Shipped *dark* mode", at(2026, 10, 3), {
          project_title: "Tethyr",
          source_url: "https://github.com/a/b/pull/1",
        }),
        e("fixed", "Login loop", at(2026, 10, 5)),
        e("stuck", "CORS", at(2026, 10, 6), { resolved_at: at(2026, 10, 7) }),
      ],
      "Brag doc — October 2026",
      "Maya",
    );
    expect(md).toContain("# Brag doc — October 2026 — Maya");
    expect(md).toContain("_1 built & shipped · 1 fixed · 1 blockers cleared · across 1 project_");
    expect(md).toContain(
      "- [Shipped \\*dark\\* mode](https://github.com/a/b/pull/1) — *Tethyr* (3 Oct)",
    );
    expect(md).toContain("## Blockers cleared");
  });

  it("is honest about an empty month", () => {
    expect(bragDocMarkdown([], "Brag doc")).toContain("Nothing logged this month yet");
  });
});

describe("sources", () => {
  it("normalizes tool names and labels them", () => {
    expect(normalizeSource("Claude Code")).toBe("claude-code");
    expect(normalizeSource("  ")).toBe("api");
    expect(normalizeSource(42, "mcp")).toBe("mcp");
    expect(sourceLabel("claude-code")).toBe("Claude Code");
    expect(sourceLabel("tethyr")).toBeNull();
    expect(sourceLabel("zed")).toBe("zed");
  });
});

describe("parseCommitMessage", () => {
  it("logs features and fixes, skips the noise", () => {
    expect(parseCommitMessage("feat(auth): add SSO login")).toEqual({
      kind: "did",
      body: "add SSO login (auth)",
    });
    expect(parseCommitMessage("fix: redirect loop on logout\n\nlong body")).toEqual({
      kind: "fixed",
      body: "redirect loop on logout",
    });
    expect(parseCommitMessage("chore: bump deps")).toBeNull();
    expect(parseCommitMessage("fix(deps): update all non-major dependencies")).toBeNull();
    expect(parseCommitMessage("Merge branch 'main'")).toBeNull();
    expect(parseCommitMessage("wip")).toBeNull();
  });

  it("logs anything tagged [log]", () => {
    expect(parseCommitMessage("Tidy the parser [log]")).toEqual({
      kind: "did",
      body: "Tidy the parser",
    });
    expect(parseCommitMessage("docs: explain the queue [log]")).toEqual({
      kind: "did",
      body: "explain the queue",
    });
  });
});
