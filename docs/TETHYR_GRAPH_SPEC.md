Absolutely. The key is that the **Tethyr Graph should not feel like a separate feature bolted onto Tethyr**. It should become the underlying connective layer of the whole product, while giving users several ways to *see* and interact with those connections.

Here is a detailed implementation prompt you can give to your coding/design AI:

# TETHYR GRAPH

## The connective layer of Tethyr

You are working on Tethyr, a creative collaboration network built around the idea:

**“Connected by what you know.”**

Tethyr is not a conventional social network, job board, portfolio site, project-management tool, or skill marketplace.

The central idea is that people become meaningful through what they actually do, what they contribute, who they build with, what they learn, what projects they participate in, and how those things connect over time.

Build a major new foundational feature called:

# THE TETHYR GRAPH

The Tethyr Graph should become the underlying relationship layer connecting the existing Tethyr ecosystem.

It must NOT feel like a random “graph visualization feature.”

It should connect:

* People
* Projects
* Skills
* Contributions
* Knowledge
* Discussions
* Milestones
* Roles
* Sessions
* Communities
* Repositories
* Imported projects
* Project forks
* Templates
* Library resources
* Badges
* Reputation evidence
* Collaborators
* Project history
* Project lineage
* Credits
* Needs
* Challenges
* Community activity

The graph is the connective tissue between these things.

The goal is not simply to show a pretty network of dots.

The goal is to make Tethyr capable of answering:

> What do you know?

but more importantly:

> Where did you use it?

> Who did you use it with?

> What did you contribute?

> What did that contribution become?

> What projects did it lead to?

> What people did you meet through it?

> What skills were developed through that work?

> What evidence supports that reputation?

> How are the things I am working on connected?

This is what should make Tethyr fundamentally different from conventional profiles and social networks.

---

# 1. CORE PRINCIPLE

Do not create a disconnected “Graph page.”

Instead, make the graph a system that exists underneath the existing product.

Every existing object should be capable of participating in relationships.

For example:

Person
→ contributed to
→ Project

Person
→ demonstrated
→ Skill

Skill
→ used in
→ Project

Project
→ contains
→ Milestone

Milestone
→ required
→ Skill

Person
→ collaborated with
→ Person

Project
→ imported from
→ GitHub repository

Project
→ forked from
→ another Project

Contribution
→ produced
→ Knowledge

Knowledge
→ referenced by
→ Discussion

Contribution
→ supports
→ Reputation evidence

Project
→ resulted in
→ Badge

Person
→ discovered through
→ Project

The system should preserve these relationships rather than flatten everything into profile text.

---

# 2. THE GRAPH IS NOT A FOLLOWER GRAPH

Do NOT build this as:

Person → follows → Person

or:

Person → likes → Person

or:

Person → has 400 followers

Tethyr should not become LinkedIn.

Connections must have meaning.

Examples:

“worked together on”

“contributed to”

“reviewed”

“learned through”

“used skill in”

“created”

“maintains”

“forked from”

“derived from”

“participated in”

“completed”

“discussed”

“documented”

“credited”

“verified through”

“connected through”

“requested”

“needed by”

“shared with”

“built with”

The relationship itself should matter.

---

# 3. THE GRAPH OBJECT MODEL

Create a flexible graph data model.

The exact database implementation should respect the existing Supabase architecture and existing Tethyr schema.

Do not replace the existing architecture unnecessarily.

Introduce graph relationships in a way that can evolve.

Conceptually:

## Nodes

Nodes can represent:

* person
* project
* skill
* contribution
* knowledge
* milestone
* repository
* discussion
* community
* session
* role
* badge
* library item
* challenge
* credit
* need
* organization where applicable

## Edges

Edges represent meaningful relationships.

Examples:

* PERSON → CONTRIBUTED_TO → PROJECT
* PERSON → HAS_SKILL → SKILL
* PERSON → DEMONSTRATED_SKILL → SKILL
* SKILL → USED_IN → PROJECT
* PROJECT → HAS_MILESTONE → MILESTONE
* PROJECT → HAS_ROLE → ROLE
* PERSON → FILLED_ROLE → ROLE
* PERSON → COLLABORATED_WITH → PERSON
* PROJECT → RELATED_TO → PROJECT
* PROJECT → FORKED_FROM → PROJECT
* PROJECT → IMPORTED_FROM → REPOSITORY
* PERSON → CONTRIBUTED_TO → REPOSITORY
* CONTRIBUTION → PRODUCED → KNOWLEDGE
* KNOWLEDGE → REFERENCED_BY → DISCUSSION
* CONTRIBUTION → SUPPORTS → REPUTATION_EVIDENCE
* PROJECT → PRODUCED → BADGE
* PERSON → EARNED → BADGE
* PERSON → PARTICIPATED_IN → SESSION
* SESSION → USES → SKILL
* COMMUNITY → CONTAINS → PROJECT
* COMMUNITY → CONTAINS → DISCUSSION
* PROJECT → NEEDS → SKILL
* PERSON → OFFERS → SKILL

The model must support metadata on relationships.

For example:

PERSON A
→ CONTRIBUTED_TO
→ PROJECT B

could contain:

* role
* date
* contribution description
* milestone
* duration
* evidence
* repository
* visibility
* confirmation status

This makes the graph meaningful rather than merely visual.

---

# 4. CONTRIBUTION TRAILS

One of the most important parts of the system should be the concept of a:

## Contribution Trail

A Contribution Trail explains how something a person knows was actually used.

Example:

React
↓
Frontend work
↓
Tethyr project
↓
Dashboard contribution
↓
Milestone completed
↓
Repository commit history
↓
Project launched
↓
Collaborator review

Instead of saying:

“Bryce knows React.”

Tethyr can show:

“React was used in these projects, during these contributions, alongside these collaborators, resulting in these project milestones.”

This should become a major differentiator.

Contribution Trails should appear throughout Tethyr.

---

# 5. CONTEXTUAL REPUTATION

Do not turn reputation into one giant arbitrary number.

Tethyr's existing reputation/trust concept should become contextual.

For example:

A person may have strong evidence around:

Frontend development
Project coordination
Animal conservation
Photography
Community management

but their reputation should come from actual connected evidence.

Show:

Skill
→ projects
→ contributions
→ collaborators
→ milestones
→ evidence

Instead of:

“87 Reputation”

The graph should allow users to understand WHY reputation exists.

If a reputation score already exists in the codebase, do not simply delete it.

Instead, connect its supporting evidence to the graph.

---

# 6. PROJECT LINEAGE

Projects should have history.

A project can evolve.

For example:

Idea
↓
Project created
↓
First collaborator
↓
Prototype
↓
GitHub repository connected
↓
First milestone
↓
New contributor
↓
Fork created
↓
Community discussion
↓
Testing
↓
Launch
↓
Derivative project

Create a:

## “How we got here”

experience.

Users should be able to understand the history of a project without digging through dozens of pages.

Project lineage should support:

* original project
* forks
* derivatives
* templates
* imported repositories
* related projects
* predecessor projects
* successor projects
* major milestones
* major contributions

This should connect directly with the existing project lifecycle:

Planning
→ Building
→ Testing
→ Launch
→ Growing

---

# 7. GITHUB / EXTERNAL PROJECT IMPORTS

The Graph must connect directly to Tethyr's project import system.

This is extremely important.

When someone imports a GitHub repository:

DO NOT simply create:

“Project imported from GitHub.”

Instead, where the available data supports it, create relationships between:

GitHub repository
↓
Project
↓
contributors
↓
commits/contributions
↓
technologies
↓
releases
↓
issues
↓
milestones
↓
people

Do not invent data.

Only create graph relationships supported by imported information or explicit user input.

The import experience should explain:

> Bring your existing work into your Tethyr graph.

The purpose is not to copy GitHub.

The purpose is to connect existing work to the rest of the person's Tethyr identity.

---

# 8. GRAPH VIEWS

Do NOT make one giant graph visualization and call it finished.

Create multiple graph perspectives.

The user should be able to switch between different views depending on what they want to understand.

## VIEW 1: NETWORK

A broad relationship map.

Nodes:

People
Projects
Skills
Communities
Knowledge

Edges show relationships.

Useful for discovering:

* collaborators
* related projects
* related skills
* communities
* knowledge

This should be the most visually expressive view.

---

# VIEW 2: PROJECT

Focus the graph around one project.

Example:

PROJECT
│
├── People
├── Skills
├── Contributions
├── Milestones
├── Repository
├── Discussions
├── Needs
├── Roles
├── Related Projects
└── Knowledge

This should be available directly from project pages.

Do not force users to leave the project page.

---

# VIEW 3: PERSON

Focus the graph around a person.

Example:

PERSON
│
├── Projects
├── Contributions
├── Skills
├── Collaborators
├── Sessions
├── Knowledge
├── Communities
├── Reputation Evidence
└── Project History

This becomes a much more meaningful alternative to a traditional resume/profile.

---

# VIEW 4: SKILL

Focus on a specific skill.

Example:

SKILL: React
│
├── People
├── Projects
├── Contributions
├── Sessions
├── Communities
├── Evidence
└── Related Skills

The important difference:

Do not only show people who declared React.

Prioritize relationships where the skill was actually demonstrated through work.

---

# VIEW 5: LINEAGE

A chronological project-history view.

Example:

Idea
→ Prototype
→ Project
→ Contributors
→ Milestone
→ Repository
→ Fork
→ Launch

This should look more like a visual timeline/history system than a traditional network.

---

# VIEW 6: CONTRIBUTION

Focus entirely on a person's work.

Example:

Person
→ Contribution
→ Project
→ Skill
→ Milestone
→ Result

This should be useful for understanding someone's actual work.

---

# VIEW 7: COLLABORATION

Focus on people who have worked together.

Example:

Person A
↔ Project 1
↔ Person B

Person B
↔ Project 2
↔ Person C

The emphasis should be on shared work rather than social following.

---

# VIEW 8: DISCOVERY

A more exploratory graph.

Start from:

“People connected to this skill”

or:

“Projects related to this project”

or:

“People who have contributed to similar projects”

or:

“Knowledge connected to this topic”

This can become one of Tethyr's strongest discovery mechanisms.

---

# 9. GRAPH CONTROLS

The graph should be interactive.

Include:

* zoom
* pan
* focus
* reset
* expand
* collapse
* isolate node
* hide node type
* show node type
* search
* filter
* relationship filters
* time filters where appropriate
* depth control
* density control
* layout selection
* fullscreen
* fit to screen

Do not overwhelm the interface.

Controls should progressively reveal complexity.

---

# 10. GRAPH DEPTH

Allow the user to choose how far relationships expand.

For example:

Depth 1:

Person
→ Projects

Depth 2:

Person
→ Projects
→ Skills
→ People

Depth 3:

Person
→ Projects
→ Skills
→ People
→ Contributions
→ Milestones

Depth 4:

Full connected ecosystem.

This is important because a real Tethyr graph could become extremely large.

Never dump thousands of nodes onto the screen automatically.

---

# 11. LAYOUT OPTIONS

Allow multiple layouts.

At minimum:

### Radial

Central node with relationships around it.

Best for:

Person
Project
Skill

### Tree

Best for:

Project lineage
Knowledge relationships
Contribution trails

### Timeline

Best for:

Project history
Contributions
Milestones

### Force/network

Best for:

Discovery
Collaboration
Large relationship maps

### Hierarchical

Best for:

Project structure
Community relationships
Skills and evidence

### Focus mode

One selected node in the center with only its closest relationships visible.

The user should be able to switch layouts without changing the underlying data.

---

# 12. VISUAL LANGUAGE

The graph must look like Tethyr.

Do NOT create a generic futuristic “AI graph.”

Avoid:

* glowing neon nodes
* excessive gradients
* glassmorphism
* sci-fi interfaces
* holographic effects
* excessive animation
* huge rounded cards
* glowing connection lines
* AI-looking dashboards

The visual language should feel:

Human
Professional
Technical
Creative
Structured
Editorial
Modern
Explorable

It should feel closer to the design language of:

GitHub
Linear
Figma
Notion
Discord
Vercel

while still being recognizably Tethyr.

---

# 13. SQUARED / STRUCTURED VISUAL SYSTEM

Use Tethyr's existing design language.

Prefer:

* structured panels
* thin borders
* strong spacing
* clear hierarchy
* restrained radii
* compact controls
* editorial typography
* modular sections
* dense but readable information
* subtle depth
* strong alignment

Do not redesign Tethyr around the graph.

The graph must inherit Tethyr.

---

# 14. TETHYR THEMING SYSTEM

This is extremely important.

The graph must integrate with the existing Tethyr customization system.

Tethyr already has customization concepts around:

* Structure
* Personality
* Density
* Accent
* Background
* Feel / starters

The graph should use these existing theme values.

Do NOT create a separate graph theme system.

If the user changes their Tethyr appearance, the graph should naturally change with it.

---

# 15. STRUCTURE THEME

The Structure setting should affect:

* graph panel layout
* node geometry
* spacing
* borders
* grouping
* information density
* sidebar behavior
* relationship presentation

For example:

A more structured Tethyr appearance may use:

square nodes
tight spacing
strong borders
clear hierarchy

A softer structure may use:

slightly more rounded nodes
more breathing room
less rigid grouping

But remain within the existing Tethyr design language.

---

# 16. PERSONALITY THEME

Personality should influence the visual character of the graph.

For example:

Editorial
→ typography-led
→ restrained graph
→ strong labels

Technical
→ denser
→ sharper borders
→ information-rich

Creative
→ more expressive accents
→ richer node treatments
→ slightly more visual exploration

Community
→ people/collaboration relationships become more prominent

Do not introduce arbitrary visual themes.

Use the existing Tethyr personality system.

---

# 17. DENSITY THEME

Density should directly affect graph rendering.

Low density:

* fewer visible nodes
* larger spacing
* simplified labels
* less metadata

Medium:

* normal graph
* useful relationship labels

High:

* more nodes
* tighter spacing
* more metadata
* more relationship information

This should be responsive.

Do not simply scale everything smaller.

Actually change information density.

---

# 18. ACCENT THEME

Use the user's existing Tethyr accent color.

The accent should control:

* selected nodes
* active relationships
* focus state
* buttons
* highlights
* graph controls
* relationship emphasis

Do not hard-code graph colors.

Use semantic theme tokens.

For example:

--tethyr-accent
--tethyr-accent-muted
--tethyr-border
--tethyr-surface
--tethyr-background
--tethyr-foreground
--tethyr-muted

If Tethyr already has token names, use those instead.

---

# 19. BACKGROUND THEME

The graph should respect the existing Tethyr background customization.

If the user chooses a plain background, the graph remains plain.

If the user chooses a textured/background treatment, the graph should sit naturally on top of it.

Do not create a separate graph canvas background that overrides the user's theme.

Graph rendering must remain readable regardless of the selected background.

---

# 20. FEEL / STARTERS

The existing Feel / starter system should also influence the graph.

For example, if a starter creates a more:

Minimal
Technical
Editorial
Creative
Community

appearance, the graph should inherit that personality.

The graph should feel like another part of the user's Tethyr environment.

---

# 21. NODE DESIGN

Nodes should not all look identical.

Node type should be visually distinguishable without relying entirely on color.

For example:

Person
→ avatar / portrait

Project
→ project cover or project mark

Skill
→ skill symbol/text

Knowledge
→ document/bookmark treatment

Repository
→ code/repository symbol

Community
→ group symbol

Milestone
→ milestone marker

Contribution
→ contribution marker

But keep the system restrained.

Do not turn it into a colorful infographic.

---

# 22. NODE HIERARCHY

Important nodes should visually stand out based on context.

For example:

When viewing a project:

Project = primary

People = secondary

Skills = secondary

Contributions = tertiary

Do not use arbitrary “importance scores.”

Importance should come from the current graph context.

---

# 23. RELATIONSHIP VISUALIZATION

Edges should communicate relationship type.

But avoid a rainbow of connection colors.

Use:

* line weight
* line style
* subtle labels
* directional indicators when appropriate
* hover states

Examples:

Contribution
→ solid line

Related
→ subtle/dashed

Fork
→ directional relationship

Timeline
→ connected chronological path

Need
→ directional

Avoid making every relationship visually loud.

---

# 24. INTERACTION

Clicking a node should open its existing Tethyr representation.

For example:

Click Project
→ project preview / project page

Click Person
→ profile preview / profile

Click Skill
→ skill exploration

Click Repository
→ repository/import information

Click Contribution
→ contribution details

Do not create completely separate duplicate pages unless necessary.

The graph should be an entry point into the existing product.

---

# 25. HOVER

Hovering a node should provide a lightweight preview.

Show:

* name
* type
* short description
* relevant relationship
* one or two useful facts

Avoid giant tooltips.

---

# 26. SELECTED NODE

When selected:

* highlight node
* highlight direct relationships
* dim unrelated nodes
* show relationship details
* expose actions
* optionally allow expansion

Example:

Select a person.

The graph could show:

“Worked with this person on 4 projects.”

“Shared 3 skills.”

“Participated in 2 sessions.”

“Connected through 5 contributions.”

This makes the graph useful rather than decorative.

---

# 27. PATH EXPLORATION

Allow users to select two nodes and ask:

## “How are these connected?”

Example:

Person A
→ Project X
→ Skill React
→ Project Y
→ Person B

Show the path.

This is extremely important to the Tethyr concept.

It turns the graph into a discovery tool.

Possible paths:

Person → Person

Person → Skill

Person → Project

Project → Project

Skill → Project

Project → Knowledge

Person → Community

The path should explain each relationship in human language.

---

# 28. “HOW WE GOT HERE”

Every major project should optionally expose:

## How we got here

A readable history generated from actual graph relationships.

Example:

Project created by Bryce.

↓
First collaborator joined.

↓
React was introduced.

↓
Repository connected.

↓
Frontend contribution completed.

↓
Milestone completed.

↓
Project forked into another project.

This should feel like project history, not an AI-generated summary.

No AI is required.

Use actual stored data.

---

# 29. PRIVACY

Graph visibility must respect Tethyr's existing privacy system.

Never expose private relationships.

Respect:

* private projects
* private profiles
* private contributions
* hidden skills
* private communities
* private repositories
* hidden activity

If a relationship cannot be seen by the viewer, it must not appear in the graph.

Do not leak information through graph structure.

For example, do not show:

“Person A → Private Project”

if the viewer is not allowed to know that relationship exists.

---

# 30. GRAPH SEARCH

The graph should eventually support search.

Search:

“React”

could surface:

Skills
Projects
People
Contributions
Communities
Knowledge

Search:

“Bryce”

could show:

Projects
Collaborators
Skills
Contributions
Communities

Search:

“Project X”

could show:

Project
People
Skills
Repository
Related projects
Lineage

Search should work with existing Tethyr search infrastructure where possible.

Do not create a disconnected search system.

---

# 31. GRAPH FILTERS

Useful filters include:

Node type:

* People
* Projects
* Skills
* Knowledge
* Communities
* Repositories
* Contributions
* Milestones

Relationship:

* Worked together
* Contributed
* Used skill
* Forked
* Related
* Participated
* Created
* Discussed

Time:

* All time
* Recent
* This year
* Custom range

Status:

* Active
* Completed
* Archived

Visibility:

Respect permissions automatically.

---

# 32. GRAPH ON PROJECT PAGES

The project page should gain a subtle graph entry point.

For example:

## Connections

People
Skills
Contributions
Related Projects

[Explore graph]

Do not make the graph overwhelm the project page.

Potentially include a compact visualization.

Clicking “Explore graph” opens the full graph experience focused on that project.

---

# 33. GRAPH ON PROFILES

The profile should show:

## Your Work Graph

A compact representation of:

Projects
Skills
Contributions
Collaborators
Communities

Potentially allow:

“Explore my graph”

This becomes much more meaningful than a conventional profile timeline.

---

# 34. GRAPH ON SKILL PAGES

Skills should become connected objects.

Example:

# React

Used in 37 projects

Demonstrated by 82 people

Connected projects

Related skills

Sessions

Evidence

Contributions

Communities

This gives skills context.

---

# 35. GRAPH ON LIBRARY

A library item should be able to show:

Used by:

Projects

People

Discussions

Skills

Sessions

This turns the library into part of the wider Tethyr knowledge network.

---

# 36. GRAPH ON COMMUNITIES

Communities should connect to:

People
Projects
Skills
Discussions
Sessions
Challenges
Knowledge

This makes communities useful as hubs rather than isolated chat spaces.

---

# 37. GRAPH DISCOVERY

Use graph relationships to improve discovery.

But do NOT build AI recommendations.

Do not say:

“AI thinks you should meet this person.”

Instead use explicit graph relationships.

Examples:

“You both contributed to…”

“You worked on related projects.”

“You share 3 demonstrated skills.”

“You both participated in…”

“This project was derived from…”

“This person contributed to a project related to yours.”

This remains transparent and human-readable.

---

# 38. NO AI

This feature must NOT introduce AI.

Do not add:

* AI recommendations
* AI-generated graph summaries
* AI relationship scoring
* AI people matching
* AI graph analysis
* AI-generated reputation
* AI-generated skills

The intelligence comes from Tethyr's actual structured data and relationships.

This is important to the product philosophy.

---

# 39. NO GAMIFICATION

Do not turn the graph into:

* XP
* levels
* points
* leaderboard
* social score
* popularity score

Reputation should remain evidence-based.

The graph is about understanding connections, not competing.

---

# 40. GRAPH HOME

Consider a dedicated:

# Explore

or:

# Network

entry point in the main Tethyr navigation.

But do not make it feel mandatory.

The graph should also be discoverable contextually throughout the product.

The dedicated graph experience can have:

Top navigation:

Overview
Projects
People
Skills
Knowledge
Communities

and contextual filters.

---

# 41. GRAPH WORKSPACE

The full graph interface should have a layout roughly like:

---

Top bar
Search | View | Layout | Filters | Depth | Theme
------------------------------------------------

Left:
Navigation / graph context

Center:
Interactive graph

Right:
Selected node / relationship inspector

Bottom:
Path / timeline / relationship details

---

Do not rigidly follow this exact layout if it conflicts with the existing Tethyr shell.

Integrate it into the existing navigation and responsive layout.

---

# 42. GRAPH INSPECTOR

When selecting an object, show a contextual inspector.

Example:

## PROJECT

Project Name

Short description

Connected people
12

Skills
7

Contributions
34

Milestones
5

Related projects
3

[Open project]

[Expand connections]

The inspector should use existing Tethyr components.

Do not create a completely separate design system.

---

# 43. PATH MODE

Add a mode where the user can choose:

Start
→ node

End
→ node

Then:

## Connection found

Person
↓
Project
↓
Skill
↓
Project
↓
Person

Each step should be clickable.

This could become one of the signature Tethyr experiences.

---

# 44. GRAPH ANIMATION

Use animation carefully.

Good:

* subtle node expansion
* relationship highlighting
* smooth camera movement
* focus transitions
* filtering transitions

Bad:

* constantly moving nodes
* floating particles
* glowing connections
* excessive physics
* animated backgrounds

The graph should feel stable and professional.

Users should be able to understand it.

---

# 45. PERFORMANCE

Assume large graphs.

Do not render every possible relationship at once.

Use:

* lazy expansion
* depth limits
* viewport-aware rendering
* clustering where appropriate
* pagination for relationship lists
* progressive expansion
* memoized graph calculations
* efficient graph rendering
* server-side relationship queries where appropriate

The UI must remain usable on ordinary laptops and phones.

---

# 46. MOBILE

Do not simply shrink the desktop graph.

Mobile should have a dedicated interaction model.

For example:

Graph
↓
Select node
↓
Bottom sheet

The bottom sheet contains:

Node information
Relationships
Actions
Expand

Allow swipe/navigation between related nodes.

Keep the graph visually useful without requiring precision mouse interaction.

---

# 47. ACCESSIBILITY

Do not make the graph dependent on visual interpretation.

Every relationship should have accessible text.

For example:

“Bryce contributed to Tethyr.”

“Bryce demonstrated React through Project X.”

“Project Y was forked from Project X.”

Provide keyboard navigation where practical.

Provide a list/tree alternative to the visualization.

This is extremely important.

---

# 48. GRAPH + LIST VIEW

Every graph visualization should have an alternative structured view.

Example:

## Connections

### People

Bryce
Worked on Project X

Alex
Reviewed Project X

### Skills

React
Used in Project X

TypeScript
Used in Project X

This ensures the graph is useful even when visualization is disabled.

---

# 49. THEME PREVIEW

Because Tethyr already has live customization, the graph should react instantly when the user changes:

Structure
Personality
Density
Accent
Background
Feel

If the user opens Customize while viewing the graph:

change the setting

→ graph updates immediately

No refresh.

No separate graph theme.

No duplicate theme settings.

---

# 50. GRAPH-SPECIFIC CUSTOMIZATION

Only add graph-specific controls where genuinely necessary.

Potential controls:

Graph layout
Node labels
Relationship labels
Depth
Animation

These should be considered view preferences, NOT a second theme system.

For example:

Customize:

Structure
Personality
Density
Accent
Background
Feel

Graph controls:

Layout
Depth
Filters
Labels

Keep those concepts separate.

---

# 51. USER CUSTOMIZATION MEMORY

If Tethyr already remembers customization preferences, graph presentation should respect them.

For example:

User chooses:

Dense structure
Technical personality
High density
Green accent
Dark background

The graph should automatically inherit that environment.

Do not ask the user to configure the same things again.

---

# 52. GRAPH VISUAL THEMES

Do not create arbitrary graph skins.

Instead create layout/presentation modes that operate within the user's Tethyr theme:

Network
Lineage
Timeline
Radial
Tree
Focus

All use the same theme tokens.

---

# 53. GRAPH EMPTY STATES

Do not show:

“No data.”

Instead explain what the graph becomes.

Example:

## Your Tethyr graph starts here

Connect a project, add a skill, contribute to a collaboration, or import existing work.

As you build, your connections will begin to appear here.

[Create project]

[Import project]

[Add skills]

This should feel like the graph is growing naturally.

---

# 54. FIRST-TIME EXPERIENCE

Do not overwhelm new users.

Start with a simple graph.

Example:

You
↓
Your first project
↓
Your first skill

Then progressively reveal more relationships.

The complexity should emerge from actual activity.

---

# 55. PROJECT IMPORT ONBOARDING

When importing GitHub or another supported source, explicitly explain:

## Connect your existing work

Import this project into Tethyr and connect its existing work to your:

Projects
Skills
Contributions
Collaborators
Reputation

Do not promise relationships that cannot be verified.

Allow the user to review imported relationships before publishing them where appropriate.

---

# 56. RELATIONSHIP CONFIRMATION

Some relationships can be automatically established from reliable data.

Others should require confirmation.

For example:

GitHub repository contributor
→ strong evidence

“Worked closely with this person”
→ may require user confirmation

“Skill demonstrated”
→ can be supported by contribution data but should remain transparent

Give users control over graph claims.

---

# 57. RELATIONSHIP DETAILS

Clicking an edge should reveal:

Relationship:

“Contributed to”

Source:

“Project X”

Context:

“Frontend milestone”

Date:

“September 2026”

Evidence:

Repository / contribution / milestone

Visibility:

Public

This turns the graph into evidence rather than decoration.

---

# 58. GRAPH HISTORY

Where meaningful, relationships can have timestamps.

This allows Tethyr to answer:

“What was connected at this point in time?”

This can eventually support historical views of projects and collaboration.

Do not build an overly complicated historical system if the existing data model does not support it yet.

Design the architecture so it can evolve.

---

# 59. GRAPH DATA INTEGRITY

Never create fake connections.

Every relationship should have:

* source
* target
* type
* visibility
* creation date where applicable
* evidence/source where applicable

Relationships should be traceable.

If data is uncertain, do not present it as established fact.

---

# 60. ARCHITECTURAL REQUIREMENT

The graph must be implemented as reusable infrastructure.

Do not build eight independent graph systems.

Create reusable primitives for:

Node

Edge

Relationship

Graph query

Graph context

Graph filters

Graph layout

Graph inspector

Graph path

Graph renderer

Theme integration

Then reuse these primitives across:

Profiles
Projects
Skills
Communities
Library
Discovery
Imports

---

# 61. EXISTING TETHYR COMPONENTS

Before implementing anything:

Inspect the existing codebase.

Identify:

* existing theme system
* existing customization panel
* existing layout primitives
* existing cards/panels
* existing typography
* existing navigation
* existing project schema
* existing profile schema
* existing skills schema
* existing reputation system
* existing project imports
* existing GitHub integration
* existing search
* existing privacy/visibility
* existing community system
* existing milestones
* existing contributions

Reuse them.

Do not create duplicates.

---

# 62. DO NOT BREAK EXISTING FEATURES

The implementation must preserve:

* existing profiles
* existing projects
* existing communities
* existing customization
* existing project pages
* existing import workflows
* existing GitHub integration
* existing reputation
* existing navigation
* existing authentication
* existing Supabase structure

Do not replace working systems simply to implement the graph.

Extend them.

---

# 63. UI PHILOSOPHY

The graph should feel like:

“a deeper layer of Tethyr that was always supposed to exist.”

It should NOT feel like:

“we added a graph feature.”

The user should gradually discover that:

Projects connect to people.

People connect to skills.

Skills connect to contributions.

Contributions connect to reputation.

Projects connect to other projects.

Communities connect to knowledge.

Repositories connect existing work.

Everything starts forming a living network.

---

# 64. THE SIGNATURE EXPERIENCE

The most important experience should be:

## “Show me how this is connected.”

A user can begin anywhere.

For example:

Project

→ People

→ Skills

→ Contributions

→ Repository

→ Related project

→ New collaborator

→ Community

→ Session

→ Knowledge

→ another project

Tethyr becomes a system for navigating meaningful relationships.

---

# 65. THE BIGGER PRODUCT IDEA

The graph should make the Tethyr tagline structurally true:

# Connected by what you know.

Traditional platforms mostly separate:

Profile
Work
Community
Knowledge
History
Reputation

Tethyr should connect them.

The graph is what makes that possible.

---

# 66. IMPLEMENTATION ORDER

Do not attempt to build everything at once.

Implement in stages.

### PHASE 1

Graph data model.

People
Projects
Skills
Contributions
Relationships

### PHASE 2

Project graph.

Project
People
Skills
Contributions
Milestones

### PHASE 3

Profile graph.

Person
Projects
Skills
Collaborators
Contributions

### PHASE 4

Project lineage.

Forks
Related projects
Imported projects
Project history

### PHASE 5

GitHub/import integration.

Connect imported work to the graph.

### PHASE 6

Graph exploration.

Search
Filters
Depth
Layouts
Path exploration

### PHASE 7

Community / knowledge integration.

Communities
Discussions
Library
Sessions
Knowledge

### PHASE 8

Full theme integration.

Structure
Personality
Density
Accent
Background
Feel

### PHASE 9

Performance and accessibility.

Large graph handling
Mobile
Keyboard
List/tree alternatives
Privacy auditing

---

# 67. RESPONSIVE DESIGN

Desktop:

Full graph workspace.

Tablet:

Graph + collapsible inspector.

Mobile:

Graph focus mode + bottom-sheet inspector + list alternative.

Do not sacrifice functionality on mobile.

---

# 68. FINAL DESIGN TEST

Before considering the feature complete, ask:

Does it feel like Tethyr?

Does it use the existing Tethyr theme?

Does changing Tethyr's appearance change the graph?

Does it connect existing product features?

Does it make projects more meaningful?

Does it make profiles more meaningful?

Does it make skills more meaningful?

Does it make reputation more transparent?

Does it make GitHub imports more useful?

Does it improve discovery?

Does it preserve privacy?

Does it avoid becoming a follower graph?

Does it avoid AI?

Does it avoid gamification?

Does it avoid unnecessary visual complexity?

Does every relationship have a reason to exist?

Can a user understand WHY two things are connected?

Can the user navigate from a graph node back into the actual Tethyr object?

---

# 69. MOST IMPORTANT REQUIREMENT

Do not treat this as a visualization project.

The visualization is only the visible layer.

The actual feature is:

# A connected data model for Tethyr.

The graph should exist even when the visualization is not visible.

The same relationships should power:

* project pages
* profiles
* discovery
* search
* skills
* reputation
* imports
* project lineage
* communities
* knowledge
* collaboration
* contribution history

The graph visualization is simply one way of exploring that underlying network.

---

# 70. FINAL PRODUCT VISION

When complete, a Tethyr user should be able to enter almost anywhere in the platform and follow meaningful connections.

Start with:

A person.

Find their project.

See their contribution.

See the skill used.

See the milestone completed.

See the repository.

See who they worked with.

See the related project.

See where that project came from.

See what knowledge came from it.

See the community around it.

See another person who contributed.

And continue exploring.

That is the experience Tethyr should own.

The final feeling should be:

> “I didn't just find a profile. I found the story of how this person's work connects to everything around it.”

Build this as a foundational part of Tethyr, not as an isolated feature.

Use the existing Tethyr architecture, design system, customization system, data structures and product workflows wherever possible.

Extend before replacing.

Reuse before duplicating.

Keep the UI human-made, professional, structured, creative and technically sophisticated.

No AI.

No follower economy.

No gamification.

No generic futuristic graph aesthetic.

The graph should feel like **Tethyr itself becoming visible.**

This is intentionally designed so the **graph is both a backend relationship system and a visual exploration layer**, rather than just adding a flashy graph page. The theming requirement is especially important because it means your existing **Structure / Personality / Density / Accent / Background / Feel** system remains the single source of visual identity across Tethyr.
