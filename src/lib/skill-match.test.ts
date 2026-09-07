import { describe, it, expect } from "vitest";
import {
  scoreSkillMatch,
  scoreReverseMatch,
  scoreAvailability,
  scoreLanguages,
  computeMatchScore,
  scoreProjectMatch,
  type SkillMeta,
} from "./skill-match";

function teach(id: string, name: string, overrides: Partial<SkillMeta> = {}): SkillMeta {
  return { skill_id: id, name, category: "web", ...overrides };
}

describe("scoreSkillMatch", () => {
  it("scores verified + expert teachers highest", () => {
    const candidate = [
      teach("s1", "React", {
        verification_level: "proof_certified",
        experience_level: "expert",
      }),
    ];
    const [score, reasons] = scoreSkillMatch(candidate, new Set(["s1"]));
    expect(score).toBe(6); // 2 (proof_certified) + 4 (expert)
    expect(reasons).toEqual(["Teaches React"]);
  });

  it("defaults unknown levels to self_declared + beginner", () => {
    const candidate = [teach("s1", "React")];
    const [score] = scoreSkillMatch(candidate, new Set(["s1"]));
    expect(score).toBe(2); // 1 (self_declared) + 1 (beginner)
  });

  it("ignores skills the target is not learning", () => {
    const candidate = [teach("s1", "React"), teach("s2", "Go")];
    const [score, reasons] = scoreSkillMatch(candidate, new Set(["s2"]));
    expect(score).toBe(2);
    expect(reasons).toEqual(["Teaches Go"]);
  });

  it("returns zero with no overlap", () => {
    expect(scoreSkillMatch([teach("s1", "React")], new Set())).toEqual([0, []]);
  });
});

describe("scoreReverseMatch", () => {
  it("credits each shared learn skill", () => {
    const candidate = [
      { skill_id: "s1", name: "Go", category: "backend" },
      { skill_id: "s2", name: "SQL", category: "backend" },
    ];
    const [score, reasons] = scoreReverseMatch(candidate, new Set(["s2"]));
    expect(score).toBe(1);
    expect(reasons).toEqual(["Wants to learn SQL"]);
  });
});

describe("scoreAvailability", () => {
  it("rewards an available candidate", () => {
    const [score, reasons] = scoreAvailability("available", "busy");
    expect(score).toBe(2);
    expect(reasons).toEqual(["Available to collaborate"]);
  });

  it("rewards both being available", () => {
    const [score] = scoreAvailability("available", "available");
    expect(score).toBe(3);
  });

  it("detects great timing for lookers + available targets", () => {
    const [score, reasons] = scoreAvailability("looking_for_team", "available");
    expect(score).toBe(5); // 2 + 1 + 2
    expect(reasons).toContain("Great timing — both looking to connect");
  });

  it("scores nothing when neither is available", () => {
    expect(scoreAvailability("busy", "mentoring")).toEqual([0, []]);
  });
});

describe("scoreLanguages", () => {
  it("matches languages case-insensitively", () => {
    const [score, reasons] = scoreLanguages(["English", "French"], ["english"]);
    expect(score).toBe(1);
    expect(reasons).toEqual(["Speaks English"]);
  });

  it("returns zero when nothing overlaps", () => {
    expect(scoreLanguages(["English"], ["Spanish"])).toEqual([0, []]);
  });
});

describe("computeMatchScore", () => {
  it("aggregates weighted sub-scores with ordered reasons", () => {
    const result = computeMatchScore({
      candidateTeach: [
        teach("s1", "React", {
          verification_level: "proof_certified",
          experience_level: "expert",
        }),
      ],
      candidateLearn: [{ skill_id: "s2", name: "Go", category: "backend" }],
      candidateAvail: "available",
      candidateLangs: ["English", "French"],
      targetLearnIds: new Set(["s1"]),
      targetTeachIds: new Set(["s2"]),
      targetAvail: "available",
      targetLangs: ["english"],
    });
    expect(result.score).toBe(24); // 6*3 + 1*2 + 3 + 1
    expect(result.reasons).toEqual([
      "Teaches React",
      "Wants to learn Go",
      "Available to collaborate",
      "Speaks English",
    ]);
  });
});

describe("scoreProjectMatch", () => {
  it("scores learning overlap highest and dedupes reasons", () => {
    const result = scoreProjectMatch({
      projectSkillIds: ["s1", "s2", "s3"],
      userLearnIds: new Set(["s1"]),
      userTeachIds: new Set(["s2"]),
      lookingForCollaborators: true,
      lookingForFeedback: true,
    });
    expect(result.score).toBe(7); // 3 + 1 + 2 + 1
    expect(result.reasons).toEqual([
      "Matches your learning goals",
      "Uses your skills",
      "Looking for collaborators",
    ]);
  });

  it("caps reasons at three", () => {
    const result = scoreProjectMatch({
      projectSkillIds: ["a", "b", "c", "d"],
      userLearnIds: new Set(["a", "b", "c", "d"]),
      userTeachIds: new Set(),
      lookingForCollaborators: true,
      lookingForFeedback: true,
    });
    expect(result.reasons).toHaveLength(3);
  });
});
