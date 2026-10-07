import { useMemo, type CSSProperties } from "react";
import { useTheme as useAppTheme } from "@/lib/theme";
import { BANNER_ACCENT, rgbToHex, siteAccentVars } from "@/lib/site-appearance";

/**
 * Site appearance → Accent → "From your banner", resolved. <html> can't know
 * the banner, so the app shells apply this on their root instead: the same
 * accent family a picked colour sets, built from the banner's main colour.
 * Empty for any other accent choice, or until the banner colour is known
 * (the theme's own accent shows meanwhile).
 */
export function useSiteAccentStyle(bannerColor: string | null | undefined): CSSProperties {
  const { siteAppearance } = useAppTheme();
  const followsBanner = siteAppearance.accent === BANNER_ACCENT;
  return useMemo(
    () => (followsBanner ? (siteAccentVars(rgbToHex(bannerColor) ?? "") as CSSProperties) : {}),
    [followsBanner, bannerColor],
  );
}
