/**
 * Extract the token from an `Authorization: Bearer <token>` header value.
 *
 * Returns the raw token (no leading/trailing whitespace), or null when the
 * header isn't a well-formed Bearer token. Kept pure so the auth middleware
 * logic is unit-testable — a naive `replace("Bearer", "")` previously left a
 * leading space that failed base64url JWT decoding downstream.
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
  return match ? match[1] : null;
}
