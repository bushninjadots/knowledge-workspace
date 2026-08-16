const configuredSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/+$/, "");

let warnedMissingSiteUrl = false;

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
