// Applies cardInk() to a Studio surface: measures the backdrop the cards
// actually sit on (theme, light/dark mode, and Studio background all affect
// it), then exposes the ink as custom properties. `.studio-block` swaps its
// --foreground / --muted-foreground to them when `data-card-ink` is present.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cardInk, type Rgb } from "@/lib/card-ink";
import type { StudioConfig } from "@/lib/studio-config";

/** Resolve any CSS colour to RGBA by painting it on a 1×1 canvas. */
function parseColor(context: CanvasRenderingContext2D, color: string): [...Rgb, number] {
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = "#000";
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/** The first opaque background at or above `element`, defaulting to white. */
function paintedBackdrop(element: HTMLElement): Rgb {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [255, 255, 255];
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const [r, g, b, a] = parseColor(context, getComputedStyle(node).backgroundColor);
    if (a >= 0.99) return [r, g, b];
  }
  return [255, 255, 255];
}

export function useCardInk(config: Pick<StudioConfig, "cardColor" | "cardOpacity"> | null) {
  const ref = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState<ReturnType<typeof cardInk>>(null);
  const cardColor = config?.cardColor;
  const cardOpacity = config?.cardOpacity ?? 100;

  useEffect(() => {
    const element = ref.current;
    if (!element || !cardColor) {
      setInk(null);
      return;
    }
    // Cards sit on whatever their parent paints, which can differ from the
    // root (the editor canvas, a preview frame), so measure from there.
    const measure = () => {
      const block = element.querySelector<HTMLElement>(".studio-block");
      const from = block?.parentElement ?? element;
      setInk(cardInk(cardColor, cardOpacity, paintedBackdrop(from)));
    };
    measure();
    // Blocks mount after the page data loads; measure again once they exist.
    const blocks = new MutationObserver(() => {
      if (!element.querySelector(".studio-block")) return;
      blocks.disconnect();
      measure();
    });
    if (!element.querySelector(".studio-block")) {
      blocks.observe(element, { childList: true, subtree: true });
    }
    // Light/dark mode and theme switches repaint the backdrop.
    const theme = new MutationObserver(measure);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", measure);
    return () => {
      blocks.disconnect();
      theme.disconnect();
      media.removeEventListener("change", measure);
    };
  }, [cardColor, cardOpacity]);

  const style = ink
    ? ({
        "--studio-card-ink": ink.ink,
        "--studio-card-ink-muted": ink.muted,
        "--studio-card-surface": ink.surface,
        "--studio-card-border": ink.border,
      } as CSSProperties)
    : undefined;
  return { ref, style, active: ink !== null };
}
