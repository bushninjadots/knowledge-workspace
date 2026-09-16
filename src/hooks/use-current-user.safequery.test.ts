import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { safeQuery } from "./use-current-user";

// --- Mocks ---------------------------------------------------------------

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

const fallback = { data: [], error: null };

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- safeQuery -----------------------------------------------------------

describe("safeQuery", () => {
  it("returns the resolved value when the query succeeds", async () => {
    const result = await safeQuery(
      "test query",
      () => Promise.resolve({ data: [{ id: 1 }], error: null }),
      fallback,
    );
    expect(result).toEqual({ data: [{ id: 1 }], error: null });
  });

  it("degrades to the fallback on a missing-table error (42P01) without logging an error", async () => {
    const warn = vi.spyOn(console, "warn");
    const result = await safeQuery(
      "test query",
      () =>
        Promise.resolve({
          data: null,
          error: {
            code: "42P01",
            message: 'Could not find the table "follows" in the schema cache',
          },
        }),
      fallback,
    );
    expect(result).toBe(fallback);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("schema not published"),
      expect.anything(),
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs a real error when a genuine failure occurs but still degrades", async () => {
    const result = await safeQuery(
      "test query",
      () => Promise.resolve({ data: null, error: { message: "network down" } }),
      fallback,
    );
    expect(result).toBe(fallback);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("failed to load"),
      expect.anything(),
    );
  });

  it("degenerates a message-based column error without logging an error", async () => {
    const warn = vi.spyOn(console, "warn");
    const result = await safeQuery(
      "thrown query",
      () =>
        Promise.resolve({
          data: null,
          error: { code: null, message: 'Could not find the "contribution_score" column' },
        }),
      fallback,
    );
    expect(result).toBe(fallback);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("schema not published"),
      expect.anything(),
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("falls back when the promise rejects", async () => {
    const result = await safeQuery(
      "rejecting query",
      () => Promise.reject(new Error("boom")),
      fallback,
    );
    expect(result).toBe(fallback);
    expect(console.error).toHaveBeenCalled();
  });
});
