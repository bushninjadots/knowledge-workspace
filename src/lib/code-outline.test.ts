import { describe, expect, it } from "vitest";
import { detectLanguage, outlineCode, outlineToMarkdown } from "./code-outline";

const TS = `// Formats money for receipts and the checkout page.
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { rates } from "./rates";

/**
 * Format an amount in the member's currency.
 * @param cents amount in cents
 */
export function formatMoney(cents: number, currency = "EUR"): string {
  return "";
}

export const toCents = (value: string) => {
  return 0;
};

export interface Price {
  amount: number;
}

function helper() {} // TODO: remove once v2 ships
`;

describe("outlineCode", () => {
  it("reads TypeScript: summary, exports with docs, imports, todos", () => {
    const o = outlineCode(TS, "money.ts");
    expect(o.language).toBe("TypeScript");
    expect(o.summary).toBe("Formats money for receipts and the checkout page.");
    expect(o.declarations.map((d) => [d.kind, d.name, d.exported])).toEqual([
      ["function", "formatMoney", true],
      ["function", "toCents", true],
      ["interface", "Price", true],
      ["function", "helper", false],
    ]);
    expect(o.declarations[0].doc).toBe("Format an amount in the member's currency.");
    expect(o.imports.external).toEqual(["react"]);
    expect(o.imports.local).toEqual(["@/lib/utils", "./rates"]);
    expect(o.todos).toEqual([{ line: 22, text: "TODO: remove once v2 ships" }]);
  });

  it("reads Python docstrings and private names", () => {
    const py = `"""Billing jobs."""
import os
from .models import Invoice

def send_invoice(invoice_id):
    """Email the invoice to the customer."""
    pass

def _retry():
    pass

class Ledger:
    pass
`;
    const o = outlineCode(py, "billing.py");
    expect(o.summary).toBe("Billing jobs.");
    expect(o.declarations.map((d) => [d.name, d.exported, d.doc])).toEqual([
      ["send_invoice", true, "Email the invoice to the customer."],
      ["_retry", false, null],
      ["Ledger", true, null],
    ]);
    expect(o.imports.local).toEqual([".models"]);
    expect(o.imports.external).toEqual(["os"]);
  });

  it("reads Go exports and comments", () => {
    const go = `package api

// Handler serves the public API.
func Handler(w http.ResponseWriter, r *http.Request) {}

func helper() {}

// Config holds settings.
type Config struct {}
`;
    const o = outlineCode(go, "api.go");
    expect(o.declarations.map((d) => [d.kind, d.name, d.exported, d.doc])).toEqual([
      ["function", "Handler", true, "Handler serves the public API."],
      ["function", "helper", false, null],
      ["struct", "Config", true, "Config holds settings."],
    ]);
  });

  it("reads Rust pub items and doc comments", () => {
    const o = outlineCode(
      "/// Parse a config file.\npub fn parse(s: &str) -> Config {}\nstruct Inner;\n",
      "lib.rs",
    );
    expect(o.declarations.map((d) => [d.name, d.exported, d.doc])).toEqual([
      ["parse", true, "Parse a config file."],
      ["Inner", false, null],
    ]);
  });
});

describe("outlineToMarkdown", () => {
  it("writes a readable doc", () => {
    const md = outlineToMarkdown(outlineCode(TS, "money.ts"), "src/money.ts");
    expect(md).toContain("# src/money.ts");
    expect(md).toContain("_TypeScript · 23 lines · 3 public parts · 2 without a description yet_");
    expect(md).toContain("## What this file is");
    expect(md).toContain("### Function `formatMoney`");
    expect(md).toContain("_No description in the code yet._");
    expect(md).toContain("## Internal helpers");
    expect(md).toContain("- **Packages:** `react`");
    expect(md).toContain("## Still to do");
  });

  it("knows languages by extension", () => {
    expect(detectLanguage("App.tsx")).toBe("TypeScript (React)");
    expect(detectLanguage("main.rs")).toBe("Rust");
    expect(detectLanguage("notes.txt")).toBe("Code");
  });
});
