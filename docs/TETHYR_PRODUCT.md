# Tethyr Product Definition

> Canonical product reference. For binding visual guardrails, see [`AGENTS.md`](../AGENTS.md). For current implementation state, see the dated audits in this directory.

## What Tethyr Is

Tethyr is a creative collaboration network where people become known through what they build, contribute to, and collaborate on.

The product helps builders find meaningful work, meet people through that work, collaborate in public, and build a reputation grounded in visible contribution.

Tethyr serves developers, designers, writers, musicians, researchers, founders, artists, and anyone making something tangible.

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

## Product Pillars

### Build

Projects are first-class citizens. The work itself is the primary unit of identity and discovery.

### Connect

People meet through projects, skills, communities, sessions, and visible shared interests—not through profile claims alone.

### Grow

Learning happens through collaboration, mentoring, challenges, feedback, and contributing to real work.

### Earn Reputation

Recognition comes from visible contributions, completed work, consistency, and helping others. Reputation is evidence-based rather than self-declared.

## Core Product Objects

- **Project:** The primary workspace and the clearest expression of what someone is building.
- **Person / Studio:** A person is represented through their work, contributions, skills, and current direction.
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

## Project Experience

The project page is Tethyr's flagship experience. Its default narrative is:

```text
README → identity → work → people → conversation → evidence
```

A project page should feel like a workspace and a living record of progress, not a stack of unrelated dashboard cards.

## Profile Experience

A profile is a person's studio. Projects and contributions should visually dominate. Skills, biography, availability, and links support the work rather than replacing it.

## How to Use This Document

Use this document for product decisions and information architecture. Use `AGENTS.md` for non-negotiable design guardrails. Use `TETHYR_UX_RULES.md` before making a significant interface change. Use `TETHYR_ARCHITECTURE.md` to identify the correct implementation owner.
