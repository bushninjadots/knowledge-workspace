import { describe, expect, it, afterEach, vi } from "vitest";
import { getAuthErrorMessage, isNetworkError } from "./auth-error";

describe("isNetworkError", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats TypeError (fetch rejection) as a network error", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("detects the exact 'NetworkError when attempting to fetch resource' message", () => {
    expect(isNetworkError(new Error("NetworkError when attempting to fetch resource"))).toBe(true);
  });

  it("detects common network failure messages", () => {
    for (const msg of [
      "Failed to fetch",
      "fetch failed",
      "Load failed",
      "net::ERR_CONNECTION_REFUSED",
      "request timed out",
    ]) {
      expect(isNetworkError(new Error(msg)), msg).toBe(true);
    }
  });

  it("returns true when the browser reports being offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(isNetworkError(new Error("anything"))).toBe(true);
  });

  it("does not flag normal auth errors", () => {
    expect(isNetworkError(new Error("Invalid login credentials"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe("getAuthErrorMessage", () => {
  it("surfaces friendly supabase messages for credential errors", () => {
    const err = new Error("Invalid login credentials");
    expect(getAuthErrorMessage(err)).toBe("Invalid login credentials");
  });

  it("returns an actionable message for network errors", () => {
    const err = new TypeError("Failed to fetch");
    const msg = getAuthErrorMessage(err);
    expect(msg).toContain("Can't reach");
    expect(msg).not.toContain("Failed to fetch");
  });

  it("uses the fallback for unknown errors without a message", () => {
    expect(getAuthErrorMessage({})).toBe("Something went wrong. Please try again.");
    expect(getAuthErrorMessage(undefined, "custom fallback")).toBe("custom fallback");
  });
});
