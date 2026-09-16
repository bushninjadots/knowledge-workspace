# Tethyr Visual Audit (2026-09-16)

> **Method:** metric-driven, not eyeballed. A repeatable Playwright harness
> (`scripts/qa-audit.mjs`) walks 21 routes at desktop (1440px) and mobile (390px)
> widths and measures, per page: console/page/HTTP errors, horizontal overflow,
> tap-target sizes, and text-to-border distances on every leaf card. A second
> harness (`scripts/qa-workflows.mjs`) click-throughs the editor's core flows.
> Screenshots land in `qa-artifacts/`. Both scripts gate CI (see
> `.github/workflows/visual-qa.yml`).

## Findings fixed this pass

| Finding | Root cause | Fix |
| --- | --- | --- |
| Block content sat 1px from the `studio-block` card border | The frame utility owned background/border/radius but no padding | Frame owns a 16px inset (`--studio-block-inset`); self-carding blocks (profile header, containerless heroes) render flush |
| "Bunched" density in studio cards | 9–10px metadata text, 0px vertical gaps between rows, 11px text on 11px line-height | Metadata floor raised to 11px with `leading-snug`; rhythm restored (`mt-3` meta rows, 0.5 caption gaps) in projects, achievements, header, person pills |
| Achievements text pushed past the card border in narrow columns | `min-w-44` beats `max-w-full` in CSS — classic min/max clash | `min-w-[min(11rem,100%)]` responsive minimum |
| Project page 32px horizontal viewport overflow | Workbench band's `-mx-4` counteracted padding that wasn't there | Full-width band + the container's own horizontal padding |
| Teams page React key warning | `key` on the inner Link instead of the repeated Card | Key moved to the Card |
| Community inline project card 1px bottom overflow | Line-height subpixel artifact | Clipped at the card |
| Community post/composer cards were the only square cards site-wide | Missing radius utility | `rounded-lg` per the radius scale |

False positives documented for future runs: line-clamped text reports full range
rects (measurement artifact, not visual overflow); intentional media-overlay
labels (project shelf thumbnails) sit close to edges by design; full-bleed
`border-y` bands and `section-label` eyebrows are the site's level-1 language.

## Status of the 2026-09-09 audit items

Re-verified in source and in the running app rather than assumed. **G14, G16,
G18, G19, G21 — all resolved.** The Explore control layers are collapsed, the
selected-state dialect is `SegmentedControl` everywhere (library view toggle
included), raw inputs/selects are swapped to the `ui/` primitives, and the
messages focus ring is the standard one. No open items remain from that audit.

## Workflow verification

`scripts/qa-workflows.mjs` passes 14/14 in the running app: exactly one
"Edit details" entry, dialog opens/saves/closes with bio persisted and no error
toast, customize panel opens in edit mode with the background entry and the
site-wide theme option, the panel scrolls independently of the page, the
site-wide theme changes `--primary` on `<html>` and persists, and the editor
grid + snap settle logic are reachable. Snap behavior additionally carries a
dedicated drag-simulation suite (`snap-qa.test.ts`).

## Harness for CI

`.github/workflows/visual-qa.yml` boots the full local Supabase stack + dev
server on the primary remote, runs both harnesses (hard-failing on console/
page/HTTP errors and failed workflow checks; visual metrics stay informational),
and uploads `qa-artifacts/` for review. Scheduled nightly plus manual dispatch;
never runs on forked PRs.
