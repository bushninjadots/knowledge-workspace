import type { DetailedHTMLProps, MetaHTMLAttributes } from "react";

type MetaTag = DetailedHTMLProps<MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement>;

const configuredSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/+$/, "");

let warnedMissingSiteUrl = false;

export const SITE = {
  name: "Tethyr",
  tagline: "Build together, get known for what you make",
  description:
    "Tethyr is the collaboration network where builders create projects together, grow through real contributions, and become known for what they make — not what they claim.",
};

export function canonicalLinks(path: string) {
  // Fall back to the serving origin when the public site URL isn't configured,
  // so canonical links are never silently dropped in dev/staging. Production
  // still relies on VITE_PUBLIC_SITE_URL (documented as required).
  const origin =
    configuredSiteUrl ?? (typeof window !== "undefined" ? window.location.origin : undefined);

  if (!origin) {
    if (import.meta.env.DEV && !warnedMissingSiteUrl) {
      warnedMissingSiteUrl = true;
      console.warn(
        "[seo] VITE_PUBLIC_SITE_URL is not set, so canonical links are omitted. Set it to the public origin in production.",
      );
    }
    return [];
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return [{ rel: "canonical", href: `${origin}${normalizedPath}` }];
}

export function robotsMeta(content = "noindex, nofollow, noarchive") {
  return [{ name: "robots", content }];
}

export function getConfiguredSiteUrl() {
  return configuredSiteUrl;
}

/** Absolute URL for a path, or undefined when no origin is available (dev). */
export function absoluteUrl(path: string) {
  const origin =
    configuredSiteUrl ?? (typeof window !== "undefined" ? window.location.origin : undefined);
  if (!origin) return undefined;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}

/** Shared social-preview image. Resolves against the public origin in prod. */
function ogImageUrl() {
  return `${getConfiguredSiteUrl() ?? ""}/og-image.png`;
}

export type SeoOptions = {
  /** Route path for the canonical + og:url, e.g. "/community". */
  path: string;
  /** Page title. The "— Tethyr" suffix is applied automatically. */
  title: string;
  description: string;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
  image?: string;
};

/**
 * Standardized metadata template for routes. Produces title (with site-name
 * suffix), description, robots (when noindex), canonical link, and the full
 * OpenGraph + Twitter card set — so every route gets the same social surface
 * without repeating it. Child-route entries override the root defaults
 * (the router merges head meta child-first).
 */
export function seoMeta({
  path,
  title,
  description,
  type = "website",
  noindex = false,
  image,
}: SeoOptions) {
  const fullTitle = title === SITE.tagline ? title : `${title} — ${SITE.name}`;
  const img = image ?? ogImageUrl();
  const url = absoluteUrl(path);

  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      ...(noindex ? robotsMeta() : []),
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:type", content: type },
      ...(url ? [{ property: "og:url", content: url }] : []),
      { property: "og:image", content: img },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: img },
    ],
    links: canonicalLinks(path),
  };
}

/**
 * Structured-data entries for route head() meta. The router serializes each
 * object into a `<script type="application/ld+json">` tag.
 */
export function jsonLd(...schemas: Record<string, unknown>[]) {
  // The router's head meta type only models HTML meta attributes, but its
  // runtime (headContentUtils) also serializes `"script:ld+json"` entries into
  // <script type="application/ld+json"> tags — cast at the helper boundary.
  return schemas.map((schema) => ({
    "script:ld+json": schema,
  })) as unknown as MetaTag[];
}

/**
 * Private / post-auth paths that must never be indexed. Single source of truth
 * for the robots.txt disallow rules, the X-Robots-Tag header, and route-level
 * noindex meta.
 */
export const NO_INDEX_PATHS = [
  "/dashboard",
  "/explore",
  "/library",
  "/profile",
  "/messages",
  "/notifications",
  "/sessions",
  "/community",
  "/challenges",
  "/spaces",
  "/login",
  "/signup",
  "/reset-password",
] as const;

export function isNoIndexPath(pathname: string) {
  return NO_INDEX_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
