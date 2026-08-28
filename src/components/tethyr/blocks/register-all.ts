// ── Block Registration Force-Load ────────────────────────────────────────────
// Import this file wherever a page renderer or editor needs the block registry.
// Each side-effect import triggers registerBlock() in its block module.
//
// Barrel re-exports are intentionally avoided because Vite may tree-shake them
// when no named export is consumed.

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
