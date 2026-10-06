// The Studio canvas's visual-language hooks, shared by the editor canvas, the
// owner's Studio view and the public page: the data-vl-* attributes the CSS in
// styles.css reads, and the SVG filters the Duotone and Grain image
// treatments use. One helper, so the three surfaces render one look.

import { lookAttributes, resolveLook } from "@/lib/visual-language";
import type { StudioConfig } from "@/lib/studio-config";

/** Attributes for the element that wraps a Studio's areas. */
export function lookCanvasAttributes(config: StudioConfig): Record<string, string> {
  return lookAttributes(resolveLook(config));
}

/**
 * Filters for image treatments. Rendered inside the canvas so the flood
 * colour picks up the Studio's accent (and an area's own accent does not
 * leak in: filters resolve against this element).
 */
export function LookFilters() {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      className="pointer-events-none absolute"
      focusable="false"
    >
      <defs>
        <filter id="vl-duotone" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" result="grey" />
          <feFlood style={{ floodColor: "var(--user-accent, var(--primary))" }} result="ink" />
          <feComposite in="ink" in2="SourceGraphic" operator="in" result="tint" />
          <feBlend in="grey" in2="tint" mode="multiply" result="duo" />
          <feComponentTransfer in="duo">
            <feFuncR type="linear" slope="0.88" intercept="0.1" />
            <feFuncG type="linear" slope="0.88" intercept="0.1" />
            <feFuncB type="linear" slope="0.88" intercept="0.1" />
          </feComponentTransfer>
        </filter>
        <filter id="vl-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.16 0"
            result="speckle"
          />
          <feComposite in="speckle" in2="SourceGraphic" operator="in" result="grain" />
          <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
        </filter>
      </defs>
    </svg>
  );
}
