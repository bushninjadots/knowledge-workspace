# Pages To Create

Link audit result (2026-08-01): every link on every page was verified by
direct navigation and click test. All links resolve correctly **except** the
skill hubs listed below, which are linked from the UI but have no page yet.

## Skill hubs (no page yet)

These are linked from the Community page's **"Trending Skills"** sidebar
(`src/components/tethyr/community/right-sidebar.tsx:105-106`). That list is
currently **hardcoded**: `["React", "TypeScript", "UI/UX", "Python", "Tailwind"]`.
`React` and `Python` hubs already exist; the rest resolve to a "Skill not
found" page.

| Route | Linked from | Notes |
| --- | --- | --- |
| `/skills/typescript` | Community → Trending Skills | No `typescript` row in `skills` table |
| `/skills/ui-ux` | Community → Trending Skills | Link targets `/skills/ui%2Fux` (lowercased `ui/ux`); no skill row |
| `/skills/tailwind` | Community → Trending Skills | No `tailwind` row in `skills` table |

### Options once designed

1. Create skill rows + design hub pages for these skills (they use the existing
   `/skills/$slug` route, so only a `skills` row is needed).
2. Or make the "Trending Skills" sidebar data-driven (query the `skills` table,
   ordered by usage) so it only ever links to existing hubs — the label
   "Trending" is currently misleading since the list is hardcoded.

## Already handled / no action

- `/skills/video-editing` — was linked from the dashboard QuickLink; that link
  was replaced with `/explore`. The URL itself still renders "Skill not found".
- No external links (off-domain) exist anywhere on the site.
