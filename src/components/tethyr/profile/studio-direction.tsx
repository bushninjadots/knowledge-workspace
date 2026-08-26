import { Compass, Hammer, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type StudioDirectionProject = {
  id: string;
  title: string;
  status?: string | null;
};

type Props = {
  projects: StudioDirectionProject[];
  learningGoals?: string | null;
  availability?: string | null;
  canEdit?: boolean;
};

const AVAILABILITY_LABEL: Record<string, string> = {
  available: "Open to collaboration",
  busy: "Focused on current work",
  away: "Taking a step back",
};

export function StudioDirection({ projects, learningGoals, availability, canEdit = false }: Props) {
  const currentProject = projects.find((project) =>
    ["active", "planning"].includes(project.status ?? ""),
  );
  const availabilityLabel = availability
    ? (AVAILABILITY_LABEL[availability] ?? availability)
    : null;

  return (
    <section
      aria-labelledby="studio-direction-heading"
      className="border-l-2 border-[var(--user-accent-border,var(--primary))] bg-surface-elevated/20 px-4 py-4 sm:px-5"
    >
      <div>
        <p className="section-label">Direction</p>
        <h2 id="studio-direction-heading" className="mt-1 font-display text-lg font-semibold">
          {canEdit ? "What you're moving toward" : "What this person is moving toward"}
        </h2>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <DirectionItem
          icon={<Hammer className="h-3.5 w-3.5" />}
          label="Building now"
          value={
            currentProject?.title ??
            (canEdit ? "Choose a project to lead your Studio." : "No active project pinned yet.")
          }
          projectId={currentProject?.id}
        />
        <DirectionItem
          icon={<Users className="h-3.5 w-3.5" />}
          label="Open to"
          value={
            availabilityLabel ??
            (canEdit
              ? "Set your availability so people know how to approach you."
              : "No availability shared yet.")
          }
        />
        <DirectionItem
          icon={<Compass className="h-3.5 w-3.5" />}
          label="Growing toward"
          value={
            learningGoals ??
            (canEdit
              ? "Add a learning direction to make your next step visible."
              : "No learning direction shared yet.")
          }
        />
      </div>
    </section>
  );
}

function DirectionItem({
  icon,
  label,
  value,
  projectId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  projectId?: string;
}) {
  const content = (
    <>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-foreground/85">{value}</p>
    </>
  );

  return projectId ? (
    <Link
      to="/projects/$id"
      params={{ id: projectId }}
      className="block rounded-md transition hover:text-primary"
    >
      {content}
    </Link>
  ) : (
    <div>{content}</div>
  );
}
