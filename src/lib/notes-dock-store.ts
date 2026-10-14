// Shared state for the Notes dock: whether it's open and which library item
// it shows. It shares the bottom-right corner with the messaging dock, so
// opening one closes the other.
import { useSyncExternalStore } from "react";
import { messageDock } from "./message-dock-store";

type NotesDockState = { open: boolean; itemId: string | null };

let state: NotesDockState = { open: false, itemId: null };
const listeners = new Set<() => void>();

function set(next: NotesDockState) {
  if (next.open === state.open && next.itemId === state.itemId) return;
  state = next;
  if (next.open) messageDock.close();
  for (const listener of listeners) listener();
}

// Messages opening closes Notes.
messageDock.subscribe(() => {
  if (messageDock.get().open && state.open) set({ open: false, itemId: state.itemId });
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
    set({ open: true, itemId });
  },
  showList() {
    set({ open: true, itemId: null });
  },
  close() {
    set({ open: false, itemId: state.itemId });
  },
  toggle() {
    set({ open: !state.open, itemId: state.itemId });
  },
};

export function useNotesDock(): NotesDockState {
  return useSyncExternalStore(notesDock.subscribe, notesDock.get, notesDock.get);
}
