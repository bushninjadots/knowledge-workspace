import { describe, it, expect } from "vitest";
import { isColumnSchemaError } from "./supabase-errors";

describe("isColumnSchemaError", () => {
  it("flags Postgres missing-object codes (42P01, 42703, …)", () => {
    expect(isColumnSchemaError({ code: "42P01", message: "undefined_table" })).toBe(true);
    expect(isColumnSchemaError({ code: "42703", message: "undefined_column" })).toBe(true);
    expect(isColumnSchemaError({ code: "42501", message: "permission denied" })).toBe(true);
  });

  it("flags messages that mention a column or schema", () => {
    expect(isColumnSchemaError({ message: 'Could not find the "verification_level" column' })).toBe(
      true,
    );
    expect(
      isColumnSchemaError({ message: 'Could not find the table "follows" in the schema cache' }),
    ).toBe(true);
  });

  it("treats anything else — including null/undefined — as a real error", () => {
    expect(isColumnSchemaError(null)).toBe(false);
    expect(isColumnSchemaError(undefined)).toBe(false);
    expect(isColumnSchemaError({})).toBe(false);
    expect(isColumnSchemaError({ code: "PGRST301", message: "database connection failed" })).toBe(
      false,
    );
    expect(isColumnSchemaError({ code: "22P02", message: "invalid input syntax" })).toBe(false);
    expect(isColumnSchemaError({ message: "timeout" })).toBe(false);
  });

  it("does not treat a plain network failure message as schema drift", () => {
    expect(isColumnSchemaError({ message: "fetch failed: socket hang up" })).toBe(false);
  });
});
