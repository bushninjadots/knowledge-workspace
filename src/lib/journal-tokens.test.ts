import { describe, expect, it } from "vitest";
import { generateToken, hashToken, looksLikeToken, tokenPrefix } from "./journal-tokens";

describe("journal tokens", () => {
  it("generates distinct, well-formed tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(looksLikeToken(a)).toBe(true);
    expect(looksLikeToken("tth_short")).toBe(false);
    expect(tokenPrefix(a)).toMatch(/^tth_.{4}…$/);
  });

  it("hashes with SHA-256", async () => {
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
