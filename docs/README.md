# Tethyr Documentation Index

This directory contains canonical product/design references, current-state audits, feature specifications, and execution records. They do not all have the same authority.

## Authority and Precedence

The canonical references have different ownership rather than one universal ranking:

- **Product intent:** [`TETHYR_PRODUCT.md`](./TETHYR_PRODUCT.md) owns what Tethyr is, who it serves, the primary loop, and product decisions.
- **Binding implementation/design constraints:** [`../AGENTS.md`](../AGENTS.md) owns the non-negotiable rules for how AI agents modify the repository.
- **Workflow:** [`TETHYR_UX_RULES.md`](./TETHYR_UX_RULES.md) owns how significant decisions are reasoned about, reviewed, and validated.
- **Implementation guidance:** [`TETHYR_DESIGN_SYSTEM.md`](./TETHYR_DESIGN_SYSTEM.md) owns concrete visual and interaction guidance.
- **Architecture:** [`TETHYR_ARCHITECTURE.md`](./TETHYR_ARCHITECTURE.md) owns implementation and ownership boundaries.
- **Design intent:** [`TETHYR_DESIGN.md`](./TETHYR_DESIGN.md) explains the desired visual character and composition.

When documents conflict, preserve both ownership boundaries: do not violate a binding `AGENTS.md` guardrail, and do not make a product decision that contradicts `TETHYR_PRODUCT.md` without explicitly proposing a product-direction change. The workflow and implementation documents should resolve ambiguity in favor of those two anchors. Current source and tests describe implementation reality and should be audited against them. Dated audits, feature specs, and plans provide valuable context but do not silently override canonical references.

If a change should alter product direction or a binding rule, update the appropriate canonical document deliberately rather than working around the conflict in a feature file.

## Canonical References

| Document                                                               | Owns                                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`TETHYR_PRODUCT.md`](./TETHYR_PRODUCT.md)                             | Product identity, loop, pillars, objects, and product decisions                  |
| [`TETHYR_DESIGN.md`](./TETHYR_DESIGN.md)                               | Visual character, composition intent, and aesthetic reasoning                    |
| [`TETHYR_DESIGN_SYSTEM.md`](./TETHYR_DESIGN_SYSTEM.md)                 | Surfaces, typography, spacing, states, responsiveness, and component reuse       |
| [`TETHYR_UX_RULES.md`](./TETHYR_UX_RULES.md)                           | Required analysis, design review, implementation review, and validation workflow |
| [`TETHYR_ARCHITECTURE.md`](./TETHYR_ARCHITECTURE.md)                   | Route, component, data, server, security, and documentation ownership            |
| [`TETHYR_REDESIGN_SPEC.md`](./TETHYR_REDESIGN_SPEC.md)                 | Major redesign specification — block system, templates, fork/remix, phases       |
| [`TETHYR_REDESIGN_ARCHITECTURE.md`](./TETHYR_REDESIGN_ARCHITECTURE.md) | Redesign data model, component ownership, and migration strategy                 |
| [`../AGENTS.md`](../AGENTS.md)                                         | Binding constitution and project-wide agent guardrails                           |

## Living Trackers, Known Issues & Active Plans

- [`TETHYR_ISSUE_TRACKER.md`](./TETHYR_ISSUE_TRACKER.md) — living functional/security issue tracker with per-item status (open · fixed · deferred)
- [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md) — known gotchas and migration foot-guns
- [`LAUNCH_READINESS.md`](./LAUNCH_READINESS.md) — launch environment checklist and open items
- [`studio-integration-plan.md`](./studio-integration-plan.md) — active Studio convergence plan (project/profile page composition)

## Context Documents

- [`TETHYR_REDESIGN_SPEC.md`](./TETHYR_REDESIGN_SPEC.md) — major redesign specification
- [`TETHYR_REDESIGN_ARCHITECTURE.md`](./TETHYR_REDESIGN_ARCHITECTURE.md) — redesign architecture proposal
- [`TETHYR_REDESIGN_AUDIT_2026-08-23.md`](./TETHYR_REDESIGN_AUDIT_2026-08-23.md) — **Phase 1 audit report** (complete)
- [`TETHYR_REDESIGN_FINAL_AUDIT_2026-08-23.md`](./TETHYR_REDESIGN_FINAL_AUDIT_2026-08-23.md) — **Phase 11 final audit** — all 11 phases complete, all gates passing
- [`TETHYR_IMPLEMENTATION_STAGES.md`](./TETHYR_IMPLEMENTATION_STAGES.md) — staged execution priorities (includes redesign Stages 8–18)
- [`TETHYR_FULL_FORENSIC_AUDIT_2026-08-09.md`](./TETHYR_FULL_FORENSIC_AUDIT_2026-08-09.md) — dated forensic audit and findings
- [`UI_UX_FULL_AUDIT.md`](./UI_UX_FULL_AUDIT.md) — detailed dated UI/UX audit
- [`UX_AUDIT.md`](./UX_AUDIT.md) — route-level UX findings and priorities
- [`PROJECT_AUDIT.md`](./PROJECT_AUDIT.md) — broader project audit
- [`UX_FULL_REVIEW_2026-08-20.md`](./UX_FULL_REVIEW_2026-08-20.md) — full user-flow review (2026-08-20); findings with same-day resolution status
- [`UI_UX_AUDIT_AND_FIXES.md`](./UI_UX_AUDIT_AND_FIXES.md) — remediation history
- [`FULL_SITE_AUDIT_2026-08-26.md`](./FULL_SITE_AUDIT_2026-08-26.md) — full-stack site audit (2026-08-26): P0 production crash (Sentry double-init), stored XSS in block renderers, CSP gaps, bundle budget, lint debt, DB drift, and healthy-surface verification
- [`superpowers/specs/`](./superpowers/specs/) — feature design specifications
- [`superpowers/plans/`](./superpowers/plans/) — feature execution plans
- [`MEDIA_STORAGE_MAINTENANCE.md`](./MEDIA_STORAGE_MAINTENANCE.md) — storage upload conventions, orphaned-media prune tool + registry contract, and bucket-growth monitoring

Dated documents should be read for relevant context, but their recommendations may be complete, stale, or superseded. Check dates and compare them against the current source before acting.

Serial full-site/forensic audits that were superseded by a retained later audit of the same scope were pruned on 2026-09-07 (`TETHYR_FULL_SITE_AUDIT_2026-08-16/19`, `TETHYR_FORENSIC_AUDIT_2026-08-22`, and the obsolete `PAGES_TO_CREATE.md` planning artifact); the newest audit of each scope — `FULL_SITE_AUDIT_2026-08-26.md` and the `TETHYR_REDESIGN_*` audits — remains authoritative.
