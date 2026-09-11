import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Realtime "jump in" room for a project. Pure Supabase Realtime — presence
 * tracks who is co-working right now, broadcast carries a live scratch chat.
 * There is no database table: the room is ephemeral co-presence. The durable
 * artifact is a real Session, created through the existing sessions flow when
 * the room decides to formalize the work.
 *
 * Everyone viewing the project subscribes read-only, so the live occupant
 * count is visible before joining; calling `join()` starts tracking presence
 * (and only then does the current user appear to others).
 */

export type RoomOccupant = {
  userId: string;
  name: string;
  handle: string | null;
  joinedAt: number;
};

type RoomMessage = {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: number;
};

export type RoomIdentity = {
  userId: string;
  name: string;
  handle: string | null;
};

const MESSAGE_EVENT = "room-message";
const MAX_MESSAGES = 80;
const MAX_MESSAGE_LENGTH = 500;

type PresenceMeta = RoomOccupant & { presence_ref?: string };

function occupantsFromState(state: Record<string, PresenceMeta[]>): RoomOccupant[] {
  const byUser = new Map<string, RoomOccupant>();
  for (const metas of Object.values(state)) {
    for (const meta of metas) {
      if (!meta?.userId) continue;
      const existing = byUser.get(meta.userId);
      // Keep the earliest join time if the same user has multiple tabs open.
      if (!existing || meta.joinedAt < existing.joinedAt) {
        byUser.set(meta.userId, {
          userId: meta.userId,
          name: meta.name,
          handle: meta.handle ?? null,
          joinedAt: meta.joinedAt,
        });
      }
    }
  }
  return [...byUser.values()].sort((a, b) => a.joinedAt - b.joinedAt);
}

export function useProjectRoom(projectId: string | null, me: RoomIdentity | null) {
  const [joined, setJoined] = useState(false);
  const [occupants, setOccupants] = useState<RoomOccupant[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const joinedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase.channel(`project-room-${projectId}`, {
      config: { broadcast: { self: true }, presence: { key: me?.userId ?? crypto.randomUUID() } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOccupants(occupantsFromState(channel.presenceState() as Record<string, PresenceMeta[]>));
      })
      .on("broadcast", { event: MESSAGE_EVENT }, (payload) => {
        const msg = payload.payload as RoomMessage | undefined;
        if (!msg?.id || !msg.text) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg].slice(-MAX_MESSAGES);
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setJoined(false);
      setOccupants([]);
      setMessages([]);
    };
  }, [projectId, me?.userId]);

  const join = useCallback(() => {
    if (!me?.userId || !channelRef.current) return;
    joinedAtRef.current = Date.now();
    channelRef.current.track({
      userId: me.userId,
      name: me.name,
      handle: me.handle,
      joinedAt: joinedAtRef.current,
    } satisfies RoomOccupant);
    setJoined(true);
  }, [me?.userId, me?.name, me?.handle]);

  const leave = useCallback(() => {
    channelRef.current?.untrack();
    setJoined(false);
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!trimmed || !me?.userId || !channelRef.current) return;
      const msg: RoomMessage = {
        id: crypto.randomUUID(),
        userId: me.userId,
        name: me.name,
        text: trimmed,
        at: Date.now(),
      };
      channelRef.current.send({ type: "broadcast", event: MESSAGE_EVENT, payload: msg });
    },
    [me?.userId, me?.name],
  );

  return { joined, occupants, messages, join, leave, sendMessage };
}
