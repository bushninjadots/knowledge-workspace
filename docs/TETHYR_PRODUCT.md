# Tethyr Product Definition

> Canonical product reference. For binding visual guardrails, see [`AGENTS.md`](../AGENTS.md). For the major redesign specification, see [`TETHYR_REDESIGN_SPEC.md`](./TETHYR_REDESIGN_SPEC.md). For current implementation state, see the dated audits in this directory.

## What Tethyr Is

Tethyr is a creative collaboration network where people become known through what they build, contribute to, and collaborate on.

The product helps builders find meaningful work, meet people through that work, collaborate in public, and build a reputation grounded in visible contribution.

Tethyr serves developers, designers, writers, musicians, researchers, founders, artists, and anyone making something tangible.

### The Larger Vision

Tethyr is evolving from a conventional dashboard into a platform where **people and projects have places of their own**. Every project should feel unique, even when built from the same platform. Tethyr gives people the tools — the creator decides what their space becomes.

Two first-class customizable experiences anchor this vision:

- **Personal Profile ("Your Studio")** — a personal homepage representing identity, work, and contributions.
- **Project Space** — a project's home on the internet, not merely a database record with a dashboard attached.

Both are composed from a semantic block system (not predetermined cards) and support customization, templates, forking, remixing, and community sharing. See [`TETHYR_REDESIGN_SPEC.md`](./TETHYR_REDESIGN_SPEC.md) for the full specification.

## What Tethyr Is Not

Tethyr is not:

- A generic SaaS dashboard
- LinkedIn
- Discord
- GitHub
- Behance
- A job board
- A portfolio template
- A skill marketplace
- An AI-generated card-grid website
- A generic website builder (Canva/Wix/Framer) — customization serves projects, people, and collaboration, not arbitrary web publishing

Tethyr may contain patterns associated with those products when they support the collaboration loop, but it must not inherit their default product model or visual language.

## Primary Loop

```text
DISCOVER
  → Explore work
  → Find people
  → Collaborate
  → Build
  → Contribute
  → Become known
  → DISCOVER
```

Every substantial feature should strengthen at least one transition in this loop. If it does not help people discover work, find collaborators, collaborate, build, contribute, or become known through contribution, its product justification should be explicit.

### Extended Community Loop (Redesign)

The primary loop is extended by a creative ecosystem loop around layouts and templates:

```text
CREATE → CUSTOMIZE → PUBLISH → DISCOVER → FORK → REMIX → PUBLISH → DISCOVER
```

This creates a community around design and expression, where people inspire each other and layouts become a shared language.

## Product Pillars

### Build

Projects are first-class citizens. The work itself is the primary unit of identity and discovery. Project Spaces give every project a unique home.

### Connect

People meet through projects, skills, communities, sessions, and visible shared interests—not through profile claims alone.

### Grow

Learning happens through collaboration, mentoring, challenges, feedback, and contributing to real work.

### Earn Reputation

Recognition comes from visible contributions, completed work, consistency, and helping others. Reputation is evidence-based rather than self-declared.

### Express (New)

Creators can shape how their work and identity are presented. Through blocks, layouts, themes, and customization, every profile and project can look distinct. Templates and remixing create a creative ecosystem where design is shared and evolved.

## Core Product Objects

- **Project:** The primary workspace and the clearest expression of what someone is building. Has a customizable Project Space.
- **Person / Studio:** A person is represented through their work, contributions, skills, and current direction. Has a customizable Profile.
- **Block:** A semantic unit of content — text, heading, roadmap, team, files, activity, etc. Blocks are not cards. The block system is extensible.
- **Layout:** The structural arrangement of sections and blocks on a page. Data-driven, not hard-coded.
- **Template:** A reusable, shareable Layout + optional Theme that others can fork and customize.
- **Theme:** A named collection of design tokens (colors, typography, spacing, borders, shadows).
- **Fork:** A copy of a template's structure, maintaining lineage back to the original while allowing independent evolution.
- **Skill:** A discovery and collaboration signal, not a résumé keyword wall.
- **Community:** A place for shared practice, conversation, challenges, and contribution.
- **Session:** A focused collaboration, mentoring, or working interaction.
- **Library:** A personal working space for notes, links, and references—not the center of the public product.

## Product Decision Rules

1. Put work before metadata.
2. Make projects easier to understand before adding more profile fields.
3. Prefer evidence of contribution over claims of ability.
4. Make discovery lead to a meaningful next action.
5. Reduce friction between finding a person and understanding what they are building.
6. Preserve user agency and context when asking for actions, permissions, or profile information.
7. Treat empty, loading, and error states as part of the product—not implementation leftovers.
8. Prefer a smaller number of strong concepts over a larger number of weak features.
9. Do not add a social feature merely because another network has one.
10. When a surface feels awkward, inspect the product model and information architecture before changing its styling.
11. **New:** The platform provides strong defaults; customization is optional and progressive. A beginner sees "Customize"; an advanced user discovers Layout, Blocks, Theme, Advanced.
12. **New:** Templates contain structure, not private content. Never expose private project data, members, discussions, files, or activity through templates.
13. **New:** Content, layout, theme, and project data must remain properly separated. A project can change theme without rebuilding content; a layout can change without losing data.

## Project Experience

The project page is Tethyr's flagship experience. Its default narrative is:

```text
README → identity → work → people → conversation → evidence
```

A project page should feel like a workspace and a living record of progress, not a stack of unrelated dashboard cards.

### Redesign Direction

In the redesigned Project Space, the README remains central, but the entire page becomes a composed block-based surface. The owner can add, remove, reorder, and configure sections. The default Project Space is excellent without any customization. Two projects can look completely different while remaining distinctly Tethyr.

## Profile Experience

A profile is a person's studio. Projects and contributions should visually dominate. Skills, biography, availability, and links support the work rather than replacing it.

### Redesign Direction

In the redesigned Profile, the user composes their identity through blocks. The default profile is strong; customization is optional. The profile can become a personal homepage, and layouts can be forked and remixed by the community.

## How to Use This Document

Use this document for product decisions and information architecture. Use `AGENTS.md` for non-negotiable design guardrails. Use `TETHYR_REDESIGN_SPEC.md` for the full redesign specification and phased plan. Use `TETHYR_UX_RULES.md` before making a significant interface change. Use `TETHYR_ARCHITECTURE.md` and `TETHYR_REDESIGN_ARCHITECTURE.md` to identify the correct implementation owner.
