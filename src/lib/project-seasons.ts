import type { ProjectSeason } from "@/hooks/use-projects";

export type SeasonMeta = { id: ProjectSeason; label: string; description: string };

export const SEASONS: SeasonMeta[] = [
  { id: "research", label: "Research", description: "Understanding the problem and people." },
  { id: "prototype", label: "Prototype", description: "Making the first shape of the work." },
  { id: "feedback", label: "Feedback", description: "Learning from people around the work." },
  { id: "launch", label: "Launch", description: "Putting the work in front of people." },
  { id: "building", label: "Building", description: "Steady progress on the next version." },
];

const BUILDING = SEASONS.find((item) => item.id === "building")!;

export function getSeasonMeta(season: ProjectSeason | null | undefined): SeasonMeta {
  return SEASONS.find((item) => item.id === (season ?? "building")) ?? BUILDING;
}
