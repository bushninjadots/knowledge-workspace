// The Studio editor's document state as one reducer: what is on the canvas
// (layout, config, page theme, card borders, which areas are hand-arranged),
// the last saved copy, and undo/redo. Pure, so every rule below is testable
// without rendering the editor; side effects (saving the theme, autosave)
// stay in CreationStudio and react to the state.
//
// Rules that used to be spread over a dozen setters and refs:
// - An edit records the state *before* it as one undo step.
// - Rapid edits to the same thing (same merge key within a second: typing,
//   dragging a slider) extend that step instead of adding one per keystroke.
// - At most HISTORY_LIMIT steps are kept.
// - Any new edit clears redo.
// - Undo/redo swap the current state with the target, so they mirror exactly.
// - Measuring content heights (fit) patches the working and saved layouts
//   alike, so it never marks the draft dirty or adds an undo step.

import type { CardBorderPreference } from "@/lib/background-themes";
import type { LayoutGridItem, PageLayout } from "@/lib/page-blocks";
import type { GStudioConfig } from "@/components/tethyr/studio/g-studio-surface";
import { cloneConfig, cloneLayout, normalizeLayout } from "@/lib/studio-layout";

export const HISTORY_LIMIT = 50;
/** Edits with the same merge key closer together than this are one undo step. */
export const MERGE_WINDOW_MS = 1000;

export type StudioBorders = { cardBorders: CardBorderPreference; cardBorderColor: string };

/** Everything one undo step puts back. */
export type StudioDoc = {
  layout: PageLayout;
  config: GStudioConfig;
  /** The page theme (null = default). */
  themeId: string | null;
  borders: StudioBorders;
  /** Areas arranged by hand on the grid (their grids are saved as-is). */
  arranged: string[];
};

export type StudioEditorState = {
  doc: StudioDoc | null;
  /** The last saved layout and config: "dirty" compares against these. */
  saved: { layout: PageLayout; config: GStudioConfig } | null;
  past: StudioDoc[];
  future: StudioDoc[];
  lastEdit: { key: string; at: number } | null;
  /** Card borders read from the profile before the page loaded. */
  bordersSeed?: StudioBorders;
};

export const INITIAL_STUDIO_EDITOR_STATE: StudioEditorState = {
  doc: null,
  saved: null,
  past: [],
  future: [],
  lastEdit: null,
};

const DEFAULT_BORDERS: StudioBorders = { cardBorders: "neutral", cardBorderColor: "" };

export type StudioEditorAction =
  /** Load a page as the saved baseline. `carry` keeps one undo step (the
   *  editor just before a restore) so a restore can be undone. Borders
   *  default to the current ones: they belong to the profile, not the page. */
  | {
      type: "seed";
      layout: PageLayout;
      config: GStudioConfig;
      themeId: string | null;
      arranged: string[];
      borders?: StudioBorders;
      carry?: StudioDoc;
    }
  /** Seed the card borders from the profile without an undo step. */
  | { type: "seedBorders"; borders: StudioBorders }
  /** A user edit: record an undo step (or extend a merging one), then apply. */
  | {
      type: "edit";
      layout?: PageLayout;
      config?: GStudioConfig;
      themeId?: string | null;
      borders?: StudioBorders;
      /** The hand-arranged areas as tracked right now; they go into the
       *  undo step and stay on the document. */
      arranged?: string[];
      mergeKey?: string;
      now: number;
    }
  /** Record an undo step without changing anything yet (a drag is starting;
   *  its moves arrive as `adjust`). */
  | { type: "checkpoint"; now: number; arranged?: string[] }
  /** Change the layout without an undo step (the moves of a drag that
   *  already checkpointed). Returning null or the same layout is a no-op. */
  | { type: "adjust"; update: (layout: PageLayout) => PageLayout | null }
  /** Measured content heights: patch working and saved layouts alike. */
  | { type: "fit"; sectionId: string; grid: LayoutGridItem[]; apply: FitGrid }
  /** Track which areas are hand-arranged (saved with the next undo step). */
  | { type: "arranged"; arranged: string[] }
  | { type: "undo" }
  | { type: "redo" }
  /** A save finished: this layout and config are the new baseline. */
  | { type: "saved"; layout: PageLayout; config: GStudioConfig };

/** `withFittedGrid` from studio-layout, injected so this module stays pure. */
export type FitGrid = (
  layout: PageLayout,
  sectionId: string,
  grid: LayoutGridItem[],
) => PageLayout | null;

function cloneDoc(doc: StudioDoc): StudioDoc {
  return {
    layout: cloneLayout(doc.layout),
    config: cloneConfig(doc.config),
    themeId: doc.themeId,
    borders: { ...doc.borders },
    arranged: [...doc.arranged],
  };
}

/** Push the current document as an undo step, honouring the merge window. */
function record(state: StudioEditorState, mergeKey: string | undefined, now: number) {
  const last = state.lastEdit;
  const lastEdit = mergeKey ? { key: mergeKey, at: now } : null;
  const merges = !!mergeKey && !!last && last.key === mergeKey && now - last.at < MERGE_WINDOW_MS;
  if (merges || !state.doc) return { past: state.past, future: state.future, lastEdit };
  return {
    past: [...state.past.slice(-(HISTORY_LIMIT - 1)), cloneDoc(state.doc)],
    future: [],
    lastEdit,
  };
}

export function studioEditorReducer(
  state: StudioEditorState,
  action: StudioEditorAction,
): StudioEditorState {
  switch (action.type) {
    case "seed": {
      const layout = normalizeLayout(action.layout);
      return {
        doc: {
          layout: cloneLayout(layout),
          config: cloneConfig(action.config),
          themeId: action.themeId,
          borders: action.borders ?? state.doc?.borders ?? state.bordersSeed ?? DEFAULT_BORDERS,
          arranged: [...action.arranged],
        },
        saved: { layout: cloneLayout(layout), config: cloneConfig(action.config) },
        past: action.carry ? [cloneDoc(action.carry)] : [],
        future: [],
        lastEdit: null,
      };
    }
    case "seedBorders":
      return state.doc
        ? { ...state, doc: { ...state.doc, borders: { ...action.borders } } }
        : { ...state, bordersSeed: { ...action.borders } };
    case "edit": {
      if (!state.doc) return state;
      const current = action.arranged
        ? { ...state.doc, arranged: [...action.arranged] }
        : state.doc;
      const history = record({ ...state, doc: current }, action.mergeKey, action.now);
      return {
        ...state,
        ...history,
        doc: {
          layout: action.layout ? normalizeLayout(action.layout) : state.doc.layout,
          config: action.config ? { ...action.config } : state.doc.config,
          themeId: action.themeId !== undefined ? action.themeId : state.doc.themeId,
          borders: action.borders ? { ...action.borders } : state.doc.borders,
          arranged: current.arranged,
        },
      };
    }
    case "checkpoint": {
      if (!state.doc) return state;
      const doc = action.arranged ? { ...state.doc, arranged: [...action.arranged] } : state.doc;
      return { ...state, doc, ...record({ ...state, doc }, undefined, action.now) };
    }
    case "adjust": {
      if (!state.doc) return state;
      const layout = action.update(state.doc.layout);
      return layout && layout !== state.doc.layout
        ? { ...state, doc: { ...state.doc, layout } }
        : state;
    }
    case "fit": {
      if (!state.doc) return state;
      const fit = (layout: PageLayout) =>
        action.apply(layout, action.sectionId, action.grid) ?? layout;
      return {
        ...state,
        doc: { ...state.doc, layout: fit(state.doc.layout) },
        saved: state.saved ? { ...state.saved, layout: fit(state.saved.layout) } : state.saved,
      };
    }
    case "arranged":
      return state.doc
        ? { ...state, doc: { ...state.doc, arranged: [...action.arranged] } }
        : state;
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous || !state.doc) return state;
      return {
        ...state,
        doc: cloneDoc(previous),
        past: state.past.slice(0, -1),
        future: [cloneDoc(state.doc), ...state.future],
        lastEdit: null,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next || !state.doc) return state;
      return {
        ...state,
        doc: cloneDoc(next),
        past: [...state.past, cloneDoc(state.doc)],
        future: state.future.slice(1),
        lastEdit: null,
      };
    }
    case "saved":
      return {
        ...state,
        saved: { layout: cloneLayout(action.layout), config: cloneConfig(action.config) },
      };
  }
}
