import type { BlockDefinition, BlockCategory, BlockType } from '../types/studio';

/**
 * Block registry metadata — mirrors the BlockRenderer registry keys used by
 * Tethyr today (`profile-header`, `profile-projects`, `profile-skills`, …).
 * Sizes are expressed in the 12-column canvas grid.
 */
export const blockCatalog: BlockDefinition[] = [
{
  type: 'profile-header',
  label: 'Identity',
  category: 'identity',
  description: 'Banner, avatar, name, title, availability.',
  defaultW: 12,
  defaultH: 7,
  minW: 6,
  minH: 5,
  singleton: true
},
{
  type: 'profile-bio',
  label: 'Who I am',
  category: 'identity',
  description: 'Long-form statement in your own words.',
  defaultW: 7,
  defaultH: 5,
  minW: 3,
  minH: 3
},
{
  type: 'profile-direction',
  label: 'What I’m looking for',
  category: 'identity',
  description: 'Seeking and offering — the collaboration handshake.',
  defaultW: 5,
  defaultH: 5,
  minW: 3,
  minH: 4
},
{
  type: 'profile-projects',
  label: 'Project shelf',
  category: 'projects',
  description: 'Building, contributing or created — with live project signals.',
  defaultW: 12,
  defaultH: 9,
  minW: 4,
  minH: 5
},
{
  type: 'profile-needs',
  label: 'Ways to contribute',
  category: 'projects',
  description: 'Open needs and roles across your projects.',
  defaultW: 5,
  defaultH: 8,
  minW: 3,
  minH: 4
},
{
  type: 'profile-credits',
  label: 'Credits roll',
  category: 'signals',
  description: 'Who built what with you, compiled from project evidence.',
  defaultW: 7,
  defaultH: 7,
  minW: 4,
  minH: 4
},
{
  type: 'profile-activity',
  label: 'Recent signals',
  category: 'signals',
  description: 'Updates, milestones and credits as they happen.',
  defaultW: 5,
  defaultH: 7,
  minW: 3,
  minH: 4
},
{
  type: 'profile-skills',
  label: 'Skills',
  category: 'signals',
  description: 'Declared and verified skills with experience level.',
  defaultW: 5,
  defaultH: 7,
  minW: 3,
  minH: 4
},
{
  type: 'profile-tools',
  label: 'Tools & stack',
  category: 'signals',
  description: 'Favourite software and working stack.',
  defaultW: 4,
  defaultH: 7,
  minW: 2,
  minH: 3
},
{
  type: 'profile-links',
  label: 'Links',
  category: 'signals',
  description: 'Portfolio and social links.',
  defaultW: 3,
  defaultH: 7,
  minW: 2,
  minH: 3
},
{
  type: 'profile-achievements',
  label: 'Evidence shelf',
  category: 'signals',
  description: 'Things you shipped, wrote or spoke about.',
  defaultW: 6,
  defaultH: 6,
  minW: 3,
  minH: 4
},
{
  type: 'profile-gallery',
  label: 'Gallery',
  category: 'content',
  description: 'Images pulled from your project galleries.',
  defaultW: 12,
  defaultH: 8,
  minW: 4,
  minH: 5
},
{
  type: 'content-heading',
  label: 'Heading',
  category: 'content',
  description: 'A section heading you can edit inline.',
  defaultW: 12,
  defaultH: 2,
  minW: 3,
  minH: 2
},
{
  type: 'content-text',
  label: 'Text',
  category: 'content',
  description: 'A paragraph of free text, edited on the canvas.',
  defaultW: 6,
  defaultH: 4,
  minW: 3,
  minH: 2
},
{
  type: 'content-divider',
  label: 'Rule',
  category: 'content',
  description: 'A horizontal rule between ideas.',
  defaultW: 12,
  defaultH: 1,
  minW: 2,
  minH: 1
}];


export const blockMap: Record<BlockType, BlockDefinition> = blockCatalog.reduce(
  (acc, def) => ({ ...acc, [def.type]: def }),
  {} as Record<BlockType, BlockDefinition>
);

export const categoryOrder: BlockCategory[] = ['projects', 'identity', 'signals', 'content'];

export const categoryLabels: Record<BlockCategory, string> = {
  projects: 'Projects',
  identity: 'Identity',
  signals: 'Signals',
  content: 'Content'
};

export const categoryHints: Record<BlockCategory, string> = {
  projects: 'The spine of your Studio — what you are building and contributing to.',
  identity: 'Who you are and what you are looking for.',
  signals: 'Evidence, skills and the trail your work leaves.',
  content: 'Your own words, images and structure.'
};