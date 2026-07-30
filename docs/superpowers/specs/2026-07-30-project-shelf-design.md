# 3D Horizontal Project Shelf — Design Spec

## Overview

Replace the explore page's CSS masonry grid with an interactive 3D horizontal shelf that presents projects as physical-like objects with depth, spine details, and smooth spring-animated transitions. Clicking a project opens an inline fullscreen overlay with a frosted-glass backdrop.

## Architecture

### Component Tree

```
ExplorePage
  └── ProjectShelf
        ├── ProjectShelfHeader (title, count, search, category filters)
        ├── ProjectShelfCover[] (the shelf items)
        │     └── (cover image / animated gradient)
        │     └── spine strip (icon, title, color, progress)
        │     └── badges (trending, you, contributed, invited)
        └── ProjectShelfOverlay (fullscreen on click)
              └── layoutId morph from clicked ProjectShelfCover
```

### Components

**ProjectShelf** — Container with `perspective(1200px)` on the wrapper. Manages active index, keyboard navigation, AnimatePresence for filter transitions.

**ProjectShelfCover** — Individual shelf item. Applies rotateY based on position relative to active index. 3 tiers of blur based on distance (0, 1, or 2+ steps away). Spring-animated on mount (staggered entrance). Spring-animated on index change and hover. Spine-style display for non-active cards.

**ProjectShelfOverlay** — Full-screen overlay with `layoutId` bridging from the clicked cover. Frosted glass backdrop (`backdrop-filter: blur(16px)`). Closes on Escape / backdrop click. Contains full project detail content.

**ProjectShelfHeader** — Sticky header with search input, filter chips, result count. Animates with AnimatePresence when filters change.

## Layout & Perspective

- Shelf container: `perspective(1200px)`
- Active (center) card: `rotateY(0deg)`, occupies ~65% of container width
- 1st neighbors: `rotateY(±18deg)`, ~40% width, show spine face
- 2nd neighbors: `rotateY(±35deg)`, ~25% width, more compressed
- 3+ neighbors: hidden or `rotateY(±50deg)` with 4px blur
- Cards are arranged in a row with `translateZ` layering (active highest)

## Motion (framer-motion springs)

| Action | Stiffness | Damping |
|---|---|---|
| Index change (scroll/nav) | 300 | 30 |
| Hover on non-active card | 400 | 25 |
| Opening overlay | 200 | 25 |
| Closing overlay | 150 | 20 |

### Entrance Sequence (on mount, per card)

Back-to-front layering: background layer → title → ring/status → avatars → badges. Each layer delayed by `i * 30ms` per card, with inner layers delayed further.

### Filter/Search Transitions

`AnimatePresence` with `mode="popLayout"` on the shelf items. Exit: opacity 0, scale 0.9, rotateY 30deg. Enter: spring with stiffness 300/damping 30.

## Cover Visuals

Priority order for cover display:
1. User-uploaded cover image
2. Hash-based animated gradient using project category color influence
3. Category-default gradient

The animated gradient uses CSS `@property` or framer-motion animated values to shift hue/saturation over time, with a subtle slow animation (~8s cycle).

### Spine (non-active cards)

Each non-active card shows its side as a "spine" with:
- Category icon (Lucide icon based on project category)
- Project title (rotated or stacked vertically, truncated)
- Color strip (category-based accent color, ~4px wide)
- Progress line (thin horizontal bar showing completion %)
- Status dot (colored, matching STATUS_STYLES from existing code)

## Status Indicators

| Indicator | Condition | Visual |
|---|---|---|
| Trending glow | High recent activity | `box-shadow` with brand green glow, pulsing |
| Own-project edge | `userId === currentUser.id` | Left border accent strip + small "You" pill |
| Contributed bookmark | User is contributor | Bookmark ribbon in top-right corner |
| Invited pulse | User has pending invite | Gentle pulse animation on a ring/icon |

## Overlay (Project Detail Panel)

When a card is clicked:
1. The clicked cover morphs via `layoutId` to become the overlay header
2. Full-viewport overlay appears with `backdrop-filter: blur(16px)` frosted glass
3. Close button (X) in top-right corner
4. Content area: project title, description, status, progress, tags, creator info, collaborator section, action buttons
5. Escape key and backdrop click close the overlay
6. Overlay content is lazy-loaded (only when opened)

## Responsive / Mobile

Below `md` breakpoint:
- Horizontal shelf collapses to a vertical card stack
- Cards display full front-face (no perspective/rotateY)
- Swipe gesture to dismiss or navigate between cards
- Overlay becomes a bottom sheet (via vaul)

## Accessibility

- Container `role="listbox"` with `aria-label="Projects"`
- Each card `role="option"` with `aria-selected`
- Arrow keys (left/right) navigate between projects
- Enter/Space opens the overlay
- Escape closes the overlay
- `prefers-reduced-motion` respected: disable spring animations, use instant transitions, no blur
- Focus trap inside overlay
- Focus returns to the triggering card on overlay close

## Data Dependencies

Uses existing `useProjects()` hooks. Cover images from project `cover_url` field. Category from `project_category`. Status from `status`. Progress from milestone completion ratio. Collaborator info from `project_collaborators` join.

## Implementation Order

1. Install framer-motion
2. Build `ProjectShelf` container with perspective wrapper
3. Build `ProjectShelfCover` with spring transforms
4. Build `ProjectShelfHeader` with search/filter
5. Implement cover gradient generation
6. Implement status indicators
7. Build `ProjectShelfOverlay` with layoutId morph
8. Wire navigation (keyboard, click, index change)
9. Responsive/mobile adaptation
10. A11y pass
11. Tests
