import type { LayoutSection, PageLayout } from "@/lib/page-blocks";

/** Optional page-level composition metadata. Older layouts omit this field. */
type PageComposition = {
  columns?: number;
  gap?: string;
};

type ComposedPageLayout = PageLayout & {
  composition?: PageComposition;
};

function safeColumnCount(columns: number | undefined): number {
  return Math.max(1, Math.min(3, Math.round(columns ?? 1)));
}

function sectionCoordinates(section: LayoutSection, index: number, columns: number) {
  return {
    row: section.gridRow ?? Math.floor(index / columns),
    column: section.gridColumn ?? index % columns,
  };
}

/** Return the layout's top-level section groups, preserving old sequential layouts. */
export function groupSections(layout: ComposedPageLayout): LayoutSection[][] {
  const columns = safeColumnCount(layout.composition?.columns);
  if (columns === 1) return layout.sections.map((section) => [section]);

  const rows = new Map<number, LayoutSection[]>();
  layout.sections.forEach((section, index) => {
    const { row, column } = sectionCoordinates(section, index, columns);
    const rowSections = rows.get(row) ?? [];
    rowSections.push({ ...section, gridColumn: column, gridRow: row });
    rows.set(row, rowSections);
  });

  return [...rows.entries()]
    .sort(([first], [second]) => first - second)
    .map(([, sections]) =>
      sections.sort((first, second) => first.gridColumn! - second.gridColumn!),
    );
}

export function normalizeComposition(layout: PageLayout, columns: number): ComposedPageLayout {
  const safeColumns = safeColumnCount(columns);
  return {
    ...layout,
    sections: layout.sections.map((section, index) =>
      safeColumns === 1
        ? (() => {
            const { gridRow: _row, gridColumn: _column, ...withoutPlacement } = section;
            return withoutPlacement;
          })()
        : {
            ...section,
            gridRow: Math.floor(index / safeColumns),
            gridColumn: index % safeColumns,
          },
    ),
    composition: safeColumns === 1 ? undefined : { columns: safeColumns, gap: "1.5rem" },
  };
}

/** Move one section to a specific row/column, swapping an occupied slot. */
export function placeSection(
  layout: ComposedPageLayout,
  sectionId: string,
  row: number,
  column: number,
): ComposedPageLayout {
  const columns = safeColumnCount(layout.composition?.columns);
  const targetRow = Math.max(0, Math.round(row));
  const targetColumn = Math.max(0, Math.min(columns - 1, Math.round(column)));
  const sourceIndex = layout.sections.findIndex((section) => section.id === sectionId);
  if (sourceIndex === -1 || columns === 1) return layout;

  const coordinates = layout.sections.map((section, index) =>
    sectionCoordinates(section, index, columns),
  );
  const source = coordinates[sourceIndex];
  const targetIndex = coordinates.findIndex(
    (coords, index) =>
      index !== sourceIndex && coords.row === targetRow && coords.column === targetColumn,
  );
  const sections = layout.sections.map((section, index) => {
    const coords = coordinates[index];
    if (index === sourceIndex) {
      return { ...section, gridRow: targetRow, gridColumn: targetColumn };
    }
    if (index === targetIndex) {
      return { ...section, gridRow: source.row, gridColumn: source.column };
    }
    return { ...section, gridRow: coords.row, gridColumn: coords.column };
  });
  return { ...layout, sections };
}
