import type { Profile, ProfileSkill } from '../types/tethyr';

export const profile: Profile = {
  id: 'p_1',
  handle: 'ivomarchetti',
  display_name: 'Ivo Marchetti',
  creator_title: 'Interaction designer & tool-maker',
  bio: 'I build small, sharp tools for people who make things — mostly interfaces for messy work: timelines, telemetry, and the awkward middle of a project. Ten years split between product teams and my own workbench. I care about legibility over spectacle, and I ship in public so the work can be argued with.',
  avatar_url: "/5af94f21-1ab7-48b2-84a6-2a43ebd7369a.jpg",
  banner_url: "/3d40d788-cb26-4176-9656-3ceae7f0ad82.jpg",
  banner_caption: 'Plotter study for Meridian, 2026',
  country: 'Portugal',
  timezone: 'WET · UTC+0',
  languages: ['English', 'Portuguese', 'Italian'],
  category: 'Design engineering',
  years_experience: 10,
  portfolio_links: [
  { label: 'Workbench log', url: 'ivomarchetti.dev/log' },
  { label: 'Meridian docs', url: 'meridian.tools/docs' },
  { label: 'Reading list', url: 'ivomarchetti.dev/reading' }],

  social_links: {
    github: 'github.com/ivomarchetti',
    mastodon: '@ivo@merveilles.town',
    email: 'ivo@ivomarchetti.dev'
  },
  availability: 'Two days a week, from October',
  reputation_score: 412,
  favourite_tools: ['Figma', 'Zed', 'Rhino', 'Blender', 'Grasshopper', 'Ableton'],
  software_stack: ['TypeScript', 'React', 'Rust', 'Postgres', 'D3', 'WebGL'],
  favorite_achievement: 'Shipped Meridian’s timeline engine to 4,000 weekly users with a two-person team',
  learning_goals: ['Signal processing', 'Type design', 'Rust audio'],
  teaching_style: 'Pairing over lecturing — I would rather build the thing with you once.',
  evidence_shelf: [
  { project_id: 'pr_1', title: 'Meridian timeline engine', note: 'Shipped v2 — 4k weekly users', kind: 'shipped' },
  { project_id: 'pr_3', title: 'Field Notes on Tools, issue 02', note: 'Printed run of 300', kind: 'artifact' },
  { project_id: 'pr_4', title: 'Motion system talk, Lisbon', note: 'Reduced-motion in practice', kind: 'talk' }],

  direction: {
    headline: 'Looking for one hardware collaborator and a second pair of eyes on Meridian’s data model.',
    seeking: [
    'An embedded engineer for Halyard’s firmware',
    'Critique on Meridian’s event schema',
    'A print partner for Field Notes issue 03'],

    offering: [
    'Interface architecture reviews',
    'Pairing on React performance',
    'Mentoring one person per season']

  }
};

export const skills: ProfileSkill[] = [
{ id: 's1', name: 'Interface architecture', category: 'Design', verification: 'community_recognized', experience: 'expert' },
{ id: 's2', name: 'Design engineering', category: 'Engineering', verification: 'proof_certified', experience: 'expert' },
{ id: 's3', name: 'Data visualisation', category: 'Design', verification: 'proof_certified', experience: 'advanced' },
{ id: 's4', name: 'Motion & interaction', category: 'Design', verification: 'community_recognized', experience: 'advanced' },
{ id: 's5', name: 'Rust', category: 'Engineering', verification: 'self_declared', experience: 'intermediate' },
{ id: 's6', name: 'Type & editorial', category: 'Craft', verification: 'self_declared', experience: 'intermediate' },
{ id: 's7', name: 'Fabrication', category: 'Craft', verification: 'self_declared', experience: 'beginner' }];


export interface ActivitySignal {
  id: string;
  at: string;
  project: string;
  kind: 'update' | 'need_filled' | 'discussion' | 'milestone' | 'credit' | 'contributor_joined';
  title: string;
}

export const activity: ActivitySignal[] = [
{ id: 'a1', at: '2026-09-01', project: 'Meridian', kind: 'update', title: 'Posted update “Event schema, take three”' },
{ id: 'a2', at: '2026-08-28', project: 'Orbit Kit', kind: 'credit', title: 'Credited for the reduced-motion pass' },
{ id: 'a3', at: '2026-08-24', project: 'Halyard', kind: 'milestone', title: 'Completed milestone “Enclosure v3”' },
{ id: 'a4', at: '2026-08-19', project: 'Meridian', kind: 'contributor_joined', title: 'Nadia Okafor joined as a contributor' },
{ id: 'a5', at: '2026-08-11', project: 'Field Notes on Tools', kind: 'discussion', title: 'Started discussion: “Paper stock for issue 03”' }];