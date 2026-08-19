import { describe, expect, it } from "vitest";
import { extractBearerToken } from "./auth-token";

describe("extractBearerToken", () => {
  it("returns the token without the scheme or separating whitespace", () => {
    expect(extractBearerToken("Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc")).toBe(
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc",
    );
  });

  it("handles extra whitespace around the header", () => {
    expect(extractBearerToken("  Bearer   abc.def.ghi  ")).toBe("abc.def.ghi");
  });

  it("returns null for missing or non-Bearer headers", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
    expect(extractBearerToken("Bearer ")).toBeNull();
  });
});
