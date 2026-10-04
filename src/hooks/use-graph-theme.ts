import { useEffect, useState } from "react";

/**
 * Phase 8 of the Tethyr Graph spec — full theme integration.
 *
 * The graph does NOT have its own theme system. It reads the same CSS custom
 * properties the Studio config already emits on the page container
 * (--content-density-gap, --studio-radius, --user-accent-*) and derives
 * graph-specific rendering parameters from them, so changing Tethyr's
 * appearance changes the graph instantly (spec §49).
 *
 * Density (spec §17) controls how many connected nodes are visible, how much
 * metadata each shows, and the spacing between them — not just a scale factor.
 * Structure (spec §15) controls node geometry via --studio-radius.
 * Accent (spec §18) is already wired through --user-accent-* tokens.
 */

export type GraphDensity = "compact" | "comfortable" | "spacious";

export interface GraphThemeConfig {
  /** The resolved density from --content-density-gap. */
  density: GraphDensity;
  /** How many connected nodes to show in a compact summary. */
  nodeLimit: number;
  /** Whether to show secondary metadata (descriptions, dates) on nodes. */
  showMetadata: boolean;
  /** Whether to show relationship counts in the summary header. */
  showRelationshipCounts: boolean;
  /** CSS gap value for use in inline styles. */
  gap: string;
  /** CSS border-radius value for node chips, from --studio-radius. */
  nodeRadius: string;
}

const DENSITY_NODE_LIMIT: Record<GraphDensity, number> = {
  compact: 16,
  comfortable: 12,
  spacious: 8,
};

function densityFromGap(gap: string): GraphDensity {
  const px = parseFloat(gap);
  if (Number.isNaN(px)) return "comfortable";
  if (px <= 11) return "compact";
  if (px >= 17) return "spacious";
  return "comfortable";
}

const DEFAULT_CONFIG: GraphThemeConfig = {
  density: "comfortable",
  nodeLimit: 12,
  showMetadata: true,
  showRelationshipCounts: true,
  gap: "var(--content-density-gap, 1rem)",
  nodeRadius: "var(--studio-radius, var(--radius-md))",
};

/**
 * Read the graph-relevant theme values from the page's computed style.
 * Falls back to the Studio defaults when the variables are not set (e.g. on
 * pages without a Studio config, like the community feed).
 */
export function useGraphTheme(): GraphThemeConfig {
  const [config, setConfig] = useState<GraphThemeConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const el = document.documentElement;
    const read = () => {
      const styles = getComputedStyle(el);
      const gap = styles.getPropertyValue("--content-density-gap").trim();
      const studioRadius = styles.getPropertyValue("--studio-radius").trim();
      if (!gap && !studioRadius) return;

      const density = gap ? densityFromGap(gap) : "comfortable";
      setConfig({
        density,
        nodeLimit: DENSITY_NODE_LIMIT[density],
        showMetadata: density !== "spacious",
        showRelationshipCounts: density === "compact",
        gap: gap || DEFAULT_CONFIG.gap,
        nodeRadius: studioRadius || DEFAULT_CONFIG.nodeRadius,
      });
    };

    read();

    // Re-read when the theme preset changes (the ThemeProvider writes new
    // CSS vars to <html>). A MutationObserver on the style attribute catches
    // the studioConfigToStyle application without a separate event system.
    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);

  return config;
}
