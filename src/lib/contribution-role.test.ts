// The role verb is shared vocabulary, not presentation: the same fact ("they
// built it" / "they contributed to it") is spoken by the profile-projects
// block, the public profile fallback, and eventually the credits roll. If one
// surface re-derives its own map they drift, and a person's record of what
// they built starts contradicting itself.

import { describe, it, expect } from "vitest";
import {
  contributionRoleVerb,
  contributionRoleNoun,
  CONTRIBUTION_ROLE_VERB,
  CONTRIBUTION_ROLE_NOUN,
} from "./contribution-role";

describe("contributionRoleVerb", () => {
  it("phases every known role as an action the person took", () => {
    expect(contributionRoleVerb("creator")).toBe("Built");
    expect(contributionRoleVerb("mentor")).toBe("Mentored");
    expect(contributionRoleVerb("contributor")).toBe("Contributed to");
  });

  it("never renders the bare noun 'Creator', which reads as a job title", () => {
    // The whole point of the verb form: Tethyr claims identity comes from work
    // rather than self-reported labels, and a title is a self-reported label.
    for (const role of ["creator", "mentor", "contributor"]) {
      expect(contributionRoleVerb(role)).not.toBe(CONTRIBUTION_ROLE_NOUN[role as "creator"]);
    }
  });

  it("falls back to the raw role for a value the map has never seen", () => {
    // Roles are stored as free text; a seeded or imported project can carry one
    // this map has never seen. Rendering it beats rendering nothing.
    expect(contributionRoleVerb("advisor")).toBe("advisor");
  });

  it("stays readable when the role is missing entirely", () => {
    expect(contributionRoleVerb(null)).toBe("Worked on");
    expect(contributionRoleVerb(undefined)).toBe("Worked on");
    expect(contributionRoleVerb("")).toBe("Worked on");
  });

  it("keeps the verb and noun maps in one-to-one correspondence", () => {
    expect(Object.keys(CONTRIBUTION_ROLE_VERB).sort()).toEqual(
      Object.keys(CONTRIBUTION_ROLE_NOUN).sort(),
    );
  });
});

describe("contributionRoleNoun", () => {
  it("uses the noun form for every known role", () => {
    expect(contributionRoleNoun("creator")).toBe("Creator");
    expect(contributionRoleNoun("mentor")).toBe("Mentor");
    expect(contributionRoleNoun("contributor")).toBe("Contributor");
  });

  it("falls back to the raw role for unknown values, never undefined", () => {
    expect(contributionRoleNoun("advisor")).toBe("advisor");
  });

  it("still names a person when the role is missing entirely", () => {
    expect(contributionRoleNoun(null)).toBe("Contributor");
    expect(contributionRoleNoun(undefined)).toBe("Contributor");
    expect(contributionRoleNoun("")).toBe("Contributor");
  });
});
