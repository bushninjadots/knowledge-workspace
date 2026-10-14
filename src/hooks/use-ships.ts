// The weekly ship log: one note per member per week, kudos and replies on it,
// and the streak of consecutive weeks (see 20261014150000_ship_log.sql).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { draftShipFromGithub } from "@/lib/github-server";
import { shipWeekOf, type ShipHighlight } from "@/lib/ship-log";

const sb = supabase;

type ShipAuthor = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  creator_title: string | null;
};

export type Ship = {
  id: string;
  author_id: string;
  week_start: string;
  body: string;
  next_up: string | null;
  highlights: ShipHighlight[];
  project_id: string | null;
  created_at: string;
  updated_at: string;
  author: ShipAuthor | null;
  project: { id: string; title: string } | null;
  kudos: number;
  replies: number;
};

type ShipReply = {
  id: string;
  ship_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: Pick<ShipAuthor, "display_name" | "handle" | "avatar_url"> | null;
};

const SHIPS_KEY = ["ships"] as const;
const weekKey = (week: string) => [...SHIPS_KEY, "week", week] as const;
const mineKey = (userId: string, week: string) => [...SHIPS_KEY, "mine", userId, week] as const;
const streakKey = (ids: string[]) => [...SHIPS_KEY, "streaks", ...ids] as const;
const kudosKey = (userId: string) => [...SHIPS_KEY, "my-kudos", userId] as const;
const repliesKey = (shipId: string) => [...SHIPS_KEY, "replies", shipId] as const;

const SHIP_SELECT =
  "id, author_id, week_start, body, next_up, highlights, project_id, created_at, updated_at, " +
  "author:profiles!author_id(id, display_name, handle, avatar_url, creator_title), " +
  "project:projects(id, title), ship_kudos(count), ship_replies(count)";

type ShipRow = Omit<Ship, "kudos" | "replies" | "highlights"> & {
  highlights: Json;
  ship_kudos: { count: number }[] | null;
  ship_replies: { count: number }[] | null;
};

function toShip(row: ShipRow): Ship {
  const { ship_kudos, ship_replies, highlights, ...rest } = row;
  return {
    ...rest,
    highlights: Array.isArray(highlights) ? (highlights as unknown as ShipHighlight[]) : [],
    kudos: ship_kudos?.[0]?.count ?? 0,
    replies: ship_replies?.[0]?.count ?? 0,
  };
}

/** Every ship posted in a week, newest first. */
export function useWeekShips(week: string) {
  return useQuery({
    queryKey: weekKey(week),
    queryFn: async () => {
      const { data, error } = await sb
        .from("ships")
        .select(SHIP_SELECT)
        .eq("week_start", week)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data ?? []) as unknown as ShipRow[]).map(toShip);
    },
    staleTime: 30_000,
  });
}

/** The signed-in member's ship for a week, or null. */
export function useMyShip(userId: string | undefined, week: string = shipWeekOf()) {
  return useQuery({
    queryKey: mineKey(userId ?? "", week),
    queryFn: async () => {
      const { data, error } = await sb
        .from("ships")
        .select(SHIP_SELECT)
        .eq("author_id", userId!)
        .eq("week_start", week)
        .maybeSingle();
      if (error) throw error;
      return data ? toShip(data as unknown as ShipRow) : null;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** A member's recent ships, newest week first (for their log). */
export function useMemberShips(profileId: string | undefined, limit = 12) {
  return useQuery({
    queryKey: [...SHIPS_KEY, "member", profileId ?? "", limit],
    queryFn: async () => {
      const { data, error } = await sb
        .from("ships")
        .select(SHIP_SELECT)
        .eq("author_id", profileId!)
        .order("week_start", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as ShipRow[]).map(toShip);
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

/** Streaks for a set of members, as { [profileId]: weeks }. */
export function useShipStreaks(profileIds: string[]) {
  const ids = [...new Set(profileIds)].sort().slice(0, 100);
  return useQuery({
    queryKey: streakKey(ids),
    queryFn: async () => {
      const { data, error } = await sb.rpc("ship_streaks", { p_profile_ids: ids });
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.profile_id, r.streak])) as Record<
        string,
        number
      >;
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
}

/** Ship ids the signed-in member has given kudos to. */
export function useMyShipKudos(userId: string | undefined) {
  return useQuery({
    queryKey: kudosKey(userId ?? ""),
    queryFn: async () => {
      const { data, error } = await sb
        .from("ship_kudos")
        .select("ship_id")
        .eq("giver_id", userId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.ship_id));
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useShipReplies(shipId: string, enabled = true) {
  return useQuery({
    queryKey: repliesKey(shipId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("ship_replies")
        .select(
          "id, ship_id, author_id, body, created_at, author:profiles!author_id(display_name, handle, avatar_url)",
        )
        .eq("ship_id", shipId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ShipReply[];
    },
    enabled,
    staleTime: 15_000,
  });
}

type ShipInput = {
  body: string;
  next_up: string | null;
  highlights: ShipHighlight[];
  project_id: string | null;
};

/** Post this week's ship, or update it when `id` is given. */
export function useSaveShip(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShipInput & { id?: string }) => {
      const values = {
        body: input.body,
        next_up: input.next_up,
        highlights: input.highlights as unknown as Json,
        project_id: input.project_id,
      };
      if (input.id) {
        const { error } = await sb.from("ships").update(values).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("ships").insert({ ...values, author_id: userId! });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SHIPS_KEY }),
  });
}

export function useDeleteShip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("ships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SHIPS_KEY }),
  });
}

/** Give (or with `on: false`, take back) kudos. */
export function useToggleShipKudos(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shipId, on }: { shipId: string; on: boolean }) => {
      const { error } = on
        ? await sb.from("ship_kudos").insert({ ship_id: shipId, giver_id: userId! })
        : await sb.from("ship_kudos").delete().eq("ship_id", shipId).eq("giver_id", userId!);
      if (error && error.code !== "23505") throw error;
    },
    onMutate: async ({ shipId, on }) => {
      const key = kudosKey(userId ?? "");
      const prev = qc.getQueryData<Set<string>>(key);
      const next = new Set(prev ?? []);
      if (on) next.add(shipId);
      else next.delete(shipId);
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(kudosKey(userId ?? ""), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: SHIPS_KEY }),
  });
}

export function useReplyToShip(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shipId, body }: { shipId: string; body: string }) => {
      const { error } = await sb
        .from("ship_replies")
        .insert({ ship_id: shipId, author_id: userId!, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: (_d, { shipId }) => {
      qc.invalidateQueries({ queryKey: repliesKey(shipId) });
      qc.invalidateQueries({ queryKey: SHIPS_KEY });
    },
  });
}

export function useDeleteShipReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; shipId: string }) => {
      const { error } = await sb.from("ship_replies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { shipId }) => {
      qc.invalidateQueries({ queryKey: repliesKey(shipId) });
      qc.invalidateQueries({ queryKey: SHIPS_KEY });
    },
  });
}

/** Ask the server for a draft from this week's public GitHub activity. */
export function useShipDraft() {
  return useMutation({ mutationFn: () => draftShipFromGithub() });
}
