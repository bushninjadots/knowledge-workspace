import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./use-current-user";

/* ───────── Types ───────── */

export type SessionType =
  | "skill_exchange"
  | "mentoring"
  | "project_meeting"
  | "study_session"
  | "workshop"
  | "general";

export type SessionStatus =
  | "draft"
  | "scheduled"
  | "invitation_sent"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ParticipantRole = "organizer" | "participant" | "mentor";
export type ParticipantStatus = "invited" | "accepted" | "declined" | "pending";

export type Session = {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  session_type: SessionType;
  status: SessionStatus;
  skill_id: string | null;
  project_id: string | null;
  community_id: string | null;
  exchange_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  duration_minutes: number;
  timezone: string;
  meeting_url: string | null;
  location: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionParticipant = {
  id: string;
  session_id: string;
  profile_id: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  responded_at: string | null;
  created_at: string;
};

export type SessionWithParticipants = Session & {
  participants: (SessionParticipant & {
    profiles: { display_name: string | null; handle: string | null; avatar_url: string | null } | null;
  })[];
  organizer: { display_name: string | null; handle: string | null; avatar_url: string | null } | null;
  skills?: { name: string; category: string } | null;
  projects?: { title: string } | null;
};

export type SessionRequest = {
  id: string;
  session_id: string | null;
  from_user_id: string;
  to_user_id: string;
  status: string;
  message: string | null;
  suggested_time: string | null;
  created_at: string;
  responded_at: string | null;
  from_user?: { display_name: string | null; handle: string | null; avatar_url: string | null } | null;
  to_user?: { display_name: string | null; handle: string | null; avatar_url: string | null } | null;
  sessions?: { title: string; starts_at: string | null; duration_minutes: number } | null;
};

/* ───────── Query Keys ───────── */

export const sessionKeys = {
  all: ["sessions"] as const,
  list: (userId: string) => [...sessionKeys.all, "list", userId] as const,
  detail: (id: string) => [...sessionKeys.all, "detail", id] as const,
  today: (userId: string) => [...sessionKeys.all, "today", userId] as const,
  upcoming: (userId: string) => [...sessionKeys.all, "upcoming", userId] as const,
  participants: (sessionId: string) => [...sessionKeys.all, "participants", sessionId] as const,
  requests: (userId: string) => [...sessionKeys.all, "requests", userId] as const,
  availability: (userId: string) => [...sessionKeys.all, "availability", userId] as const,
  stats: (userId: string) => [...sessionKeys.all, "stats", userId] as const,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

/* ───────── Fetchers ───────── */

const SESSION_SELECT = `
  *,
  organizer:profiles!sessions_organizer_id_fkey(display_name, handle, avatar_url),
  participants:session_participants(
    *,
    profiles:profiles!session_participants_profile_id_fkey(display_name, handle, avatar_url)
  ),
  skills:skills(name, category),
  projects:projects(title)
`;

async function fetchSessionsForUser(userId: string): Promise<SessionWithParticipants[]> {
  const { data, error } = await sb
    .from("sessions")
    .select(SESSION_SELECT)
    .or(`organizer_id.eq.${userId},session_participants.profile_id.eq.${userId}`)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SessionWithParticipants[];
}

async function fetchTodaySessions(userId: string): Promise<SessionWithParticipants[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data, error } = await sb
    .from("sessions")
    .select(SESSION_SELECT)
    .gte("starts_at", startOfDay)
    .lt("starts_at", endOfDay)
    .not("status", "eq", "cancelled")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SessionWithParticipants[];
}

async function fetchUpcomingSessions(userId: string): Promise<SessionWithParticipants[]> {
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("sessions")
    .select(SESSION_SELECT)
    .gte("starts_at", now)
    .not("status", "eq", "cancelled")
    .order("starts_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as SessionWithParticipants[];
}

async function fetchSessionStats(userId: string) {
  const now = new Date().toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [upcomingRes, completedRes, pendingRes, hoursRes] = await Promise.all([
    sb
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", now)
      .not("status", "eq", "cancelled")
      .or(`organizer_id.eq.${userId},session_participants.profile_id.eq.${userId}`),
    sb
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .or(`organizer_id.eq.${userId},session_participants.profile_id.eq.${userId}`),
    sb
      .from("session_requests")
      .select("id", { count: "exact", head: true })
      .eq("to_user_id", userId)
      .eq("status", "pending"),
    sb
      .from("sessions")
      .select("duration_minutes")
      .eq("status", "completed")
      .gte("starts_at", monthStart)
      .or(`organizer_id.eq.${userId},session_participants.profile_id.eq.${userId}`),
  ]);

  const totalHours = (hoursRes.data ?? []).reduce(
    (sum: number, s: any) => sum + (s.duration_minutes ?? 0),
    0,
  );

  return {
    upcomingCount: upcomingRes.count ?? 0,
    completedCount: completedRes.count ?? 0,
    pendingCount: pendingRes.count ?? 0,
    hoursThisMonth: Math.round((totalHours / 60) * 10) / 10,
  };
}

async function fetchRequests(userId: string): Promise<SessionRequest[]> {
  const { data, error } = await sb
    .from("session_requests")
    .select(`
      *,
      from_user:profiles!session_requests_from_user_id_fkey(display_name, handle, avatar_url),
      to_user:profiles!session_requests_to_user_id_fkey(display_name, handle, avatar_url),
      sessions(title, starts_at, duration_minutes)
    `)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SessionRequest[];
}

async function fetchAvailability(userId: string) {
  const { data, error } = await sb
    .from("session_availability")
    .select("*")
    .eq("profile_id", userId)
    .order("day_of_week");
  if (error) throw error;
  return data ?? [];
}

async function fetchSessionHistory(userId: string): Promise<SessionWithParticipants[]> {
  const { data, error } = await sb
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("status", "completed")
    .or(`organizer_id.eq.${userId},session_participants.profile_id.eq.${userId}`)
    .order("starts_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as SessionWithParticipants[];
}

/* ───────── Hooks ───────── */

export function useSessions() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  return useQuery({
    queryKey: sessionKeys.list(userId ?? ""),
    queryFn: () => fetchSessionsForUser(userId!),
    enabled: !!userId,
  });
}

export function useTodaySessions() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  return useQuery({
    queryKey: sessionKeys.today(userId ?? ""),
    queryFn: () => fetchTodaySessions(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
  });
}

export function useUpcomingSessions() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  return useQuery({
    queryKey: sessionKeys.upcoming(userId ?? ""),
    queryFn: () => fetchUpcomingSessions(userId!),
    enabled: !!userId,
  });
}

export function useSessionStats() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  return useQuery({
    queryKey: sessionKeys.stats(userId ?? ""),
    queryFn: () => fetchSessionStats(userId!),
    enabled: !!userId,
  });
}

export function useSessionRequests() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  return useQuery({
    queryKey: sessionKeys.requests(userId ?? ""),
    queryFn: () => fetchRequests(userId!),
    enabled: !!userId,
  });
}

export function useSessionAvailability() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  return useQuery({
    queryKey: sessionKeys.availability(userId ?? ""),
    queryFn: () => fetchAvailability(userId!),
    enabled: !!userId,
  });
}

export function useSessionHistory() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  return useQuery({
    queryKey: [...sessionKeys.all, "history", userId ?? ""] as const,
    queryFn: () => fetchSessionHistory(userId!),
    enabled: !!userId,
  });
}

/* ───────── Mutations ───────── */

export function useCreateSession() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      session_type: SessionType;
      starts_at: string;
      duration_minutes: number;
      timezone?: string;
      meeting_url?: string;
      location?: string;
      skill_id?: string;
      project_id?: string;
      participant_ids?: string[];
    }) => {
      const { data: session, error } = await sb
        .from("sessions")
        .insert({
          organizer_id: userId,
          title: input.title,
          description: input.description ?? null,
          session_type: input.session_type,
          status:
            input.participant_ids && input.participant_ids.length > 0
              ? "invitation_sent"
              : "scheduled",
          starts_at: input.starts_at,
          ends_at: new Date(
            new Date(input.starts_at).getTime() + input.duration_minutes * 60_000,
          ).toISOString(),
          duration_minutes: input.duration_minutes,
          timezone: input.timezone ?? "UTC",
          meeting_url: input.meeting_url ?? null,
          location: input.location ?? null,
          skill_id: input.skill_id ?? null,
          project_id: input.project_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      if (input.participant_ids && input.participant_ids.length > 0) {
        const participants = input.participant_ids.map((pid: string) => ({
          session_id: session.id,
          profile_id: pid,
          role: "participant",
          status: "invited",
        }));
        const { error: pErr } = await sb.from("session_participants").insert(participants);
        if (pErr) throw pErr;
      }

      return session as Session;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      }
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Session> & { id: string }) => {
      const { data, error } = await sb
        .from("sessions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Session;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      }
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      }
    },
  });
}

export function useRespondToRequest() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: string }) => {
      const { data, error } = await sb
        .from("session_requests")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", requestId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: sessionKeys.requests(userId) });
      }
    },
  });
}
