import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SpaceTypingUser = {
  id: string;
  name: string;
  lastTypedAt: number;
};

const TYPING_EVENT = "typing";
const TYPING_SEND_THROTTLE_MS = 1_500;
const TYPING_EXPIRE_MS = 3_500;

/**
 * Realtime "is typing" presence for a space's chat. Members who are typing
 * broadcast on a per-space channel (scoped by space id in the channel name);
 * everyone else viewing the space sees a subtle "X is typing…" hint. Pure
 * broadcast — no database writes, and `self: false` means you never see your
 * own typing echoed back.
 */
export function useSpaceTyping(spaceId: string | null) {
  const [typers, setTypers] = useState<Map<string, SpaceTypingUser>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (!spaceId) return;

    const channel = supabase.channel(`space-typing-${spaceId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: TYPING_EVENT }, (payload) => {
        const u = payload.payload as SpaceTypingUser | undefined;
        if (!u?.id || !u?.name) return;
        setTypers((prev) => {
          const next = new Map(prev);
          next.set(u.id, { ...u, lastTypedAt: Date.now() });
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;

    // Prune typers who stopped typing (or closed the tab) after a few seconds.
    const prune = window.setInterval(() => {
      const cutoff = Date.now() - TYPING_EXPIRE_MS;
      setTypers((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, u] of next) {
          if (u.lastTypedAt < cutoff) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1_000);

    return () => {
      window.clearInterval(prune);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setTypers(new Map());
    };
  }, [spaceId]);

  /** Announce that the current user is typing. Throttled to every 1.5s. */
  function announceTyping(user: { id: string; name: string }) {
    const now = Date.now();
    if (now - lastSentAtRef.current < TYPING_SEND_THROTTLE_MS) return;
    lastSentAtRef.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: TYPING_EVENT,
      payload: { ...user, lastTypedAt: now },
    });
  }

  return { typers, announceTyping };
}
