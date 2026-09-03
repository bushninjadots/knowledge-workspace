import type { PageLayout, StudioConfig } from '../types/studio';

/**
 * The default Studio: projects are the spine. Identity sits on top, the three
 * project shelves carry the weight, and the generic portfolio material
 * (tools, links, evidence) is deliberately last and smaller.
 */
export const defaultLayout: PageLayout = {
  sections: [
  {
    id: 'sec-identity',
    title: 'Identity',
    kind: 'standard',
    visible: true,
    blocks: [
    { id: 'blk-header', type: 'profile-header', visible: true, props: {} },
    { id: 'blk-bio', type: 'profile-bio', visible: true, props: {} },
    { id: 'blk-direction', type: 'profile-direction', visible: true, props: {} }],

    grid: [
    { i: 'blk-header', x: 0, y: 0, w: 12, h: 7, minW: 6, minH: 5 },
    { i: 'blk-bio', x: 0, y: 7, w: 7, h: 5, minW: 3, minH: 3 },
    { i: 'blk-direction', x: 7, y: 7, w: 5, h: 5, minW: 3, minH: 4 }]

  },
  {
    id: 'sec-building',
    title: 'Building now',
    kind: 'spine',
    visible: true,
    blocks: [
    {
      id: 'blk-building',
      type: 'profile-projects',
      visible: true,
      props: { filter: 'building', presentation: 'spotlight', showSignals: true, title: 'Building now' }
    }],

    grid: [{ i: 'blk-building', x: 0, y: 0, w: 12, h: 12, minW: 4, minH: 5 }]
  },
  {
    id: 'sec-contributing',
    title: 'Contributing to',
    kind: 'spine',
    visible: true,
    blocks: [
    {
      id: 'blk-contributing',
      type: 'profile-projects',
      visible: true,
      props: { filter: 'contributing', presentation: 'minimal-list', showSignals: true, title: 'Contributing to' }
    },
    { id: 'blk-needs', type: 'profile-needs', visible: true, props: {} }],

    grid: [
    { i: 'blk-contributing', x: 0, y: 0, w: 7, h: 8, minW: 4, minH: 5 },
    { i: 'blk-needs', x: 7, y: 0, w: 5, h: 8, minW: 3, minH: 4 }]

  },
  {
    id: 'sec-created',
    title: 'Created',
    kind: 'spine',
    visible: true,
    blocks: [
    {
      id: 'blk-created',
      type: 'profile-projects',
      visible: true,
      props: { filter: 'created', presentation: 'editorial-grid', showSignals: false, title: 'Created' }
    }],

    grid: [{ i: 'blk-created', x: 0, y: 0, w: 12, h: 9, minW: 4, minH: 5 }]
  },
  {
    id: 'sec-practice',
    title: 'Practice',
    kind: 'standard',
    visible: true,
    blocks: [
    { id: 'blk-skills', type: 'profile-skills', visible: true, props: {} },
    { id: 'blk-tools', type: 'profile-tools', visible: true, props: {} },
    { id: 'blk-links', type: 'profile-links', visible: true, props: {} }],

    grid: [
    { i: 'blk-skills', x: 0, y: 0, w: 5, h: 7, minW: 3, minH: 4 },
    { i: 'blk-tools', x: 5, y: 0, w: 4, h: 7, minW: 2, minH: 3 },
    { i: 'blk-links', x: 9, y: 0, w: 3, h: 7, minW: 2, minH: 3 }]

  },
  {
    id: 'sec-signals',
    title: 'Trail',
    kind: 'standard',
    visible: true,
    blocks: [
    { id: 'blk-credits', type: 'profile-credits', visible: true, props: {} },
    { id: 'blk-activity', type: 'profile-activity', visible: true, props: {} }],

    grid: [
    { i: 'blk-credits', x: 0, y: 0, w: 7, h: 7, minW: 4, minH: 4 },
    { i: 'blk-activity', x: 7, y: 0, w: 5, h: 7, minW: 3, minH: 4 }]

  }]

};

export const defaultConfig: StudioConfig = {
  starterId: null,
  structure: 'wide',
  personality: 'modern',
  density: 'comfortable',
  radius: 'soft',
  accentMode: 'auto',
  accentColor: '#3f8f8a',
  appBackground: 'surface',
  publicBackground: 'default'
};