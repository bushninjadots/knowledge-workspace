// Shared state for the Notes dock: whether it's open and which library item
// it shows. It shares the bottom-right corner with the messaging dock, so
// opening one closes the other.
import { useSyncExternalStore } from "react";
import { messageDock } from "./message-dock-store";

type NotesDockTab = "notes" | "log";
type NotesDockState = { open: boolean; itemId: string | null; tab: NotesDockTab };

let state: NotesDockState = { open: false, itemId: null, tab: "notes" };
const listeners = new Set<() => void>();

function set(next: NotesDockState) {
  if (next.open === state.open && next.itemId === state.itemId && next.tab === state.tab) return;
  state = next;
  if (next.open) messageDock.close();
  for (const listener of listeners) listener();
}

// Messages opening closes Notes.
messageDock.subscribe(() => {
  if (messageDock.get().open && state.open) set({ ...state, open: false });
});

export const notesDock = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Open on the list, or straight onto one note or file. */
  open(itemId: string | null = null) {
    set({ open: true, itemId, tab: "notes" });
  },
  /** Open on the dev journal's Log tab. */
  openLog() {
    set({ open: true, itemId: null, tab: "log" });
  },
  setTab(tab: NotesDockTab) {
    set({ ...state, itemId: null, tab });
  },
  showList() {
    set({ ...state, open: true, itemId: null });
  },
  close() {
    set({ ...state, open: false });
  },
  toggle() {
    set({ ...state, open: !state.open });
  },
};

export function useNotesDock(): NotesDockState {
  return useSyncExternalStore(notesDock.subscribe, notesDock.get, notesDock.get);
}
