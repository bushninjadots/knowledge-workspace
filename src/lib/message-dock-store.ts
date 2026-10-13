// Shared state for the messaging dock: whether it's open and which
// conversation it shows. The dock, the new-message popups (which open threads
// in it and stay quiet for the thread you're reading) and anything else can
// read and drive it without prop drilling.
import { useSyncExternalStore } from "react";

export type MessageDockState = { open: boolean; threadId: string | null };

let state: MessageDockState = { open: false, threadId: null };
const listeners = new Set<() => void>();

function set(next: MessageDockState) {
  if (next.open === state.open && next.threadId === state.threadId) return;
  state = next;
  for (const listener of listeners) listener();
}

export const messageDock = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Open the dock on the list, or straight onto a conversation. */
  open(threadId: string | null = null) {
    set({ open: true, threadId });
  },
  /** Back to the conversation list without closing. */
  showList() {
    set({ open: true, threadId: null });
  },
  close() {
    set({ open: false, threadId: state.threadId });
  },
  toggle() {
    set({ open: !state.open, threadId: state.threadId });
  },
};

export function useMessageDock(): MessageDockState {
  return useSyncExternalStore(messageDock.subscribe, messageDock.get, messageDock.get);
}
