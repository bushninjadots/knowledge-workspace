# Tethyr UX Full Review — 2026-08-20

> Dated audit. Findings are against current source on `main` (verified by reading
> the code, not by running the app). Severity: 🔴 high (user-visible breakage or
> dead end), 🟠 medium (confusion / duplication / inconsistency), 🟡 low (polish).

## Resolution status — 2026-08-20 (same day)

All 🔴, 🟠, and 🟡 findings were implemented the same day. Work is
browser-verified against the local stack (dashboard → connections → sessions →
settings → explore → skills → community → public profiles, incl. mobile
viewport), plus `npm run typecheck`, `npm test` (203 tests), ESLint, and the
production build. The notification-preferences migration
(`supabase/migrations/20260820170000_notification_preferences.sql`) was applied
**to the remote Supabase project** and the local dev database. See the execution
log in [`TETHYR_IMPLEMENTATION_STAGES.md`](./TETHYR_IMPLEMENTATION_STAGES.md)
for the full change list.

| Finding                                 | Status                                                                                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 — Space reports duplicated           | ✅ Resolved — Settings links to the Reports inbox; embedded queue + ban/dismiss dialogs removed                                                                                                                                     |
| H2 — Activity card routes to wrong page | ✅ Resolved — routes to `/connections`; browser-verified with a real incoming request                                                                                                                                               |
| H3 — Back fallback hits auth wall       | ✅ Resolved — public pages fall back to `/`                                                                                                                                                                                         |
| H4 — Dead profile action buttons        | ✅ Resolved — unreachable `!isOwnProfile` branch removed                                                                                                                                                                            |
| H5 — No settings surface                | ✅ Resolved — new `/settings` hub: email change, password, delete account, notification prefs                                                                                                                                       |
| M1 — Availability overlap               | ✅ Resolved — one status control (sidebar); dashboard duplicate removed; weekly schedule renamed                                                                                                                                    |
| M2 — Notification overlap + no prefs    | ✅ Resolved — disjoint categories; per-category mute prefs (persisted, browser-verified)                                                                                                                                            |
| M3 — Duplicate community nav            | ✅ Resolved — "Profile" removed; "Projects" relabeled "Project updates"; "Challenges" removed from the rail (app sidebar owns it; deep link stays valid); "Trending" kept — it's a community-feed sort, not a duplicate destination |
| M4 — Handle-less profile links          | ✅ Resolved — `ProfileLink` guard on all 7 sites                                                                                                                                                                                    |
| M5 — Conversation dead end              | ✅ Resolved — link only for accepted connections, deep-links `?c=`; browser-verified                                                                                                                                                |
| M6 — "Your projects" misdirect          | ✅ Resolved — "View all" → `/profile`                                                                                                                                                                                               |
| M7 — Sessions requests buried           | ✅ Resolved — URL-driven tabs (`?tab=requests`) + deep links; browser-verified                                                                                                                                                      |
| M8 — Search misses participant sessions | ✅ Resolved — participant sessions included, de-duped against organized                                                                                                                                                             |
| L1 — Label inconsistency                | ✅ Resolved — mobile nav matches the sidebar (Dashboard / Your Studio); "Teams I build with" → "Crews I build with"                                                                                                                 |
| L2 — Duplicate completeness nag         | ✅ Resolved — welcome-header ring removed; the next-steps module is the single dashboard completeness surface (browser-verified)                                                                                                    |
| L3 — Header style inconsistency         | ✅ Resolved — page titles unified; shared `SegmentedControl` extracted and adopted by Explore + skills tabs; challenges filters kept as chips (a different pattern — tags stay `rounded-full` per the radius scale)                 |
| L4 — Footer auth awareness              | ✅ Resolved — auth-aware links (hidden auth-only links for visitors)                                                                                                                                                                |
| L5 — Empty-state CTAs                   | 🟡 Partial — Messages CTAs added; Connections divider untouched                                                                                                                                                                     |
| L6 — Search shortcut hint               | ✅ Resolved — `title="Search (press /)"` tooltip                                                                                                                                                                                    |

## Executive summary

Tethyr's core loop — **DISCOVER → Explore work → Find people → Collaborate →
Build → Contribute → Become known** — is well supported by the surface set. The
project page and Studio are the strongest experiences and already follow the
README → identity → work → people → conversation → evidence narrative.

The biggest user-flow problems are:

1. **Moderation/settings are duplicated across two routes** — space Reports live
   in both `/spaces/$slug/settings` (embedded "Reported posts" queue with full
   ban/dismiss/resolve dialogs) and a separate `/spaces/$slug/reports` inbox.
2. **Availability is controlled from three different places** with overlapping
   concepts (status vs. weekly schedule).
3. **Dead-end navigation**: several cards link to the wrong destination (e.g.
   connection requests → `/profile` instead of `/connections`), and the
   "back" fallback sends signed-out users to `/explore` (an authenticated
   route) instead of the landing page.
4. **Profile "action" buttons are dead** — Message / Connect / Collaborate
   buttons in `ProfileLayout` have no handlers (currently unreachable because
   the layout is only used with `isOwnProfile=true`, but they are a trap).
5. **Settings are spread across surfaces** — profile identity vs. appearance,
   session availability, notification preferences (which don't exist at all),
   and GitHub integration all live in different places with no single "settings"
   home.

---

## 🔴 High severity

### H1. Space reports duplicated across Settings and a dedicated Reports route

> ✅ **Resolved 2026-08-20** — Settings now links to `/spaces/$slug/reports`; the embedded queue, ban dialog, and dismiss dialog were removed from Settings.

`/spaces/$slug/settings` embeds a full **"Reported posts"** moderation queue
(resolve / dismiss / ban dialogs, ~150 lines of duplicated dialog code) AND a
separate `/spaces/$slug/reports` route exists with the same cards, the same
three dialogs, and identical ban/dismiss logic. `SpaceHeader` links to **both**
"Reports" and "Settings", so a moderator sees the same open reports twice and
can resolve in one place while they still show as open in the other.

- Files: `src/routes/_authenticated/spaces.$slug.settings.tsx`,
  `src/routes/_authenticated/spaces.$slug.reports.tsx`,
  `src/components/tethyr/community/space-header.tsx`
- **Recommendation:** Keep `/spaces/$slug/reports` as the single moderation
  surface. Remove the embedded reports queue + ban/dismiss dialogs from
  Settings and replace with a link + open-count chip ("N open reports"). The
  ban dialog is used by both; extract it once into a shared component.

### H2. Dashboard "You have activity" card routes connection requests to the wrong page

> ✅ **Resolved 2026-08-20** — routes to `/connections` when `pendingConnectionCount > 0`.

`dashboard.tsx` (`TodayCard` "You have activity"):

```ts
href={
  pendingSessionCount > 0
    ? "/sessions"
    : pendingConnectionCount > 0
      ? "/profile"      // ← connection requests belong in /connections
      : "/messages"
}
```

When there are pending **connection** requests the card links to `/profile`,
which has no pending-request UI — a dead end. Connection requests are reviewed
in `/connections` ("Requests waiting for you").

- **Recommendation:** route to `/connections` when `pendingConnectionCount > 0`
  (or show the pending list inline on the dashboard so the link makes sense).

### H3. "Back" fallback sends signed-out users into the authenticated area

> ✅ **Resolved 2026-08-20** — `u.$handle.tsx`, `projects.$id.tsx`, and `teams.$slug.tsx` now fall back to `/` (landing) instead of `/explore`.

`u.$handle.tsx`, `projects.$id.tsx`, and `teams.$slug.tsx` all use:

```ts
window.history.length > 1 ? window.history.back() : navigate({ to: "/explore" });
```

`/explore` is under `/_authenticated`, so a signed-out visitor who lands
directly on a public profile/project and clicks "Back" (no history) gets
redirected to `/login` — a jarring dead end from an otherwise public page.

- **Recommendation:** fall back to `/` (the landing page) when there's no
  history, or better: render a labeled breadcrumb (Tethyr / Studio / @handle)
  instead of a history-dependent back button.

### H4. Profile action buttons with no behavior

> ✅ **Resolved 2026-08-20** — the unreachable `!isOwnProfile` action-button branch was deleted.

`ProfileLayout` (`src/components/tethyr/profile/profile-layout.tsx`) renders a
`!isOwnProfile` branch with **Message / Connect / Collaborate** buttons that
have no `onClick` and are not `asChild` links — pure dead buttons. Today they're
unreachable (the layout is only mounted with `isOwnProfile=true` in
`profile.tsx`, and the public `/u/$handle` page has its own header), but any
future reuse of `ProfileLayout` for other people's profiles silently ships
non-functional CTAs.

- **Recommendation:** delete the unreachable `!isOwnProfile` branch (the public
  page owns that surface), or wire the buttons to real flows
  (`/messages?c=…`, `ConnectButton`, `/sessions` request dialog).

### H5. No account/settings surface at all

> ✅ **Resolved 2026-08-20** — new `/settings` route (added to the sidebar Account group and footer): account & security (email change, password change), per-category notification preferences, links to Studio appearance/skills and the sessions weekly schedule, sign out, and a confirmed delete-account flow backed by a service-role server function (`src/lib/account-server.ts`).

There is no user account settings page: no email/password change, no delete
account, no notification preferences (per-type opt-in/opt-out), no language/
theme persistence beyond the profile, no session management. Settings that do
exist are scattered:

- Identity → `/profile` → "Edit Studio" dropdown
- Appearance (background/accent) → `/profile` → "Change appearance" dialog
- Skills/links/GitHub → `/profile` tab content (GitHub connect is a separate card)
- Availability status → sidebar + dashboard welcome header
- Weekly session availability → `/sessions` → "Availability" tab
- Space settings → `/spaces/$slug/settings`
- Notification preferences → **nonexistent**

- **Recommendation:** introduce a single **Settings** hub (sidebar "Account"
  group currently has only "Your Studio") with sections for Account (email,
  password, delete), Notifications (per-type preferences), and links to
  profile appearance/skills editing. At minimum add notification preferences —
  the Notifications page currently has tabs but no way to control what lands
  there.

---

## 🟠 Medium

### M1. Availability is three overlapping concepts with one name

> ✅ **Resolved 2026-08-20** — dashboard welcome duplicate removed (sidebar is the single status control); weekly schedule tab renamed to "Weekly schedule".

1. **Status** (available / busy / …) — `AvailabilitySelector` in the sidebar
   AND again in the dashboard welcome header (two entry points for the same
   write).
2. **Weekly schedule** (session slots) — `/sessions` → "Availability" tab
   (`availability-settings.tsx`), a completely different data model that is
   also called "availability".

Users see "Set status" in two places and a third weekly-schedule editor with
the same label. The status also shows as `AvailabilityBadge` on skill pages and
public profiles.

- **Recommendation:** rename the weekly schedule to "Session windows" or
  "Weekly schedule" everywhere; keep exactly **one** status control in the
  sidebar (remove the dashboard welcome duplicate); link the two concepts
  explicitly ("Your status badge" vs. "When you're free for sessions").

### M2. Notifications: no preferences + category overlap

> ✅ **Resolved 2026-08-20** — `src/lib/notification-categories.ts` is the single type→category map; page tabs are derived from it (no overlaps, no orphaned types); per-category mutes persist on `profiles.notification_preferences` and hide items in both the page and the bell dropdown.

`notifications.tsx` has 9 tabs ("Needs action", "Messages", "Sessions",
"Community", "Projects", "Reputation", "Achievements", "Moderation"), but the
type map has overlaps: `session_invite` appears under both "Needs action" and
"Sessions"; `connection_request` under both "Needs action" and "Reputation";
`challenge_submitted` under "Needs action" and "Community". So one item shows in
multiple tabs, and there is no way to mute a category.

- **Recommendation:** give each notification type a single canonical tab (a
  notification type map with exactly one owner), and add per-category
  preferences (silence community, sessions, etc.) — the natural home for them
  is the new Settings hub from H5.

### M3. Duplicate community navigation surfaces

> ✅ **Resolved 2026-08-20** — one owner per destination: "Profile" removed from the rail, "Projects" relabeled "Project updates" (feed filter, not the projects surface), and "Challenges" removed from the rail — the app sidebar owns the Challenges destination. The community feed's `challenges` nav id stays valid for deep links (the nav catalog already keeps unsurfaced ids alive). "Trending" stays: it's a community-feed sort, not a duplicate of any app-level destination.

The app-level sidebar has: Dashboard, Library, Explore, Challenges, Sessions,
Community, Connections, Messages, Notifications, Your Studio. The community
page adds its own left rail with its own groups (Feed / Post types / Discover /
You). That means **Challenges, Trending, Projects, Profile** appear both in the
app sidebar and inside the community rail, and "You → Profile" inside
community duplicates "Your Studio" in the sidebar. Mobile users get the app
bottom nav _and_ a community mobile bottom nav on top.

- **Recommendation:** decide one owner for cross-cutting destinations
  (Challenges = app-level, keep in sidebar; community rail = community-only
  feed types + spaces). Remove "Projects"/"Profile" from the community "You"
  group, or make them deep-links that also highlight the app-sidebar entry.

### M4. Dead links to `/u/` for handle-less profiles

> ✅ **Resolved 2026-08-20** — shared `ProfileLink` renders a non-interactive element for handle-less profiles; used in all 7 verified sites.

Many cards render `<Link to="/u/$handle" params={{ handle: c.handle ?? "" }}>`
even when the handle is null → navigates to `/u/` → 404 page. Verified in:
`explore.tsx` (people grid), `suggested-creators.tsx`, `skills.$slug.tsx`
(teachers + learners), `project-people.tsx`, `project-main-content.tsx`,
`project-header.tsx`.

- **Recommendation:** when `handle` is missing, render a non-link row (or a
  disabled state) instead of a broken link. A helper like
  `profileLink(handle)` returning `{to, params} | null` would centralize this.

### M5. "Start a conversation" from public profile is a dead end for non-connections

> ✅ **Resolved 2026-08-20** — link only renders for accepted connections and deep-links `/messages?c=…`; browser-verified (connected shows, non-connected doesn't).

`u.$handle.tsx` shows a "Start a conversation" link to `/messages` for **any**
signed-in viewer, even when there is no accepted connection — but Messages only
lists accepted connections, so the user lands on "The table is empty" with no
way to start a thread with this person (the Connect flow is a separate button).
Project People handles this correctly (message icon only shows when an accepted
connection exists) — the public profile doesn't.

- **Recommendation:** mirror `project-people.tsx`: only show the message link
  when a connection exists (deep-link `/messages?c=…`), otherwise show Connect
  only, or have "Start a conversation" fall back to sending a connection
  request.

### M6. Library "View all / Your projects" misdirects

> ✅ **Resolved 2026-08-20** — "Your projects → View all" now points at `/profile`.

Dashboard "Your projects" module links "View all" to `/explore` — but Explore
shows the whole network, not _your_ projects. Your projects are in `/profile`
(Projects tab) and the Library. Similarly the "Applications" module deep-links
to `/projects/$id?tab=people` which is correct, but "View all" (projects) has no
"my projects" surface.

- **Recommendation:** point "Your projects → View all" at the Studio Projects
  tab (`/profile` with a `?tab=projects` search param) or the Library.

### M7. Sessions "Requests" is a buried tab with no deep link

> ✅ **Resolved 2026-08-20** — sessions tabs are URL-driven (`?tab=requests`); the dashboard "Review requests" CTA and TodayCard deep-link to the queue; tab clicks update the URL.

The dashboard "Review requests" button links to `/sessions`, but session
requests live in the "Requests" tab (client-side state, no URL param). The
sidebar counts pending requests but clicking the badge opens the default
"Upcoming" view — the count and the destination disagree.

- **Recommendation:** make the sessions tabs URL-driven
  (`/sessions?tab=requests`) so dashboard + badge can deep-link to the actual
  queue.

### M8. Search results limited to sessions I organize

> ✅ **Resolved 2026-08-20** — global search also matches sessions the user participates in (via `session_participants`), de-duped against organized.

`global-search.tsx` filters sessions with `.eq("organizer_id", me.profile.id)`,
so sessions I'm invited to/participating in never appear. Same for library
(owner-only is correct). Sessions should include participant matches.

---

## 🟡 Low / polish

### L1. Label inconsistency

> ✅ **Resolved 2026-08-20** — mobile primary nav now uses the same labels as the sidebar ("Dashboard", "Your Studio"); the profile "Teams I build with" heading now reads "Crews I build with" (the rest of the app already said "Crew").

- Sidebar: "Your Studio" / mobile nav: "Studio" / community rail: "Profile".
- Sidebar: "Dashboard" / mobile nav: "Home".
- Public page breadcrumbs: "Tethyr / Studio", "Tethyr / Project", "Tethyr /
  Hub", "Tethyr / Crew" — "Crew" vs. "Team" naming (`/teams` route vs. "Form a
  crew" copy).
- Pick one label per destination and keep it across desktop/mobile/breadcrumbs.

### L2. Duplicate "What's next" completions

> ✅ **Resolved 2026-08-20** — the dashboard welcome header no longer shows the "{pct}% complete" ring; the next-steps module ("Finish setting up your profile — X/Y done" with action items) is now the single completeness surface on the dashboard. The profile `CompletenessRing` and community CTA remain, but no screen shows completeness twice.

Profile completeness is surfaced in 4 places: dashboard welcome ring,
dashboard next-steps module, profile `CompletenessRing`, and community
"Your Tethyr" CTA. The welcome header additionally shows rep, availability, and
completeness in one row. Consider consolidating the two dashboard surfaces
(welcome + next-steps) — they say the same thing twice on the same screen.

### L3. Visual inconsistency in headers

> ✅ **Resolved 2026-08-20** — page titles use the shared `font-display … font-semibold tracking-tight` style, and a shared `SegmentedControl` component (`src/components/tethyr/segmented-control.tsx`) now drives the Explore views and Skill workshop tabs with one container + pill treatment and proper tab semantics — including the ARIA tabs keyboard pattern (roving tabindex, arrow-key selection + focus), covered by component tests. The challenges type/difficulty/status filters stay as chips — that's a multi-group filter row, not a tab bar, and `rounded-full` chips match the radius scale for tags.

- `sessions.tsx` / `sessions.$id.tsx` use `text-2xl font-bold` headers while
  connections/dashboard use `font-display text-2xl/3xl font-semibold`.
- Notifications uses `font-display text-2xl font-bold` (bold, not semibold).
- The Messages page uses `font-display text-lg` for the same "page title" role.
- `skills.$slug` tab bar, `challenges` filters, and `explore` tabs all implement
  "chips/segmented control" slightly differently (rounded-full vs rounded-xl
  containers, different active treatments). Extract one `SegmentedControl`
  component and one page-title style.

### L4. Footer duplicates landing CTAs

> ✅ **Resolved 2026-08-20** — footer is auth-aware: authenticated-only links hidden for visitors; Join/Log In hidden for members (replaced with Studio/Discover links + Settings).

Footer shows "Join Tethyr" / "Log In" even for signed-in users, and "Projects"
→ `/explore` / "Community" → `/community` are authenticated-only — for a
signed-out visitor these footer links bounce to `/login`. Either hide them for
signed-in users (like the Dashboard link already is) or point to public
landing sections.

### L5. Empty states lack a next action on some surfaces

> 🟡 **Partially resolved 2026-08-20** — Messages empty states gained "Find people to connect with" CTAs. The Connections decorative divider is unchanged.

- Messages empty ("The table is empty") has no CTA to find people.
- Connections empty state links to Explore (good) but the "Requests waiting"
  row uses `RequestRow` with a decorative divider line that does nothing.
- The `ProfileLayout` `!isOwnProfile` "Collaborate" button (H4) — if kept, wire
  to the session request dialog.

### L6. Global search shortcut mismatch

> ✅ **Resolved 2026-08-20** — sidebar inline search has a `title="Search (press /)"` tooltip.

Desktop inline search opens with `/`; dialog search only opens with ⌘/Ctrl-K.
The project page reserves `/` for file search. Fine, but the sidebar inline
search gives no hint of the `/` shortcut and the top header has no search icon
on desktop — the only affordance is the sidebar box. Add a `title="Search (/)"`
tooltip.

---

## Recommended change order

1. **Fix dead-end routing** (H2, H3, M4, M5, M7) — smallest changes, immediate
   user-visible wins.
2. **De-duplicate space moderation** (H1) — one Reports inbox, Settings links
   to it.
3. **Add the Settings hub + notification preferences** (H5, M2) — the single
   biggest information-architecture gap; also resolves availability home (M1).
4. **Resolve cross-cutting navigation ownership** (M3, L1) — one label and one
   owner per destination.
5. **Consolidate duplicated UI patterns** (L2, L3) — page-title style,
   segmented control, completeness messaging.
6. **Polish empty states and footer** (L4, L5, L6).

Nothing here requires new top-level features — the loop already exists. The
work is consolidation, correct routing, and one missing settings surface.

---

## Second audit pass — 2026-08-20 (post-resolution sweep)

Re-audited routing, navigation labels, deep-link targets, and empty/CTA flows
after all original findings were resolved. Findings:

- **A1 (fixed) — Explore views not URL-driven.** `/explore` held its view in
  local state, so the footer's "Discover people" link (and any other deep
  link) always landed on the Projects view, and the back button couldn't
  move between views. Explore now mirrors the Sessions pattern: `?tab=`
  (`projects` | `creators` | `opportunities`) is the single source of truth;
  the footer "Discover people" link deep-links `?tab=creators`. Verified in
  the browser: direct load, tab clicks, and URL updates in both directions.
- **A2 (fixed) — Mobile community nav label drift.** The community mobile
  bottom nav read "Home" while the desktop rail reads "Home feed" for the
  same destination. Aligned to "Home feed" (fits at 390px; verified).
- **Checked clean**: notification → destination map covers every type with
  permission-safe fallbacks; sidebar/footer/mobile-primary-nav label sets
  agree (Dashboard / Your Studio / Crews); sessions tabs URL-driven with
  consistent labels; password-reset flow sends a link (no dead page);
  profile workspace grid carries the projects module the dashboard's
  "View all" points at; no `href="#"`, placeholder buttons, or console
  spam in app code; community feed nav ids (saved/following) still wired.
