import { describe, expect, it, vi } from "vitest";
import { buildSessionIcs, downloadIcs } from "./ical";

describe("buildSessionIcs", () => {
  const start = new Date("2026-09-20T15:00:00.000Z");

  it("produces a minimal valid VCALENDAR with a timed VEVENT", () => {
    const body = buildSessionIcs({
      uid: "abc-123",
      title: "Portfolio review",
      start,
      end: null,
      durationMinutes: 45,
    });

    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("VERSION:2.0");
    expect(body).toContain("PRODID:-//Tethyr//Sessions//EN");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("UID:abc-123@tethyr");
    expect(body).toContain("DTSTART:20260920T150000Z");
    expect(body).toContain("DTEND:20260920T154500Z");
    expect(body).toContain("SUMMARY:Portfolio review");
    expect(body).toContain("END:VEVENT");
    expect(body).toContain("END:VCALENDAR");
    expect(body.endsWith("\r\n")).toBe(true);
  });

  it("uses ends_at when present instead of the duration", () => {
    const body = buildSessionIcs({
      uid: "x",
      title: "Session",
      start,
      end: new Date("2026-09-20T16:30:00.000Z"),
      durationMinutes: 30,
    });
    expect(body).toContain("DTEND:20260920T163000Z");
  });

  it("escapes RFC 5545 special characters in text fields", () => {
    const body = buildSessionIcs({
      uid: "x",
      title: 'Design review, part 2; "vibes"',
      start,
      end: null,
      durationMinutes: 30,
      description: "Line one\nLine two, with detail",
      location: "Back room; ask at desk",
    });
    expect(body).toContain('SUMMARY:Design review\\, part 2\\; "vibes"');
    expect(body).toContain("DESCRIPTION:Line one\\nLine two\\, with detail");
    expect(body).toContain("LOCATION:Back room\\; ask at desk");
  });

  it("folds long lines at 75 octets with a leading space continuation", () => {
    const longTitle = "A".repeat(120);
    const body = buildSessionIcs({
      uid: "x",
      title: longTitle,
      start,
      end: null,
      durationMinutes: 30,
    });
    const lines = body.split("\r\n");
    // First physical line is capped; continuation lines start with a space.
    expect(lines.some((l) => l.startsWith(" A"))).toBe(true);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    // Rejoining the folded lines reconstructs the original value.
    const folded = lines.filter(
      (l) => l.startsWith("SUMMARY:") || (l.startsWith(" ") && !l.startsWith("SUMMARY")),
    );
    const summary = folded
      .map((l, idx) => (idx === 0 ? l.slice("SUMMARY:".length) : l.slice(1)))
      .join("");
    expect(summary).toBe(longTitle);
  });

  it("omits DESCRIPTION/LOCATION when nothing is provided", () => {
    const body = buildSessionIcs({
      uid: "x",
      title: "Simple",
      start,
      end: null,
      durationMinutes: 30,
    });
    expect(body).not.toContain("DESCRIPTION:");
    expect(body).not.toContain("LOCATION:");
  });

  it("includes the meeting URL in the description", () => {
    const body = buildSessionIcs({
      uid: "x",
      title: "Call",
      start,
      end: null,
      durationMinutes: 30,
      meetingUrl: "https://meet.example.com/abc",
    });
    expect(body).toContain("https://meet.example.com/abc");
  });
});

describe("downloadIcs", () => {
  it("creates a temporary anchor and revokes the object URL", () => {
    const originalCreate = document.createElement.bind(document);
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock")
      .mockImplementation(() => "blob:mock");

    const clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") {
        Object.defineProperty(el, "click", { value: clickSpy });
      }
      return el;
    }) as typeof document.createElement);

    downloadIcs("session.ics", "BEGIN:VCALENDAR");

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(createSpy).toHaveBeenCalledOnce();
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock");
    vi.restoreAllMocks();
  });
});
