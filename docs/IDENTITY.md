# Tethyr — Platform Identity

> **"It's where people build things together and get known for what they make."**

Every page, every interaction, every future feature should reinforce that sentence.

---

## What Tethyr Is

Tethyr is the collaboration network where builders — developers, designers, writers, musicians, researchers, founders, artists, and anyone making something tangible — create projects together in public, grow through real contributions, and become known for what they make, not what they claim.

It is not Skillshare. It is not GitHub. It is not LinkedIn. It is not Discord. It draws from all of them and commits to none of them. It is its own category.

---

## The Tethyr Philosophy

Tethyr is built around a simple belief:

> **People shouldn't be defined by what they say they can do. They should be known for what they've built with others.**

Every profile is a story told through projects.

Every project is a place where people meet.

Every contribution leaves a visible mark.

Everything on Tethyr should encourage creation over consumption.

If a feature doesn't help people create, collaborate, learn through doing, or discover builders, it probably doesn't belong.

---

## How It Feels

The interface should never feel like enterprise software.

It should feel like walking through a creative studio.

Projects feel alive. Profiles feel personal. Communities feel active.

The UI communicates movement, momentum, and progress rather than static information.

Instead of asking: **"What information should we display?"**

Tethyr asks: **"What is this person building right now?"**

---

## The Four Pillars

### Build
Everything starts with making something. Projects are the center of the ecosystem.

### Connect
People discover one another naturally through work, skills, communities, and shared interests.

### Grow
Learning happens through collaboration, mentoring, challenges, and contributing to real projects.

### Earn Reputation
Recognition comes from visible contributions, consistency, completed work, and helping others — not self-promotion.

---

## The Platform Loop

```
Discover
      ↓
Join
      ↓
Build
      ↓
Contribute
      ↓
Learn
      ↓
Earn Trust
      ↓
Unlock Opportunities
      ↓
Start Again
```

This creates a compounding ecosystem where projects generate connections, connections generate new projects, and every completed contribution strengthens a member's reputation.

---

## Product Principles

Every feature should satisfy at least one of these:

- Helps someone start building
- Helps someone find collaborators
- Helps someone make progress
- Helps someone discover interesting work
- Helps someone earn trust
- Helps someone grow their skills through real projects
- Helps communities organize around creation

If it doesn't support one of these, it should be reconsidered.

---

## Emotional Goals

When someone leaves Tethyr, they should feel:

- Inspired to create
- Proud of their progress
- Connected to other builders
- Motivated to continue
- Recognized for their contributions
- Curious about what others are making

Not:

- Overwhelmed
- Comparing themselves to others
- Chasing vanity metrics
- Looking for likes

---

## What Makes Tethyr Different

| Most platforms | Tethyr |
|---------------|--------|
| Optimize for attention | Optimizes for progress |
| Reward posting | Rewards building |
| Showcase finished work | Celebrates the journey from idea to launch |
| Ask "What have you done?" | Asks "What are you building next?" |

---

## Inspirations (What Tethyr Draws From)

| Platform | What Tethyr Took |
|----------|-----------------|
| **GitHub** | Projects as the atomic unit, contributors, milestones, progress tracking, open collaboration |
| **Behance / Dribbble** | Visual project showcases, cover images, creative portfolios, identity through work |
| **Polywork** | Multi-faceted identity, skills as teach/learn, creator titles, availability badges |
| **Discord** | Topic-based community spaces, real-time feel, community as a destination |
| **LinkedIn** | Professional networking, connections, endorsements, reputation, opportunities |

Tethyr doesn't copy any of them. It's its own category.

---

## What People Do on Tethyr

1. **Create a profile** that shows who they are as a maker — skills they can teach, skills they're learning, projects they've built
2. **Start or join projects** — structured workspaces with milestones, roles, and progress tracking
3. **Find collaborators** — matched by complementary skills and availability
4. **Schedule sessions** — mentoring, pairing, brainstorming with other members
5. **Participate in challenges** — structured skill-building with reputation rewards
6. **Build community** — join spaces around crafts and interests, share updates, discuss work
7. **Grow reputation** — earn through contributions, endorsements, and completed work
8. **Discover opportunities** — open roles on active projects matched to their skills

---

## What's Live Right Now

This isn't aspirational. It's built. Here's what exists in the codebase today:

### Identity Layer
- Profiles with handles, display names, creator titles, banners, avatars
- Dominant color extraction from banners → personalized accent colors throughout the UI
- Availability badges showing who's open to connect
- Profile completeness tracking with guided next steps
- Reputation scores tied to real activity

### Skills Layer
- Teach/learn skill model (I can help with X, I want to grow in Y)
- Verification levels and experience badges
- Endorsements from other members
- Skill-to-project linking
- Skill match scoring for opportunities
- Skill hub pages at `/skills/:slug` with teachers, learners, and projects

### Project Layer
- Full project lifecycle: planning → building → testing → launch → growing
- Milestones with status tracking
- Progress bars and percentage tracking
- Open roles with skill requirements and application flow
- Contributor rosters with roles (creator, mentor, contributor)
- Project shelf — 3D browseable interface with drag-to-flip, spotlight, and cover art
- Project community posts linking projects to the community feed
- Resources, gallery, vision, goals sections
- Looking for collaborators / looking for feedback flags

### Collaboration Layer
- Session scheduling with calendar, availability settings, and request flow
- Session types: mentoring, pairing, brainstorming
- Connection requests between members
- Direct messaging
- Role applications on projects with accept/decline flow

### Community Layer
- 14 post types (discussion, project, question, resource, milestone, etc.)
- Community spaces with topic-based organization
- Challenges with join/leave, progress tracking, and completion rewards
- Follows between members
- Activity feed with real-time updates
- Comments and discussions

### Reputation Layer
- Achievement system
- Reputation scores from activity, contributions, and endorsements
- Weekly reputation tracking
- Challenge completion rewards

### Discovery Layer
- Explore page with projects (3D shelf), people, and opportunities tabs
- Search across profiles, skills, projects, library, posts, sessions
- Suggested projects and creators matched to your skills
- Trending skills
- Category and need-based filtering
- Discover sidebar with quick stats

### Library Layer
- Personal library for notes, files, and links
- Collections for organization
- Favorites, pins, tags
- File uploads

### Design Language
- Living backgrounds (`bg-noise`, `bg-grid`, animated gradients)
- Page entrance animations (`animate-room-enter`)
- Staggered reveals on lists
- Animated border glow on featured cards
- Marquee stats on landing page
- 3D project shelf with physics-based drag
- User accent colors derived from banner images
- Section reveal animations
- Scroll indicators
- Consistent `card-border` and `transition-lift` patterns

---

## Positioning Statement

> **Tethyr is the collaboration network where builders create projects together in public, grow through real contributions, and become known for what they make — not what they claim.**

---

## North Star

> **"It's where people build things together and get known for what they make."**

If you can only remember one sentence, remember that one.

---

## For Future Feature Decisions

Before building anything new, ask:

1. Does it help someone **build** something?
2. Does it help someone **connect** with a collaborator?
3. Does it help someone **grow** through real work?
4. Does it help someone **earn recognition** for contributions?
5. Does it feel like a **creative studio**, not enterprise software?

If the answer to all five is no, reconsider.
