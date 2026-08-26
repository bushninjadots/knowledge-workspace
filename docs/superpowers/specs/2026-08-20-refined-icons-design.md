# Tethyr Refined Line Icons — Design Spec

**Date:** 2026-08-20
**Status:** Approved

## Overview

Replace generic Lucide icons on achievement badges with custom Tethyr-branded line icons. Refine the pillar icons. Add proper favicon and PWA manifest.

## Principles

- **Consistent 1.5px stroke weight** across all custom icons
- **24×24 viewBox** for badge icons, **20×20** for nav/UI icons
- **No fills** — stroke-only, matching Lucide's aesthetic
- **Tethyr DNA** — subtle infinity-motif curves, green/purple gradient used sparingly as accent
- **Distinct silhouettes** — each badge reads clearly at 16px

## Deliverable 1: Achievement Badge Icons

Create 24 custom SVG icon components in `src/components/tethyr/icons/achievements.tsx`.

Each icon is a React component that accepts `className` and renders an inline SVG.

### Icon Mapping

| Achievement             | Current Lucide | New Custom Icon                        |
| ----------------------- | -------------- | -------------------------------------- |
| `first_project`         | Rocket         | Rocket with infinity trail loop        |
| `first_milestone`       | Flag           | Flag with small star burst at tip      |
| `first_endorsement`     | ThumbsUp       | Thumbs up with small sparkle accent    |
| `five_endorsements`     | Star           | 5-pointed star with inner detail       |
| `ten_endorsements`      | Award          | Medal/ribbon with infinity knot center |
| `community_recognized`  | Shield         | Shield with checkmark + subtle wave    |
| `mentor`                | GraduationCap  | Cap with book + infinity tassel        |
| `collaborator`          | Users          | Two figures with linking arc           |
| `prolific_teacher`      | BookOpen       | Open book with radiating lines         |
| `project_builder`       | Hammer         | Hammer with small blueprint corner     |
| `community_builder`     | MessageCircle  | Speech bubble with people dots         |
| `reliable_collaborator` | Clock          | Clock with infinity loop on face       |
| `helped_ten_people`     | Heart          | Heart with small hands cupping         |
| `learner_journey`       | Compass        | Compass with path trail                |
| `challenge_winner`      | Trophy         | Trophy with wave motif base            |
| `crew_founder`          | Users          | Two figures + infinity link            |
| `team_player`           | Users          | Three figures in arc formation         |
| `milestone_master`      | Target         | Target with concentric rings + arrow   |
| `helping_hand`          | HeartHandshake | Handshake with heart above             |
| `conversation_starter`  | MessageSquare  | Chat bubble with spark/dots            |
| `role_filler`           | BadgeCheck     | Badge with checkmark                   |
| `first_session`         | Calendar       | Calendar with small play mark          |
| `session_teacher`       | Presentation   | Presentation board with person         |
| `streak_4_weeks`        | Flame          | Flame with 4 concentric rings          |

### Implementation

```tsx
// src/components/tethyr/icons/achievements.tsx
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function IconFirstProject(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Custom SVG paths */}
    </svg>
  );
}

// ... 23 more icon components
```

Export a lookup map:

```tsx
export const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<IconProps>> = {
  first_project: IconFirstProject,
  // ...
};
```

## Deliverable 2: Favicon + PWA Manifest

### Files to create/update

- `public/favicon.svg` — SVG favicon using LogoInfinity (simplified for 16px clarity)
- `public/icon-192.png` — PWA icon 192×192
- `public/icon-512.png` — PWA icon 512×512
- `public/apple-touch-icon.png` — 180×180
- `site.webmanifest` — PWA manifest with theme color, icons, display mode
- `index.html` or root layout — link tags for favicon, manifest, apple-touch-icon

### Design

- SVG favicon: Infinity mark only (no text), green-to-purple gradient
- PNG icons: Same mark on transparent background
- Manifest: `name: "Tethyr"`, `short_name: "Tethyr"`, `theme_color: "#0a0a0a"`, `background_color: "#0a0a0a"`, `display: "standalone"`

## Deliverable 3: Pillar Icon Refinement

Update existing components in `src/components/tethyr/icons-system.tsx`:

- `IconLearn` — cleaner geometry, consistent stroke weight
- `IconTeach` — refined book shape, better proportions
- `IconConnect` — tighter infinity overlap, more balanced
- `IconGrow` — sharper cross/arrow, consistent sizing
- Compact variants — same refinement at 24×24

Keep gradient fills on full-size versions. Compact versions stay stroke-only.

## What stays the same

- All 188 Lucide icons for general UI
- 5 workshop illustrations in empty-state.tsx
- LogoInfinity component
