// Forgiving Zod pieces for route `validateSearch` schemas.
//
// The router's default parser JSON-decodes each value, so `?q=123` arrives as
// the number 123 and `?c=true` as a boolean. A bare z.string() rejects those,
// and a failed validateSearch is a 500 for the whole route — a search for
// "2024" or an id that happens to look numeric took the page down. These
// helpers accept what the URL can produce and drop what they cannot use,
// so a stale or hand-edited link degrades to the default view instead.

import { z } from "zod";

/** An optional string param; scalars are stringified, anything else dropped. */
export function searchString() {
  return z
    .union([z.string(), z.number(), z.boolean()])
    .transform(String)
    .optional()
    .catch(undefined);
}

/** An optional enum param; an unknown value falls back to undefined. */
export function searchEnum<const T extends string>(values: readonly T[]) {
  return z
    .enum(values as readonly [T, ...T[]])
    .optional()
    .catch(undefined);
}
