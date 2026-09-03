import React from 'react';
import { ArrowUpRight, Circle, CircleCheck, CircleDot } from 'lucide-react';
import type { MilestoneRow, ProjectDetail } from '../../types/tethyr';
import type { ProjectPresentation } from '../../types/studio';
import { Chip, EmptyHint, Rule } from '../common/Primitives';
import {
  CollaboratorSignal,
  ContributionSignal,
  CreditSignal,
  OpportunitySignal,
  ProgressSignal,
  RoleSignal,
  StatusSignals,
  TagRow } from
'./ProjectSignals';
import { cx, shortDate } from '../../utils/format';

function MilestoneLine({ milestone }: {milestone: MilestoneRow;}) {
  const Icon = milestone.status === 'done' ? CircleCheck : milestone.status === 'in_progress' ? CircleDot : Circle;
  const color =
  milestone.status === 'done' ?
  'var(--trust)' :
  milestone.status === 'in_progress' ?
  'var(--user-accent)' :
  'var(--muted-foreground-subtle)';
  return (
    <li className="flex items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} aria-hidden />
      <span className={cx('truncate', milestone.status === 'done' ? 'text-muted-foreground' : 'text-foreground')}>
        {milestone.title}
      </span>
      {milestone.due_date &&
      <span className="ml-auto shrink-0 font-mono text-2xs text-muted-foreground-subtle">
          {shortDate(milestone.due_date)}
        </span>
      }
    </li>);

}

function ProjectTitle({ project, as = 'h3', size = 'md' }: {project: ProjectDetail;as?: 'h3' | 'h4';size?: 'lg' | 'md' | 'sm';}) {
  const Tag = as;
  return (
    <Tag
      className={cx(
        't-heading font-semibold text-foreground',
        size === 'lg' ? 'text-[22px] leading-tight' : size === 'md' ? 'text-[15px]' : 'text-[13px]'
      )}>
      
      <span className="group/link inline-flex items-baseline gap-1">
        {project.title}
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-muted-foreground-subtle transition-colors duration-140 group-hover/link:text-[var(--user-accent)]" aria-hidden />
      </span>
    </Tag>);

}

/* -------------------------------------------------------------------------- */
/* Spotlight — one project carries the section, the rest queue beneath.       */
/* -------------------------------------------------------------------------- */

function Spotlight({ projects }: {projects: ProjectDetail[];}) {
  const [lead, ...rest] = projects;
  if (!lead) return <EmptyHint>No projects on this shelf yet.</EmptyHint>;
  return (
    <div className="flex h-full min-h-0 flex-col gap-[var(--studio-gap)]">
      <article className="grid min-h-0 flex-1 gap-[var(--studio-gap)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {lead.cover_url ?
        <div className="relative min-h-[160px] overflow-hidden border border-border bg-[var(--surface-sunken)]" style={{ borderRadius: 'var(--studio-radius)' }}>
            <img src={lead.cover_url} alt={`${lead.title} cover`} className="h-full w-full object-cover" />
          </div> :

        <div
          className="flex min-h-[160px] items-center justify-center border border-dashed border-border bg-[var(--surface-sunken)] font-mono text-2xs uppercase tracking-widest text-muted-foreground-subtle"
          style={{ borderRadius: 'var(--studio-radius)' }}>
          
            {lead.stage}
          </div>
        }

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusSignals project={lead} />
            <RoleSignal project={lead} />
          </div>
          <div className="space-y-1.5">
            <ProjectTitle project={lead} size="lg" />
            {lead.description &&
            <p className="text-[13px] leading-relaxed text-muted-foreground" style={{ maxWidth: 'var(--studio-measure)' }}>
                {lead.description}
              </p>
            }
          </div>
          {lead.goal &&
          <p className="font-mono text-2xs uppercase tracking-wider text-muted-foreground-subtle">
              Goal · <span className="normal-case tracking-normal text-muted-foreground">{lead.goal}</span>
            </p>
          }
          <ProgressSignal project={lead} />
          <ContributionSignal project={lead} />

          {lead.collaboration_brief?.need &&
          <div className="border-l-2 pl-3" style={{ borderColor: 'var(--user-accent)' }}>
              <p className="t-label mb-1">Open collaboration</p>
              <p className="text-[13px] font-medium text-foreground">{lead.collaboration_brief.need}</p>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                {[lead.collaboration_brief.contribution_shape, lead.collaboration_brief.time_shape].
              filter(Boolean).
              join(' · ')}
              </p>
            </div>
          }

          {lead.milestones.length > 0 &&
          <ul className="space-y-1">
              {lead.milestones.slice(0, 3).map((milestone) =>
            <MilestoneLine key={milestone.id} milestone={milestone} />
            )}
            </ul>
          }

          <div className="mt-auto space-y-2">
            <OpportunitySignal project={lead} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CollaboratorSignal project={lead} />
              <CreditSignal project={lead} />
            </div>
            <TagRow items={lead.tags} />
          </div>
        </div>
      </article>

      {rest.length > 0 &&
      <>
          <Rule />
          <ul className="shrink-0 divide-y divide-border">
            {rest.map((project) =>
          <li key={project.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <ProjectTitle project={project} as="h4" size="sm" />
                <StatusSignals project={project} compact />
                <span className="ml-auto flex items-center gap-3">
                  <OpportunitySignal project={project} />
                  <CollaboratorSignal project={project} />
                </span>
              </li>
          )}
          </ul>
        </>
      }
    </div>);

}

/* -------------------------------------------------------------------------- */
/* Minimal list — dense rows, GitHub repo-list register.                      */
/* -------------------------------------------------------------------------- */

function MinimalList({ projects, showSignals }: {projects: ProjectDetail[];showSignals: boolean;}) {
  if (projects.length === 0) return <EmptyHint>No projects on this shelf yet.</EmptyHint>;
  return (
    <ul className="divide-y divide-border">
      {projects.map((project) =>
      <li key={project.id} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <ProjectTitle project={project} />
            <StatusSignals project={project} compact />
            <span className="ml-auto font-mono text-2xs text-muted-foreground-subtle">
              {shortDate(project.updated_at)}
            </span>
          </div>
          {project.relation === 'contributing' && <RoleSignal project={project} />}
          {project.description &&
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground" style={{ maxWidth: 'var(--studio-measure)' }}>
              {project.description}
            </p>
        }
          <ContributionSignal project={project} />
          {showSignals &&
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <OpportunitySignal project={project} />
              <CollaboratorSignal project={project} />
            </div>
        }
        </li>
      )}
    </ul>);

}

/* -------------------------------------------------------------------------- */
/* Editorial grid — completed work, treated like a printed index.             */
/* -------------------------------------------------------------------------- */

function EditorialGrid({ projects, showSignals }: {projects: ProjectDetail[];showSignals: boolean;}) {
  if (projects.length === 0) return <EmptyHint>Nothing finished yet — that is allowed.</EmptyHint>;
  return (
    <div className="grid gap-[var(--studio-gap)] sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) =>
      <article key={project.id} className="flex flex-col gap-2.5">
          {project.cover_url ?
        <div className="aspect-[3/2] overflow-hidden border border-border" style={{ borderRadius: 'var(--studio-radius)' }}>
              <img src={project.cover_url} alt={`${project.title} cover`} className="h-full w-full object-cover" />
            </div> :

        <div
          className="flex aspect-[3/2] items-center justify-center border border-dashed border-border bg-[var(--surface-sunken)] font-mono text-2xs uppercase tracking-widest text-muted-foreground-subtle"
          style={{ borderRadius: 'var(--studio-radius)' }}>
          
              {project.title}
            </div>
        }
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <ProjectTitle project={project} />
              <Chip token={project.status === 'completed' ? 'trust' : 'neutral'}>{shortDate(project.updated_at)}</Chip>
            </div>
            {project.description &&
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{project.description}</p>
          }
            <TagRow items={project.tags} max={3} />
            {showSignals && <OpportunitySignal project={project} />}
          </div>
        </article>
      )}
    </div>);

}

/* -------------------------------------------------------------------------- */
/* Horizontal scroll — a restless shelf.                                      */
/* -------------------------------------------------------------------------- */

function HorizontalScroll({ projects }: {projects: ProjectDetail[];}) {
  if (projects.length === 0) return <EmptyHint>No projects on this shelf yet.</EmptyHint>;
  return (
    <div className="t-scroll -mx-[var(--studio-pad)] flex snap-x gap-[var(--studio-gap)] overflow-x-auto px-[var(--studio-pad)] pb-2">
      {projects.map((project) =>
      <article
        key={project.id}
        className="flex w-[260px] shrink-0 snap-start flex-col gap-2 border border-border p-3"
        style={{ borderRadius: 'var(--studio-radius)' }}>
        
          <StatusSignals project={project} compact />
          <ProjectTitle project={project} />
          {project.description &&
        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{project.description}</p>
        }
          <div className="mt-auto space-y-2 pt-1">
            <ProgressSignal project={project} />
            <CollaboratorSignal project={project} />
          </div>
        </article>
      )}
    </div>);

}

export function ProjectShelf({
  projects,
  presentation,
  showSignals = true




}: {projects: ProjectDetail[];presentation: ProjectPresentation;showSignals?: boolean;}) {
  if (presentation === 'spotlight') return <Spotlight projects={projects} />;
  if (presentation === 'editorial-grid') return <EditorialGrid projects={projects} showSignals={showSignals} />;
  if (presentation === 'horizontal-scroll') return <HorizontalScroll projects={projects} />;
  return <MinimalList projects={projects} showSignals={showSignals} />;
}