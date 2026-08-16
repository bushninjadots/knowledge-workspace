const configuredSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/+$/, "");

export function canonicalLinks(path: string) {
  if (!configuredSiteUrl) return [];

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return [{ rel: "canonical", href: `${configuredSiteUrl}${normalizedPath}` }];
}

export function robotsMeta(content = "noindex, nofollow, noarchive") {
  return [{ name: "robots", content }];
}

export function getConfiguredSiteUrl() {
  return configuredSiteUrl;
}
