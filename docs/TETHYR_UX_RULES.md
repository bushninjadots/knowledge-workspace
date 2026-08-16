# Tethyr UX Rules and AI Workflow

> Mandatory workflow for significant product, UX, or UI changes. Small bug fixes may use judgment, but must still preserve the rules in [`AGENTS.md`](../AGENTS.md).

## Operating Principle

Do not jump from a request to JSX.

Use this sequence:

```text
Understand the product problem
  → Audit the current experience
  → Decide the information architecture
  → Propose the smallest strong change
  → Implement
  → Review the result
  → Validate states, responsiveness, accessibility, and tests
```

## Before Changing a Page

Inspect:

- Existing page structure
- Existing route and auth boundary
- Existing components and utilities
- Existing design tokens and styles
- Existing navigation and related destinations
- Existing responsive behavior
- Existing loading, empty, and error states
- Existing duplicated UI or competing implementations
- Relevant product, audit, architecture, and feature docs

Search before reimplementing. Reuse a component when it represents the same stable product concept.

## Required Design Reasoning

Before a significant change, answer:

### 1. Purpose

What is this page or component for?

### 2. Primary User

Who is using it, and what context do they bring?

### 3. Primary Goal

What is the single most important thing the user should accomplish?

### 4. Information Hierarchy

What should be noticed first, second, and later? What can remain secondary?

### 5. Relationships

Which information belongs together? Which needs separation or a different reading order?

### 6. Interaction Model

What happens on click, expand, drag, edit, filter, submit, navigate, retry, or cancel?

### 7. State Coverage

How does it behave for:

- New users
- Empty data
- Loading
- Errors
- No results
- Long content
- Large datasets
- Mobile widths
- Keyboard users
- Reduced motion

### 8. Consistency

Which Tethyr pattern does this follow? If it differs, is the difference justified by the user's task?

### 9. Structural Risk

Is the problem actually caused by CSS, or is the product model, content order, or ownership of controls wrong?

## Proposal Before Implementation

For a meaningful UI change, provide a short plan before editing code. Use this response structure so the reasoning is visible and reviewable:

```md
## Purpose

What this page or change exists to accomplish.

## Primary goal

The one action or outcome that matters most.

## Current issues

What is confusing, broken, duplicated, or structurally weak today.

## Information hierarchy

What should be first, second, and secondary.

## Reuse

Existing routes, components, hooks, tokens, and patterns to reuse.

## Proposed information architecture

The proposed structure and interaction model.

## Scope

Files and behavior that will change, plus what will intentionally not change.

## State and responsive plan

Loading, empty, error, long-content, keyboard, desktop, tablet, and mobile behavior.

## Validation plan

Typecheck, tests, smoke/browser checks, accessibility review, and any limitations.
```

Only after this proposal is clear should implementation begin. For small fixes, use a condensed version rather than skipping the reasoning entirely.

Do not preserve a bad layout merely because it already exists. Do not redesign unrelated areas without a product reason.

## Design Review Mode

When asked for a design review, do not modify code. Audit the target as a senior product designer across:

- Information architecture
- User flow
- Visual hierarchy
- Typography
- Spacing
- Grid and layout
- Navigation
- Interaction design
- Responsiveness
- Accessibility
- Consistency with Tethyr
- Component reuse
- Duplicate UI
- Unnecessary UI
- Missing UI
- Empty, loading, and error states

Return:

1. What is good
2. What is bad
3. What is confusing
4. What is unnecessary
5. What is missing
6. Structural problems
7. Visual problems
8. Recommended information architecture
9. Recommended implementation
10. Priority order

Every recommendation must have a user, product, accessibility, or maintainability reason. Do not recommend trends for their own sake.

## Implementation Review

After implementation, inspect the changed experience again. Check:

- Does the primary goal remain obvious?
- Is the first meaningful content still above the fold where appropriate?
- Did any new container, badge, control, or animation add noise?
- Are existing patterns reused rather than duplicated?
- Are all states represented?
- Does mobile have a deliberate composition rather than a shrunken desktop layout?
- Are keyboard and screen-reader paths usable?
- Did the change introduce console errors, broken links, layout overflow, or dead actions?

Remove or simplify anything introduced without a clear reason.

## Change Classification

Classify discovered inconsistencies before fixing them:

- **Critical:** Blocks usability, access, safety, or product understanding.
- **High:** Major visual, interaction, or information-architecture inconsistency.
- **Medium:** Noticeable inconsistency with a meaningful cumulative cost.
- **Low:** Cosmetic difference with little user impact.

Fix in priority order. Do not randomly normalize every difference.

## Validation Expectations

For significant changes, use the narrowest relevant checks plus a broader safety check when practical:

- Typecheck
- Focused tests
- Route smoke tests
- Lint on changed files
- Browser inspection at desktop and mobile widths
- Console and network-error review
- Keyboard and accessibility review
- Build verification for route or server changes

Report environment limitations honestly. A source review is not a substitute for live browser verification.

## Design References and Figma

When a Figma reference is available, use it as visual evidence—not as an automatic override of Tethyr's product direction or binding guardrails.

Compare the reference against:

1. `TETHYR_PRODUCT.md` — does the proposed structure support the collaboration loop?
2. `AGENTS.md` — does it respect Tethyr's composition and visual constraints?
3. The current route and components — what is already canonical in code?
4. Responsive and accessibility requirements — does the reference cover real states and device sizes?

Record the meaningful mismatches before implementation. Preserve the intent of the reference where it improves the user's goal, but adapt or reject treatments that introduce generic SaaS patterns, unnecessary containment, weak hierarchy, or inaccessible interactions. If no Figma connector or inspectable design file is available, ask for screenshots, a link, or the relevant frames rather than implying that the design has been inspected.

## Escalation

If the requested implementation conflicts with the product definition or design constitution:

1. State the conflict.
2. Explain the user or product risk.
3. Propose the smallest better structure.
4. Ask for clarification only when the decision materially changes product direction.

The AI is expected to improve the product, not blindly obey a visually or logically bad request. It must also avoid silently expanding scope.
