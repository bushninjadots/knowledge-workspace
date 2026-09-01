import { describe, expect, it } from "vitest";
import {
  normalizeProfileHandle,
  validateProfileInput,
  validateProfileUrl,
} from "./profile-validation";

describe("profile validation", () => {
  it("requires a display name", () => {
    expect(
      validateProfileInput({ displayName: " ", handle: "maker", yearsExperience: "" }),
    ).toContain("display name");
  });

  it("accepts and normalizes a valid handle", () => {
    expect(normalizeProfileHandle("  Maker_01 ")).toBe("maker_01");
    expect(
      validateProfileInput({ displayName: "Maker", handle: "maker_01", yearsExperience: "10" }),
    ).toBeNull();
  });

  it("accepts only secure profile URLs", () => {
    expect(validateProfileUrl("https://example.com/work")).toBe(true);
    expect(validateProfileUrl("http://example.com/work")).toBe(false);
    expect(validateProfileUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects malformed handles and experience values", () => {
    expect(
      validateProfileInput({ displayName: "Maker", handle: "not valid", yearsExperience: "10" }),
    ).toContain("Handle");
    expect(
      validateProfileInput({ displayName: "Maker", handle: "maker", yearsExperience: "81" }),
    ).toContain("0 to 80");
  });
});
