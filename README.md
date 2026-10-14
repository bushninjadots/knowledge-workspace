# Tethyr

> **"Ship every week. Get known for what you build."**

Tethyr is where developers — and the designers, makers, writers and indie hackers who build alongside them — post what they ship each week, find people to build with, and grow a profile that proves it. Connect GitHub and Tethyr drafts your week for you; you edit and post.

---

## What Tethyr Is

Most platforms optimize for attention. Tethyr optimizes for progress.

Most platforms reward posting. Tethyr rewards building.

Most platforms showcase finished work. Tethyr celebrates the journey from idea to launch.

Tethyr asks: **"What are you building next?"**

---

## Four Pillars

- **Build** — Everything starts with making something. Projects are the center of the ecosystem.
- **Connect** — People discover one another naturally through work, skills, communities, and shared interests.
- **Grow** — Learning happens through collaboration, mentoring, challenges, and contributing to real projects.
- **Earn Reputation** — Recognition comes from visible contributions, consistency, completed work, and helping others — not self-promotion.

---

## Features

### Ship log (the weekly habit)

- One short "what I shipped" note per week, drafted from your public GitHub activity (commits, merged PRs, releases)
- Kudos and replies from other builders; consecutive weeks build a streak
- Friday reminder for anyone with a streak to keep; a Ship log block for your Studio
- Everyone / Following feed, and earlier weeks one click back

### Dev journal

- One-line log as you work (did / fixed / decided / learned / stuck / next), from the Notes dock's Log tab or `/journal`
- Copy-paste standup, the weekly ship drafted from it, and a monthly brag doc (Markdown — Obsidian/Notion friendly)
- Your tools log for you: MCP server for AI coding assistants (Claude Code, Cursor, VS Code, Windsurf), a git hook for any host, a REST API — see [docs/JOURNAL_API.md](docs/JOURNAL_API.md)
- Private by default; share chosen entries to your profile (Dev journal Studio block: 30-day numbers, working on now, shared entries). Share ships to LinkedIn / X

### Code → docs

- Paste code, pick a file from a project's repo, or read a whole project: Tethyr writes a readable doc from the code itself — free, nothing leaves the site
- Optional "Explain with AI" with your own Anthropic key (Settings), saved to the Library as Markdown or added to the project README

### The Tether

- Your whole story as a living tetherball — you're the pole; projects, collaborators, skills, crews, spaces, repos and what you've shipped orbit on ropes, ring by ring
- The pole rises through levels (Seed → Galaxy) as your work grows; "Watch it grow" replays it in order
- On project pages ("How it connects"), as a Studio block, and full-screen at `/tether`; refreshes on its own, with Sync for owners

### Identity

- Profiles with handles, creator titles, banners, and personalized accent colors
- Availability badges showing who's open to connect
- Profile completeness with guided next steps
- Reputation scores tied to real activity

### Projects

- Full project lifecycle: planning → building → testing → launch → growing
- Milestones, progress tracking, open roles with skill requirements
- Contributor rosters with roles (creator, mentor, contributor)
- 3D project shelf with drag-to-browse cover art

### Skills

- Teach/learn model (I can help with X, I want to grow in Y)
- Verification levels, experience badges, and endorsements
- Skill-to-project linking with match scoring
- Skill hub pages with teachers, learners, and projects

### Collaboration

- Session scheduling with calendar and availability settings
- Connection requests and direct messaging
- Role applications on projects with accept/decline flow

### Community

- 14 post types (discussions, showcases, questions, milestones, etc.)
- Community spaces organized by topic
- Challenges with progress tracking and reputation rewards
- Activity feed with real-time updates

### Discovery

- Explore page with projects, people, and opportunities tabs
- Search across profiles, skills, projects, library, and more
- Suggested projects and creators matched to your skills

### Library

- Personal library for notes, files, and links
- Collections, favorites, pins, and tags

---

## Tech Stack

- React · TypeScript · Vite · Tailwind CSS
- Supabase (auth, database, storage, real-time)
- TanStack Router · TanStack Query · Framer Motion

---

## Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/tethyr.git
npm install
npm run dev
```

### Environment Variables

```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
VITE_PUBLIC_SITE_URL=https://your-public-domain.example
```

`VITE_PUBLIC_SITE_URL` is required in production for canonical links and sitemap URLs. Use the deployed origin without a trailing slash.

---

## Status

🚧 Active development (MVP). Features may change frequently.

---

## License

License to be decided.
