// Skill matching engine — scores compatibility between two users based on
// complementary teach/learn skills, availability overlap, and profile signals.

export type SkillMeta = {
  skill_id: string;
  name: string;
  category: string;
  experience_level?: string;
  verification_level?: string;
};

export type AvailabilityStatus =
  "available" | "busy" | "learning" | "looking_for_team" | "mentoring" | null;

export type MatchCandidate = {
  profile_id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  avatar_url: string | null;
  availability: AvailabilityStatus;
  category: string | null;
  languages: string[];
  teachSkills: SkillMeta[];
  learnSkills: SkillMeta[];
  matchScore: number;
  matchReasons: string[];
};

const VERIFICATION_WEIGHT: Record<string, number> = {
  community_recognized: 3,
  proof_certified: 2,
  self_declared: 1,
};

const EXPERIENCE_WEIGHT: Record<string, number> = {
  expert: 4,
  advanced: 3,
  intermediate: 2,
  beginner: 1,
};

/**
 * Score how well a candidate's teach skills match a target user's learn skills.
 * Returns [score, reasons[]].
 */
export function scoreSkillMatch(
  candidateTeach: SkillMeta[],
  targetLearnIds: Set<string>,
): [number, string[]] {
  let score = 0;
  const reasons: string[] = [];

  for (const skill of candidateTeach) {
    if (targetLearnIds.has(skill.skill_id)) {
      const vWeight = VERIFICATION_WEIGHT[skill.verification_level ?? "self_declared"] ?? 1;
      const eWeight = EXPERIENCE_WEIGHT[skill.experience_level ?? "beginner"] ?? 1;
      score += vWeight + eWeight;
      reasons.push(`Teaches ${skill.name}`);
    }
  }

  return [score, reasons];
}

/**
 * Score how well a candidate's learn skills match a target user's teach skills
 * (reverse match —"I can teach them what they want to learn").
 */
export function scoreReverseMatch(
  candidateLearn: SkillMeta[],
  targetTeachIds: Set<string>,
): [number, string[]] {
  let score = 0;
  const reasons: string[] = [];

  for (const skill of candidateLearn) {
    if (targetTeachIds.has(skill.skill_id)) {
      score += 1;
      reasons.push(`Wants to learn ${skill.name}`);
    }
  }

  return [score, reasons];
}

/**
 * Compute availability overlap score (0–5).
 */
export function scoreAvailability(
  candidateAvail: AvailabilityStatus,
  targetAvail: AvailabilityStatus,
): [number, string[]] {
  let score = 0;
  const reasons: string[] = [];

  if (candidateAvail === "available" || candidateAvail === "looking_for_team") {
    score += 2;
    reasons.push("Available to collaborate");
  }
  if (targetAvail === "available" || targetAvail === "looking_for_team") {
    score += 1;
  }
  if (candidateAvail === "looking_for_team" && targetAvail === "available") {
    score += 2;
    reasons.push("Great timing — both looking to connect");
  }

  return [score, reasons];
}

/**
 * Score language overlap.
 */
export function scoreLanguages(
  candidateLangs: string[],
  targetLangs: string[],
): [number, string[]] {
  const targetSet = new Set(targetLangs.map((l) => l.toLowerCase()));
  const overlap = candidateLangs.filter((l) => targetSet.has(l.toLowerCase()));
  if (overlap.length > 0) {
    return [overlap.length, [`Speaks ${overlap.join(",")}`]];
  }
  return [0, []];
}

/**
 * Full match score between two users.
 */
export function computeMatchScore(params: {
  candidateTeach: SkillMeta[];
  candidateLearn: SkillMeta[];
  candidateAvail: AvailabilityStatus;
  candidateLangs: string[];
  targetLearnIds: Set<string>;
  targetTeachIds: Set<string>;
  targetAvail: AvailabilityStatus;
  targetLangs: string[];
}): { score: number; reasons: string[] } {
  const [skillScore, skillReasons] = scoreSkillMatch(params.candidateTeach, params.targetLearnIds);
  const [reverseScore, reverseReasons] = scoreReverseMatch(
    params.candidateLearn,
    params.targetTeachIds,
  );
  const [availScore, availReasons] = scoreAvailability(params.candidateAvail, params.targetAvail);
  const [langScore, langReasons] = scoreLanguages(params.candidateLangs, params.targetLangs);

  return {
    score: skillScore * 3 + reverseScore * 2 + availScore + langScore,
    reasons: [...skillReasons, ...reverseReasons, ...availReasons, ...langReasons],
  };
}

/**
 * Score a project's relevance to a user based on skill overlap and collab flags.
 */
export function scoreProjectMatch(params: {
  projectSkillIds: string[];
  userLearnIds: Set<string>;
  userTeachIds: Set<string>;
  lookingForCollaborators: boolean;
  lookingForFeedback: boolean;
}): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  for (const sid of params.projectSkillIds) {
    if (params.userLearnIds.has(sid)) {
      score += 3;
      reasons.push("Matches your learning goals");
    }
    if (params.userTeachIds.has(sid)) {
      score += 1;
      reasons.push("Uses your skills");
    }
  }

  if (params.lookingForCollaborators) {
    score += 2;
    reasons.push("Looking for collaborators");
  }
  if (params.lookingForFeedback) {
    score += 1;
    reasons.push("Looking for feedback");
  }

  return { score, reasons: [...new Set(reasons)].slice(0, 3) };
}
