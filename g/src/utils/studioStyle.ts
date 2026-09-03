import type { CSSProperties } from 'react';
import type { BackgroundId, DensityId, StudioConfig } from '../types/studio';

/** Density → canvas gap + block padding, matching --content-density-* in Tethyr. */
const DENSITY: Record<DensityId, {gap: number;pad: number;rowHeight: number;}> = {
  compact: { gap: 10, pad: 12, rowHeight: 20 },
  comfortable: { gap: 14, pad: 16, rowHeight: 24 },
  spacious: { gap: 20, pad: 22, rowHeight: 28 }
};

export function densityMetrics(density: DensityId) {
  return DENSITY[density];
}

/** Banner-derived accent (the dominant-colour pass in the real app). */
export const BANNER_ACCENT = 'oklch(0.68 0.09 191)';

export function resolveAccent(config: StudioConfig): string | null {
  if (config.accentMode === 'none') return null;
  if (config.accentMode === 'auto') return BANNER_ACCENT;
  return config.accentColor;
}

const BACKGROUND_VAR: Record<BackgroundId, string> = {
  default: 'var(--background)',
  surface: 'var(--surface)',
  sunken: 'var(--surface-sunken)'
};

export function backgroundFor(id: BackgroundId): string {
  return BACKGROUND_VAR[id];
}

/**
 * The single style bridge: config → CSS custom properties. Everything
 * downstream reads tokens, so no component needs to know about the config.
 */
export function studioStyle(config: StudioConfig, surface: 'app' | 'public'): CSSProperties {
  const { gap, pad } = DENSITY[config.density];
  const accent = resolveAccent(config);
  const style: Record<string, string> = {
    '--studio-radius': config.radius === 'sharp' ? '2px' : '5px',
    '--studio-gap': `${gap}px`,
    '--studio-pad': `${pad}px`,
    '--content-density-gap': `${gap}px`,
    '--content-density-padding': `${pad}px`
  };
  if (accent) {
    style['--user-accent'] = accent;
    style['--user-accent-subtle'] = `color-mix(in oklab, ${accent} 12%, transparent)`;
    style['--user-accent-border'] = `color-mix(in oklab, ${accent} 34%, transparent)`;
  } else {
    style['--user-accent'] = 'var(--foreground)';
    style['--user-accent-subtle'] = 'var(--muted)';
    style['--user-accent-border'] = 'var(--border-strong)';
  }
  style.backgroundColor = backgroundFor(surface === 'app' ? config.appBackground : config.publicBackground);
  return style as CSSProperties;
}

/** Structure → canvas measure. */
export function structureMaxWidth(config: StudioConfig): number {
  if (config.structure === 'single') return 880;
  if (config.structure === 'sidebar') return 1120;
  return 1360;
}