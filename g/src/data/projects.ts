import type { ProjectDetail } from '../types/tethyr';

const COVER_A = "/cbddbb6b-8d74-471e-be3d-dc02c80560b7.jpg";
const COVER_B = "/7cb986f0-cd52-4192-9aef-c19cf7c7c2c3.jpg";
const COVER_C = "/e7e1d284-695e-4809-be80-500d20202ab4.jpg";

export const projects: ProjectDetail[] = [
{
  id: 'pr_1',
  profile_id: 'p_1',
  title: 'Meridian',
  description:
  'A timeline and telemetry surface for teams whose work does not fit a kanban board. Events, sessions and artefacts on one shared spine.',
  goal: 'Make a week of messy work legible in one screen.',
  status: 'active',
  visibility: 'public',
  stage: 'building',
  season: 'prototype',
  started_at: '2025-11-04',
  updated_at: '2026-09-01',
  progress_percent: 62,
  cover_url: COVER_A,
  gallery: [{ url: COVER_A, caption: 'Timeline v2', type: 'image' }],
  tags: ['Developer tools', 'Data viz', 'Open source'],
  tools: ['TypeScript', 'React', 'Rust', 'Postgres'],
  looking_for_feedback: true,
  looking_for_collaborators: true,
  is_featured: true,
  collaboration_brief: {
    need: 'Someone to argue with me about the event schema',
    why_now: 'v2 locks the data model in six weeks',
    contribution_shape: 'Two review sessions and written notes',
    time_shape: '~4 hours, once'
  },
  milestones: [
  { id: 'm1', title: 'Event schema v2', status: 'in_progress', due_date: '2026-10-12' },
  { id: 'm2', title: 'Session replay', status: 'pending', due_date: '2026-11-02' },
  { id: 'm3', title: 'Timeline engine v2', status: 'done', due_date: '2026-08-01' }],

  credits: [
  { profile_id: 'p_1', display_name: 'Ivo Marchetti', handle: 'ivomarchetti', role: 'creator', credit_text: 'Created the project', at: '2025-11-04', credit_count: 24 },
  { profile_id: 'p_2', display_name: 'Nadia Okafor', handle: 'nadiao', role: 'contributor', credit_text: 'Built the query layer', at: '2026-08-19', credit_count: 7 },
  { profile_id: 'p_3', display_name: 'Théo Lambert', handle: 'theol', role: 'mentor', credit_text: 'Reviewed the storage model', at: '2026-06-02', credit_count: 3 }],

  roles: [
  { id: 'r1', title: 'Data modelling reviewer', status: 'open', skills: ['Postgres', 'Schema design'] },
  { id: 'r2', title: 'Query layer', status: 'filled', skills: ['Rust'], filled_by: { id: 'p_2', display_name: 'Nadia Okafor', handle: 'nadiao' } }],

  needs: [
  { id: 'n1', project_id: 'pr_1', title: 'Critique on the event schema', kind: 'feedback', status: 'open', time_shape: '~4h, once' },
  { id: 'n2', project_id: 'pr_1', title: 'Intro to anyone running Timescale in production', kind: 'introduction', status: 'open', time_shape: 'One message' }],

  collaborators: [
  { id: 'p_2', display_name: 'Nadia Okafor', handle: 'nadiao' },
  { id: 'p_3', display_name: 'Théo Lambert', handle: 'theol' }],

  relation: 'owned',
  my_role: 'creator',
  my_contribution: null
},
{
  id: 'pr_2',
  profile_id: 'p_1',
  title: 'Halyard',
  description:
  'A pocket instrument that logs the weather you actually worked in. Monochrome display, one dial, no app required.',
  goal: 'A hundred units in the hands of people who work outdoors.',
  status: 'active',
  visibility: 'public',
  stage: 'testing',
  season: 'feedback',
  started_at: '2026-02-18',
  updated_at: '2026-08-24',
  progress_percent: 41,
  cover_url: COVER_B,
  gallery: [{ url: COVER_B, caption: 'Enclosure v3', type: 'image' }],
  tags: ['Hardware', 'Instruments', 'Fabrication'],
  tools: ['Rhino', 'KiCad', 'Rust'],
  looking_for_feedback: true,
  looking_for_collaborators: true,
  is_featured: true,
  collaboration_brief: {
    need: 'An embedded engineer for the firmware',
    why_now: 'Enclosure is frozen; the board is the blocker',
    contribution_shape: 'Own the firmware through first run',
    time_shape: '~6 hours a week, three months'
  },
  milestones: [
  { id: 'm4', title: 'Enclosure v3', status: 'done', due_date: '2026-08-24' },
  { id: 'm5', title: 'Firmware first light', status: 'pending', due_date: '2026-11-30' }],

  credits: [
  { profile_id: 'p_1', display_name: 'Ivo Marchetti', handle: 'ivomarchetti', role: 'creator', credit_text: 'Created the project', at: '2026-02-18', credit_count: 11 },
  { profile_id: 'p_4', display_name: 'Mei Tanaka', handle: 'meit', role: 'contributor', credit_text: 'Drew the enclosure tooling', at: '2026-07-14', credit_count: 4 }],

  roles: [{ id: 'r3', title: 'Embedded engineer', status: 'open', skills: ['C', 'Rust', 'Embedded'] }],
  needs: [
  { id: 'n3', project_id: 'pr_2', title: 'Embedded engineer for firmware', kind: 'skill', status: 'open', time_shape: '6h/week' },
  { id: 'n4', project_id: 'pr_2', title: 'A CNC shop in Iberia for small runs', kind: 'resource', status: 'open', time_shape: 'One recommendation' }],

  collaborators: [{ id: 'p_4', display_name: 'Mei Tanaka', handle: 'meit' }],
  relation: 'owned',
  my_role: 'creator',
  my_contribution: null
},
{
  id: 'pr_6',
  profile_id: 'p_1',
  title: 'Slate',
  description: 'A sketchbook for interface arguments — one file, one canvas, no accounts.',
  goal: 'Ship something in a weekend and see if anyone wants it.',
  status: 'planning',
  visibility: 'public',
  stage: 'planning',
  season: 'research',
  started_at: '2026-08-30',
  updated_at: '2026-08-31',
  progress_percent: 8,
  cover_url: null,
  gallery: [],
  tags: ['Tools', 'Weekend'],
  tools: ['TypeScript', 'Canvas'],
  looking_for_feedback: false,
  looking_for_collaborators: false,
  is_featured: false,
  collaboration_brief: null,
  milestones: [{ id: 'm6', title: 'Decide the file format', status: 'in_progress', due_date: null }],
  credits: [
  { profile_id: 'p_1', display_name: 'Ivo Marchetti', handle: 'ivomarchetti', role: 'creator', credit_text: 'Created the project', at: '2026-08-30', credit_count: 2 }],

  roles: [],
  needs: [],
  collaborators: [],
  relation: 'owned',
  my_role: 'creator',
  my_contribution: null
},
{
  id: 'pr_4',
  profile_id: 'p_9',
  title: 'Orbit Kit',
  description: 'An open motion system for product teams — tokens, springs and a reduced-motion contract.',
  goal: null,
  status: 'active',
  visibility: 'public',
  stage: 'growing',
  season: 'launch',
  started_at: '2025-05-02',
  updated_at: '2026-08-28',
  progress_percent: 78,
  cover_url: null,
  gallery: [],
  tags: ['Design systems', 'Motion', 'Open source'],
  tools: ['TypeScript', 'Framer Motion'],
  looking_for_feedback: false,
  looking_for_collaborators: true,
  is_featured: false,
  collaboration_brief: null,
  milestones: [],
  credits: [
  { profile_id: 'p_9', display_name: 'Sasha Rowe', handle: 'sasharowe', role: 'creator', credit_text: 'Created the project', at: '2025-05-02', credit_count: 40 },
  { profile_id: 'p_1', display_name: 'Ivo Marchetti', handle: 'ivomarchetti', role: 'contributor', credit_text: 'Rebuilt the motion system’s reduced-motion pass', at: '2026-08-28', credit_count: 9 }],

  roles: [{ id: 'r4', title: 'Motion engineering', status: 'filled', skills: ['Motion'], filled_by: { id: 'p_1', display_name: 'Ivo Marchetti', handle: 'ivomarchetti' } }],
  needs: [],
  collaborators: [
  { id: 'p_9', display_name: 'Sasha Rowe', handle: 'sasharowe' },
  { id: 'p_5', display_name: 'Jonas Weber', handle: 'jonasw' }],

  relation: 'contributing',
  my_role: 'contributor',
  my_contribution: 'Rebuilt the reduced-motion pass and wrote the accessibility contract',
  owner: { id: 'p_9', display_name: 'Sasha Rowe', handle: 'sasharowe' }
},
{
  id: 'pr_5',
  profile_id: 'p_7',
  title: 'Coastline Archive',
  description: 'Community mapping of disappearing shoreline, built by twelve people along the Atlantic coast.',
  goal: null,
  status: 'paused',
  visibility: 'public',
  stage: 'building',
  season: 'research',
  started_at: '2025-09-15',
  updated_at: '2026-06-30',
  progress_percent: 55,
  cover_url: null,
  gallery: [],
  tags: ['Civic', 'Mapping', 'Research'],
  tools: ['Leaflet', 'Postgres'],
  looking_for_feedback: true,
  looking_for_collaborators: false,
  is_featured: false,
  collaboration_brief: null,
  milestones: [],
  credits: [
  { profile_id: 'p_7', display_name: 'Amara Diallo', handle: 'amarad', role: 'creator', credit_text: 'Created the project', at: '2025-09-15', credit_count: 31 },
  { profile_id: 'p_1', display_name: 'Ivo Marchetti', handle: 'ivomarchetti', role: 'mentor', credit_text: 'Reviewed the map interaction model', at: '2026-04-11', credit_count: 5 }],

  roles: [],
  needs: [],
  collaborators: [{ id: 'p_7', display_name: 'Amara Diallo', handle: 'amarad' }],
  relation: 'contributing',
  my_role: 'mentor',
  my_contribution: 'Mentored the team through two interaction reviews',
  owner: { id: 'p_7', display_name: 'Amara Diallo', handle: 'amarad' }
},
{
  id: 'pr_3',
  profile_id: 'p_1',
  title: 'Field Notes on Tools',
  description: 'A printed zine about the instruments people build for themselves. Two issues, 300 copies each.',
  goal: 'Three issues, then stop.',
  status: 'completed',
  visibility: 'public',
  stage: 'launch',
  season: 'launch',
  started_at: '2024-10-01',
  updated_at: '2026-08-11',
  progress_percent: 100,
  cover_url: COVER_C,
  gallery: [{ url: COVER_C, caption: 'Issue 02 spread', type: 'image' }],
  tags: ['Publishing', 'Writing', 'Print'],
  tools: ['InDesign', 'Risograph'],
  looking_for_feedback: false,
  looking_for_collaborators: true,
  is_featured: true,
  collaboration_brief: {
    need: 'A print partner for issue 03',
    why_now: 'Copy is written, the press is the blocker',
    contribution_shape: 'Riso or offset, 300 copies',
    time_shape: 'One run'
  },
  milestones: [
  { id: 'm7', title: 'Issue 01', status: 'done', due_date: '2025-03-01' },
  { id: 'm8', title: 'Issue 02', status: 'done', due_date: '2026-02-01' }],

  credits: [
  { profile_id: 'p_1', display_name: 'Ivo Marchetti', handle: 'ivomarchetti', role: 'creator', credit_text: 'Created the project', at: '2024-10-01', credit_count: 18 },
  { profile_id: 'p_6', display_name: 'Priya Raman', handle: 'priyar', role: 'contributor', credit_text: 'Edited both issues', at: '2026-02-01', credit_count: 12 }],

  roles: [{ id: 'r5', title: 'Print partner', status: 'open', skills: ['Risograph', 'Offset'] }],
  needs: [{ id: 'n5', project_id: 'pr_3', title: 'Print partner for issue 03', kind: 'resource', status: 'open', time_shape: 'One run' }],
  collaborators: [{ id: 'p_6', display_name: 'Priya Raman', handle: 'priyar' }],
  relation: 'owned',
  my_role: 'creator',
  my_contribution: null
}];


export function projectsByFilter(filter: 'building' | 'contributing' | 'created' | 'all'): ProjectDetail[] {
  if (filter === 'all') return projects;
  if (filter === 'contributing') return projects.filter((p) => p.relation === 'contributing');
  if (filter === 'created') return projects.filter((p) => p.relation === 'owned' && p.status === 'completed');
  return projects.filter((p) => p.relation === 'owned' && p.status !== 'completed');
}

export const openNeeds = projects.flatMap((p) =>
p.needs.filter((n) => n.status === 'open').map((n) => ({ need: n, project: p }))
);