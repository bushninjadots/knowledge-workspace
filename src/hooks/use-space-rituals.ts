// Rituals that bring people back to a space (20261014130000_space_rituals):
// sessions scheduled in the space, and the weekly ship thread.
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SPACE_POSTS_KEY } from "@/hooks/community-space-types";
import { useCurrentUser } from "@/hooks/use-current-user";

const sb = supabase;

export type SpaceSession = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  duration_minutes: number;
  meeting_url: string | null;
  organizer_id: string;
  going: string[];
};

const SPACE_SESSIONS_KEY = (spaceId: string) => ["space-sessions", spaceId] as const;

/** Upcoming (and just-started) sessions in a space, soonest first. */
export function useSpaceSessions(spaceId: string, enabled = true) {
  return useQuery({
    queryKey: SPACE_SESSIONS_KEY(spaceId),
    enabled: enabled && !!spaceId,
    staleTime: 60_000,
    queryFn: async (): Promise<SpaceSession[]> => {
      const since = new Date(Date.now() - 60 * 60_000).toISOString();
      const { data, error } = await sb
        .from("sessions")
        .select(
          "id, title, description, starts_at, duration_minutes, meeting_url, organizer_id, session_participants(profile_id, status)",
        )
        .eq("community_id", spaceId)
        .neq("status", "cancelled")
        .gte("starts_at", since)
        .order("starts_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      return (data ?? []).map(({ session_participants, ...s }) => ({
        ...s,
        going: (session_participants ?? [])
          .filter((p) => p.status === "accepted")
          .map((p) => p.profile_id),
      }));
    },
  });
}

/** An owner or moderator schedules a session in their space. */
export function useScheduleSpaceSession() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  return useMutation({
    mutationFn: async (input: {
      spaceId: string;
      title: string;
      description: string;
      startsAt: string;
      durationMinutes: number;
      meetingUrl: string;
    }) => {
      if (!me?.userId) throw new Error("Not signed in");
      const start = new Date(input.startsAt);
      const { error } = await sb.from("sessions").insert({
        organizer_id: me.userId,
        community_id: input.spaceId,
        title: input.title,
        description: input.description || null,
        session_type: "workshop",
        status: "scheduled",
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + input.durationMinutes * 60_000).toISOString(),
        duration_minutes: input.durationMinutes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        meeting_url: input.meetingUrl || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: SPACE_SESSIONS_KEY(input.spaceId) });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

/** Say you're going to a space session, or take it back. */
export function useToggleGoing() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  return useMutation({
    mutationFn: async (input: { sessionId: string; spaceId: string; going: boolean }) => {
      if (!me?.userId) throw new Error("Not signed in");
      if (input.going) {
        const { error } = await sb
          .from("session_participants")
          .delete()
          .eq("session_id", input.sessionId)
          .eq("profile_id", me.userId);
        if (error) throw error;
      } else {
        const { error } = await sb.from("session_participants").insert({
          session_id: input.sessionId,
          profile_id: me.userId,
          role: "participant",
          status: "accepted",
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: SPACE_SESSIONS_KEY(input.spaceId) });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

/**
 * Starts this week's ship thread when a member opens a space that has it
 * turned on. Runs once per space per page load; the server makes it a no-op
 * if the thread already exists.
 */
export function useWeeklyThread(
  space: { id: string; weekly_thread?: boolean | null; is_member?: boolean } | null | undefined,
) {
  const qc = useQueryClient();
  const done = useRef(new Set<string>());
  const id = space?.id;
  const wanted = !!space?.weekly_thread && !!space?.is_member;
  useEffect(() => {
    if (!id || !wanted || done.current.has(id)) return;
    done.current.add(id);
    void sb.rpc("ensure_weekly_thread", { p_space_id: id }).then(({ data }) => {
      if (data) qc.invalidateQueries({ queryKey: SPACE_POSTS_KEY(id) });
    });
  }, [id, wanted, qc]);
}
