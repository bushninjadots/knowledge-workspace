# Tethyr — Major Product Redesign Specification

> **Status: Pre-implementation specification. Phase 1 (audit + architectural proposal) only.**
> **Created: 2026-08-23**
> **Do not begin implementation until the audit is complete and the architecture is approved.**

## What This Is

This is the specification for a **major product and architecture redesign** of Tethyr. It is not a visual refresh. It changes the fundamental way Tethyr presents people, profiles, projects, project pages, content, collaboration, and community.

## The Core Idea

Tethyr should not feel like "a SaaS dashboard with cards."

It should feel like **"a place where people and their projects live."**

**Core principle:** Every project should feel unique, even when it is built from the same platform.

**Second principle:** Tethyr gives people the tools. The creator decides what their space becomes.

Users should have strong creative control without needing to know HTML, CSS, design systems, or web development. Advanced users should eventually have deeper control. Beginners should still get beautiful results automatically.

## Inspirations (Combined, Not Copied)

Tethyr draws conceptual inspiration from several ecosystems without copying their visual designs:

**GitHub** — personal identity, profile customization, project/repository identity, README culture, community-created profile styles, contributions, open-source culture.

**Notion** — block-based content, drag-and-drop composition, flexible pages, templates, duplicate/fork concepts, structured content.

**Framer / Webflow** — creator ownership, visual composition, beautiful public pages, layout flexibility, personal expression.

**Tethyr's unique combination** — people, skills, projects, collaboration, trust, reputation, community, contributions, activity, shared knowledge.

Do NOT copy the appearance of any of these platforms. Create a distinct Tethyr identity.

---

# 1. Two First-Class Experiences

## A. Personal Profile ("Your Studio")

The profile represents the person's identity within Tethyr. It should be capable of becoming a personal homepage.

Possible sections: profile header, avatar, name, username, bio, location, links, skills, skills wanted, featured projects, experience, education, achievements, contributions, activity, testimonials, gallery, statistics, custom content.

The user decides what appears. Tethyr provides a strong default.

## B. Project Space

A project should not simply be a database record with a dashboard attached. It should have a **Project Space** — the project's home on the internet.

Possible project content: hero, banner, description, about/README, status, statistics, roadmap, tech stack, files, documentation, releases, changelog, tasks, kanban, team, contributors, activity, discussions, gallery, videos, embedded content, custom sections.

The project owner controls the structure. Tethyr provides a strong default.

---

# 2. Semantic Block System (Core Architecture)

Do NOT build the page system around predefined dashboard cards. Instead build a **semantic block system**.

A page consists of:

```
PAGE → LAYOUT → SECTIONS → BLOCKS → CONTENT → THEME
```

These must remain conceptually separate.

## Block Types (Extensible)

### Content

- Text, Heading, Markdown, Quote, Divider

### Media

- Image, Gallery, Video, Embed

### Project

- Project status, Statistics, Roadmap, Timeline, Tech stack, Releases, Changelog, Files, File explorer, Tasks, Kanban

### People

- Team members, Contributors, Profile links, Testimonials

### Community

- Activity, Discussions, Comments, Events

### Utility

- Button, Link, Badge, Table, Progress

The architecture must make it possible to add future block types without rewriting the page system.

## Blocks Are Not Cards

Do not visually turn every block into a floating rectangle. A block may be: full-width text, a heading, an image, a section, a grid, a timeline, a file tree, a visual divider, a project component, a piece of documentation.

Use cards only when the content benefits from card-like presentation. Avoid Card Card Card Card appearance.

---

# 3. Default Pages (Strong Defaults, Optional Customization)

Users should NOT need to customize anything. When creating a project, Tethyr automatically creates a beautiful default Project Space:

```
HERO → Project title / Description / Actions
ABOUT → Project introduction
STATUS / TECH STACK
ROADMAP
TEAM
FILES
ACTIVITY
```

Every section can be changed. The default should be excellent. Customization should be optional.

## Profile Default

New users automatically receive a strong profile:

```
PROFILE HEADER → Avatar / Name / Bio / Links
FEATURED PROJECTS
SKILLS
EXPERIENCE
ACTIVITY
CONTRIBUTIONS
```

This is a starting point. Everything can be customized.

---

# 4. Visual Page Builder

Create a "Customize" mode. The editor should allow users to:

- Add blocks, remove blocks, edit blocks, reorder blocks
- Duplicate blocks, move blocks, configure blocks, hide blocks
- Change layouts, change themes
- Preview, save draft, publish

Use drag-and-drop where appropriate. Do not make the editor unnecessarily complicated.

**Goal:** Powerful enough to create something unique. Simple enough that anyone can use it.

---

# 5. Layout System

Layouts must be data-driven. Starting layouts:

- Standard, Minimal, Full Width, Centered
- Sidebar, Documentation, Portfolio, Magazine
- Dashboard, Landing Page, Custom

These are starting points, not rigid templates. A user can modify them.

## Grid / Composition System

Support meaningful composition:

```
FULL WIDTH
TWO COLUMNS → [ABOUT] [STATUS]
THREE COLUMNS → [STAT] [STAT] [STAT]
FEATURE → [IMAGE] [DESCRIPTION]
SIDEBAR → [MAIN CONTENT] [SIDEBAR]
```

The system should have sensible responsive behavior. Do not expose unnecessary CSS complexity to ordinary users.

---

# 6. Theme System

Create a reusable theme/token architecture. Themes can control: colors, typography, background, borders, radius, spacing, shadows, icons, component treatment.

Initial themes: Minimal, Developer, Terminal, Paper, Brutalist, Glass, Retro, Cyberpunk, Academic, Nature, Studio.

These should NOT be hard-coded collections of unrelated CSS. Build a proper theme system.

## User Customization

Allow controlled customization of: background, typography, accent, borders, radius, spacing, banner, icons, light/dark, section widths.

Maintain sensible design constraints. Users should have freedom without being able to accidentally create an unusable website.

---

# 7. Template System (Core Feature)

Tethyr should support reusable layouts/templates. A template represents:

```
LAYOUT + BLOCK STRUCTURE + OPTIONAL THEME + DEFAULT CONTENT CONFIGURATION
```

A template should NOT contain another person's private project data.

Example templates:

- **Developer Portfolio:** Hero, About, Skills, Projects, Contributions
- **Open Source Project:** Hero, README, Roadmap, Tech Stack, Releases, Contributors, Activity
- **Startup:** Hero, About, Features, Team, Roadmap, Updates
- **Creative Studio:** Hero, Gallery, Projects, Team, Contact

## Template Library

Create the architecture for a public Template Library. Users should eventually browse: Featured, Popular, New, Trending, Minimal, Developer, Portfolio, Documentation, Startup, Community, Creative, Experimental.

Templates should have: name, author, preview, description, categories, usage count, likes/favorites, version, created/updated date.

---

# 8. Fork / Remix System

A user should be able to discover a beautiful project/profile layout and select **"Fork Layout"**. This creates a copy of the layout structure. The user's own content, projects, members, links, and data remain theirs. The original creator's content does NOT get copied as private data. The fork inherits the structural design.

```
ORIGINAL (Template A) → Fork → User B's customized version
```

## Remixing

Do not limit users to simply using templates. Allow "Remix" — a user can take a template and modify sections, blocks, ordering, theme, typography, layout, and content structure. Eventually they can publish their remix as a new community template.

## Template Lineage

Maintain template ancestry:

```
"Minimal Developer" → Forked by Bryce → "Minimal Developer — Dark"
→ Forked by Alex → "Minimal Developer — Documentation"
```

This creates a visible creative lineage. Attribution should remain intact.

---

# 9. Community Layouts

This should become a community around design, not merely a template marketplace.

A layout page could show: preview, name, creator, description, tags, usage count, [Use Layout], [Save], [Fork].

## "Made With Tethyr"

Consider a subtle attribution mechanism for public community templates. Do not make attribution intrusive.

## Template Versioning

Templates should support versions. Do NOT automatically destroy an existing user's customized page when the original template changes. A user's fork should be independent after creation unless they explicitly choose to pull updates.

Template update model: Original Template → New Version Available → "Update Fork" → User reviews differences before applying.

Do NOT implement dangerous automatic overwrites. Design for safe evolution.

## Community Discovery

Eventually users should discover layouts while browsing Tethyr: "This project uses the Minimal Documentation layout." Clicking opens template preview, creator, other projects using it, [Use Layout], [Fork].

## Creator Credit

Template creators should receive recognition through signals like layouts created, times used, forks, favorites, and projects using their layout. This could become another form of contribution/reputation. Do not turn this into a meaningless popularity contest.

---

# 10. Content / Layout / Theme Separation

Architect this carefully. A page should conceptually consist of:

```
CONTENT + STRUCTURE + STYLE + THEME
```

Do not tightly couple these:

- A project can change its theme without rebuilding its content.
- A user can change its layout without losing content.
- A template can be shared without exposing private project data.
- A fork can become independent from the original.

---

# 11. Draft / Preview / Publish

Pages should support: DRAFT → PREVIEW → PUBLISH. Public visitors only see the published version. Users should be able to experiment safely.

## Version History

Design the architecture so pages can eventually support version history, restore, compare, and publish history. Do not necessarily implement every advanced capability immediately. But avoid an architecture that makes these impossible later.

---

# 12. Public vs Private

A project may contain private information. Templates must NEVER accidentally expose private project data, private members, private discussions, private files, or internal activity.

Templates contain structure, not private content. Permissions must be enforced at the data layer, not merely hidden in the UI.

---

# 13. README / Markdown

Tethyr should support a powerful README/About system. Normal users can use a visual editor. Advanced users can use Markdown.

Eventually consider structured Tethyr components inside Markdown. Build the underlying block architecture first. Do NOT invent a complex custom syntax unless it is actually necessary.

---

# 14. Edit Mode vs View Mode

**VIEW MODE:** Clean, beautiful, immersive — no editing controls.

**EDIT MODE:** Add, edit, move, customize, preview, publish — editing UI disappears from public experience.

Public pages must feel like finished websites.

---

# 15. Design Language

The interface should feel: modern, human, creative, premium, calm, flexible, community-oriented.

Avoid: generic SaaS, corporate dashboards, excessive floating cards, excessive borders, huge metric grids, artificial AI aesthetics, unnecessary gradients, excessive glassmorphism, excessive rounded containers.

Do not make everything look like an AI product. Tethyr should feel like a real human platform.

---

# 16. Do Not Over-Design

The platform should provide strong defaults. Customization should be progressive: a beginner sees "Customize," an advanced user can eventually access Layout, Blocks, Theme, Advanced.

Do not expose every possible setting immediately.

---

# 17. The Most Important User Experience

The first time someone visits a Tethyr project, they should think:

> "This doesn't look like every other project page."

Then:

> "I want my project to look like this." → "Oh, I can use this layout." → "I can change it." → "I can make my own."

That is the ecosystem we are building.

---

# 18. Community Creation Loop

The long-term loop:

```
CREATE → CUSTOMIZE → PUBLISH → DISCOVER → FORK → REMIX → PUBLISH → DISCOVER → FORK
```

This should become part of Tethyr's culture.

---

# 19. Phased Implementation

**DO NOT rewrite the entire application in one enormous change.**

### Phase 1 — Full Audit (current)

- Inspect the entire existing Tethyr codebase
- Report: current architecture, profile/project architecture, dashboard, design system, reusable components, data models, APIs, current problems, duplicate components, dead code, migration risks, recommended architecture
- Do NOT begin major implementation yet

### Phase 2 — Page / Block Foundation

- Create the underlying Page, Layout, Block, Theme, Draft, Publish architecture

### Phase 3 — Project Space

- Build the new customizable Project Space

### Phase 4 — Personal Profile

- Build the customizable personal profile

### Phase 5 — Visual Editor

- Build the customization experience

### Phase 6 — Template System

- Build reusable layouts

### Phase 7 — Template Library

- Build community discovery

### Phase 8 — Fork / Remix

- Build layout lineage and remixing

### Phase 9 — Themes

- Expand the theme system

### Phase 10 — Migration

- Move existing Tethyr projects/profiles into the new architecture

### Phase 11 — Polish

- Audit mobile, accessibility, performance, UX, empty states, loading states, error states, permissions, security, consistency

---

# 20. Testing Requirements

Every phase should include testing for: existing users, new users, existing projects, new projects, public pages, private pages, editing, publishing, mobile, permissions, template creation, template use, forking, remixing.

Do not declare a feature complete simply because it renders.

---

# 21. Success Criteria

The redesign succeeds when:

### Identity

A user's Tethyr profile feels personal.

### Projects

A Tethyr project feels like a destination rather than a dashboard.

### Creativity

Two projects can look completely different.

### Simplicity

A non-designer can create something beautiful.

### Power

An advanced user can meaningfully customize their space.

### Community

People can discover layouts created by other people.

### Templates

Layouts can be reused.

### Forking

Layouts can be forked.

### Remixing

Forks can be modified and republished.

### Attribution

Creators receive appropriate credit.

### Evolution

Templates can have versions.

### Safety

Private project data never leaks through templates.

### Performance

Public pages remain fast.

### Architecture

Content, layout, theme and project data remain properly separated.

---

# 22. The Ultimate Tethyr Principle

> **GitHub gives you a repository. Tethyr gives your project a place to live.**

> **Every project should feel unique, even when it is built from the same platform.**

> **Tethyr is not a collection of templates. It is a system for people to create, share, fork and evolve their own spaces.**

---

# 23. Final Instruction

Do NOT immediately start rewriting the application.

First:

1. Inspect the complete codebase
2. Understand the current architecture
3. Understand what Tethyr already does
4. Identify what can be preserved
5. Identify what needs to change
6. Identify architectural risks
7. Design the migration strategy
8. Design the page/block/template architecture
9. Explain how existing functionality will connect to it
10. Produce a phased implementation plan

Do not make destructive changes before this analysis. Do not remove existing functionality simply because the UI is changing. Do not create placeholder functionality and call it complete. Do not create dozens of hard-coded templates. Do not create a generic website builder.

**Build the foundation for a real Tethyr ecosystem.**

**Start with the audit and architectural proposal only. Wait for approval before performing the major redesign.**
