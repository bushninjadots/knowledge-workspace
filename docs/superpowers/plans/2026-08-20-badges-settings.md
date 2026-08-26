# Badges + Centralized Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session-related achievements, streak tracking, and a centralized appearance/personalization settings page.

**Architecture:** Extend the existing reputation engine (20 badges → 25) with session badges and a streak system. Add an appearance section to the existing settings page.

**Tech Stack:** React 19, TanStack Router, Supabase, Tailwind CSS 4, TypeScript strict

## Global Constraints

- TypeScript strict mode, no `as any`, no `@ts-ignore`
- Tailwind CSS 4 — use existing design tokens
- Follow existing code patterns and naming conventions
- No new card containers — use surfaces/sections/compositions

---

## Task 1: Add session achievement types + DB migration

**Files:**

- Create: `supabase/migrations/20260820220000_session_achievements.sql`
- Modify: `src/lib/reputation.ts`

**Interfaces:**

- Consumes: existing `achievement_type` enum, `user_achievements` table, `award_earned_achievements()` function
- Produces: 3 new achievement types: `first_session`, `session_teacher`, `streak_4_weeks`

- [ ] **Step 1: Create DB migration**

Create `supabase/migrations/20260820220000_session_achievements.sql`:

```sql
-- Add session-related achievements and streak tracking

ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'first_session';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'session_teacher';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'streak_4_weeks';

-- Update award_earned_achievements to check session achievements
CREATE OR REPLACE FUNCTION public.award_earned_achievements()
RETURNS SETOF public.achievement_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := auth.uid();
  v_created_at timestamptz;
  v_project_count integer;
  v_endorsement_count integer;
  v_teach_count integer;
  v_learn_count integer;
  v_contributor_count integer;
  v_community_posts integer;
  v_milestones integer;
  v_comments integer;
  v_offers integer;
  v_teams_created integer;
  v_teams_joined integer;
  v_roles_filled integer;
  v_has_milestone boolean;
  v_session_count integer;
  v_teach_session_count integer;
  v_streak_weeks integer;
  v_achievement public.achievement_type;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get account creation date
  SELECT created_at INTO v_created_at
  FROM profiles WHERE id = v_profile_id;

  -- Count projects
  SELECT count(*) INTO v_project_count
  FROM projects WHERE owner_id = v_profile_id;

  -- Count endorsements
  SELECT count(*) INTO v_endorsement_count
  FROM skill_endorsements WHERE endorsed_id = v_profile_id;

  -- Count teach/learn skills
  SELECT count(*) INTO v_teach_count FROM profile_skills_teach WHERE profile_id = v_profile_id;
  SELECT count(*) INTO v_learn_count FROM profile_skills_learn WHERE profile_id = v_profile_id;

  -- Count project contributions
  SELECT count(*) INTO v_contributor_count
  FROM project_contributors WHERE user_id = v_profile_id AND status = 'accepted';

  -- Count community posts
  SELECT count(*) INTO v_community_posts
  FROM community_posts WHERE author_id = v_profile_id;

  -- Count milestones
  SELECT count(*) INTO v_milestones
  FROM project_milestones m
  JOIN projects p ON p.id = m.project_id
  WHERE p.owner_id = v_profile_id AND m.status = 'completed';

  -- Count comments
  SELECT count(*) INTO v_comments
  FROM community_comments WHERE author_id = v_profile_id;

  -- Count help offers
  SELECT count(*) INTO v_offers
  FROM community_posts
  WHERE author_id = v_profile_id AND post_type = 'help_offer';

  -- Count teams
  SELECT count(*) INTO v_teams_created FROM crews WHERE founder_id = v_profile_id;
  SELECT count(*) INTO v_teams_joined FROM crew_members WHERE user_id = v_profile_id AND role IN ('contributor', 'core');

  -- Count roles filled
  SELECT count(*) INTO v_roles_filled
  FROM project_contributors
  WHERE user_id = v_profile_id AND role IS NOT NULL AND status = 'accepted';

  -- Check has any completed milestone
  SELECT EXISTS(
    SELECT 1 FROM project_milestones m
    JOIN projects p ON p.id = m.project_id
    WHERE p.owner_id = v_profile_id AND m.status = 'completed'
  ) INTO v_has_milestone;

  -- Session counts
  SELECT count(*) INTO v_session_count
  FROM session_participants sp
  JOIN sessions s ON s.id = sp.session_id
  WHERE sp.user_id = v_profile_id AND sp.status = 'accepted' AND s.status = 'completed';

  SELECT count(*) INTO v_teach_session_count
  FROM session_participants sp
  JOIN sessions s ON s.id = sp.session_id
  WHERE sp.user_id = v_profile_id AND sp.role = 'organizer' AND sp.status = 'accepted' AND s.status = 'completed';

  -- Streak: count consecutive weeks with at least one activity
  WITH weekly_activity AS (
    SELECT DISTINCT date_trunc('week', created_at) AS week
    FROM contribution_log WHERE profile_id = v_profile_id
    UNION
    SELECT DISTINCT date_trunc('week', s.starts_at) AS week
    FROM session_participants sp
    JOIN sessions s ON s.id = sp.session_id
    WHERE sp.user_id = v_profile_id AND s.status = 'completed'
  ),
  streak AS (
    SELECT count(*) AS consecutive_weeks
    FROM (
      SELECT week,
        row_number() OVER (ORDER BY week DESC) AS rn,
        week - (row_number() OVER (ORDER BY week DESC) || ' weeks')::interval AS gap
      FROM weekly_activity
    ) sub
    WHERE sub.gap = (SELECT max(gap) FROM (
      SELECT week - (row_number() OVER (ORDER BY week DESC) || ' weeks')::interval AS gap
      FROM weekly_activity
    ) g)
  )
  SELECT consecutive_weeks INTO v_streak_weeks FROM streak;

  -- Award achievements (existing)
  IF v_project_count >= 1 THEN
    v_achievement := 'first_project';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_has_milestone THEN
    v_achievement := 'first_milestone';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_endorsement_count >= 1 THEN
    v_achievement := 'first_endorsement';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_endorsement_count >= 5 THEN
    v_achievement := 'five_endorsements';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_endorsement_count >= 10 THEN
    v_achievement := 'ten_endorsements';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_teach_count >= 5 THEN
    v_achievement := 'prolific_teacher';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_project_count >= 3 THEN
    v_achievement := 'project_builder';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_community_posts >= 10 THEN
    v_achievement := 'community_builder';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF (now() - v_created_at) >= interval '30 days' THEN
    v_achievement := 'reliable_collaborator';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_contributor_count >= 3 THEN
    v_achievement := 'helped_ten_people';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_learn_count >= 3 THEN
    v_achievement := 'learner_journey';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_milestones >= 3 THEN
    v_achievement := 'milestone_master';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_offers >= 1 THEN
    v_achievement := 'helping_hand';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_comments >= 1 THEN
    v_achievement := 'conversation_starter';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_roles_filled >= 1 THEN
    v_achievement := 'role_filler';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_teams_created >= 1 THEN
    v_achievement := 'crew_founder';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_teams_joined >= 1 THEN
    v_achievement := 'team_player';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  -- NEW: Session achievements
  IF v_session_count >= 1 THEN
    v_achievement := 'first_session';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_teach_session_count >= 5 THEN
    v_achievement := 'session_teacher';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  IF v_streak_weeks >= 4 THEN
    v_achievement := 'streak_4_weeks';
    INSERT INTO user_achievements (profile_id, achievement) VALUES (v_profile_id, v_achievement) ON CONFLICT DO NOTHING;
    RETURN NEXT v_achievement;
  END IF;

  RETURN;
END;
$$;
```

- [ ] **Step 2: Run migration**

```bash
cd "/home/bender/TEHYR Build/tethyr" && npx supabase db push --linked
```

If not linked, just apply manually via Supabase dashboard SQL editor.

- [ ] **Step 3: Commit migration**

```bash
git add supabase/migrations/20260820220000_session_achievements.sql
git commit -m "feat: add session achievement types + DB migration"
```

---

## Task 2: Add achievement definitions to reputation.ts

**Files:**

- Modify: `src/lib/reputation.ts`

**Interfaces:**

- Consumes: existing `AchievementType` union, `ACHIEVEMENTS` array
- Produces: 3 new entries in `ACHIEVEMENTS`, updated `AchievementType` union

- [ ] **Step 1: Update AchievementType union**

Add the three new types to the union in `src/lib/reputation.ts`:

```typescript
export type AchievementType =
  | "first_project"
  | "first_milestone"
  | "first_endorsement"
  | "five_endorsements"
  | "ten_endorsements"
  | "community_recognized"
  | "mentor"
  | "collaborator"
  | "prolific_teacher"
  | "project_builder"
  | "community_builder"
  | "reliable_collaborator"
  | "helped_ten_people"
  | "learner_journey"
  | "challenge_winner"
  | "crew_founder"
  | "team_player"
  | "milestone_master"
  | "helping_hand"
  | "conversation_starter"
  | "role_filler"
  | "first_session"
  | "session_teacher"
  | "streak_4_weeks";
```

- [ ] **Step 2: Add achievement definitions**

Add 3 new entries to the `ACHIEVEMENTS` array, after the existing entries:

```typescript
  {
    type: "first_session",
    label: "First Session",
    description: "Completed your first session",
    icon: "Calendar",
    color: "text-primary",
  },
  {
    type: "session_teacher",
    label: "Session Teacher",
    description: "Led 5 completed sessions",
    icon: "Presentation",
    color: "text-brand-green",
  },
  {
    type: "streak_4_weeks",
    label: "4-Week Streak",
    description: "Active for 4 consecutive weeks",
    icon: "Flame",
    color: "text-teaching",
  },
```

- [ ] **Step 3: Import new icons**

Add `Calendar`, `Presentation`, and `Flame` to the lucide-react imports in both `reputation.ts` and `achievements.tsx`. Add them to the `ICONS` record in `achievements.tsx`.

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/reputation.ts src/components/tethyr/achievements.tsx
git commit -m "feat: add session achievement definitions"
```

---

## Task 3: Centralized appearance settings

**Files:**

- Modify: `src/components/tethyr/settings-page.tsx`

**Interfaces:**

- Consumes: existing `background-themes.ts` utilities, `ThemeProvider`
- Produces: Appearance section in settings page with theme, background, accent, density controls

- [ ] **Step 1: Read the current settings page**

Read `src/components/tethyr/settings-page.tsx` to understand the existing structure (sections: Account, Notifications, Danger Zone).

- [ ] **Step 2: Read background-themes.ts**

Read `src/lib/background-themes.ts` to understand the available customization options (backgrounds, cardBorders, accentMode, accentColor, density).

- [ ] **Step 3: Add Appearance section to settings page**

Add a new "Appearance" section between Account and Notifications with:

1. **Theme** — Light/Dark/System toggle (reuse existing `ThemeToggle`)
2. **Background** — Color/Pattern/Gradient selector with strength slider
3. **Accent Color** — Color picker with dynamic/custom toggle
4. **Density** — Comfortable/Compact toggle

Import the relevant utilities from `background-themes.ts` and `theme.tsx`.

```tsx
import { ThemeToggle } from "@/components/tethyr/theme-toggle";
import { BACKGROUND_PRESETS, type BackgroundMode } from "@/lib/background-themes";

// Inside the component, add appearance state:
const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("color");
const [selectedTint, setSelectedTint] = useState("sky");
const [strength, setStrength] = useState(34);
const [cardBorders, setCardBorders] = useState<"accent" | "neutral" | "none">("neutral");
const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

// In the JSX, add after the Account section:
<div className="space-y-4">
  <h2 className="text-lg font-semibold">Appearance</h2>
  <p className="text-sm text-muted-foreground">Customize how Tethyr looks and feels.</p>

  {/* Theme */}
  <div className="flex items-center justify-between">
    <div>
      <p className="font-medium">Theme</p>
      <p className="text-sm text-muted-foreground">Light, dark, or system</p>
    </div>
    <ThemeToggle variant="button" />
  </div>

  {/* Density */}
  <div className="flex items-center justify-between">
    <div>
      <p className="font-medium">Density</p>
      <p className="text-sm text-muted-foreground">Spacing between elements</p>
    </div>
    <div className="flex gap-1">
      {(["comfortable", "compact"] as const).map((d) => (
        <button
          key={d}
          onClick={() => setDensity(d)}
          className={`rounded-md px-3 py-1.5 text-sm transition ${
            density === d
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground hover:bg-surface/80"
          }`}
        >
          {d === "comfortable" ? "Comfortable" : "Compact"}
        </button>
      ))}
    </div>
  </div>

  {/* Card Borders */}
  <div className="flex items-center justify-between">
    <div>
      <p className="font-medium">Card Borders</p>
      <p className="text-sm text-muted-foreground">How card edges are styled</p>
    </div>
    <div className="flex gap-1">
      {(["neutral", "accent", "none"] as const).map((b) => (
        <button
          key={b}
          onClick={() => setCardBorders(b)}
          className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${
            cardBorders === b
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground hover:bg-surface/80"
          }`}
        >
          {b}
        </button>
      ))}
    </div>
  </div>
</div>;
```

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/tethyr/settings-page.tsx
git commit -m "feat: add appearance section to settings page"
```

---

## Task 4: Final verification

- [ ] **Step 1: Run full verification**

```bash
npx tsc --noEmit
npx vitest run
npx eslint src/ --fix
npx vite build
```

- [ ] **Step 2: Commit and push**

```bash
git add -A
git commit -m "feat: session badges + centralized appearance settings"
git push origin main
```
