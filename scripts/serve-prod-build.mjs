// Run the production build locally (dev tool, not shipped).
//
// Why this exists: the deployed artifact is a single-file fetch bundle
// (`LOVABLE_NITRO_PRESET=lovable-fetch-bundle`, built to dist/server/index.mjs
// — see the preset branch in @lovable.dev/vite-tanstack-config). Building with
// the *local* fallback presets instead (`cloudflare-module` under wrangler, or
// `node-server` under node) produces a chunk-split SSR bundle that dies at
// import time with `TypeError: __exportAll is not a function`: rolldown hoists
// that helper into one sibling chunk while a chunk that consumes it sits in a
// require cycle with it. The output is a bundler artifact, not an app bug —
// which is why `npm run build:prod` uses the same preset the hosted build does
// and this fills in the missing piece: something to serve it.
//
// Usage:
//   npm run build:prod
//   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... npm run serve:prod
//   node scripts/serve-prod-build.mjs --port 8790
//
// Document responses then carry the *enforced* nonce CSP, so this is how a
// change whose effect only exists in a production build (header mode,
// NODE_ENV branches) gets verified:
//   node scripts/qa-csp.mjs --base http://127.0.0.1:8790 --require-enforced
//   node scripts/qa-audit.mjs --base http://127.0.0.1:8790
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : def;
};

const PORT = Number(arg("port", "8790"));
const HOST = arg("host", "127.0.0.1");
const BUNDLE = path.resolve(arg("bundle", "dist/server/index.mjs"));
const CLIENT = path.resolve(arg("client", "dist/client"));

if (!fs.existsSync(BUNDLE)) {
  console.error(`No production bundle at ${BUNDLE}.\n` + `Build it first: npm run build:prod`);
  process.exit(1);
}

const { default: entry } = await import(pathToFileURL(BUNDLE).href);
const handler = entry?.fetch ? entry : { fetch: entry };

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

/**
 * A single-file fetch bundle ships no static handling (`serveStatic: false`),
 * so the client assets next to it are served here. Only exact file paths are
 * matched — everything else falls through to SSR, including 404s.
 */
function serveStatic(pathname) {
  if (!fs.existsSync(CLIENT)) return undefined;
  const file = path.join(
    CLIENT,
    path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, ""),
  );
  if (!file.startsWith(CLIENT) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return undefined;
  return new Response(fs.createReadStream(file), {
    headers: {
      "content-type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
      // Hashed assets are immutable; public/ files are not.
      "cache-control": pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=0, must-revalidate",
    },
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers))
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);

    const url = `http://${req.headers.host ?? `${HOST}:${PORT}`}${req.url}`;
    const bodyless = req.method === "GET" || req.method === "HEAD";
    const staticResponse = bodyless ? serveStatic(new URL(url).pathname) : undefined;
    const response =
      staticResponse ??
      (await handler.fetch(
        new Request(url, {
          method: req.method,
          headers,
          body: bodyless ? undefined : Readable.toWeb(req),
          duplex: bodyless ? undefined : "half",
        }),
      ));

    res.statusCode = response.status;
    if (response.statusText) res.statusMessage = response.statusText;
    for (const [name, value] of response.headers) {
      if (name === "set-cookie") continue;
      res.setHeader(name, value);
    }
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length) res.setHeader("set-cookie", cookies);

    if (!response.body || req.method === "HEAD") return res.end();
    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${path.relative(process.cwd(), BUNDLE)} on http://${HOST}:${PORT}`);
});
