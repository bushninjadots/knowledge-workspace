import type { ProjectStatus, ProjectStage, CreditRole } from '../types/tethyr';

export function initials(name: string): string {
  return name.
  split(' ').
  filter(Boolean).
  slice(0, 2).
  map((part) => part[0]?.toUpperCase() ?? '').
  join('');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function dayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** The only colours allowed to carry meaning. */
export type SemanticToken =
'trust' |
'learning' |
'teaching' |
'ai' |
'warning' |
'caution' |
'accent' |
'neutral';

/** Semantic colour language: trust / learning / teaching / caution. */
export const statusToken: Record<ProjectStatus, {label: string;token: SemanticToken;}> = {
  planning: { label: 'Planning', token: 'ai' },
  active: { label: 'Active', token: 'learning' },
  paused: { label: 'Paused', token: 'caution' },
  completed: { label: 'Completed', token: 'trust' }
};

export const stageLabel: Record<ProjectStage, string> = {
  planning: 'Planning',
  building: 'Building',
  testing: 'Testing',
  launch: 'Launch',
  growing: 'Growing'
};

export const roleLabel: Record<CreditRole, string> = {
  creator: 'Creator',
  contributor: 'Contributor',
  mentor: 'Mentor'
};

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}