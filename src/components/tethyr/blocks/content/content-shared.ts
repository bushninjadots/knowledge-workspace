// Helpers shared by the free-form content blocks (quote, call to action,
// highlights, timeline, FAQ, featured link, services, callout). Their content
// lives in the block config, but some settings (alignment, tone) are never
// empty, so each block reports its own emptiness like the data blocks do.

import { useEffect } from "react";
import type { BlockConfig, BlockContext } from "@/lib/page-blocks";

/** A trimmed string config value ("" when absent). */
export function str(config: BlockConfig, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

/** A list config value, keeping only items with at least one filled field. */
export function listItems(config: BlockConfig, key: string): Array<Record<string, string>> {
  const value = config[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) =>
      Object.fromEntries(
        Object.entries(item).map(([k, v]) => [k, typeof v === "string" ? v.trim() : ""]),
      ),
    )
    .filter((item) => Object.values(item).some(Boolean));
}

/** An href that is safe to render: http(s) or mailto, else null. */
export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(value)) return value;
  if (/^[^\s@:/]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Tell the page renderer whether this block has anything to show. */
export function useReportEmpty(context: BlockContext, isEmpty: boolean) {
  const { blockId, onBlockEmptyChange } = context;
  useEffect(() => {
    if (blockId) onBlockEmptyChange?.(blockId, isEmpty);
  }, [blockId, isEmpty, onBlockEmptyChange]);
}
