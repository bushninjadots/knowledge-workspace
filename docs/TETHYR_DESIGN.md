# Tethyr Design Direction

> Canonical design direction. Binding guardrails live in [`AGENTS.md`](../AGENTS.md); this document explains the intent behind them.

## Desired Character

Tethyr should feel:

- Creative
- Technical
- Human
- Confident
- Modern
- Editorial
- Slightly experimental
- Crafted rather than assembled

The interface should feel like a place where people actually make things together—not a generic productivity dashboard wrapped in a social feed.

## Design Priorities

Every interface should prioritize, in this order:

1. Clarity
2. Hierarchy
3. Content
4. Context
5. Human personality
6. Consistency
7. Discoverability
8. Visual quality

Visual quality matters, but it is the result of strong structure, not a substitute for it.

## Design From the User's Goal Downward

Do not begin with components. Begin with the user's goal:

```text
User goal
  ↓
Information required
  ↓
Information hierarchy
  ↓
Page structure
  ↓
Interaction model
  ↓
Components
  ↓
Visual styling
```

A polished implementation of the wrong structure is still a bad interface.

## Composition Principles

### Work Before Metadata

Show the thing being built, the contribution being made, or the conversation taking place before secondary profile metadata.

### Hierarchy Before Decoration

Solve hierarchy with ordering, typography, whitespace, alignment, grouping, and contrast before reaching for gradients, shadows, borders, or color effects.

### Sections Before Containers

A page should be composed from meaningful sections and workspaces. Containers are useful when they clarify an independent object or interaction, not as a universal spacing fix.

### Intentional Whitespace

Whitespace creates rhythm and makes priority visible. Do not fill empty space merely because it exists.

### Distinct Page Identities

Landing, project, profile, community, library, and authenticated workspace surfaces can share primitives without becoming identical layouts. Choose structure based on the user's task.

### Dynamic Color as Accent

User-derived color can express identity through small accents, active states, avatar rings, progress indicators, and selection states. It should not overpower the Tethyr structure.

## Anti-Patterns

Avoid:

- Generic AI SaaS layouts
- Excessive rounded cards
- Every section becoming a card
- Floating card piles without a product reason
- Huge gradients or decorative glows
- Glassmorphism and blur used as default styling
- Excessive shadows
- Random borders
- Pill-shaped controls where a normal button or link is clearer
- Repeated hero sections and CTAs on every page
- Identical dashboard layouts for unrelated tasks
- Using more color to compensate for weak hierarchy
- Using more controls to compensate for weak information architecture

## Aesthetic Decision Test

Before adding a visual element, answer:

1. What user problem does this solve?
2. What information or action does it clarify?
3. Why is this treatment better than spacing, typography, ordering, or a simpler surface?
4. Does it reinforce Tethyr's work-first identity?
5. Does it introduce a new pattern that should become canonical?

If the answer is only "it looks more modern" or "it makes the page feel polished," do not add it.

## Consistency Without Uniformity

Consistency means shared rules for hierarchy, interaction, states, typography, and spacing. It does not mean every page uses the same card grid, hero, sidebar, or visual treatment.

Reuse a component when it represents a real repeated concept. Do not abstract unrelated content merely because two JSX fragments look superficially similar.

## Review Lens

After implementation, inspect:

- Visual hierarchy
- Alignment
- Spacing rhythm
- Content density
- Responsive composition
- Interaction clarity
- Accessibility
- State coverage
- Component reuse
- Duplicate patterns
- Unnecessary decoration

Then remove anything that does not earn its place.
