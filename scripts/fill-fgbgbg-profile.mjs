#!/usr/bin/env node
// One-off local fill for the fgbgbg profile (brycecbond94@gmail.com):
// hides test projects, creates the three real GitHub repo projects with their
// actual READMEs + cached metadata, fills every profile field, links skills.
// Dev-local only; never run against a hosted environment.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const RUNTIME = readFileSync(".env.supabase-runtime", "utf8");
const env = Object.fromEntries(
  RUNTIME.split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const URL = "http://127.0.0.1:54321";
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const PID = "9115e6f0-bbfa-4605-8af5-8d6016ef4ba9";

const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const readme = (name) => readFileSync(`/tmp/${name}.md`, "utf8");

const REPOS = [
  {
    title: "Tethyr",
    slugHint: "knowledge-workspace",
    repo: "bushninjadots/knowledge-workspace",
    url: "https://github.com/bushninjadots/knowledge-workspace",
    description:
      "The collaboration network where builders create projects together in public and get known for what they make.",
    vision:
      "Reputation should come from real contributions, not self-reported claims. Tethyr makes the work itself the proof.",
    goal: "Ship the core loop: create projects, contribute, build reputation.",
    language: "TypeScript",
    tags: ["TypeScript", "Supabase", "React", "SSR"],
    status: "active",
    stage: "building",
    progress: 60,
    featured: true,
    lookingFor: { feedback: true, collaborators: true },
    meta: {
      full_name: "bushninjadots/knowledge-workspace",
      description: null,
      language: "TypeScript",
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      topics: [],
      private: false,
      default_branch: "main",
      created_at: "2026-08-05T12:06:56Z",
      updated_at: "2026-10-01T16:16:21Z",
    },
    skills: ["typescript", "react", "nodejs"],
    milestone: [
      { title: "Core collaboration loop", status: "done", position: 0 },
      { title: "Studio customization system", status: "in_progress", position: 1 },
      { title: "Public launch", status: "pending", position: 2 },
    ],
  },
  {
    title: "TomeBase",
    slugHint: "tomebase",
    repo: "bushninjadots/tomebase",
    url: "https://github.com/bushninjadots/tomebase",
    description:
      "Documentation that writes itself — generate, organize, and publish beautiful engineering docs from your codebase.",
    vision:
      "Documentation is the most neglected part of every engineering project — not because developers don't care, but because the tools make it painful. TomeBase removes the trade-off.",
    goal: "Open the beta to the first 100 teams.",
    language: "TypeScript",
    tags: ["TypeScript", "Docs", "MIT"],
    links: { website: "https://tomebase-web-bfx3.vercel.app/" },
    status: "active",
    stage: "launch",
    progress: 45,
    featured: true,
    lookingFor: { feedback: true, collaborators: false },
    meta: {
      full_name: "bushninjadots/tomebase",
      description: "our temperory location untill i can afford to pay for a custom domain",
      language: "TypeScript",
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 3,
      topics: [],
      private: false,
      default_branch: "main",
      homepage: "https://tomebase-web-bfx3.vercel.app/",
      license: "MIT",
      created_at: "2026-07-09T07:39:12Z",
      updated_at: "2026-09-10T16:05:16Z",
    },
    skills: ["typescript", "react", "nextjs"],
    milestone: [
      { title: "Generator MVP", status: "done", position: 0 },
      { title: "Custom domain support", status: "in_progress", position: 1 },
    ],
  },
  {
    title: "One Rule",
    slugHint: "onerule",
    repo: "bushninjadots/onerule",
    url: "https://github.com/bushninjadots/onerule",
    description:
      "A shared, persistent digital civilization where the inhabitants create the laws, the government, the economy, and the history. No one designed it — the players did.",
    vision: "A society as a living simulation: rules emerge from the players, not the designers.",
    goal: "First persistent world with 100 concurrent inhabitants.",
    language: "TypeScript",
    tags: ["TypeScript", "Next.js", "MongoDB", "Game"],
    status: "planning",
    stage: "planning",
    progress: 10,
    featured: false,
    lookingFor: { feedback: true, collaborators: true },
    meta: {
      full_name: "bushninjadots/onerule",
      description: null,
      language: "TypeScript",
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      topics: [],
      private: false,
      default_branch: "main",
      created_at: "2026-08-25T14:07:16Z",
      updated_at: "2026-08-29T07:29:26Z",
    },
    skills: ["nextjs", "typescript"],
    milestone: [{ title: "World simulation prototype", status: "in_progress", position: 0 }],
  },
];

const PROFILE = {
  display_name: "Bushninja",
  creator_title: "Full-stack developer & product builder",
  bio: "I build products end to end — TypeScript, React, and Supabase are my daily drivers. Currently shipping Tethyr, a collaboration network where people get known for what they make; TomeBase, documentation that writes itself from your codebase; and One Rule, a persistent digital civilization shaped entirely by its players.",
  category: "Development",
  years_experience: 4,
  languages: ["English"],
  favourite_tools: ["VS Code", "GitHub", "Vite", "Vitest", "Playwright"],
  software_stack: [
    "TypeScript",
    "React",
    "Next.js",
    "Node.js",
    "Supabase",
    "PostgreSQL",
    "Tailwind CSS",
  ],
  teaching_style:
    "Learn-by-building. I like pairing on real features rather than abstract exercises — show the problem, build the fix, read the diff together.",
  learning_goals:
    "Going deeper on 3D on the web (Three.js / WebGL) and systems design for multiplayer, persistent-world apps.",
  available_days: ["mon", "tue", "wed", "thu", "fri"],
  available_times: ["evenings"],
  country: "uk",
  timezone: "gmt",
  readme: [
    "## What I'm about",
    "",
    "I build products end to end — from schema to shipping UI. Right now most of",
    "my energy goes into **Tethyr**, a collaboration network where builders work",
    "in public and reputation comes from real contributions.",
    "",
    "## Currently",
    "",
    "- **Tethyr** — the collaboration network itself (active development)",
    "- **TomeBase** — documentation that writes itself from your codebase (live beta)",
    "- **One Rule** — a persistent digital civilization shaped by its players (prototyping)",
    "",
    "## Toolbox",
    "",
    "TypeScript · React · Next.js · Node.js · Supabase · PostgreSQL · Tailwind",
    "",
    "Find me on [GitHub](https://github.com/bushninjadots).",
  ].join("\n"),
  teaching_learning_note: undefined,
};

const TEACH = ["typescript", "react", "nodejs"];
const LEARN = ["three-js", "figma", "product-design"].filter(Boolean);

// ── helpers ───────────────────────────────────────────────────────────────────
const { data: skillRows } = await db.from("skills").select("id, slug, name");
const skillId = (slug) => skillRows.find((s) => s.slug === slug)?.id;
const { data: existing } = await db.from("projects").select("id, title").eq("profile_id", PID);
const { data: existingRepos } = await db.from("project_repositories").select("id, project_id, url");

// 1. Hide the keyboard-mash test projects (reversible; nothing deleted)
const junk = (existing ?? []).filter((p) => !REPOS.some((r) => r.title === p.title));
for (const p of junk) {
  const { error } = await db.from("projects").update({ visibility: "private" }).eq("id", p.id);
  if (error) console.error("hide", p.title, error.message);
}
console.log(`hid ${junk.length} test projects`);

// 2. Upsert profile fields
const { error: profErr } = await db
  .from("profiles")
  .update({
    display_name: PROFILE.display_name,
    creator_title: PROFILE.creator_title,
    bio: PROFILE.bio,
    category: PROFILE.category,
    years_experience: PROFILE.years_experience,
    languages: PROFILE.languages,
    favourite_tools: PROFILE.favourite_tools,
    software_stack: PROFILE.software_stack,
    teaching_style: PROFILE.teaching_style,
    learning_goals: PROFILE.learning_goals,
    available_days: PROFILE.available_days,
    available_times: PROFILE.available_times,
    readme: PROFILE.readme,
  })
  .eq("id", PID);
if (profErr) throw profErr;
console.log("profile fields updated");

// 3. Skills (teach / learn)
for (const slug of TEACH) {
  const id = skillId(slug);
  if (!id) continue;
  await db.from("profile_skills_teach").upsert(
    {
      profile_id: PID,
      skill_id: id,
      experience_level: "advanced",
      verification_level: "community_recognized",
    },
    { onConflict: "profile_id,skill_id" },
  );
}
for (const slug of LEARN) {
  const id = skillId(slug);
  if (!id) continue;
  await db
    .from("profile_skills_learn")
    .upsert({ profile_id: PID, skill_id: id }, { onConflict: "profile_id,skill_id" });
}
console.log("skills linked");

// 4. Projects with README + repo rows
for (const r of REPOS) {
  let projectId = existing.find((p) => p.title === r.title)?.id;
  const payload = {
    profile_id: PID,
    title: r.title,
    description: r.description,
    vision: r.vision,
    goal: r.goal,
    tags: r.tags,
    links: r.links ?? {},
    status: r.status,
    stage: r.stage,
    progress_percent: r.progress,
    visibility: "public",
    is_featured: r.featured,
    looking_for_feedback: r.lookingFor.feedback,
    looking_for_collaborators: r.lookingFor.collaborators,
    allow_forks: true,
    readme: readme(r.slugHint),
    started_at: r.meta.created_at,
  };
  if (projectId) {
    const { error } = await db.from("projects").update(payload).eq("id", projectId);
    if (error) throw error;
  } else {
    const { data, error } = await db.from("projects").insert(payload).select("id").single();
    if (error) throw error;
    projectId = data.id;
  }

  // milestones
  await db.from("project_milestones").delete().eq("project_id", projectId);
  await db.from("project_milestones").insert(
    r.milestone.map((m) => ({
      project_id: projectId,
      title: m.title,
      status: m.status,
      position: m.position,
    })),
  );

  // skills on the project
  for (const slug of r.skills) {
    const id = skillId(slug);
    if (id)
      await db
        .from("project_skills")
        .upsert({ project_id: projectId, skill_id: id }, { onConflict: "project_id,skill_id" });
  }

  // repo row (same shape the import flow writes)
  const repoRow = existingRepos?.find((x) => x.url === r.url);
  if (!repoRow) {
    await db.from("project_repositories").insert({
      project_id: projectId,
      url: r.url,
      provider: "github",
      metadata: { ...r.meta, commit_activity: null },
    });
  }
  console.log("project:", r.title, "→", projectId);
}

// 5. Achievements the seeded activity actually supports
for (const a of ["first_project", "project_builder", "first_endorsement"]) {
  await db
    .from("user_achievements")
    .upsert({ profile_id: PID, achievement: a }, { onConflict: "profile_id,achievement" });
}
console.log("achievements added");
console.log("DONE");
