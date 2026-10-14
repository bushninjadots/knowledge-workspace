// Who can see a project (projects.visibility, 20261014200000).
export type ProjectAccess = "public" | "private" | "crew" | "people";

export const PROJECT_ACCESS: {
  value: ProjectAccess;
  label: string;
  short: string;
  help: string;
}[] = [
  {
    value: "public",
    label: "Public",
    short: "Public",
    help: "Anyone can find it — it shows in Explore and on your profile.",
  },
  {
    value: "crew",
    label: "Crew only",
    short: "Crew",
    help: "Members of the crews this project belongs to, plus contributors.",
  },
  {
    value: "people",
    label: "Selected people",
    short: "Shared",
    help: "Only the people you pick, plus contributors.",
  },
  {
    value: "private",
    label: "Private",
    short: "Private",
    help: "Only you and the project's contributors.",
  },
];

export function accessMeta(value: string | null | undefined) {
  return PROJECT_ACCESS.find((a) => a.value === value) ?? PROJECT_ACCESS[0];
}
