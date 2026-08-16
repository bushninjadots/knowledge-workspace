const configuredSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/+$/, "");

let warnedMissingSiteUrl = false;

export function canonicalLinks(path: string) {
  if (!configuredSiteUrl) {
    if (import.meta.env.DEV && !warnedMissingSiteUrl) {
      warnedMissingSiteUrl = true;
      console.warn(
        "[seo] VITE_PUBLIC_SITE_URL is not set, so canonical links are omitted. Set it to the public origin in production.",
      );
    }
    return [];
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return [{ rel: "canonical", href: `${configuredSiteUrl}${normalizedPath}` }];
}

export function robotsMeta(content = "noindex, nofollow, noarchive") {
  return [{ name: "robots", content }];
}

export function getConfiguredSiteUrl() {
  return configuredSiteUrl;
}
