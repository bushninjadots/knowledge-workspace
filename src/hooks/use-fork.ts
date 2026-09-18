// ── Fork Hook ────────────────────────────────────────────────────────────────
// Forks copy a layout's structure to a new layout owned by the forking user,
// with a recorded parent→child relationship.
// Remix = fork + publish the fork as a new template.
//
//   • useForkLayout — copy a template's sections into a new layout + record fork.
//   • useRemixLayout — fork + mark the child as a template.
//   • useLineage — get the full ancestry chain for a layout.
//   • useForkCount — get the fork count for a layout.

// ── Queries ──────────────────────────────────────────────────────────────────
