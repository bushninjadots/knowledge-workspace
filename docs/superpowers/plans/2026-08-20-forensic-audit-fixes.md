# Forensic Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the 4 remaining gaps from the forensic audit: error tracking, legal pages, terminology drift, and onboarding flow.

**Architecture:** Add Sentry for client-side error capture, create privacy/terms routes with footer links, standardize all skill terminology to "Skills I share"/"Skills I'm growing", and add a post-signup welcome modal.

**Tech Stack:** React 19, TanStack Router, Sentry (`@sentry/react`), Tailwind CSS 4, TypeScript strict

## Global Constraints

- TypeScript strict mode, no `as any`, no `@ts-ignore`
- Tailwind CSS 4 — use existing design tokens
- Border radius scale: `rounded-md` (inputs), `rounded-lg`/`rounded-xl` (cards), `rounded-full` (avatars/tags)
- Shadow scale: `shadow-sm` → `shadow-md` → `shadow-lg` (max for overlays)
- No new card containers — use surfaces/sections/compositions
- Follow existing code patterns and naming conventions

---

## Task 1: Add Sentry Error Tracking

**Files:**
- Create: `src/lib/sentry.ts`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Produces: `initSentry()` function called once at app root

- [ ] **Step 1: Install Sentry**

Run: `npm install @sentry/react`

- [ ] **Step 2: Create Sentry config**

Create `src/lib/sentry.ts`:

```typescript
import * as Sentry from "@sentry/react";

export function initSentry() {
  if (import.meta.env.DEV) return; // skip in development

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

- [ ] **Step 3: Initialize in root route**

In `src/routes/__root.tsx`, add the import and call at the top of `RootShell`:

```typescript
import { initSentry } from "@/lib/sentry";

// At the top of RootShell function, before any hooks:
initSentry();
```

Also wrap the route's `component` with `Sentry.withProfiler` if not already wrapped.

- [ ] **Step 4: Update error boundary**

In `src/routes/__root.tsx`, replace the existing `errorComponent` with Sentry's error boundary:

```typescript
import { ErrorBoundary } from "@sentry/react";

// In the route definition, replace errorComponent with:
errorComponent: ({ error, reset }) => (
  <ErrorBoundary onError={Sentry.captureException} fallback={<ErrorPage error={error} onRetry={reset} />}>
    <ErrorPage error={error} onRetry={reset} />
  </ErrorBoundary>
),
```

Note: Check if the existing `ErrorPage` component at `src/components/tethyr/error-page.tsx` is compatible. If the signature doesn't match, adapt accordingly.

- [ ] **Step 5: Add env var placeholder**

Add to `.env.example`:
```
VITE_SENTRY_DSN=
```

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add src/lib/sentry.ts src/routes/__root.tsx .env.example
git commit -m "feat: add Sentry error tracking"
```

---

## Task 2: Create Legal Pages

**Files:**
- Create: `src/routes/privacy.tsx`
- Create: `src/routes/terms.tsx`
- Modify: `src/components/tethyr/footer.tsx`
- Modify: `src/routes/signup.tsx`

**Interfaces:**
- Produces: `/privacy` and `/terms` routes, linked from footer and signup

- [ ] **Step 1: Create privacy policy page**

Create `src/routes/privacy.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 20, 2026</p>

      <div className="prose prose-neutral dark:prose-invert mt-8 space-y-6 text-foreground">
        <section>
          <h2 className="font-display text-xl font-semibold">1. Information We Collect</h2>
          <p className="mt-2 text-muted-foreground">
            Tethyr collects information you provide directly: your name, email address, handle,
            profile information, skills, projects, and community posts. We also collect usage data
            such as pages viewed, features used, and interactions with other users.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">2. How We Use Your Information</h2>
          <p className="mt-2 text-muted-foreground">
            We use your information to provide and improve the Tethyr platform, personalize your
            experience, facilitate connections between creators, and communicate with you about
            platform updates and features.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">3. Information Sharing</h2>
          <p className="mt-2 text-muted-foreground">
            We do not sell your personal information. We may share information with service providers
            who assist in operating the platform (e.g., hosting, authentication), and when required
            by law or to protect the safety of our users.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">4. Data Security</h2>
          <p className="mt-2 text-muted-foreground">
            We implement industry-standard security measures to protect your data. However, no
            method of transmission over the Internet is 100% secure, and we cannot guarantee
            absolute security.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">5. Your Rights</h2>
          <p className="mt-2 text-muted-foreground">
            You can access, update, or delete your account information at any time through your
            profile settings. You may also request a copy of all data we hold about you by
            contacting us.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">6. Cookies</h2>
          <p className="mt-2 text-muted-foreground">
            Tethyr uses essential cookies for authentication and session management. We do not
            use third-party advertising cookies or tracking pixels.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">7. Changes to This Policy</h2>
          <p className="mt-2 text-muted-foreground">
            We may update this privacy policy from time to time. We will notify you of any
            material changes by posting the new policy on this page and updating the "Last
            updated" date.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">8. Contact Us</h2>
          <p className="mt-2 text-muted-foreground">
            If you have questions about this privacy policy, please contact us through the
            Tethyr platform or at the email associated with your account.
          </p>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create terms of service page**

Create `src/routes/terms.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 20, 2026</p>

      <div className="prose prose-neutral dark:prose-invert mt-8 space-y-6 text-foreground">
        <section>
          <h2 className="font-display text-xl font-semibold">1. Acceptance of Terms</h2>
          <p className="mt-2 text-muted-foreground">
            By accessing or using Tethyr, you agree to be bound by these Terms of Service.
            If you do not agree, do not use the platform.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">2. Account Responsibilities</h2>
          <p className="mt-2 text-muted-foreground">
            You are responsible for maintaining the security of your account and for all
            activities that occur under your account. You must provide accurate and complete
            information when creating your account.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">3. User Content</h2>
          <p className="mt-2 text-muted-foreground">
            You retain ownership of all content you post on Tethyr. By posting content, you
            grant Tethyr a non-exclusive license to display, distribute, and promote your
            content on the platform.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">4. Community Standards</h2>
          <p className="mt-2 text-muted-foreground">
            You agree to interact respectfully with other users, not to harass, spam, or
            impersonate others, and not to post content that is illegal, harmful, or violates
            the rights of others.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">5. Intellectual Property</h2>
          <p className="mt-2 text-muted-foreground">
            Tethyr and its original content, features, and functionality are owned by Tethyr
            and are protected by copyright, trademark, and other intellectual property laws.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">6. Termination</h2>
          <p className="mt-2 text-muted-foreground">
            We may suspend or terminate your account at any time for conduct that violates
            these terms or is harmful to other users, the platform, or third parties.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">7. Limitation of Liability</h2>
          <p className="mt-2 text-muted-foreground">
            Tethyr is provided "as is" without warranties of any kind. We shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages resulting
            from your use of the platform.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">8. Changes to Terms</h2>
          <p className="mt-2 text-muted-foreground">
            We reserve the right to modify these terms at any time. Continued use of the
            platform after changes constitutes acceptance of the new terms.
          </p>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add links to footer**

In `src/components/tethyr/footer.tsx`, add legal links in the footer. Find the existing link sections and add a new section or add to an existing one:

```tsx
<div>
  <p className="mb-3 text-sm font-medium text-foreground">Legal</p>
  <ul className="space-y-2 text-sm">
    <li>
      <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
        Privacy Policy
      </Link>
    </li>
    <li>
      <Link to="/terms" className="text-muted-foreground hover:text-foreground">
        Terms of Service
      </Link>
    </li>
  </ul>
</div>
```

Make sure `Link` is imported from `@tanstack/react-router`.

- [ ] **Step 4: Add terms link to signup**

In `src/routes/signup.tsx`, find the text "Let's build with respect and keep Tethyr a place where creators thrive." and add links:

```tsx
<p className="mt-6 text-center text-xs text-muted-foreground">
  Let's build with respect and keep Tethyr a place where creators thrive.{" "}
  <Link to="/terms" className="underline hover:text-foreground">
    Terms of Service
  </Link>{" "}
  ·{" "}
  <Link to="/privacy" className="underline hover:text-foreground">
    Privacy Policy
  </Link>
</p>
```

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add src/routes/privacy.tsx src/routes/terms.tsx src/components/tethyr/footer.tsx src/routes/signup.tsx
git commit -m "feat: add privacy policy and terms of service pages"
```

---

## Task 3: Fix Terminology Drift

**Files:**
- Modify: `src/components/tethyr/community/skill-hub.tsx` (or wherever `teachers`/`learners` labels appear)
- Modify: `src/components/tethyr/profile-sections.tsx`
- Modify: `src/components/tethyr/landing/how-it-works.tsx`
- Modify: `src/components/tethyr/community/post-card.tsx`

**Interfaces:**
- Consumes: existing skill terminology patterns
- Produces: consistent "Skills I share" / "Skills I'm growing" terminology

- [ ] **Step 1: Find all terminology instances**

Run:
```bash
grep -rn "teachers\|learners\|teach\|learn\|Growing" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".test." | grep -v "use-current-user" | grep -v "workspace-layouts" | grep -v "activity-timeline" | grep -v "studio-direction"
```

Focus on user-facing labels only (not internal variable names, DB columns, or event types).

- [ ] **Step 2: Fix skill hub labels**

In the skill hub page (`src/routes/skills.$slug.tsx` or `src/components/tethyr/community/skill-hub.tsx`), find where `teachers` and `learners` are used as labels:

Change "teachers" count label to "sharing" or "teachers" (keep if it's a count label like "12 teachers").
Change "Growing" tab label — keep as "Growing" since it's the most current terminology.

The key fix is: wherever the UI says "teachers" or "learners" as a section header or filter label, change to:
- "Teachers" → "Sharing" (or keep as "teachers" if it's a count)
- "Learners" → "Growing" (or keep as "learners" if it's a count)

- [ ] **Step 3: Fix activity timeline labels**

In `src/components/tethyr/profile-sections.tsx`, find the activity timeline entries:

```typescript
// Around line 1605
"Added {skill} to teaching" → "Added {skill} to Skills I share"
"Started learning {skill}" → "Started growing {skill}"
```

Or use the more natural:
```typescript
"Added {skill} to teaching" → "Started sharing {skill}"
"Started learning {skill}" → "Started growing {skill}"
```

- [ ] **Step 4: Fix landing page copy**

In `src/components/tethyr/landing/how-it-works.tsx`, find "skills you can teach" and "want to learn":

```typescript
"skills you can teach" → "skills you share"
"want to learn" → "want to grow"
```

- [ ] **Step 5: Fix post card placeholder**

In `src/components/tethyr/community/post-card.tsx`, find "onboarding flow" in the comment placeholder and replace with something appropriate:

```typescript
// Change the placeholder text to be more specific to the context
```

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add src/
git commit -m "fix: standardize skill terminology to share/grow"
```

---

## Task 4: Add Post-Signup Welcome Modal

**Files:**
- Create: `src/components/tethyr/welcome-modal.tsx`
- Modify: `src/routes/_authenticated/dashboard.tsx`
- Modify: `src/routes/signup.tsx`

**Interfaces:**
- Produces: `<WelcomeModal>` component shown once after first signup
- Consumes: localStorage for dismissal state, TanStack Router for navigation

- [ ] **Step 1: Create welcome modal component**

Create `src/components/tethyr/welcome-modal.tsx`:

```tsx
import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";

const DISMISSED_KEY = "tethyr-welcome-modal-dismissed";

export function WelcomeModal() {
  const { data: user } = useCurrentUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (!dismissed) {
      setOpen(true);
    }
  }, [user]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Welcome to Tethyr, {user.display_name?.split(" ")[0] ?? "creator"}!
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            You're part of a community of people known by what they build.
            Here's how to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <Link to="/profile" onClick={handleDismiss}>
            <Button variant="outline" className="w-full justify-start gap-3">
              <span className="text-lg">🎨</span>
              <div className="text-left">
                <p className="font-medium">Add your skills</p>
                <p className="text-xs text-muted-foreground">Share what you teach and what you're growing</p>
              </div>
            </Button>
          </Link>

          <Link to="/explore" onClick={handleDismiss}>
            <Button variant="outline" className="w-full justify-start gap-3">
              <span className="text-lg">🔍</span>
              <div className="text-left">
                <p className="font-medium">Explore the community</p>
                <p className="text-xs text-muted-foreground">Find projects and people to collaborate with</p>
              </div>
            </Button>
          </Link>

          <Link to="/community" onClick={handleDismiss}>
            <Button variant="outline" className="w-full justify-start gap-3">
              <span className="text-lg">💬</span>
              <div className="text-left">
                <p className="font-medium">Join the conversation</p>
                <p className="text-xs text-muted-foreground">Ask questions, share work, find collaborators</p>
              </div>
            </Button>
          </Link>
        </div>

        <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={handleDismiss}>
          I'll explore on my own
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add welcome modal to dashboard**

In `src/routes/_authenticated/dashboard.tsx`, import and render the WelcomeModal:

```typescript
import { WelcomeModal } from "@/components/tethyr/welcome-modal";
```

Add `<WelcomeModal />` as the first child inside the dashboard's main content area (before the workspace grid).

- [ ] **Step 3: Remove first-session-onboarding from retired modules**

In `src/routes/_authenticated/dashboard.tsx`, find `RETIRED_DASHBOARD_MODULE_IDS` and remove `"welcome"` from the array since the new WelcomeModal replaces it.

- [ ] **Step 4: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add src/components/tethyr/welcome-modal.tsx src/routes/_authenticated/dashboard.tsx
git commit -m "feat: add post-signup welcome modal"
```

---

## Task 5: Final Verification

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
git commit -m "feat: forensic audit fixes — Sentry, legal pages, terminology, onboarding"
git push origin main
```
