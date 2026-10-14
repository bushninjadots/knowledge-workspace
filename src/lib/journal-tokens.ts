// Personal access tokens for the journal API and MCP server. A token is
// "tth_" + 43 url-safe characters (32 random bytes); only its SHA-256 hash is
// stored (journal_tokens.token_hash), so a database leak doesn't leak tokens.
// Web Crypto only — runs the same in Node, Workers and the browser.

const TOKEN_PREFIX = "tth_";
export const MAX_ACTIVE_TOKENS = 10;

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${TOKEN_PREFIX}${base64url(bytes)}`;
}

export function looksLikeToken(value: string): boolean {
  return /^tth_[A-Za-z0-9_-]{43}$/.test(value);
}

/** What the member sees to tell tokens apart ("tth_Ab12…"). */
export function tokenPrefix(token: string): string {
  return `${token.slice(0, 8)}…`;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
