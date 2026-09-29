// Prod-fetch-bundle smoke probe (dev tool, not shipped).
//
// The deployed artifact is the single-file fetch bundle from
// `LOVABLE_NITRO_PRESET=lovable-fetch-bundle` (see scripts/serve-prod-build.mjs
// for why the fallback presets produce a bundle that dies on import). The
// bundle is init-order sensitive: an unrelated content change can merge eager
// createServerFn() call sites into an early router chunk that initializes
// before tanstack-start's core region defines createServerFn — every SSR page
// then 500s with "createServerFn is not a function" while dev, typecheck, and
// unit tests all stay green. This probe is the check that catches that class:
// it imports the built bundle and requests every public route over fetch.
//
// Usage (after `npm run build:prod` with Supabase env vars set):
//   node scripts/prod-bundle-probe.mjs [--bundle dist/server/index.mjs] [--base http://127.0.0.1:8790]
//
// Exit 0 when every route answers with its expected status; exit 1 otherwise
// (a 500 here is the init-order failure signature).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : def;
};

const BUNDLE = path.resolve(arg("bundle", "dist/server/index.mjs"));

if (!fs.existsSync(BUNDLE)) {
  console.error(`No production bundle at ${BUNDLE}.\nBuild it first: npm run build:prod`);
  process.exit(1);
}

console.log(`Importing ${path.relative(process.cwd(), BUNDLE)} …`);
let handler;
try {
  const mod = await import(pathToFileURL(BUNDLE).href);
  handler = mod.default?.fetch ? mod.default : { fetch: mod.default ?? mod };
} catch (error) {
  // The init-order failure surfaces exactly here: the bundle dies on import.
  console.error("Bundle failed to import — this is the init-order failure signature:");
  console.error(error?.stack || error);
  process.exit(1);
}
if (typeof handler.fetch !== "function") {
  console.error("Bundle imported but exposes no fetch handler.");
  process.exit(1);
}

// Routes verified against the seeded database. The title snippets assert real
// SSR content (not just a 200 shell) where the route renders server-side data.
const ROUTES = [
  { path: "/", status: 200, contains: "Tethyr" },
  { path: "/login", status: 200, contains: "Log in" },
  { path: "/signup", status: 200, contains: "Sign up" },
  { path: "/skills", status: 200, contains: "Tethyr" },
  { path: "/explore", status: 200, contains: "Tethyr" },
  { path: "/community", status: 200, contains: "Tethyr" },
  { path: "/this-route-does-not-exist", status: 404, contains: null },
];

let failures = 0;
for (const route of ROUTES) {
  try {
    const res = await handler.fetch(new Request(`http://127.0.0.1:8790${route.path}`), {
      get(e2) {
        return undefined;
      },
    });
    const body = route.contains ? await res.text() : "";
    const ok = res.status === route.status && (!route.contains || body.includes(route.contains));
    if (ok) {
      console.log(`ok ${route.path} (${res.status})`);
    } else {
      failures++;
      console.error(
        `FAIL ${route.path}: expected ${route.status}${route.contains ? ` with ${JSON.stringify(route.contains)}` : ""}, got ${res.status}`,
      );
    }
  } catch (error) {
    failures++;
    console.error(`FAIL ${route.path}: ${error?.stack || error}`);
  }
}

console.log(
  failures === 0 ? `\nAll ${ROUTES.length} routes OK.` : `\n${failures} route(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
