import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const sb = supabase;

export type ChallengeType = "skill" | "project" | "learning";
export type ChallengeDifficulty = "beginner" | "intermediate" | "advanced";
export type ChallengeStatus = "draft" | "active" | "completed" | "archived";

export type ChallengeRow = {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  skills: string[];
  difficulty: ChallengeDifficulty;
  start_date: string | null;
  end_date: string | null;
  max_participants: number | null;
  /** Rubric the creator uses to judge submissions. */
  pass_criteria: string | null;
  status: ChallengeStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Optional project this challenge is tied to. */
  project_id: string | null;
  /** True when Tethyr curated this challenge as cold-start content. */
  is_starter: boolean;
  // Joined stats & creator info
  creator?: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
  participant_count?: number;
  is_joined?: boolean;
  my_participation?: ChallengeParticipantRow | null;
};

export type ChallengeReviewStatus = "none" | "submitted" | "passed" | "rejected";

export type ChallengeParticipantRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  status: "joined" | "in_progress" | "completed";
  progress: Record<string, unknown>;
  joined_at: string;
  submission_url: string | null;
  submission_note: string | null;
  submitted_at: string | null;
  review_status: ChallengeReviewStatus;
  reviewer_note: string | null;
  reviewed_at: string | null;
  profile?: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
};

export type CreateChallengeInput = {
  title: string;
  description: string;
  type?: ChallengeType;
  skills?: string[];
  difficulty?: ChallengeDifficulty;
  start_date?: string | null;
  end_date?: string | null;
  max_participants?: number | null;
  pass_criteria?: string | null;
  /** Optional project this challenge is tied to. */
  project_id?: string | null;
};

export const CHALLENGES_KEY = ["challenges"] as const;
export const CHALLENGE_KEY = (id: string) => ["challenge", id] as const;

export function useChallenges(statusFilter: string = "active") {
  return useQuery({
    queryKey: [...CHALLENGES_KEY, statusFilter],
    queryFn: async () => {
      let query = sb
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false })
        // Platform-wide list with no per-user bound — cap it so the page
        // doesn't grow unbounded as challenges accumulate. Pagination can
        // come when usage evidence shows people actually go past this.
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: rawChallenges, error } = await query;
      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as ChallengeRow[];
        }
        throw error;
      }
      const challenges = (rawChallenges ?? []) as ChallengeRow[];

      if (challenges.length === 0) return [];

      // Fetch participants for counts and current user status
      const challengeIds = challenges.map((c) => c.id);
      const PARTICIPANTS_SELECT =
        "id, challenge_id, user_id, status, progress, joined_at, review_status, submission_url, submission_note, submitted_at, reviewed_at, reviewer_note" as const;
      const { data: rawParticipants } = await sb
        .from("challenge_participants")
        .select<typeof PARTICIPANTS_SELECT, ChallengeParticipantRow>(PARTICIPANTS_SELECT)
        .in("challenge_id", challengeIds);

      const participants = rawParticipants ?? [];

      // Fetch creators
      const creatorIds = [...new Set(challenges.map((c) => c.created_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .in("id", creatorIds);

      const profileMap = new Map<string, NonNullable<ChallengeRow["creator"]>>(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      return challenges.map((c): ChallengeRow => {
        const cParticipants = participants.filter((p) => p.challenge_id === c.id);
        const myPart = user ? cParticipants.find((p) => p.user_id === user.id) : null;
        return {
          ...c,
          creator: profileMap.get(c.created_by) ?? {
            display_name: "Community Member",
            handle: "creator",
            avatar_url: null,
          },
          participant_count: cParticipants.length,
          is_joined: !!myPart,
          my_participation: myPart ?? null,
        };
      });
    },
    staleTime: 30_000,
  });
}

export function useChallenge(id: string) {
  return useQuery({
    queryKey: CHALLENGE_KEY(id),
    queryFn: async () => {
      const { data: rawChallenge, error } = await sb
        .from("challenges")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      const challenge = rawChallenge as ChallengeRow;

      // Fetch creator
      const { data: creator } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .eq("id", challenge.created_by)
        .maybeSingle();

      // Fetch participants with profile info
      const { data: rawParticipants } = await sb
        .from("challenge_participants")
        .select<"*", ChallengeParticipantRow>("*")
        .eq("challenge_id", id)
        .order("joined_at", { ascending: true });

      const participants = rawParticipants ?? [];
      const userIds = [...new Set(participants.map((p) => p.user_id))];

      let profileMap = new Map<string, NonNullable<ChallengeParticipantRow["profile"]>>();
      if (userIds.length > 0) {
        const { data: partProfiles } = await supabase
          .from("profiles")
          .select("id, display_name, handle, avatar_url")
          .in("id", userIds);
        profileMap = new Map<string, NonNullable<ChallengeParticipantRow["profile"]>>(
          (partProfiles ?? []).map((p) => [p.id, p]),
        );
      }

      const participantsWithProfiles = participants.map((p) => ({
        ...p,
        profile: profileMap.get(p.user_id),
      }));

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const myPart = user ? participants.find((p) => p.user_id === user.id) : null;

      return {
        ...challenge,
        creator: creator ?? {
          display_name: "Community Member",
          handle: "creator",
          avatar_url: null,
        },
        participants: participantsWithProfiles,
        participant_count: participants.length,
        is_joined: !!myPart,
        my_participation: myPart ?? null,
      };
    },
    enabled: !!id,
  });
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateChallengeInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("challenges")
        .insert({
          title: input.title,
          description: input.description,
          type: input.type ?? "skill",
          skills: input.skills ?? [],
          difficulty: input.difficulty ?? "intermediate",
          start_date: input.start_date ?? null,
          end_date: input.end_date ?? null,
          max_participants: input.max_participants ?? null,
          pass_criteria: input.pass_criteria ?? null,
          project_id: input.project_id ?? null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHALLENGES_KEY });
    },
  });
}

/** Challenges tied to a specific project (active ones first). */
export function useProjectChallenges(projectId: string) {
  return useQuery({
    queryKey: [...CHALLENGES_KEY, "project", projectId] as const,
    queryFn: async () => {
      const { data, error } = await sb
        .from("challenges")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as ChallengeRow[];
        }
        throw error;
      }
      return (data ?? []) as ChallengeRow[];
    },
    enabled: !!projectId,
  });
}

export function useJoinChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("challenge_participants")
        .insert({
          challenge_id: challengeId,
          user_id: user.id,
          status: "joined",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, challengeId) => {
      qc.invalidateQueries({ queryKey: CHALLENGES_KEY });
      qc.invalidateQueries({ queryKey: CHALLENGE_KEY(challengeId) });
    },
  });
}

export function useLeaveChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await sb
        .from("challenge_participants")
        .delete()
        .eq("challenge_id", challengeId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: (_data, challengeId) => {
      qc.invalidateQueries({ queryKey: CHALLENGES_KEY });
      qc.invalidateQueries({ queryKey: CHALLENGE_KEY(challengeId) });
    },
  });
}

export function useUpdateChallengeProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      challengeId: string;
      status: "joined" | "in_progress" | "completed";
      progress?: Record<string, unknown>;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("challenge_participants")
        .update({
          status: input.status,
          progress: (input.progress ?? {}) as Json,
        })
        .eq("challenge_id", input.challengeId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: CHALLENGES_KEY });
      qc.invalidateQueries({ queryKey: CHALLENGE_KEY(variables.challengeId) });
    },
  });
}

/**
 * Participant submits their finished work for creator review.
 * Sets status → completed and review_status → submitted.
 */
export function useSubmitChallengeWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      challengeId: string;
      submissionUrl: string;
      submissionNote?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("challenge_participants")
        .update({
          status: "completed",
          review_status: "submitted",
          submission_url: input.submissionUrl,
          submission_note: input.submissionNote?.trim() || null,
          submitted_at: new Date().toISOString(),
          reviewed_at: null,
          reviewer_note: null,
        })
        .eq("challenge_id", input.challengeId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: CHALLENGES_KEY });
      qc.invalidateQueries({ queryKey: CHALLENGE_KEY(variables.challengeId) });
    },
  });
}

/**
 * Challenge creator reviews a participant submission: pass or reject.
 */
export function useReviewChallengeSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      challengeId: string;
      participantId: string;
      reviewStatus: "passed" | "rejected";
      reviewerNote?: string;
    }) => {
      const { data, error } = await sb
        .from("challenge_participants")
        .update({
          review_status: input.reviewStatus,
          reviewer_note: input.reviewerNote?.trim() || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.participantId)
        .eq("challenge_id", input.challengeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: CHALLENGES_KEY });
      qc.invalidateQueries({ queryKey: CHALLENGE_KEY(variables.challengeId) });
    },
  });
}
