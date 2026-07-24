# Tethyr Sessions — Development Roadmap

## Database Schema

### Tables
- `sessions` — core table (id, title, description, type, status, organizer_id, skill_id, project_id, community_id, exchange_id, starts_at, ends_at, duration_minutes, timezone, meeting_url, location, is_recurring, recurrence_rule, created_at, updated_at)
- `session_participants` — (session_id, profile_id, role, status: invited/accepted/declined/pending, responded_at)
- `session_resources` — (id, session_id, user_id, title, url, file_path, resource_type, created_at)
- `session_notes` — (id, session_id, content, version, created_by, created_at, updated_at)
- `session_availability` — (id, profile_id, day_of_week, start_time, end_time, timezone, is_active, created_at)
- `session_requests` — (id, session_id, from_user_id, to_user_id, status, message, suggested_time, created_at, responded_at)

### Enums
- `session_type`: skill_exchange, mentoring, project_meeting, study_session, workshop, general
- `session_status`: draft, scheduled, invitation_sent, confirmed, in_progress, completed, cancelled
- `participant_role`: organizer, participant, mentor
- `participant_status`: invited, accepted, declined, pending
- `availability_status`: available, unavailable, tentative

### Indexes
- sessions: (organizer_id), (starts_at), (status), (skill_id), (project_id)
- session_participants: (session_id), (profile_id), (profile_id, status)
- session_availability: (profile_id, day_of_week)
- session_notes: (session_id)
- session_resources: (session_id)

### RLS Policies
- sessions: organizer CRUD, participants SELECT
- session_participants: organizer manage, participants SELECT own
- session_resources: session participants CRUD
- session_notes: session participants CRUD
- session_availability: owner CRUD, others SELECT
- session_requests: from/to user CRUD

---

## Phase 1 — Sessions Dashboard ✓ (Current)
- [x] Database migration (tables, enums, RLS, grants)
- [x] Route: `src/routes/_authenticated/sessions.tsx`
- [x] Hook: `src/hooks/use-sessions.ts` (queries, mutations, types)
- [x] Components:
  - [x] `sessions-layout.tsx` — three-column layout with sidebar nav
  - [x] `sessions-sidebar.tsx` — left nav (Upcoming, Calendar, History, Requests, Availability)
  - [x] `overview-cards.tsx` — summary stat cards
  - [x] `today-schedule.tsx` — today's timeline
  - [x] `upcoming-sessions.tsx` — upcoming session list
- [x] Update sidebar nav in `dashboard-sidebar.tsx`
- [x] Route params: `?tab=upcoming|calendar|history|requests|availability`

## Phase 2 — Calendar ✓ (Current)
- [x] Day view with hourly time slots
- [x] Week view with 7-column grid
- [x] Month view with date cells
- [x] Agenda view grouped by day
- [ ] Drag-and-drop scheduling (Phase 3 integration)
- [ ] Resize session duration
- [x] Calendar controls (prev, next, today, date picker)
- [x] Session click → expand card (Phase 4 for full detail page)
- [x] View switcher (day/week/month/agenda)
- [x] Today highlighting

---

## Audit Fixes Applied

### 2026-07-24
- **Storage buckets**: Created missing `avatars`, `banners`, `project-media` buckets with RLS policies (`20260724120000_fix_storage_buckets.sql`)
- **CSP headers**: Added `ws://localhost:54321` and `ws://127.0.0.1:54321` to `connect-src` for Supabase realtime
- **Auth grants**: Fixed 16 tables missing `GRANT SELECT` to `authenticated` role (`20260724100000_fix_grants_for_authenticated.sql`)
- **Supabase config**: Added email auto-confirm for local dev (`supabase/config.toml`)

### Known Remaining Items
- Community right sidebar is placeholder text (trending skills, help requests)
- `reputationLabel()` is a dead stub in `community-data.ts`
- `COMMUNITIES` and `ACTIVE_LEARNING_GOALS` are empty arrays
- `unsafe-eval` in CSP `script-src` (needed for Vite HMR in dev)

---

## Phase 3 — Schedule Session Wizard ✓
- [x] Step 1: Choose participants (search, invite)
- [x] Step 2: Session type selector
- [x] Step 3: Link content (title, description, meeting URL, location)
- [x] Step 4: Date/time/timezone/duration/recurring
- [x] Step 5: Confirmation & send invitations
- [x] Dialog-based wizard shell with step indicator
- [x] Wired to "+ Schedule Session" button in layout
- [x] Uses `useCreateSession` mutation (inserts session + participants)

## Phase 4 — Session Details Page ✓
- [x] Route: `sessions/$id.tsx`
- [x] Hero section (title, participants, status, actions)
- [x] Info panel (location, link, duration, timezone, organizer)
- [x] Participant list with status badges
- [x] Notes editor (add notes to sessions)
- [x] Follow-up actions (delete session)
- [x] Session click → navigate to detail (calendar, today, upcoming)
- [x] Route tree regenerated via TanStack Router CLI

## Phase 5 — Requests (Planned)
- [ ] Incoming invitations list
- [ ] Outgoing invitations list
- [ ] Accept/Decline/Suggest new time actions

## Phase 6 — Availability (Planned)
- [ ] Weekly schedule editor (Mon-Sun)
- [ ] Time slot creation (morning/afternoon/evening)
- [ ] Timezone selector
- [ ] Working hours, breaks, vacation mode
- [ ] Buffer time, max sessions/day, preferred length

## Phase 7 — Session History (Planned)
- [ ] Timeline layout of completed sessions
- [ ] Filters (date range, skill, project, user)

## Phase 8 — Session Resources (Planned)
- [ ] Upload/download/preview/remove
- [ ] Resource type categorization

## Phase 9 — Collaborative Notes (Planned)
- [ ] Rich text editor (headings, lists, checkboxes, tables, code blocks, markdown)
- [ ] Autosave, version history, export

## Phase 10 — Follow-up (Planned)
- [ ] Create follow-up session
- [ ] Mark goals complete, create tasks
- [ ] Leave feedback

## Phase 11 — Session Status Lifecycle (Planned)
- [ ] Status transitions with colors/icons
- [ ] Auto-transition logic

## Phase 12 — Search & Filters (Planned)
- [ ] Full-text search across sessions
- [ ] Filter chips (participant, skill, project, status, date)

## Phase 13 — Notifications (Planned)
- [ ] Reminders, accept/decline alerts, reschedule alerts
- [ ] Global notification center integration
