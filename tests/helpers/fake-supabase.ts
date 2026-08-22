import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FakeCall = {
  table: string;
  action: string;
  value?: unknown;
};

export type FakeHandler = () => { data: unknown; error: unknown };
export type FakeHandlers = Record<string, FakeHandler>;

// ---------------------------------------------------------------------------
// createFakeSupabase — chainable mock for the Supabase JS client
// ---------------------------------------------------------------------------

export interface FakeSupabaseHandle {
  /** Wire these into your vi.mock factory: `fake.supabase.from = h.client.from` */
  client: {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
    rpc: ReturnType<typeof vi.fn>;
  };
  /** Every `from(table)` call recorded by the chainable builder. */
  calls: FakeCall[];
  /** Register a response handler. Key = `"table:action"` (e.g. `"teams:insert"`). */
  on(key: string, handler: FakeHandler): void;
  /** Clear all recorded calls and handlers. */
  reset(): void;
}

/**
 * Creates a chainable mock of the Supabase JS client.
 *
 * Usage:
 * ```ts
 * const handle = createFakeSupabase();
 * fake.supabase.from = handle.client.from;
 * fake.supabase.auth = handle.client.auth;
 * handle.on("teams:insert", () => ({ data: { id: "1" }, error: null }));
 * // ... await a query that calls sb.from("teams").insert(...)
 * expect(handle.calls).toEqual([{ table: "teams", action: "insert", value: { id: "1" } }]);
 * ```
 */
export function createFakeSupabase(): FakeSupabaseHandle {
  const calls: FakeCall[] = [];
  const handlers: FakeHandlers = {};

  const from = vi.fn((table: string) => {
    const builder = {
      _action: "select" as string,
      _value: undefined as unknown,

      // Mutations -----------------------------------------------------------
      insert(v: unknown) {
        builder._action = "insert";
        builder._value = v;
        return builder;
      },
      update(v: unknown) {
        builder._action = "update";
        builder._value = v;
        return builder;
      },
      upsert(v: unknown) {
        builder._action = "upsert";
        builder._value = v;
        return builder;
      },
      delete() {
        builder._action = "delete";
        return builder;
      },

      // Filters (all no-ops, just keep the chain alive) ---------------------
      select(_cols?: string) {
        return builder;
      },
      eq() {
        return builder;
      },
      neq() {
        return builder;
      },
      ilike() {
        return builder;
      },
      in() {
        return builder;
      },
      gt() {
        return builder;
      },
      is() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },

      // Result modifiers ----------------------------------------------------
      single() {
        return builder;
      },
      maybeSingle() {
        return builder;
      },

      // Thenable — lets `await sb.from(...).select().eq(...)` resolve --------
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
        calls.push({ table, action: builder._action, value: builder._value });
        const handler =
          handlers[`${table}:${builder._action}`] ?? (() => ({ data: null, error: null }));
        return Promise.resolve(handler()).then(onFulfilled);
      },
    };
    return builder;
  });

  const auth = {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    })),
  };

  const rpc = vi.fn(async () => ({ data: null, error: null }));

  return {
    client: { from, auth, rpc },
    calls,
    on(key, handler) {
      handlers[key] = handler;
    },
    reset() {
      calls.length = 0;
      for (const key of Object.keys(handlers)) delete handlers[key];
    },
  };
}
