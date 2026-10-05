import { describe, expect, it } from "vitest";
import { z } from "zod";
import { searchEnum, searchString } from "./search-params";

const schema = z.object({ q: searchString(), tab: searchEnum(["a", "b"] as const) });

describe("search params", () => {
  it("keeps valid values", () => {
    expect(schema.parse({ q: "react", tab: "b" })).toEqual({ q: "react", tab: "b" });
  });

  it("stringifies values the router JSON-decoded", () => {
    expect(schema.parse({ q: 123 }).q).toBe("123");
    expect(schema.parse({ q: true }).q).toBe("true");
  });

  it("drops unusable values instead of throwing", () => {
    expect(schema.parse({ q: { nested: 1 }, tab: "people" })).toEqual({
      q: undefined,
      tab: undefined,
    });
  });

  it("leaves absent params absent", () => {
    expect(schema.parse({})).toEqual({});
  });
});
