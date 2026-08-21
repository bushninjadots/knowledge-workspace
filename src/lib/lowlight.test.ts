import { describe, it, expect } from "vitest";
import lowlight, { CODE_LANGUAGE_OPTIONS } from "./lowlight";

describe("lowlight registry", () => {
  const languages = [
    "javascript", "js", "jsx",
    "typescript", "ts", "tsx",
    "python", "py",
    "java",
    "c", "cpp", "csharp", "cs",
    "go", "golang",
    "rust",
    "php",
    "ruby",
    "sql",
    "bash", "sh", "shell", "zsh",
    "yaml", "yml",
    "xml", "html",
    "css",
    "json",
  ];

  it.each(languages)("has a grammar registered for %s", (lang) => {
    expect(lowlight.registered(lang)).toBe(true);
  });
});

describe("CODE_LANGUAGE_OPTIONS", () => {
  it("starts with a plain-text option that clears the language", () => {
    expect(CODE_LANGUAGE_OPTIONS[0]).toEqual({ value: "none", label: "Plain text" });
  });

  it("only offers languages lowlight can actually highlight", () => {
    for (const opt of CODE_LANGUAGE_OPTIONS.slice(1)) {
      expect(lowlight.registered(opt.value)).toBe(true);
    }
  });

  it("covers the ten most common languages plus the rest of the set", () => {
    const values = CODE_LANGUAGE_OPTIONS.map((o) => o.value);
    for (const required of [
      "javascript", "typescript", "python", "java", "c",
      "cpp", "csharp", "go", "rust", "php",
      "ruby", "sql", "bash", "yaml", "html", "css", "json",
    ]) {
      expect(values).toContain(required);
    }
  });
});
