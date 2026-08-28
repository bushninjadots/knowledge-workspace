# Tethyr Design System Guidance

> Implementation-oriented reference. Do not treat this as permission to redesign unrelated surfaces. Check [`AGENTS.md`](../AGENTS.md) and [`TETHYR_UX_RULES.md`](./TETHYR_UX_RULES.md) first.

## Source of Truth

- `AGENTS.md` — binding constitution and non-negotiable guardrails
- `src/styles.css` — implemented tokens and utilities
- `src/components/ui/` — shared interface primitives
- `src/components/tethyr/` — Tethyr product components
- This document — decision guidance when choosing between existing patterns

When this document and the implementation disagree, follow the precedence in [`docs/README.md`](./README.md): product direction and binding guardrails come first, then UX rules, then this implementation guidance, then existing code. Do not preserve a bad layout merely because it exists; make structural corrections deliberately and within the task's scope. Record meaningful corrections in the relevant docs or code comments rather than silently creating another pattern.

## Surface Hierarchy

Use the smallest visual treatment that communicates the relationship:

| Level | Treatment                          | Use for                                          |
| ----- | ---------------------------------- | ------------------------------------------------ |
| 0     | Page background, no border         | Overall page canvas                              |
| 1     | Background contrast, no border     | Grouped sections and quiet regions               |
| 2     | Subtle border or surface           | Independent interactive objects                  |
| 3     | Accent border or focused treatment | Active, selected, featured, or validation states |
| 4     | Dialog treatment with backdrop     | Modal and blocking interactions                  |

Not every surface needs a border, shadow, or rounded container.

## Containers and Cards

A card should represent an independent object such as a project, person, challenge, or self-contained action.

Use sections, rows, lists, dividers, or editorial compositions when content belongs to the page flow. Do not introduce a new card solely to fix spacing or group arbitrary content.

Prefer the existing radius scale:

- Large sections: `rounded-xl`
- Cards: `rounded-lg` or `rounded-xl`
- Inputs and buttons: `rounded-md` or `rounded-lg`
- Avatars and tags: `rounded-full`

Do not increase radius without a structural reason.

## Spacing

Use existing spacing tokens and neighboring patterns. Spacing should communicate relationships:

- Tight spacing for label/value or icon/title pairs
- Moderate spacing for content within a section
- Larger spacing between distinct sections
- Generous whitespace around primary content and page boundaries

Do not invent arbitrary values for each component. If a layout needs unusual spacing, first ask whether the information hierarchy is wrong.

## Typography

Typography should establish hierarchy before decoration:

- One clear page title
- Clear section titles
- Readable body copy
- Distinct but restrained metadata
- Consistent line heights
- Strong contrast for primary actions and content

Do not solve weak hierarchy with extra colors, badges, borders, shadows, or card nesting.

## Interaction States

Every meaningful interactive surface should have an intentional treatment for:

- Default
- Hover
- Focus-visible
- Active / selected
- Disabled
- Loading
- Success
- Error
- Empty / no results

Focus-visible states must remain clear in both themes. Loading states should preserve layout so content does not jump unnecessarily.

## Responsive Behavior

Design each major layout at three levels before implementation:

### Desktop

Define the primary composition, reading order, max width, and any persistent navigation.

### Tablet

Decide which columns collapse, which controls move, and which relationships must remain visible.

### Mobile

Recompose rather than merely shrink. Determine the mobile reading order, touch targets, menu behavior, truncation, overflow, and which secondary information can collapse.

Test long names, long project titles, empty states, and narrow widths.

## Accessibility Baseline

- Use semantic headings in a meaningful order.
- Every form control needs an accessible label.
- Icon-only controls need an accessible name.
- Keyboard focus must be visible.
- Interactive targets must be usable on touch devices.
- Do not communicate meaning with color alone.
- Respect reduced-motion preferences.
- Error and success messages should be announced or otherwise discoverable.
- Preserve sufficient contrast in light and dark themes.

## Component Reuse

Good canonical concepts include:

- Project card or project row
- Profile header
- Skill badge
- Activity item
- Empty state
- Loading state
- Auth shell
- Workspace section

Avoid abstractions whose only purpose is to hide arbitrary markup differences. A shared component should encode a stable product concept or interaction contract.

## New Pattern Checklist

Before introducing a new component or visual pattern:

1. Search for an existing component with the same product meaning.
2. Check the route and design language where it will be used.
3. Decide whether it is a surface, section, workspace, composition, or independent object.
4. Define its states and responsive behavior.
5. Confirm its hierarchy does not compete with project/work content.
6. Document the pattern if it is expected to repeat.
