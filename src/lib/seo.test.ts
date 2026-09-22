import { describe, it, expect } from "vitest";
import {
  absoluteUrl,
  canonicalLinks,
  getConfiguredSiteUrl,
  isNoIndexPath,
  jsonLd,
  NO_INDEX_PATHS,
  robotsMeta,
  seoMeta,
  SITE,
} from "@/lib/seo";

/**
 * These helpers are the only thing standing between a private route and a
 * search index, and they are shared by every public route's `head()` — but no
 * test imported them. The cases below are the ones that actually bite:
 * prefix matching that catches `/logins`, a missing canonical link, and a
 * `og:url` that disagrees with the canonical.
 */
const ORIGIN = getConfiguredSiteUrl() ?? window.location.origin;

describe("isNoIndexPath", () => {
  it("matches a private path and its descendants", () => {
    for (const path of ["/dashboard", "/dashboard/settings", "/community", "/spaces/design"]) {
      expect(isNoIndexPath(path), path).toBe(true);
    }
  });

  it("does not match a public path that merely starts with a private one", () => {
    // `/logins` and `/dashboardx` are not routes, but a `startsWith(private)`
    // check without a boundary would silently noindex real pages the moment a
    // name collides (e.g. a future `/session` vs `/sessions`).
    for (const path of ["/", "/skills", "/skills/typescript", "/projects/abc", "/u/maya"]) {
      expect(isNoIndexPath(path), path).toBe(false);
    }
    expect(isNoIndexPath("/dashboard-ish")).toBe(false);
  });
});

describe("NO_INDEX_PATHS", () => {
  it("is a clean list of absolute, slash-free, unique paths", () => {
    for (const path of NO_INDEX_PATHS) {
      expect(path.startsWith("/"), path).toBe(true);
      expect(path.endsWith("/"), path).toBe(false);
    }
    expect(new Set(NO_INDEX_PATHS).size).toBe(NO_INDEX_PATHS.length);
  });

  it("never contains a public surface", () => {
    // The same constant drives the robots.txt disallow rules, the X-Robots-Tag
    // header, and route-level noindex meta, so a mistake here de-indexes a
    // public page three ways at once.
    for (const path of ["/", "/skills", "/projects", "/u", "/terms", "/privacy"]) {
      expect(NO_INDEX_PATHS as readonly string[]).not.toContain(path);
    }
  });
});

describe("canonicalLinks / absoluteUrl", () => {
  it("builds an absolute canonical against the serving origin", () => {
    expect(canonicalLinks("/skills")).toEqual([{ rel: "canonical", href: `${ORIGIN}/skills` }]);
    expect(absoluteUrl("/skills")).toBe(`${ORIGIN}/skills`);
  });

  it("normalizes a path without a leading slash", () => {
    expect(canonicalLinks("skills")[0]?.href).toBe(`${ORIGIN}/skills`);
    expect(absoluteUrl("skills")).toBe(`${ORIGIN}/skills`);
  });

  it("keeps the root path a single slash", () => {
    expect(canonicalLinks("/")[0]?.href).toBe(`${ORIGIN}/`);
  });
});

describe("seoMeta", () => {
  const base = { path: "/skills", title: "Skills directory", description: "Browse skills" };

  type Meta = ReturnType<typeof seoMeta>["meta"];
  // The router's `head()` meta type models `{ title }` separately from
  // `{ name, content }`, and seoMeta emits the former. Narrowing by hand keeps
  // the assertions type-safe instead of casting the whole array.
  const titleOf = (meta: Meta) => {
    for (const tag of meta) if ("title" in tag) return tag.title;
    return undefined;
  };
  const metaContent = (meta: Meta, key: "name" | "property", value: string) => {
    for (const tag of meta) {
      if ("title" in tag || !("content" in tag)) continue;
      const attribute = "name" in tag && key === "name" ? tag.name : undefined;
      const property = "property" in tag && key === "property" ? tag.property : undefined;
      if ((attribute ?? property) === value) return tag.content;
    }
    return undefined;
  };

  it("suffixes the site name once and mirrors the title into the social tags", () => {
    const { meta } = seoMeta(base);
    expect(titleOf(meta)).toBe(`Skills directory — ${SITE.name}`);
    expect(metaContent(meta, "property", "og:title")).toBe(`Skills directory — ${SITE.name}`);
    expect(metaContent(meta, "name", "twitter:title")).toBe(`Skills directory — ${SITE.name}`);
    expect(metaContent(meta, "name", "description")).toBe("Browse skills");
    expect(metaContent(meta, "property", "og:type")).toBe("website");
  });

  it("does not double the suffix on the tagline itself", () => {
    const { meta } = seoMeta({ ...base, title: SITE.tagline });
    expect(titleOf(meta)).toBe(SITE.tagline);
  });

  it("agrees with the canonical link on the page URL", () => {
    const { meta, links } = seoMeta(base);
    expect(links).toEqual(canonicalLinks(base.path));
    expect(metaContent(meta, "property", "og:url")).toBe(absoluteUrl(base.path));
  });

  it("adds robots noindex only when asked", () => {
    expect(metaContent(seoMeta(base).meta, "name", "robots")).toBeUndefined();
    expect(metaContent(seoMeta({ ...base, noindex: true }).meta, "name", "robots")).toContain(
      "noindex",
    );
  });

  it("uses the shared social image unless one is given", () => {
    expect(metaContent(seoMeta(base).meta, "property", "og:image")).toBe(
      `${getConfiguredSiteUrl() ?? ""}/og-image.png`,
    );
    expect(
      metaContent(
        seoMeta({ ...base, image: "https://cdn.test/a.png" }).meta,
        "property",
        "og:image",
      ),
    ).toBe("https://cdn.test/a.png");
  });
});

describe("jsonLd / robotsMeta", () => {
  it("wraps each schema for the router's ld+json serializer", () => {
    const schemas = [{ "@type": "Person" }, { "@type": "WebSite" }];
    expect(jsonLd(...schemas)).toEqual([
      { "script:ld+json": schemas[0] },
      { "script:ld+json": schemas[1] },
    ]);
  });

  it("defaults robots to a full noindex set", () => {
    expect(robotsMeta()).toEqual([{ name: "robots", content: "noindex, nofollow, noarchive" }]);
  });
});
