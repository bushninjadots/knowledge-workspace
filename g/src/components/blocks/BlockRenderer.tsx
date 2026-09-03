import React from 'react';
import type { BlockInstance, BlockProps } from '../../types/studio';
import {
  ProfileAchievementsBlock,
  ProfileActivityBlock,
  ProfileBioBlock,
  ProfileCreditsBlock,
  ProfileDirectionBlock,
  ProfileGalleryBlock,
  ProfileHeaderBlock,
  ProfileLinksBlock,
  ProfileNeedsBlock,
  ProfileProjectsBlock,
  ProfileSkillsBlock,
  ProfileToolsBlock } from
'./ProfileBlocks';
import { ContentDividerBlock, ContentHeadingBlock, ContentTextBlock } from './ContentBlocks';

interface BlockRendererProps {
  block: BlockInstance;
  editing: boolean;
  onPropsChange: (patch: BlockProps) => void;
}

/**
 * The registry lookup — one place that maps a block type to its component,
 * preserving the existing BlockRenderer contract.
 */
export function BlockRenderer({ block, editing, onPropsChange }: BlockRendererProps) {
  const { type, props } = block;
  switch (type) {
    case 'profile-header':
      return <ProfileHeaderBlock />;
    case 'profile-bio':
      return <ProfileBioBlock props={props} />;
    case 'profile-direction':
      return <ProfileDirectionBlock props={props} />;
    case 'profile-projects':
      return <ProfileProjectsBlock props={props} />;
    case 'profile-needs':
      return <ProfileNeedsBlock props={props} />;
    case 'profile-credits':
      return <ProfileCreditsBlock props={props} />;
    case 'profile-activity':
      return <ProfileActivityBlock props={props} />;
    case 'profile-skills':
      return <ProfileSkillsBlock props={props} />;
    case 'profile-tools':
      return <ProfileToolsBlock props={props} />;
    case 'profile-links':
      return <ProfileLinksBlock props={props} />;
    case 'profile-achievements':
      return <ProfileAchievementsBlock props={props} />;
    case 'profile-gallery':
      return <ProfileGalleryBlock props={props} />;
    case 'content-heading':
      return <ContentHeadingBlock props={props} editing={editing} onChange={onPropsChange} />;
    case 'content-text':
      return <ContentTextBlock props={props} editing={editing} onChange={onPropsChange} />;
    case 'content-divider':
      return <ContentDividerBlock />;
    default:
      return (
        <div className="flex h-full items-center justify-center border border-dashed border-border text-2xs text-muted-foreground">
          Unknown block type
        </div>);

  }
}