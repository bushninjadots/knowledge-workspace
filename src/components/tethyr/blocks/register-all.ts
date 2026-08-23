// ── Block Registration Force-Load ────────────────────────────────────────────
// Import this file wherever you need the block registry populated (studio route,
// editor, page shell). Each import below triggers the module-level
// registerBlock() call in the individual block file.
//
// Barrel re-exports (export { X } from "./file") are NOT sufficient — Vite
// tree-shakes them when nothing consumes the named export.

import "./content/text-block";
import "./content/heading-block";
import "./content/markdown-block";
import "./content/divider-block";

import "./project/hero-block";
import "./project/about-block";
import "./project/status-block";
import "./project/team-block";
import "./project/activity-block";
import "./project/files-block";
import "./project/repos-block";
import "./project/milestones-block";
import "./project/needs-block";
import "./project/roles-block";
import "./project/discussions-block";
import "./project/evidence-block";
import "./project/sessions-block";
import "./project/credits-block";
import "./project/timeline-block";

import "./profile/header-block";
import "./profile/skills-block";
import "./profile/projects-block";
import "./profile/bio-block";
import "./profile/tools-block";
import "./profile/links-block";
import "./profile/experience-block";
import "./profile/direction-block";
import "./profile/achievements-block";
import "./profile/gallery-block";