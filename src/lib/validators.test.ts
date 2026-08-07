import { describe, it, expect } from "vitest";
import { safeRedirectPath, isSafeUrl, safeHref } from "./validators";

describe("safeRedirectPath", () => {
  it("accepts clean internal paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/projects/abc?section=roles")).toBe("/projects/abc?section=roles");
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("rejects null / undefined / empty", () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath("")).toBeNull();
  });

  it("rejects protocol-relative and absolute external URLs", () => {
    expect(safeRedirectPath("//evil.com")).toBeNull();
    expect(safeRedirectPath("https://evil.com")).toBeNull();
    expect(safeRedirectPath("http://evil.com")).toBeNull();
    // Protocol-relative via backslash — browsers normalize \\ to /.
    expect(safeRedirectPath("/\\evil.com")).toBeNull();
    expect(safeRedirectPath("\\\\evil.com")).toBeNull();
  });

  it("rejects anything containing a colon or backslash", () => {
    expect(safeRedirectPath("/https://evil.com")).toBeNull();
    expect(safeRedirectPath("/\\path\\traversal")).toBeNull();
    expect(safeRedirectPath("/javascript:alert(1)")).toBeNull();
  });

  it("rejects non-path strings", () => {
    expect(safeRedirectPath("dashboard")).toBeNull();
    expect(safeRedirectPath("javascript:void(0)")).toBeNull();
  });
});

describe("isSafeUrl", () => {
  it("allows http(s) only", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("ftp://example.com")).toBe(false);
    expect(isSafeUrl("")).toBe(false);
  });
});

describe("safeHref", () => {
  it("falls back to # for unsafe URLs", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref(null)).toBe("#");
    expect(safeHref("https://ok.com")).toBe("https://ok.com");
  });
});
