import { describe, it, expect } from "vitest";
import { escapeForOr, ilikeOrFilter, SEARCH_MIN_LENGTH } from "./search";

describe("escapeForOr", () => {
  it("escapes the comma that would split the or-filter into two conditions", () => {
    expect(escapeForOr("react, hooks")).toBe("react\\, hooks");
  });

  it("escapes percent signs so they match literally instead of widening the LIKE", () => {
    expect(escapeForOr("100% done")).toBe("100\\% done");
  });

  it("escapes grouping parentheses and the or-operator", () => {
    expect(escapeForOr("(a|b)")).toBe("\\(a\\|b\\)");
  });

  it("escapes backslashes so an escaped term stays a literal", () => {
    expect(escapeForOr("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary terms untouched", () => {
    expect(escapeForOr("react hooks")).toBe("react hooks");
    expect(escapeForOr("c++ tutorials")).toBe("c++ tutorials");
    expect(escapeForOr("")).toBe("");
  });
});

describe("ilikeOrFilter", () => {
  it("wraps and joins one condition per column", () => {
    expect(ilikeOrFilter(["title", "content"], "react")).toBe(
      "title.ilike.%react%,content.ilike.%react%",
    );
  });

  it("escapes or-structure characters before embedding — the comma cannot split the filter", () => {
    expect(ilikeOrFilter(["display_name", "handle"], "react, hooks")).toBe(
      "display_name.ilike.%react\\, hooks%,handle.ilike.%react\\, hooks%",
    );
    expect(ilikeOrFilter(["title"], "100% (a|b)")).toBe("title.ilike.%100\\% \\(a\\|b\\)%");
  });

  it("passes ordinary terms through untouched apart from the % wrapping", () => {
    expect(ilikeOrFilter(["title"], "c++")).toBe("title.ilike.%c++%");
  });
});

describe("SEARCH_MIN_LENGTH", () => {
  it("stays at two characters — the documented query-load floor", () => {
    expect(SEARCH_MIN_LENGTH).toBe(2);
  });
});
