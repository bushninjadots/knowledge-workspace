import type { LayoutSection, PageLayout } from "@/lib/page-blocks";

/** Optional page-level composition metadata. Older layouts omit this field. */
export type PageComposition = {
  columns?: number;
  gap?: string;
};

export type ComposedPageLayout = PageLayout & {
  composition?: PageComposition;
};

/** Return the layout's top-level section groups, preserving old sequential layouts. */
export function groupSections(layout: ComposedPageLayout): LayoutSection[][] {
  const columns = Math.max(1, Math.min(3, layout.composition?.columns ?? 1));
  if (columns === 1) return layout.sections.map((section) => [section]);

  const groups: LayoutSection[][] = [];
  for (let index = 0; index < layout.sections.length; index += columns) {
    groups.push(layout.sections.slice(index, index + columns));
  }
  return groups;
}

export function normalizeComposition(layout: PageLayout, columns: number): ComposedPageLayout {
  const safeColumns = Math.max(1, Math.min(3, Math.round(columns)));
  return {
    ...layout,
    composition: safeColumns === 1 ? undefined : { columns: safeColumns, gap: "1.5rem" },
  };
}
