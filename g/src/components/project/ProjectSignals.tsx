import React from 'react';
import { GitBranch, Handshake, MessageSquare, Users } from 'lucide-react';
import type { ProjectDetail } from '../../types/tethyr';
import { Chip, Meter, AvatarStack } from '../common/Primitives';
import { roleLabel, shortDate, stageLabel, statusToken } from '../../utils/format';

/** Status + stage + season — the project's live state, from the data model. */
export function StatusSignals({ project, compact }: {project: ProjectDetail;compact?: boolean;}) {
  const status = statusToken[project.status];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip token={status.token} dot>
        {status.label}
      </Chip>
      <Chip>{stageLabel[project.stage]}</Chip>
      {!compact && project.season && <Chip>{project.season}</Chip>}
    </div>);

}

/** What the Studio owner does on this project. */
export function RoleSignal({ project }: {project: ProjectDetail;}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider text-muted-foreground">
      <GitBranch className="h-3 w-3" aria-hidden />
      {roleLabel[project.my_role]}
      {project.relation === 'contributing' && project.owner &&
      <>
          <span className="text-muted-foreground-subtle">on</span>
          <span className="text-foreground">{project.owner.display_name}’s project</span>
        </>
      }
    </span>);

}

export function ProgressSignal({ project }: {project: ProjectDetail;}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between font-mono text-2xs text-muted-foreground">
        <span>Progress</span>
        <span className="text-foreground">{project.progress_percent}%</span>
      </div>
      <Meter value={project.progress_percent} token={project.status === 'completed' ? 'trust' : 'accent'} />
    </div>);

}

export function CollaboratorSignal({ project }: {project: ProjectDetail;}) {
  if (project.collaborators.length === 0) {
    return <span className="font-mono text-2xs text-muted-foreground-subtle">Solo so far</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <Users className="h-3 w-3 text-muted-foreground" aria-hidden />
      <AvatarStack people={project.collaborators} />
      <span className="font-mono text-2xs text-muted-foreground">
        {project.collaborators.length} {project.collaborators.length === 1 ? 'collaborator' : 'collaborators'}
      </span>
    </span>);

}

/** Opportunities to contribute — the entry point into the collaboration loop. */
export function OpportunitySignal({ project }: {project: ProjectDetail;}) {
  const openRoles = project.roles.filter((r) => r.status === 'open');
  const openNeeds = project.needs.filter((n) => n.status === 'open');
  if (!project.looking_for_collaborators && !project.looking_for_feedback && openRoles.length === 0 && openNeeds.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {openRoles.map((role) =>
      <Chip key={role.id} token="accent">
          <Handshake className="h-3 w-3" aria-hidden /> {role.title}
        </Chip>
      )}
      {project.looking_for_feedback &&
      <Chip token="learning">
          <MessageSquare className="h-3 w-3" aria-hidden /> Wants feedback
        </Chip>
      }
      {openNeeds.length > 0 &&
      <Chip token="teaching">
          {openNeeds.length} open {openNeeds.length === 1 ? 'need' : 'needs'}
        </Chip>
      }
    </div>);

}

export function ContributionSignal({ project }: {project: ProjectDetail;}) {
  if (!project.my_contribution) return null;
  return (
    <p className="border-l-2 pl-2.5 text-xs leading-relaxed text-muted-foreground" style={{ borderColor: 'var(--user-accent-border)' }}>
      {project.my_contribution}
    </p>);

}

export function CreditSignal({ project }: {project: ProjectDetail;}) {
  const total = project.credits.reduce((acc, credit) => acc + credit.credit_count, 0);
  return (
    <span className="font-mono text-2xs text-muted-foreground">
      {project.credits.length} credited · {total} events · since {shortDate(project.started_at)}
    </span>);

}

export function TagRow({ items, max = 4 }: {items: string[];max?: number;}) {
  const shown = items.slice(0, max);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((item) =>
      <span key={item} className="font-mono text-2xs text-muted-foreground-subtle">
          {item}
        </span>
      )}
      {items.length > shown.length &&
      <span className="font-mono text-2xs text-muted-foreground-subtle">+{items.length - shown.length}</span>
      }
    </div>);

}