import React from 'react';
import {
  BadgeCheck,
  Clock,
  Globe,
  Link2,
  MapPin,
  Sparkles,
  Target } from
'lucide-react';
import { activity, profile, skills } from '../../data/profile';
import { openNeeds, projects, projectsByFilter } from '../../data/projects';
import type { BlockProps } from '../../types/studio';
import { Avatar, Chip, EmptyHint, Panel, Rule } from '../common/Primitives';
import { ProjectShelf } from '../project/ProjectPresentations';
import { cx, dayMonth, roleLabel, shortDate } from '../../utils/format';

/* -------------------------------------------------------------------------- */
/* Identity — banner, avatar, who I am at a glance                            */
/* -------------------------------------------------------------------------- */

export function ProfileHeaderBlock() {
  return (
    <Panel bare flush className="overflow-hidden border border-[var(--card-border-color)] bg-[var(--surface-elevated)]">
      <div className="relative h-full">
        <div className="relative h-[38%] min-h-[92px] overflow-hidden border-b border-border">
          <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
          <span className="absolute bottom-1.5 right-2 font-mono text-3xs uppercase tracking-widest text-white/70">
            {profile.banner_caption}
          </span>
        </div>
        <div className="flex flex-wrap items-start gap-4 p-[var(--studio-pad)]">
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            className="h-16 w-16 shrink-0 border border-border object-cover"
            style={{ borderRadius: 'var(--studio-radius)' }} />
          
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="t-heading text-[20px] font-semibold leading-none text-foreground">
                {profile.display_name}
              </h1>
              <span className="font-mono text-xs text-muted-foreground">@{profile.handle}</span>
              <Chip token="trust" title="Verified by community recognition">
                <BadgeCheck className="h-3 w-3" aria-hidden /> {profile.reputation_score}
              </Chip>
            </div>
            <p className="text-[13px] text-foreground">{profile.creator_title}</p>
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-2xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" aria-hidden />
                <dt className="sr-only">Location</dt>
                <dd>{profile.country}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3" aria-hidden />
                <dt className="sr-only">Timezone</dt>
                <dd>{profile.timezone}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" aria-hidden />
                <dt className="sr-only">Availability</dt>
                <dd className="text-foreground">{profile.availability}</dd>
              </div>
            </dl>
          </div>
          <div className="flex shrink-0 items-center gap-4 border-l border-border pl-4">
            <Stat label="Building" value={projectsByFilter('building').length} />
            <Stat label="Contributing" value={projectsByFilter('contributing').length} />
            <Stat label="Created" value={projectsByFilter('created').length} />
          </div>
        </div>
      </div>
    </Panel>);

}

function Stat({ label, value }: {label: string;value: number | string;}) {
  return (
    <div>
      <p className="t-heading text-[18px] font-semibold leading-none text-foreground">{value}</p>
      <p className="t-label mt-1">{label}</p>
    </div>);

}

export function ProfileBioBlock({ props }: {props: BlockProps;}) {
  return (
    <Panel title={props.title ?? 'Who I am'} scroll>
      <p className="text-[13px] leading-relaxed text-muted-foreground" style={{ maxWidth: 'var(--studio-measure)' }}>
        {profile.bio}
      </p>
      <Rule className="my-3" />
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <MetaRow label="Practice" value={profile.category} />
        <MetaRow label="Years" value={`${profile.years_experience}`} />
        <MetaRow label="Languages" value={profile.languages.join(', ')} />
        <MetaRow label="Teaching" value={profile.teaching_style} />
      </dl>
    </Panel>);

}

function MetaRow({ label, value }: {label: string;value: string;}) {
  return (
    <div className="min-w-0">
      <dt className="t-label">{label}</dt>
      <dd className="truncate text-xs text-foreground" title={value}>
        {value}
      </dd>
    </div>);

}

/* -------------------------------------------------------------------------- */
/* Direction — what I'm looking for                                           */
/* -------------------------------------------------------------------------- */

export function ProfileDirectionBlock({ props }: {props: BlockProps;}) {
  return (
    <Panel title={props.title ?? 'What I’m looking for'} scroll>
      <p className="t-heading mb-3 text-[15px] font-medium leading-snug text-foreground">
        {profile.direction.headline}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="t-label mb-1.5 flex items-center gap-1.5">
            <Target className="h-3 w-3" aria-hidden /> Seeking
          </p>
          <ul className="space-y-1">
            {profile.direction.seeking.map((item) =>
            <li key={item} className="border-l-2 pl-2 text-xs leading-relaxed text-foreground" style={{ borderColor: 'var(--user-accent)' }}>
                {item}
              </li>
            )}
          </ul>
        </div>
        <div>
          <p className="t-label mb-1.5 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" aria-hidden /> Offering
          </p>
          <ul className="space-y-1">
            {profile.direction.offering.map((item) =>
            <li key={item} className="border-l-2 border-border pl-2 text-xs leading-relaxed text-muted-foreground">
                {item}
              </li>
            )}
          </ul>
        </div>
      </div>
    </Panel>);

}

/* -------------------------------------------------------------------------- */
/* Project shelf — the spine                                                  */
/* -------------------------------------------------------------------------- */

const FILTER_LABEL = {
  building: 'Building now',
  contributing: 'Contributing to',
  created: 'Created',
  all: 'All projects'
} as const;

export function ProfileProjectsBlock({ props }: {props: BlockProps;}) {
  const filter = props.filter ?? 'building';
  const list = projectsByFilter(filter).slice(0, props.limit ?? 12);
  return (
    <Panel
      title={props.title ?? FILTER_LABEL[filter]}
      meta={`${list.length} ${list.length === 1 ? 'project' : 'projects'}`}
      scroll>
      
      <ProjectShelf
        projects={list}
        presentation={props.presentation ?? 'minimal-list'}
        showSignals={props.showSignals ?? true} />
      
    </Panel>);

}

/* -------------------------------------------------------------------------- */
/* Ways to contribute — open needs and roles across projects                  */
/* -------------------------------------------------------------------------- */

const NEED_TOKEN = {
  skill: 'accent',
  feedback: 'learning',
  resource: 'teaching',
  introduction: 'ai'
} as const;

export function ProfileNeedsBlock({ props }: {props: BlockProps;}) {
  const openRoles = projects.flatMap((project) =>
  project.roles.filter((role) => role.status === 'open').map((role) => ({ role, project }))
  );
  return (
    <Panel title={props.title ?? 'Ways to contribute'} meta={`${openNeeds.length + openRoles.length} open`} scroll>
      {openNeeds.length === 0 && openRoles.length === 0 ?
      <EmptyHint>Nothing open right now.</EmptyHint> :

      <ul className="divide-y divide-border">
          {openRoles.map(({ role, project }) =>
        <li key={role.id} className="space-y-1 py-2 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-foreground">{role.title}</p>
                <Chip token="accent">Role</Chip>
              </div>
              <p className="font-mono text-2xs text-muted-foreground">
                {project.title} · {role.skills.join(', ')}
              </p>
            </li>
        )}
          {openNeeds.map(({ need, project }) =>
        <li key={need.id} className="space-y-1 py-2 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] text-foreground">{need.title}</p>
                <Chip token={NEED_TOKEN[need.kind]}>{need.kind}</Chip>
              </div>
              <p className="font-mono text-2xs text-muted-foreground">
                {project.title}
                {need.time_shape ? ` · ${need.time_shape}` : ''}
              </p>
            </li>
        )}
        </ul>
      }
    </Panel>);

}

/* -------------------------------------------------------------------------- */
/* Credits roll                                                               */
/* -------------------------------------------------------------------------- */

export function ProfileCreditsBlock({ props }: {props: BlockProps;}) {
  const rows = projects.flatMap((project) =>
  project.credits.
  filter((credit) => credit.profile_id !== profile.id).
  map((credit) => ({ credit, project }))
  );
  return (
    <Panel title={props.title ?? 'Built with'} meta={`${rows.length} people`} scroll>
      <ul className="divide-y divide-border">
        {rows.map(({ credit, project }) =>
        <li key={`${project.id}-${credit.profile_id}`} className="flex items-start gap-2.5 py-2 first:pt-0">
            <Avatar name={credit.display_name} size={22} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-medium text-foreground">{credit.display_name}</span>
                <span className="font-mono text-2xs text-muted-foreground-subtle">
                  {roleLabel[credit.role]} · {project.title}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{credit.credit_text}</p>
            </div>
            <span className="shrink-0 font-mono text-2xs text-muted-foreground-subtle">{shortDate(credit.at)}</span>
          </li>
        )}
      </ul>
    </Panel>);

}

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

const ACTIVITY_TOKEN = {
  update: 'learning',
  need_filled: 'trust',
  discussion: 'ai',
  milestone: 'trust',
  credit: 'accent',
  contributor_joined: 'teaching'
} as const;

export function ProfileActivityBlock({ props }: {props: BlockProps;}) {
  return (
    <Panel title={props.title ?? 'Recent signals'} scroll>
      <ol className="space-y-2.5">
        {activity.map((item) =>
        <li key={item.id} className="flex gap-2.5">
            <span className="mt-1 shrink-0 font-mono text-2xs text-muted-foreground-subtle">{dayMonth(item.at)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs leading-relaxed text-foreground">{item.title}</span>
              <span className="mt-1 inline-flex items-center gap-1.5">
                <Chip token={ACTIVITY_TOKEN[item.kind]}>{item.project}</Chip>
              </span>
            </span>
          </li>
        )}
      </ol>
    </Panel>);

}

/* -------------------------------------------------------------------------- */
/* Skills / tools / links / evidence — deliberately quieter than projects     */
/* -------------------------------------------------------------------------- */

const EXPERIENCE_WIDTH = { beginner: 25, intermediate: 50, advanced: 75, expert: 100 } as const;

export function ProfileSkillsBlock({ props }: {props: BlockProps;}) {
  return (
    <Panel title={props.title ?? 'Skills'} scroll>
      <ul className="space-y-2">
        {skills.map((skill) =>
        <li key={skill.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-foreground">{skill.name}</span>
              <span className="font-mono text-2xs text-muted-foreground-subtle">{skill.experience}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 flex-1 bg-[var(--surface-sunken)]">
                <div
                className="h-full"
                style={{
                  width: `${EXPERIENCE_WIDTH[skill.experience]}%`,
                  backgroundColor:
                  skill.verification === 'self_declared' ? 'var(--muted-foreground)' : 'var(--user-accent)'
                }} />
              
              </div>
              {skill.verification !== 'self_declared' &&
            <BadgeCheck
              className="h-3 w-3 shrink-0"
              style={{ color: skill.verification === 'proof_certified' ? 'var(--trust)' : 'var(--learning)' }}
              aria-label={skill.verification.replace('_', ' ')} />

            }
            </div>
          </li>
        )}
      </ul>
    </Panel>);

}

export function ProfileToolsBlock({ props }: {props: BlockProps;}) {
  return (
    <Panel title={props.title ?? 'Tools & stack'} scroll>
      <p className="t-label mb-1.5">Stack</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {profile.software_stack.map((tool) =>
        <Chip key={tool}>{tool}</Chip>
        )}
      </div>
      <p className="t-label mb-1.5">Software</p>
      <div className="flex flex-wrap gap-1">
        {profile.favourite_tools.map((tool) =>
        <span key={tool} className="font-mono text-2xs text-muted-foreground">
            {tool}
          </span>
        )}
      </div>
    </Panel>);

}

export function ProfileLinksBlock({ props }: {props: BlockProps;}) {
  return (
    <Panel title={props.title ?? 'Links'} scroll>
      <ul className="divide-y divide-border">
        {profile.portfolio_links.map((link) =>
        <li key={link.url}>
            <a
            href={`https://${link.url}`}
            className="t-focus flex items-center gap-2 py-2 text-xs text-foreground hover:text-[var(--user-accent)]">
            
              <Link2 className="h-3 w-3 shrink-0 text-muted-foreground-subtle" aria-hidden />
              <span className="truncate">{link.label}</span>
            </a>
          </li>
        )}
        {Object.entries(profile.social_links).map(([key, value]) =>
        <li key={key} className="flex items-baseline justify-between gap-2 py-2">
            <span className="t-label">{key}</span>
            <span className="truncate font-mono text-2xs text-muted-foreground">{value}</span>
          </li>
        )}
      </ul>
    </Panel>);

}

export function ProfileAchievementsBlock({ props }: {props: BlockProps;}) {
  return (
    <Panel title={props.title ?? 'Evidence shelf'} scroll>
      <p className="mb-3 border-l-2 pl-2.5 text-xs leading-relaxed text-foreground" style={{ borderColor: 'var(--trust)' }}>
        {profile.favorite_achievement}
      </p>
      <ul className="divide-y divide-border">
        {profile.evidence_shelf.map((item) =>
        <li key={item.title} className="flex items-start justify-between gap-2 py-2">
            <span className="min-w-0">
              <span className="block truncate text-xs text-foreground">{item.title}</span>
              {item.note && <span className="block text-2xs text-muted-foreground-subtle">{item.note}</span>}
            </span>
            {item.kind && <Chip>{item.kind}</Chip>}
          </li>
        )}
      </ul>
    </Panel>);

}

export function ProfileGalleryBlock({ props }: {props: BlockProps;}) {
  const images = projects.flatMap((project) =>
  project.gallery.map((item) => ({ ...item, project: project.title }))
  );
  return (
    <Panel title={props.title ?? 'Gallery'} meta={`${images.length} images`} scroll>
      {images.length === 0 ?
      <EmptyHint>Add images to your projects and they will appear here.</EmptyHint> :

      <div className={cx('grid gap-[var(--studio-gap)]', images.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
          {images.map((image) =>
        <figure key={image.url} className="space-y-1.5">
              <div className="aspect-[3/2] overflow-hidden border border-border" style={{ borderRadius: 'var(--studio-radius)' }}>
                <img src={image.url} alt={image.caption ?? image.project} className="h-full w-full object-cover" />
              </div>
              <figcaption className="font-mono text-2xs text-muted-foreground-subtle">
                {image.project}
                {image.caption ? ` · ${image.caption}` : ''}
              </figcaption>
            </figure>
        )}
        </div>
      }
    </Panel>);

}