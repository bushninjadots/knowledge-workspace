# Sidebar Global Search — Design Spec

## Problem

The sidebar's "Search the network…" button is **non-functional**. It attempts to focus `[aria-label="Global search"]` via `document.querySelector`, but the `GlobalSearch` component that has that label is never mounted anywhere — it's an orphaned component. Clicking the button does nothing. Additionally, `MobileSearch` in `AuthenticatedShell` duplicates the same logic inline.

## Solution

Enhance the existing `GlobalSearch` component to cover all major data sources, mount it directly in the sidebar (and in a dialog for mobile), wire up keyboard shortcuts, and remove the duplicated `MobileSearch`.

## Architecture

```
<DashboardSidebar>               # sidebar on desktop
  <GlobalSearch variant="inline" />  # always-visible search bar + dropdown

<AuthenticatedShell>             # mobile header
  <GlobalSearch variant="dialog" />  # wrapped in Dialog
```

`GlobalSearch` receives a `variant` prop:

- **`inline`**: renders its own input + absolute-positioned dropdown (for sidebar)
- **`dialog`**: renders inside a `Dialog` component (for mobile), controlled by `open`/`onOpenChange` props

## Data Sources

6 parallel `useQuery` calls debounced at 200ms. Each enabled only when `debounced.length >= 1`.

| Source          | Table           | Searched Columns                                      | Scope             | Limit |
| --------------- | --------------- | ----------------------------------------------------- | ----------------- | ----- |
| People          | `profiles`      | `display_name`, `handle`, `category`, `creator_title` | All public        | 4     |
| Skills          | `skills`        | `name`                                                | All public        | 4     |
| Projects        | `projects`      | `title`, `description`, `tags`                        | All public        | 4     |
| Library Items   | `library_items` | `title`, `content`                                    | Current user only | 4     |
| Community Posts | `posts`         | `title`, `body`                                       | All public        | 4     |
| Sessions        | `sessions`      | `title`, `description`                                | User is organizer | 4     |

Each query uses `ilike` with PostgREST escape handling (existing `escapeForOr` utility).

## UX & Interaction

- Search bar always visible in sidebar (inline variant)
- On type → debounced dropdown appears below search bar
- Loading skeleton per section while queries run
- Results grouped by section with section headers
- "No results" message when all sections empty
- Click-outside-to-close dropdown

### Keyboard Navigation

| Key                     | Action                            |
| ----------------------- | --------------------------------- |
| `/`                     | Focus search input, open dropdown |
| `Escape`                | Close dropdown, blur input        |
| `ArrowDown` / `ArrowUp` | Navigate result items             |
| `Enter`                 | Open highlighted/selected result  |
| `Tab`                   | Move between input and results    |

## Component Changes

### `GlobalSearch` (major enhancement)

- Add `variant: 'inline' | 'dialog'` prop
- Add `open`/`onOpenChange` for controlled dialog mode
- Add 4 new query blocks (projects, library, posts, sessions)
- Add keyboard navigation state (`selectedIndex`)
- Add keyboard event handlers for arrow keys + Enter
- Add global `/` key listener
- Dialog variant: wrap content in `<Dialog>` + `<DialogContent>` from shadcn/ui
- Inline variant: same as current dropdown behavior

### `DashboardSidebar` (minor)

- Replace button with `<GlobalSearch variant="inline" />`
- Remove dead `document.querySelector` click handler

### `AuthenticatedShell` (minor)

- Replace inline `MobileSearch` component with `<GlobalSearch variant="dialog" />`
- Remove duplicate `MobileSearch` function definition entirely
- Keep `searchOpen` state, pass as props

## Files to Modify

1. `src/components/tethyr/global-search.tsx` — major enhancement
2. `src/components/tethyr/dashboard-sidebar.tsx` — replace button with GlobalSearch
3. `src/components/tethyr/authenticated-shell.tsx` — replace MobileSearch with GlobalSearch dialog

## Performance

- 200ms debounce prevents Supabase request on every keystroke
- Parallel `useQuery` calls (not waterfall)
- 4-result limit per section keeps payloads small
- React Query caching: identical queries within cache TTL return instantly
- Escape handling prevents PostgREST filter injection
- Queries disabled when input is empty
