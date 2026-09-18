import { describe, expect, it } from "vitest";
import { canonicalProjectStatus, isLiveStatus, statusDotClass } from "./project-status";

describe("canonicalProjectStatus", () => {
  it("leads with the lifecycle stage for live projects", () => {
    expect(canonicalProjectStatus("active", "growing")).toBe("Growing");
    expect(canonicalProjectStatus("active", "building")).toBe("Building");
    expect(canonicalProjectStatus("active", "launch")).toBe("Launching");
  });

  it("lets status override the stage when it adds information", () => {
    expect(canonicalProjectStatus("paused", "growing")).toBe("Paused");
    expect(canonicalProjectStatus("completed", "building")).toBe("Completed");
    expect(canonicalProjectStatus("planning", "building")).toBe("Planning");
  });

  it("falls back to status alone when no stage", () => {
    expect(canonicalProjectStatus("active", null)).toBeNull();
    expect(canonicalProjectStatus("paused", null)).toBe("Paused");
    expect(canonicalProjectStatus("completed", null)).toBe("Completed");
  });

  it("returns null when both fields are empty or unknown", () => {
    expect(canonicalProjectStatus(null, null)).toBeNull();
    expect(canonicalProjectStatus("", "")).toBeNull();
    expect(canonicalProjectStatus("mystery", "mystery")).toBeNull();
  });

  it("normalizes the legacy 'launch' and 'launching' spellings", () => {
    expect(canonicalProjectStatus("active", "launching")).toBe("Launching");
  });
});

describe("isLiveStatus", () => {
  it("breathes only for live work", () => {
    expect(isLiveStatus("active", "growing")).toBe(true);
    // Status wins: an active project is live even while still planning.
    expect(isLiveStatus("active", "planning")).toBe(true);
    expect(isLiveStatus("planning", null)).toBe(false);
    expect(isLiveStatus("paused", "building")).toBe(false);
    expect(isLiveStatus("completed", "growing")).toBe(false);
  });
});

describe("statusDotClass", () => {
  it("maps statuses to the existing dot tints", () => {
    expect(statusDotClass("paused")).toBe("bg-muted-foreground/40");
    expect(statusDotClass("completed")).toBe("bg-primary");
    expect(statusDotClass("planning")).toBe("bg-teaching");
    expect(statusDotClass("active")).toBe("bg-trust");
  });
});
