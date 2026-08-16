# Pages To Create

Updated 2026-08-06 after the Phase 2 product-coherence pass.

## Current status

The public skill route `/skills/$slug` is implemented and renders a complete hub for every skill present in the `skills` catalog. Community Trending Skills and dashboard Discover Skills now read from the catalog and rank skills by usage across teaching, learning, and project associations. They no longer link to hardcoded or missing slugs.

Unknown slugs still show an intentional **Skill not found** state with a path back to Explore; no additional page is required for those URLs.

## Remaining product opportunities

These are product improvements, not missing routes:

- Add richer editorial descriptions and learning resources to skill hubs.
- Add server-side aggregation or an RPC if the usage-ranked query becomes expensive at scale.
- Add dedicated local discovery pages when that roadmap layer is started.
- Expand Opportunities with saved searches, stronger skill matching, and application status summaries.

## Already handled

- `/skills/typescript`, `/skills/ui-ux`, and `/skills/tailwind` are no longer emitted by hardcoded navigation.
- `/skills/video-editing` was removed from the dashboard QuickLink; the action now opens Explore.
- Public profile, project, community, challenge, and authenticated product routes have intentional loading, empty, and error states.
