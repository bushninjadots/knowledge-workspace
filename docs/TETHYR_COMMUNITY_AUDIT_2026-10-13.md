# Community Page Audit & Rework — 2026-10-13

Scope: `/community` (feed, Following, Saved, Communities, a space, reading view, composer), desktop 1440 / tablet 900 / phone 390, light and dark, as Maya (seed data). Screenshots: `tethyr-audit/community/shots/before-*` and `after-*`.

## Purpose

Community is "a place for shared practice, conversation, challenges, and contribution" (TETHYR_PRODUCT). It should make it easy to **find work worth responding to and respond** — help someone, give feedback, join a collaboration — and to share your own progress.

## Primary goal

Read the feed and act on a post (reply, appreciate, offer help) in as few steps as possible. Posting is second.

## Current issues

### Broken (layout bugs)

1. **Communities grid collapses.** Columns are chosen by viewport width (`xl:grid-cols-4`), but the feed column is only about 600px between the app sidebar, the community nav card and the fixed right rail. At 1440px the cards are 140px wide: names truncate to "D…", the "Open" badge stacks one letter per line, and Join buttons overflow the card.
2. **Reading view crushes the post.** The same viewport-vs-column mismatch: the selected post pane is about 130px wide and the author's title wraps letter by letter.
3. **Phone header stack.** A "TETHYR · Build in public, with people." strip, then a community tab bar whose floating "+" covers the "Following" label, then the app's own bottom bar. That's two navigation bars and an overlap.

### Inconsistent

4. **A whole column for four links.** The community nav card (Home feed, Following, Communities, Saved) takes 256px and repeats the app sidebar's "Community" entry.
5. **The filter wall.** Three always-open rows (sort, 13 focus chips, 9 type chips: about 30 controls). The sticky bar is `-mx-2` wider than the search box above it and uses a different background, so it reads as a misaligned box.
6. **Type said three times.** A post shows "PROJECT UPDATE" (mono tag), "PROJECTS" (community pill) and "Update" (flair). The left border alternates green and purple with no legend.
7. **Initials instead of faces.** Post cards ignore `avatar_url`.
8. **Empty data blocks.** Project updates render "Progress 0% · 0 contributors · 0 feedback notes".
9. **The composer is a toolbar wall at rest.** Title, 9 formatting buttons, 5 type buttons and More are visible before you've typed anything.
10. **The right rail floats.** It's `position: fixed`, so it's outside the page's grid and sits off the content's rhythm. "Useful resources" lists your _own_ project links, which isn't a community signal.
11. **Space view buries the room.** The "graph" summary and a raw expandable "connections outline" push the conversation below the fold.

## Information hierarchy

1. What's happening now (feed), with a light sense of pulse
2. Where you can help (requests that match your skills)
3. Your rooms (spaces) and how to narrow the feed (types, sort)
4. Secondary: trending skills, challenges, setup

## Reuse

`ComposerBar`, `PostCard`, `CommunityFeedList`, `CommunityCard`, `SpaceHeader`, `useInfinitePosts`, `useCommunitySpaces`, `useSignedStorageUrl`, the notifications realtime channel (`notifications:{userId}`, which already receives a row per DM via `notify_new_message`), `useSendMessage`, sonner toasts, tokens `--user-accent*`, `section-label`, `card-border`, `font-display`, `bg-noise`.

## Proposed information architecture

- **One column of navigation, not two.** The community nav card becomes a tab bar in the page header (For you · Following · Spaces · Saved), on every width. The phone strip and the duplicated tab bar go; the compose button floats at the bottom right on phones.
- **Feed width follows the column, not the window.** Grids and the reading split use container queries, so they adapt to the space they actually have.
- **Right rail in the flow.** A sticky column inside the page grid at ≥1280px; on smaller widths, its content moves into a "Pulse" drawer.
- **Filters: one row.** Post-type chips (a single scrollable row) + a Sort menu + a Filters popover (focus, my skills) with an active-count badge.
- **Composer: compact until used.** One line (avatar, prompt, quick types). Title and formatting appear when you focus or have content.
- **Post card: one type tag, a real face, no empty blocks.**
- **Space: the conversation first.** Rules and "who's here" fold into a collapsible details strip.

### New, Tethyr-specific

- **Live pulse strip** above the feed: who posted in the last 24 hours, open help requests, and the busiest space, with a live dot. Built from data already loaded.
- **"You could help"**: help and collaboration requests that match the skills you teach, with a one-click "I can help" (the existing `offer` action). Product rule 4: discovery leads to a meaningful next action.
- **Your spaces** in the rail (replacing "Useful resources"), so your rooms are one click away.
- **Message popups:** a new direct message appears as a card in the bottom-right corner, anywhere in the app, with the sender's face, a preview, an inline quick reply, and Open. It's skipped when you're already reading that conversation and when message notifications are off.

## Scope

Changes: community page shell, header/filters, composer rest state, post card header/body, communities grid, reading split, space header/details, right rail, two new rail/feed pieces, the global message popup. Unchanged: data model, post types, moderation, space chat, comments, challenges route.

## State and responsive plan

Loading skeletons stay; empty states keep their composer jump. Phone 390 / tablet 900 / desktop 1280+ checked light and dark. Every control is a real button or link with an accessible name; the tab bar uses `aria-current`; popups are `role="status"`, can be dismissed with Escape, and respect reduced motion.

## Validation plan

Typecheck, lint, unit tests, the before/after screenshot matrix, and a browser pass: tabs, filters, composer expand, the reading view, the communities grid, the space view, and a DM sent from a second account showing as a corner popup and accepting a quick reply.

## What shipped

| Issue                                | Change                                                                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2 Spaces grid / reading view crush | Feed column is a CSS container; the spaces grid, the reading split and the header layout use container queries. Cards are now ~290px wide at 1440; the reading pane is ~500px.                 |
| 3–4 Two navs, overlap, wasted column | One tab row (For you · Following · Spaces · Saved) on every width; old nav card, phone tab bar and "Build in public" strip removed. Phone compose button sits above the shell's scroll-to-top. |
| 5 Filter wall                        | One row: type chips (ordered by what needs a response, fading at the edge) + Sort menu + Filters menu with a count. No sticky box in a different colour.                                       |
| 6 Type said three times              | One mono type tag; the category pill is gone; a flair that only repeats the type is hidden.                                                                                                    |
| 7 Initials                           | `MemberAvatar` signs avatar paths (cached per author) on posts and the composer.                                                                                                               |
| 8 Empty progress blocks              | Shown only when there is progress, contributors or feedback.                                                                                                                                   |
| 9 Composer wall                      | Rests as one line; title, formatting, types and destination open on first focus and stay open until you post.                                                                                  |
| 10 Floating rail                     | Sticky column in the page grid; trending skills filter the feed; "Your spaces" replaces "Useful resources"; below 1280px it's the Pulse drawer.                                                |
| 11 Space view                        | "Who's here" (graph + outline) folds into one line with counts; rules fold for members, stay open for visitors. Breadcrumb and heading say "Spaces".                                           |
| Reading view                         | The comment box rendered twice; now once.                                                                                                                                                      |
| New                                  | Live pulse line; "You could help" with one-click offer; message popups with quick reply (anywhere in the app, skipped while reading that thread or when messages are muted).                   |
| Bug found                            | Skills are names on members but slugs on posts/roles, so "My skills", "Recommended", Explore's "match" sort and the learning-match chip never matched. `skillKey()` now compares both forms.   |
| Bug found                            | Message notifications opened the inbox, not the conversation; they now open `/messages?c=…`.                                                                                                   |

Checked: unit tests (pulse, help matching, flair rule, skill keys, popup stack, message destination), a 23-step browser pass, an end-to-end DM popup test (pop, merge, quick reply, suppressed while reading), axe WCAG A/AA on 12 page states (no violations), and the before/after screenshot matrix.

## Recommendations

Ordered roughly by value for effort. None of these are built yet.

### Make responding the habit

1. **Answered states for asks.** Let the asker mark a reply as "this helped" on help requests and questions (the `helpful` action exists). Show "Solved" on the card and count it towards reputation. Pulse and "You could help" then skip solved asks.
2. **Reply-first cards.** Put a one-line reply field on asks in the feed (the same as the popup quick reply), so helping doesn't need a click into the thread.
3. **"Waiting on you" digest.** People who offered help or were @mentioned see a small "3 threads are waiting on you" chip in the Pulse line.

### Give the feed a point of view

4. **Weekly build log.** A recurring "What did you ship this week?" thread, pinned on Fridays, with replies grouped by project. Ship It Saturdays already proves the demand; make it a native format.
5. **Show the work.** Showcases and project updates could lead with the project's cover or a screenshot strip and link to the project page's activity, which is Tethyr's "evidence over claims" rule made visible in the feed.
6. **Kudos with a reason.** Replace bare "Appreciate" with a reason: "clear writeup", "helped me", "great craft". It's a richer signal for reputation, and it reads better than a counter.

### Spaces that feel like rooms

7. **Live in the room.** Space chat already has typing presence; add a "3 here now" avatar stack in the space header, and show unread counts on "Your spaces" (the read cursor exists in `useSpaceReadState`).
8. **Room rituals.** Owners can schedule a recurring prompt (Monday goals, Friday demos) that auto-posts and pins.
9. **Space cards with life.** Show the last activity time and two recent posters' faces on each space card, so people can tell which rooms are active at a glance.

### People and messages

10. **Popup follow-ups.** Group popups by sender when someone sends many messages. Add "Mark as read" alongside Reply, and an optional sound or desktop notification setting (the Notification API) when the tab is hidden.
11. **Follow, quietly.** The Follow button repeats on every card by the same author. Show it on hover and in the author hover card only, and say "Following" on cards from people you follow.
12. **Introductions.** When "You could help" connects two people for the first time, offer a one-line intro message from the post, which turns help into a connection.

### Unique to Tethyr

13. **Collab matchmaking strip.** For collaboration requests, show "2 people in your network have this skill" with their faces, built from connections and skill keys.
14. **Feed by project graph.** A "Near your work" view: posts from people on your projects, forks of your projects, and projects that share your skills (the project graph engine already computes these).
15. **Challenge moments.** When someone completes a challenge, post a small achievement card in the feed with the submission, so challenges create community content instead of living on a separate page.

### Visual polish still open

16. Type colour: the tag and the left border share one hue per type, but `primary` is near-black in the default theme, so help requests and questions read as uncoloured next to green and purple types. Give "asks" (help, question, feedback) their own warm hue so the things that need a response stand out.

Fixed during review: the card's "More" label hides on narrow columns so the action row stays on one line, and the space header panel is tinted from `--surface`, matching the cards, instead of the near-black `--background` in dark mode.

## Follow-up — messaging dock, colour pass, space identity (same day)

- **Messaging dock** (`messaging-dock.tsx`): a Messages launcher in the bottom-right on tablet and up, with a live unread count, a conversation list and a compact thread. New-message popups open threads in it.
- **Colour pass:** one `community-card` surface for every box, and a hue per kind of post from theme tokens (`lib/post-tone.ts`). Asks use `--caution`, so the things that need a response stand out.
- **Space identity** (migration `20261013120000_space_identity`, pgTAP `space_identity.sql`):
  - Owners can set a banner and picture (saved in their own folder of the `avatars` / `banners` buckets, so the existing storage policies cover it).
  - They can also set a tagline, a markdown About, a welcome note, a colour, up to 8 topics and up to 5 links. Each field has a database CHECK, and links must be http(s).
  - Settings → "Customize your space" shows a live preview, with a sticky save bar.
  - The space page gets a forum header (banner, picture, tagline, stats, topics), a dismissible welcome note for members, and an About column (About, links, who runs it, rules).
  - Spaces cards show the banner, the tagline and the space's colour.
- **Fixed along the way:** markdown lists rendered with a `<br>` between items and no `<ul>`; the settings page's rule buttons had no accessible names.
- **Hosted:** the migration still needs applying to the hosted database (`supabase db push`) before the new fields work there.
