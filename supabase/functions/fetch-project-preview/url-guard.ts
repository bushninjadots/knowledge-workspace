/**
 * Pure URL-safety gate for fetch-project-preview.
 *
 * Deliberately dependency-free and free of Deno-specific imports so the same
 * file runs under Deno (edge runtime) and Node (vitest). Network effects are
 * injected via the `Resolver` argument so tests never touch real DNS.
 *
 * Threat model addressed:
 * - direct private/loopback/link-local/metadata IP targets (IPv4 + IPv6)
 * - non-integer / decimal / hex / octal IPv4 encodings
 * - IPv4-mapped, NAT64, 6to4 and legacy-compatible IPv6 tunnels to v4 ranges
 * - credential-bearing URLs (`user:pass@host`) and URL-zone IDs (`%25eth0`)
 * - unusual ports beyond normal web traffic
 * - hostname-based SSRF (localhost, *.local, *.internal, *.home.arpa)
 * - DNS rebinding, where a resolver is available (fail-closed)
 */

export interface Resolver {
  /** Return every A/AAAA address for `hostname`, or throw when unresolvable. */
  (hostname: string): Promise<string[]>;
}

export type GuardedUrl = { ok: true; url: URL } | { ok: false; reason: string };

/** Ports that plausibly serve public web content. */
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

// ---------------------------------------------------------------------------
// IPv4
// ---------------------------------------------------------------------------

/**
 * Parse an IPv4 address in any WHATWG-accepted encoding: dotted decimal,
 * hex (`0x7f000001`), octal (`0177.0.0.1`), bare integers
 * (`2130706433`), mixtures thereof, optional trailing dot.
 * Returns the address as an unsigned 32-bit number, or null.
 */
export function parseIpv4(input: string): number | null {
  const host = input.toLowerCase();
  if (host === "" || !/^[0-9a-fx.]+$/.test(host)) return null;

  let parts = host.split(".");
  // WHATWG ignores a single trailing dot ("127.0.0.1.").
  if (parts.length > 1 && parts[parts.length - 1] === "") parts = parts.slice(0, -1);
  if (parts.length > 4 || parts.some((p) => p === "")) return null;

  let value = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    let radix = 10;
    let digits = part;
    if (/^0x[0-9a-f]+$/.test(part)) {
      radix = 16;
      digits = part.slice(2);
    } else if (part.length > 1 && /^0[0-7]*$/.test(part)) {
      radix = 8;
      digits = part.slice(1);
    } else if (!/^\d+$/.test(part)) {
      return null;
    }
    const parsed = Number.parseInt(digits === "" ? "0" : digits, radix);
    if (Number.isNaN(parsed)) return null;
    const isLast = i === parts.length - 1;
    // All but the last part must fit one byte; the last may span the rest
    // ("127.1" == 127.0.0.1, "2130706433" alone == 127.0.0.1).
    const max = isLast ? Math.pow(256, 5 - parts.length) - 1 : 255;
    if (parsed > max) return null;
    value += isLast ? parsed : parsed * Math.pow(256, 3 - i);
  }
  return value >>> 0;
}

/** True when the address is not global unicast (loopback, private, reserved…). */
export function isPrivateIpv4(v: number): boolean {
  const a = v >>> 24;
  const b = (v >>> 16) & 0xff;
  const c = (v >>> 8) & 0xff;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (+ metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast 224/4, reserved 240/4, broadcast
  return false;
}

// ---------------------------------------------------------------------------
// IPv6
// ---------------------------------------------------------------------------

function hexGroup(n: number): string {
  return n.toString(16).padStart(4, "0");
}

/** Parse an IPv6 literal (brackets optional) into eight 16-bit groups. */
export function parseIpv6(input: string): number[] | null {
  let s = input.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");

  // Rewrite an embedded IPv4 tail (::ffff:1.2.3.4) as two hex groups.
  const tailStart = s.lastIndexOf(":");
  if (tailStart !== -1 && s.slice(tailStart + 1).includes(".")) {
    const num = parseIpv4(s.slice(tailStart + 1));
    if (num === null) return null;
    s = `${s.slice(0, tailStart + 1)}${hexGroup(num >>> 16)}:${hexGroup(num & 0xffff)}`;
  }

  let headPart = "";
  let tailPart = "";
  if (s.includes("::")) {
    const halves = s.split("::");
    if (halves.length > 2) return null; // at most one "::"
    headPart = halves[0];
    tailPart = halves[1];
  } else {
    headPart = s;
  }

  const parseGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const groups = part.split(":");
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      out.push(Number.parseInt(g, 16));
    }
    return out;
  };

  const head = parseGroups(headPart);
  const tail = parseGroups(tailPart);
  if (head === null || tail === null) return null;
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  return [...head, ...new Array(fill).fill(0), ...tail];
}

/** True when the address must not be treated as public internet. */
export function isPrivateIpv6(g: number[]): boolean {
  const zero = (...idx: number[]) => idx.every((i) => g[i] === 0);
  if (g.every((x) => x === 0)) return true; // :: unspecified
  if (zero(0, 1, 2, 3, 4, 5, 6) && g[7] === 1) return true; // ::1 loopback

  // Tunnels that embed an IPv4 address — validate the embedded address.
  const low32 = ((g[6] << 16) | g[7]) >>> 0;
  if (zero(0, 1, 2, 3, 4) && g[5] === 0xffff) return isPrivateIpv4(low32); // mapped
  if (zero(0, 1, 2, 3, 4) && g[5] === 0 && low32 !== 0) return true; // ::/96 compat
  if (g[0] === 0x64 && g[1] === 0xff9b && zero(2, 3, 4, 5)) return isPrivateIpv4(low32); // NAT64
  if (g[0] === 0x2002) return isPrivateIpv4(((g[1] << 16) | g[2]) >>> 0); // 6to4
  if (g[0] === 0x2001 && g[1] === 0x0000) return true; // Teredo (obfuscated v4)

  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x0100 && zero(1, 2, 3)) return true; // 100::/64 discard-only
  return false;
}

// ---------------------------------------------------------------------------
// URL classification
// ---------------------------------------------------------------------------

function hostnameIsLiteralIp(hostname: string): boolean {
  if (hostname.includes(":")) return true; // IPv6 (URL.hostname keeps brackets)
  return parseIpv4(hostname) !== null;
}

/**
 * Static checks only (no DNS). Returns the parsed URL when it may proceed to
 * resolution/fetching, or the reason it was rejected.
 */
export function classifyUrl(raw: string): GuardedUrl {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "unparseable-url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "scheme-not-http(s)" };
  }
  if (url.username || url.password) return { ok: false, reason: "embedded-credentials" };
  if (!ALLOWED_PORTS.has(url.port)) return { ok: false, reason: "port-not-allowed" };

  const hostname = url.hostname.toLowerCase();
  if (hostname.includes("%")) return { ok: false, reason: "zone-id-in-hostname" };
  if (BLOCKED_HOSTNAMES.has(hostname)) return { ok: false, reason: "blocked-hostname" };
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { ok: false, reason: "blocked-hostname" };
  }

  const looksLikeLiteral = hostname.startsWith("[") || /^[0-9a-fx.:]+$/.test(hostname);
  if (looksLikeLiteral) {
    if (!hostnameIsLiteralIp(hostname)) return { ok: false, reason: "ip-shaped-hostname-invalid" };
    if (hostname.includes(":")) {
      const groups = parseIpv6(hostname);
      if (!groups) return { ok: false, reason: "invalid-ipv6-literal" };
      if (isPrivateIpv6(groups)) return { ok: false, reason: "private-ipv6-target" };
      return { ok: true, url };
    }
    const v4 = parseIpv4(hostname);
    if (v4 === null) return { ok: false, reason: "invalid-ipv4-literal" };
    if (isPrivateIpv4(v4)) return { ok: false, reason: "private-ipv4-target" };
    return { ok: true, url };
  }

  // Regular DNS name — safe statically, still subject to assertPublicHost.
  return { ok: true, url };
}

/**
 * Full pre-fetch gate: static classification plus, for DNS names, resolution
 * through the injected resolver requiring EVERY resolved address to be
 * public (fail-closed on empty results or resolver errors).
 *
 * When `resolve` is null the DNS phase is skipped (resolver unavailable in
 * this runtime); static classification alone applies.
 */
export async function assertPublicHost(
  raw: string | URL,
  resolve: Resolver | null,
): Promise<GuardedUrl> {
  const cls = classifyUrl(typeof raw === "string" ? raw : raw.toString());
  if (!cls.ok) return cls;
  const hostname = cls.url.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (resolve === null || hostnameIsLiteralIp(hostname)) return cls;

  let addresses: string[];
  try {
    addresses = await resolve(hostname);
  } catch {
    return { ok: false, reason: "dns-resolution-failed" };
  }
  if (!addresses || addresses.length === 0) return { ok: false, reason: "no-dns-addresses" };

  for (const addr of addresses) {
    if (addr.includes(":")) {
      const groups = parseIpv6(addr);
      if (!groups || isPrivateIpv6(groups))
        return { ok: false, reason: `private-resolution:${addr}` };
    } else {
      const v4 = parseIpv4(addr);
      if (v4 === null || isPrivateIpv4(v4))
        return { ok: false, reason: `private-resolution:${addr}` };
    }
  }
  return cls;
}

// ---------------------------------------------------------------------------
// Repository path sanitisation
// ---------------------------------------------------------------------------

/**
 * Validate a single owner/repo/group path segment from an untrusted URL.
 * Percent-decodes first (so `%2F` cannot smuggle a separator), then applies a
 * strict allowlist. Returns the segment with any `.git` suffix removed.
 */
export function sanitizeRepoSegment(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded === "." || decoded === "..") return null;
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(decoded)) return null;
  return decoded.replace(/\.git$/i, "");
}

// ---------------------------------------------------------------------------
// Platform routing
// ---------------------------------------------------------------------------

export interface RepoTarget {
  platform: "github" | "gitlab" | "codeberg";
  /** Fully-qualified API endpoint built from sanitised segments. */
  api: string;
}

const enc = encodeURIComponent;

const HOST_PATTERNS: Array<{
  pattern: RegExp;
  platform: RepoTarget["platform"];
  /** Receives sanitised segments; builds the forge API endpoint. */
  build: (segments: string[]) => string;
}> = [
  {
    pattern: /^(www\.)?github\.com$/,
    platform: "github",
    // GitHub's API takes owner/repo as separate path parts.
    build: ([owner, repo]) => `https://api.github.com/repos/${enc(owner)}/${enc(repo)}`,
  },
  {
    pattern: /^(www\.)?gitlab\.com$/,
    platform: "gitlab",
    // GitLab expects the full project path URL-encoded as one part.
    build: (segments) => `https://gitlab.com/api/v4/projects/${enc(segments.join("/"))}`,
  },
  {
    pattern: /^(www\.)?codeberg\.org$/,
    platform: "codeberg",
    build: ([owner, repo]) => `https://codeberg.org/api/v1/repos/${enc(owner)}/${enc(repo)}`,
  },
];

/**
 * Match the URL against supported code-forge hosts using EXACT hostname
 * equality (never substring matching, which URLs like
 * `https://evil.com/?x=github.com/a/b` would spoof) and rebuild the API
 * request from strictly sanitised path segments.
 */
export function extractRepoTarget(url: URL): RepoTarget | null {
  const entry = HOST_PATTERNS.find((e) => e.pattern.test(url.hostname));
  if (!entry) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const cleaned: string[] = [];
  const limit = entry.platform === "gitlab" ? segments.length : 2;
  for (let i = 0; i < limit; i++) {
    const seg = sanitizeRepoSegment(segments[i]);
    if (seg === null) return null;
    cleaned.push(seg);
  }
  return { platform: entry.platform, api: entry.build(cleaned) };
}
