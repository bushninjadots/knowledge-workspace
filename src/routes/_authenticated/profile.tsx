import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Pencil,
  Globe,
  Languages,
  GraduationCap,
  Sparkles,
  Plus,
  X,
  Check,
  Search as SearchIcon,
  Youtube,
  Instagram,
  Twitter,
  Twitch,
  Github,
  Link as LinkIcon,
  Wrench,
  Layers,
  BookOpen,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateProofFile, isSafeUrl, safeHref } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  VerificationBadge,
  ExperienceBadge,
  EXPERIENCE_LABEL,
} from "@/components/tethyr/profile-sections";
import {
  useCurrentUser,
  useSkillsCatalog,
  type Profile,
  type TeachSkillMeta,
  type SkillVerificationLevel,
  type SkillExperienceLevel,
} from "@/hooks/use-current-user";
import { ProfileLayout, type Skill } from "@/components/tethyr/profile/profile-layout";
import { ProfileOverviewTab } from "@/components/tethyr/profile/profile-overview-tab";
import { ProfileSkillsTab } from "@/components/tethyr/profile/profile-skills-tab";
import { ProfileProjectsTab } from "@/components/tethyr/profile/profile-projects-tab";
import { ProfileActivityTab } from "@/components/tethyr/profile/profile-activity-tab";
import { ProfileSessionsTab } from "@/components/tethyr/profile/profile-sessions-tab";
import { ProfileCommunitiesTab } from "@/components/tethyr/profile/profile-communities-tab";
import { GitHubConnect } from "@/components/tethyr/profile/github-connect";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Studio — Tethyr" },
      {
        name: "description",
        content: "Manage your skills, projects, and collaborative presence on Tethyr.",
      },
    ],
  }),
  component: ProfilePage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Studio failed to load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <a href="/profile" className="mt-4 inline-block text-sm text-primary hover:underline">
          Try again
        </a>
      </div>
    </div>
  ),
});

const SOCIAL_KEYS: { key: string; label: string; icon: typeof Youtube; placeholder: string }[] = [
  { key: "website", label: "Website", icon: Globe, placeholder: "https://yoursite.com" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@you" },
  {
    key: "instagram",
    label: "Instagram",
    icon: Instagram,
    placeholder: "https://instagram.com/you",
  },
  { key: "x", label: "X", icon: Twitter, placeholder: "https://x.com/you" },
  { key: "tiktok", label: "TikTok", icon: Sparkles, placeholder: "https://tiktok.com/@you" },
  { key: "twitch", label: "Twitch", icon: Twitch, placeholder: "https://twitch.tv/you" },
  { key: "github", label: "GitHub", icon: Github, placeholder: "https://github.com/you" },
];

function ProfilePage() {
  const profileQuery = useCurrentUser();
  const skillsQuery = useSkillsCatalog();
  const refresh = profileQuery.refresh;

  // Deep link from project repo sections: /profile?github=token scrolls to the
  // GitHub card with the token editor already open.
  const { github: githubParam } = useSearch({ strict: false }) as {
    github?: string;
  };
  const focusGithubToken = githubParam === "token";
  const githubScrolledRef = useRef(false);

  // Scroll once the card is actually mounted (waits for the profile query to
  // resolve instead of racing a fixed timeout).
  useEffect(() => {
    if (!focusGithubToken || !profileQuery.data || githubScrolledRef.current) return;
    githubScrolledRef.current = true;
    const t = setTimeout(() => {
      document
        .getElementById("github-integration")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => clearTimeout(t);
  }, [focusGithubToken, profileQuery.data]);

  if (profileQuery.isError) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Couldn't load your studio</h2>
        <p className="text-sm text-muted-foreground">
          {profileQuery.error?.message ?? "Something went wrong. Please try again."}
        </p>
        <Button variant="outline" onClick={() => refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  if (profileQuery.isLoading || !profileQuery.data) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-sm text-muted-foreground">
        Setting up your studio…
      </div>
    );
  }

  const {
    profile,
    teachIds,
    teachMeta,
    learnIds,
    avatarSigned,
    bannerSigned,
    userId,
    projects,
    coverUrls,
    projectSkillIds,
    activity,
  } = profileQuery.data;
  const skills = skillsQuery.data ?? [];

  return (
    <ProfileLayout
      profile={profile}
      avatarSigned={avatarSigned}
      bannerSigned={bannerSigned}
      userId={userId}
      isOwnProfile={true}
      teachIds={teachIds}
      teachMeta={teachMeta}
      learnIds={learnIds}
      projects={projects}
      coverUrls={coverUrls}
      projectSkillIds={projectSkillIds}
      activity={activity}
      skills={skills}
      onChange={refresh}
      tabContent={{
        overview: (
          <div className="space-y-6">
            <ProfileOverviewTab
              profile={profile}
              userId={userId}
              teachIds={teachIds}
              teachMeta={teachMeta}
              learnIds={learnIds}
              projects={projects}
              coverUrls={coverUrls}
              projectSkillIds={projectSkillIds}
              activity={activity}
              skills={skills}
              onChange={refresh}
              isOwnProfile={true}
            />
            <AboutCard profile={profile} onChange={refresh} />
            <TextCard
              title="Sharing style"
              field="teaching_style"
              value={profile?.teaching_style ?? ""}
              placeholder="How do you share? Hands-on, project-based, async reviews…"
              onChange={refresh}
              userId={userId}
            />
            <TextCard
              title="Growth goals"
              field="learning_goals"
              value={profile?.learning_goals ?? ""}
              placeholder="What do you want to unlock in the next 6 months?"
              onChange={refresh}
              userId={userId}
            />
            <div className="grid gap-6 md:grid-cols-2">
              <ChipListInline
                title="Favourite tools"
                icon={<Wrench className="h-4 w-4" />}
                field="favourite_tools"
                values={profile?.favourite_tools ?? []}
                userId={userId}
                accent="green"
                placeholder="Figma, Notion, Runway…"
                onChange={refresh}
              />
              <ChipListInline
                title="Software stack"
                icon={<Layers className="h-4 w-4" />}
                field="software_stack"
                values={profile?.software_stack ?? []}
                userId={userId}
                accent="purple"
                placeholder="Photoshop, Blender, Ableton…"
                onChange={refresh}
              />
            </div>
            <LinksCard profile={profile} onChange={refresh} />
            <GitHubConnect autoOpenToken={focusGithubToken} />
          </div>
        ),
        skills: (
          <div className="space-y-6">
            <ProfileSkillsTab
              profile={profile}
              teachIds={teachIds}
              teachMeta={teachMeta}
              learnIds={learnIds}
              skills={skills}
              isOwnProfile={true}
              userId={userId}
            />
            <SkillEditingSection
              teachIds={teachIds}
              teachMeta={teachMeta}
              learnIds={learnIds}
              allSkills={skills}
              userId={userId}
              onChange={refresh}
            />
          </div>
        ),
        projects: (
          <ProfileProjectsTab
            projects={projects}
            coverUrls={coverUrls}
            userId={userId}
            skills={skills}
            projectSkillIds={projectSkillIds}
            onChange={refresh}
            isOwnProfile={true}
          />
        ),
        communities: <ProfileCommunitiesTab />,
        activity: (
          <div className="space-y-6">
            <ProfileActivityTab userId={userId} activity={activity} />
            <ProfileSessionsTab userId={userId} isOwnProfile={true} />
          </div>
        ),
      }}
    />
  );
}

/* -------------------------- ABOUT -------------------------- */

function AboutCard({ profile, onChange }: { profile: Profile | null; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [langInput, setLangInput] = useState("");
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setBio(profile?.bio ?? "");
      setLanguages(profile?.languages ?? []);
    }
  }, [editing, profile]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bio || null, languages })
      .eq("id", profile!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onChange();
    setEditing(false);
  }

  return (
    <SectionCard title="About" onEdit={() => setEditing(true)}>
      <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
        {profile?.bio || "Tell other people who you are and what you make."}
      </p>
      {profile && profile.languages.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <Languages className="h-3.5 w-3.5 text-muted-foreground" />
          {profile.languages.map((l) => (
            <Chip key={l}>{l}</Chip>
          ))}
        </div>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit about</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Bio">
              <Textarea
                rows={5}
                value={bio}
                maxLength={1000}
                onChange={(e) => setBio(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">{bio.length}/1000</p>
            </Field>
            <Field label="Languages">
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguages(languages.filter((x) => x !== l))}
                    className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary"
                  >
                    {l}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={langInput}
                  onChange={(e) => setLangInput(e.target.value)}
                  placeholder="English"
                  maxLength={30}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = langInput.trim();
                      if (v && !languages.includes(v) && languages.length < 10)
                        setLanguages([...languages, v]);
                      setLangInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const v = langInput.trim();
                    if (v && !languages.includes(v) && languages.length < 10)
                      setLanguages([...languages, v]);
                    setLangInput("");
                  }}
                >
                  Add
                </Button>
              </div>
              {languages.length >= 10 && (
                <p className="mt-1 text-xs text-muted-foreground">Maximum 10 languages</p>
              )}
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

/* -------------------------- SKILL EDITING -------------------------- */

type TeachSkill = Skill & { meta: TeachSkillMeta };

function SkillEditingSection({
  teachIds,
  teachMeta,
  learnIds,
  allSkills,
  userId,
  onChange,
}: {
  teachIds: string[];
  teachMeta: Record<string, TeachSkillMeta>;
  learnIds: string[];
  allSkills: Skill[];
  userId: string;
  onChange: () => void;
}) {
  const skillById = new Map(allSkills.map((s) => [s.id, s]));
  const teachSkills = teachIds
    .map((id) => {
      const s = skillById.get(id);
      if (!s) return null;
      const meta: TeachSkillMeta = teachMeta[id] ?? {
        verification_level: "self_declared" as SkillVerificationLevel,
        experience_level: "intermediate" as SkillExperienceLevel,
        proof_url: null,
        proof_note: null,
      };
      return { ...s, meta };
    })
    .filter(Boolean) as TeachSkill[];
  const learnSkills = learnIds.map((id) => skillById.get(id)).filter(Boolean) as Skill[];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <TeachSkillsCard
        title="Skills I Share"
        icon={<GraduationCap className="h-4 w-4" />}
        selected={teachSkills}
        allSkills={allSkills}
        userId={userId}
        onChange={onChange}
      />
      <SkillsCard
        title="Growing"
        accent="purple"
        icon={<BookOpen className="h-4 w-4" />}
        selected={learnSkills}
        allSkills={allSkills}
        userId={userId}
        table="profile_skills_learn"
        onChange={onChange}
      />
    </div>
  );
}

function SkillsCard({
  title,
  accent,
  icon,
  selected,
  allSkills,
  userId,
  table,
  onChange,
}: {
  title: string;
  accent: "green" | "purple";
  icon: React.ReactNode;
  selected: Skill[];
  allSkills: Skill[];
  userId: string;
  table: "profile_skills_teach" | "profile_skills_learn" | "profile_skills_wishlist";
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(new Set(selected.map((s) => s.id)));
  }, [open, selected]);

  const grouped = useMemo(() => {
    const filtered = allSkills.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
    const g = new Map<string, Skill[]>();
    filtered.forEach((s) => {
      if (!g.has(s.category)) g.set(s.category, []);
      g.get(s.category)!.push(s);
    });
    return Array.from(g.entries());
  }, [allSkills, search]);

  async function save() {
    setSaving(true);
    const current = new Set(selected.map((s) => s.id));
    const toAdd = [...draft].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !draft.has(id));

    if (toRemove.length) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("profile_id", userId)
        .in("skill_id", toRemove);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    if (toAdd.length) {
      const { error } = await supabase
        .from(table)
        .insert(toAdd.map((skill_id) => ({ profile_id: userId, skill_id })));
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    setSaving(false);
    toast.success("Saved");
    onChange();
    setOpen(false);
  }

  const chipCls =
    accent === "green"
      ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
      : "border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]";

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
      }
      onEdit={() => setOpen(true)}
    >
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No skills yet. Tap edit to pick from the catalog.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <Link
              key={s.id}
              to="/skills/$slug"
              params={{ slug: s.slug }}
              className={`rounded-full border px-3 py-1 text-xs transition hover:opacity-80 ${chipCls}`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Choose skills</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search the catalog…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {grouped.map(([category, items]) => (
              <div key={category}>
                <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  {category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((s) => {
                    const on = draft.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          const next = new Set(draft);
                          if (on) next.delete(s.id);
                          else next.add(s.id);
                          setDraft(next);
                        }}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                          on
                            ? chipCls
                            : "border-border bg-background/40 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" />}
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {grouped.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No matches</p>
            )}
          </div>
          <DialogFooter>
            <span className="mr-auto text-xs text-muted-foreground">{draft.size} selected</span>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function TeachSkillsCard({
  title,
  icon,
  selected,
  allSkills,
  userId,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  selected: TeachSkill[];
  allSkills: Skill[];
  userId: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [proofEditing, setProofEditing] = useState<TeachSkill | null>(null);

  useEffect(() => {
    if (open) setDraft(new Set(selected.map((s) => s.id)));
  }, [open, selected]);

  const grouped = useMemo(() => {
    const filtered = allSkills.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
    const g = new Map<string, Skill[]>();
    filtered.forEach((s) => {
      if (!g.has(s.category)) g.set(s.category, []);
      g.get(s.category)!.push(s);
    });
    return Array.from(g.entries());
  }, [allSkills, search]);

  async function save() {
    setSaving(true);
    const current = new Set(selected.map((s) => s.id));
    const toAdd = [...draft].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !draft.has(id));

    if (toRemove.length) {
      const { error } = await supabase
        .from("profile_skills_teach")
        .delete()
        .eq("profile_id", userId)
        .in("skill_id", toRemove);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    if (toAdd.length) {
      const { error } = await supabase
        .from("profile_skills_teach")
        .insert(toAdd.map((skill_id) => ({ profile_id: userId, skill_id })));
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    setSaving(false);
    toast.success("Saved");
    onChange();
    setOpen(false);
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
      }
      onEdit={() => setOpen(true)}
    >
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No skills yet. Tap edit to pick from the catalog.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setProofEditing(s)}
              className="group flex flex-col items-start gap-1 rounded-2xl border border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] px-3 py-1.5 text-left transition hover:border-[var(--user-accent-border,var(--primary))]/70"
            >
              <Link
                to="/skills/$slug"
                params={{ slug: s.slug }}
                className="text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {s.name}
              </Link>
              <div className="flex flex-wrap items-center gap-1">
                <VerificationBadge level={s.meta.verification_level} proofUrl={s.meta.proof_url} />
                <ExperienceBadge level={s.meta.experience_level} />
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Choose skills</DialogTitle>
            </DialogHeader>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search skills…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
              {grouped.map(([category, items]) => (
                <div key={category}>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((s) => {
                      const on = draft.has(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const next = new Set(draft);
                            if (on) next.delete(s.id);
                            else next.add(s.id);
                            setDraft(next);
                          }}
                          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                            on
                              ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
                              : "border-border bg-background/40 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                          }`}
                        >
                          {on && <Check className="h-3 w-3" />}
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {proofEditing && (
        <ProofDialog
          userId={userId}
          skill={proofEditing}
          onOpenChange={(o) => !o && setProofEditing(null)}
          onSaved={onChange}
        />
      )}
    </SectionCard>
  );
}

function ProofDialog({
  userId,
  skill,
  onOpenChange,
  onSaved,
}: {
  userId: string;
  skill: TeachSkill;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(skill.meta.proof_url ?? "");
  const [note, setNote] = useState(skill.meta.proof_note ?? "");
  const [experience, setExperience] = useState<SkillExperienceLevel>(skill.meta.experience_level);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const check = validateProofFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    const path = `${userId}/${skill.id}-${Date.now()}.${check.ext}`;
    const { error: upErr } = await supabase.storage
      .from("skill-proofs")
      .upload(path, file, { contentType: check.contentType });
    setUploading(false);
    if (upErr) return toast.error(upErr.message);
    const { data } = supabase.storage.from("skill-proofs").getPublicUrl(path);
    setUrl(data.publicUrl);
    toast.success("File uploaded");
  }

  async function save() {
    const trimmedUrl = url.trim();
    if (trimmedUrl && !isSafeUrl(trimmedUrl)) return toast.error("That link doesn't look valid.");
    setSaving(true);
    const nextLevel: SkillVerificationLevel =
      skill.meta.verification_level === "community_recognized"
        ? "community_recognized"
        : trimmedUrl
          ? "proof_certified"
          : "self_declared";
    const { error } = await supabase
      .from("profile_skills_teach")
      .update({
        proof_url: trimmedUrl || null,
        proof_note: note.trim() || null,
        verification_level: nextLevel,
        experience_level: experience,
      })
      .eq("profile_id", userId)
      .eq("skill_id", skill.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Skill updated");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>"{skill.name}"— how experienced are you?</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Tell people where you're at, and back it up with a certificate, screenshot, or portfolio
          file if you've got one.
          {skill.meta.verification_level === "community_recognized" && (
            <>
              {" "}
              This skill is already community recognized from peer endorsements — that stays either
              way.
            </>
          )}
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Experience level</Label>
            <Select
              value={experience}
              onValueChange={(v) => setExperience(v as SkillExperienceLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EXPERIENCE_LABEL) as SkillExperienceLevel[]).map((level) => (
                  <SelectItem key={level} value={level}>
                    {EXPERIENCE_LABEL[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Proof</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                {uploading ? "Uploading…" : "Upload a file"}
              </Button>
              <span className="text-[11px] text-muted-foreground">JPG, PNG, WEBP or PDF</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleFile}
            />
            <Input
              placeholder="…or paste a link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea
              rows={2}
              placeholder="e.g. Adobe Certified Expert, 2024"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- TEXT CARD -------------------------- */

function TextCard({
  title,
  field,
  value,
  placeholder,
  onChange,
  userId,
}: {
  title: string;
  field: "teaching_style" | "learning_goals";
  value: string;
  placeholder: string;
  onChange: () => void;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setText(value);
  }, [open, value]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: text || null } as Partial<
        Pick<Profile, "teaching_style" | "learning_goals">
      >)
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onChange();
    setOpen(false);
  }

  return (
    <SectionCard title={title} onEdit={() => setOpen(true)}>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{value || placeholder}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {title.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

/* -------------------------- CHIP LIST INLINE -------------------------- */

function ChipListInline({
  title,
  icon,
  field,
  values,
  userId,
  accent,
  placeholder,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  field: "favourite_tools" | "software_stack";
  values: string[];
  userId: string;
  accent: "green" | "purple";
  placeholder: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(values);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(values);
      setInput("");
    }
  }, [open, values]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: draft } as Partial<Pick<Profile, "favourite_tools" | "software_stack">>)
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onChange();
    setOpen(false);
  }

  function addChip() {
    const v = input.trim();
    if (v && !draft.includes(v) && draft.length < 20) {
      setDraft([...draft, v]);
      setInput("");
    }
  }

  const chipCls =
    accent === "green"
      ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
      : "border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]";

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
      }
      onEdit={() => setOpen(true)}
    >
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">None added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className={`rounded-full border px-3 py-1 text-xs ${chipCls}`}>
              {v}
            </span>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {title.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {draft.map((v) => (
              <button
                key={v}
                onClick={() => setDraft(draft.filter((x) => x !== v))}
                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${chipCls}`}
              >
                {v}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChip();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addChip}>
              Add
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

/* -------------------------- LINKS -------------------------- */

function LinksCard({ profile, onChange }: { profile: Profile | null; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [social, setSocial] = useState<Record<string, string>>(profile?.social_links ?? {});
  const [portfolio, setPortfolio] = useState<{ label: string; url: string }[]>(
    profile?.portfolio_links ?? [],
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSocial(profile?.social_links ?? {});
      setPortfolio(profile?.portfolio_links ?? []);
    }
  }, [open, profile]);

  async function save() {
    setSaving(true);
    const cleanedSocial: Record<string, string> = {};
    for (const [k, v] of Object.entries(social)) {
      const val = v?.trim();
      if (!val) continue;
      if (!isSafeUrl(val)) {
        setSaving(false);
        return toast.error(`${k} must be a valid http(s) URL`);
      }
      cleanedSocial[k] = val;
    }
    const cleanedPortfolio: { label: string; url: string }[] = [];
    for (const p of portfolio) {
      const url = p.url.trim();
      if (!url) continue;
      if (!isSafeUrl(url)) {
        setSaving(false);
        return toast.error(`Portfolio link "${p.label || url}" must be a valid http(s) URL`);
      }
      cleanedPortfolio.push({ label: p.label, url });
    }
    const { error } = await supabase
      .from("profiles")
      .update({ social_links: cleanedSocial, portfolio_links: cleanedPortfolio })
      .eq("id", profile!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onChange();
    setOpen(false);
  }

  const hasAny =
    (profile?.portfolio_links?.length ?? 0) > 0 ||
    Object.keys(profile?.social_links ?? {}).length > 0;

  return (
    <SectionCard title="Links" onEdit={() => setOpen(true)}>
      {!hasAny ? (
        <p className="text-sm text-muted-foreground">Add your portfolio and socials.</p>
      ) : (
        <div className="space-y-3">
          {profile?.portfolio_links?.map((p, i) => (
            <a
              key={i}
              href={safeHref(p.url)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {p.label || p.url}
            </a>
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            {SOCIAL_KEYS.map(({ key, icon: Icon, label }) =>
              profile?.social_links?.[key] ? (
                <a
                  key={key}
                  href={safeHref(profile.social_links[key])}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              ) : null,
            )}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit links</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Portfolio</p>
              {portfolio.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Label"
                    value={p.label}
                    onChange={(e) => {
                      const next = [...portfolio];
                      next[i] = { ...next[i], label: e.target.value };
                      setPortfolio(next);
                    }}
                    className="w-32"
                  />
                  <Input
                    placeholder="https://…"
                    value={p.url}
                    onChange={(e) => {
                      const next = [...portfolio];
                      next[i] = { ...next[i], url: e.target.value };
                      setPortfolio(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPortfolio(portfolio.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPortfolio([...portfolio, { label: "", url: "" }])}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add link
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Socials</p>
              {SOCIAL_KEYS.map(({ key, label, icon: Icon, placeholder }) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex w-28 items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <Input
                    placeholder={placeholder}
                    value={social[key] ?? ""}
                    onChange={(e) => setSocial({ ...social, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

/* -------------------------- SHARED -------------------------- */

function SectionCard({
  title,
  onEdit,
  children,
}: {
  title: React.ReactNode;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border card-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {onEdit && (
          <Button variant="ghost" size="icon" className="rounded-full" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1">
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
