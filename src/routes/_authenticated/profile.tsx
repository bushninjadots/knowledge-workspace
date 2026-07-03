import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  Pencil,
  Globe,
  MapPin,
  Clock,
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateImageFile, isSafeUrl, safeHref } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import {
  BannerStrip,
  ChipListCard,
  ProjectsCard,
  type ProjectRow,
  type ActivityRow,
} from "@/components/tethyr/profile-sections";
import { ActivityTimeline } from "@/components/tethyr/activity-timeline";
import { useCurrentUser, useSkillsCatalog, type Profile } from "@/hooks/use-current-user";
import { completenessPercent } from "@/lib/profile-completeness";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Tethyr" },
      { name: "description", content: "Your Tethyr creator profile." },
    ],
  }),
  component: ProfilePage,
});

type Skill = { id: string; slug: string; name: string; category: string };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["Mornings", "Afternoons", "Evenings", "Late night"];
const CATEGORIES = [
  "Video Editing",
  "Graphic Design",
  "Motion Design",
  "Photography",
  "YouTube",
  "Streaming",
  "SEO",
  "WordPress",
  "Development",
  "Music",
  "Other",
];
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

  if (profileQuery.isLoading || !profileQuery.data) {
    return (
      <Shell>
        <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">Loading…</div>
      </Shell>
    );
  }

  const {
    profile,
    teachIds,
    learnIds,
    wishlistIds,
    avatarSigned,
    bannerSigned,
    userId,
    projects,
    coverUrls,
    activity,
  } = profileQuery.data;
  const skills = skillsQuery.data ?? [];
  const skillById = new Map(skills.map((s) => [s.id, s]));

  const teachSkills = teachIds.map((id) => skillById.get(id)).filter(Boolean) as Skill[];
  const learnSkills = learnIds.map((id) => skillById.get(id)).filter(Boolean) as Skill[];
  const wishSkills = wishlistIds.map((id) => skillById.get(id)).filter(Boolean) as Skill[];

  const completeness = computeCompleteness(profile, teachSkills, learnSkills, projects.length);

  return (
    <Shell>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-8">
        {/* HEADER + BANNER */}
        <HeaderCard
          profile={profile}
          avatarSigned={avatarSigned}
          bannerSigned={bannerSigned}
          userId={userId}
          completeness={completeness}
          onChange={refresh}
        />

        {/* ABOUT */}
        <AboutCard profile={profile} onChange={refresh} />

        {/* SKILLS — teach / currently learning / wishlist */}
        <div className="grid gap-6 md:grid-cols-3">
          <SkillsCard
            title="Skills I teach"
            accent="green"
            icon={<GraduationCap className="h-4 w-4" />}
            selected={teachSkills}
            allSkills={skills}
            userId={userId}
            table="profile_skills_teach"
            onChange={refresh}
          />
          <SkillsCard
            title="Currently learning"
            accent="purple"
            icon={<BookOpen className="h-4 w-4" />}
            selected={learnSkills}
            allSkills={skills}
            userId={userId}
            table="profile_skills_learn"
            onChange={refresh}
          />
          <SkillsCard
            title="Want next"
            accent="purple"
            icon={<Sparkles className="h-4 w-4" />}
            selected={wishSkills}
            allSkills={skills}
            userId={userId}
            table="profile_skills_wishlist"
            onChange={refresh}
          />
        </div>

        {/* TOOLS + STACK */}
        <div className="grid gap-6 md:grid-cols-2">
          <ChipListCard
            title="Favourite tools"
            icon={<Wrench className="h-4 w-4" />}
            field="favourite_tools"
            values={profile?.favourite_tools ?? []}
            userId={userId}
            accent="green"
            placeholder="Figma, Notion, Runway…"
            onChange={refresh}
          />
          <ChipListCard
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

        {/* PROJECTS */}
        <ProjectsCard
          projects={projects}
          coverUrls={coverUrls}
          userId={userId}
          onChange={refresh}
        />

        {/* AVAILABILITY */}
        <AvailabilityCard profile={profile} onChange={refresh} />

        {/* STYLE & GOALS */}
        <div className="grid gap-6 md:grid-cols-2">
          <TextCard
            title="Teaching style"
            field="teaching_style"
            value={profile?.teaching_style ?? ""}
            placeholder="How do you teach? Hands-on, project-based, async reviews…"
            onChange={refresh}
          />
          <TextCard
            title="Learning goals"
            field="learning_goals"
            value={profile?.learning_goals ?? ""}
            placeholder="What do you want to unlock in the next 6 months?"
            onChange={refresh}
          />
        </div>

        {/* LINKS */}
        <LinksCard profile={profile} onChange={refresh} />

        {/* ACTIVITY TIMELINE */}
        <div className="rounded-3xl border border-border/60 bg-surface p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold">Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your reputation history — every action becomes part of your story.
          </p>
          <div className="mt-5">
            <ActivityTimeline events={activity} />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">
            <DashboardSidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6 md:hidden">
          <button
            className="rounded-full p-2 hover:bg-surface"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <span className="block h-0.5 w-5 bg-foreground" />
          </button>
          <span className="font-display font-semibold">Profile</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function computeCompleteness(
  profile: Profile | null,
  teach: Skill[],
  learn: Skill[],
  projectsCount: number,
): number {
  if (!profile) return 0;
  const checks = [
    !!profile.avatar_url,
    !!profile.banner_url,
    !!profile.display_name,
    !!profile.creator_title,
    !!profile.bio,
    !!profile.country,
    !!profile.timezone,
    profile.languages.length > 0,
    !!profile.category,
    profile.years_experience != null,
    teach.length > 0,
    learn.length > 0,
    (profile.favourite_tools?.length ?? 0) > 0 || (profile.software_stack?.length ?? 0) > 0,
    projectsCount > 0,
    profile.available_days.length > 0 && profile.available_times.length > 0,
    !!profile.teaching_style,
    !!profile.learning_goals,
    Object.keys(profile.social_links ?? {}).length > 0 || profile.portfolio_links.length > 0,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

/* -------------------------- HEADER -------------------------- */

function HeaderCard({
  profile,
  avatarSigned,
  bannerSigned,
  userId,
  completeness,
  onChange,
}: {
  profile: Profile | null;
  avatarSigned: string | null;
  bannerSigned: string | null;
  userId: string;
  completeness: number;
  onChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    const path = `${userId}/avatar-${Date.now()}.${check.ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: check.contentType });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }

    const { error: profErr } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);
    setUploading(false);
    if (profErr) return toast.error(profErr.message);
    toast.success("Avatar updated");
    onChange();
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface p-6 sm:p-8">
      <BannerStrip bannerSigned={bannerSigned} userId={userId} onChange={onChange} />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="relative shrink-0 -mt-16 sm:-mt-20">
          <div className="h-28 w-28 overflow-hidden rounded-3xl bg-gradient-brand ring-4 ring-surface sm:h-32 sm:w-32">
            {avatarSigned ? (
              <img src={avatarSigned} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-background">
                {(profile?.display_name ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-2 -right-2 rounded-full bg-primary p-2 text-background shadow-lg transition hover:scale-105 disabled:opacity-50"
            aria-label="Upload avatar"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">
                {profile?.display_name || "Untitled creator"}
              </h1>
              {profile?.creator_title && (
                <p className="mt-0.5 text-sm text-foreground/80">{profile.creator_title}</p>
              )}
              <p className="text-sm text-muted-foreground">@{profile?.handle ?? "—"}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto rounded-full"
              onClick={() => setEditOpen(true)}
              aria-label="Edit identity"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {profile?.category && <Chip>{profile.category}</Chip>}
            {profile?.years_experience != null && (
              <Chip>{profile.years_experience} yrs experience</Chip>
            )}
            {profile?.country && (
              <Chip>
                <MapPin className="mr-1 inline h-3 w-3" />
                {profile.country}
              </Chip>
            )}
            {profile?.timezone && (
              <Chip>
                <Clock className="mr-1 inline h-3 w-3" />
                {profile.timezone}
              </Chip>
            )}
          </div>
        </div>

        <div className="shrink-0 sm:w-40">
          <CompletenessRing value={completeness} />
        </div>
      </div>

      <EditIdentityDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        profile={profile}
        userId={userId}
        onSaved={onChange}
      />
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

function CompletenessRing({ value }: { value: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-background/40 p-3">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r={r} stroke="hsl(var(--border))" strokeWidth="6" fill="none" />
          <circle
            cx="40"
            cy="40"
            r={r}
            stroke="url(#grad)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s" }}
          />
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--brand-green)" />
              <stop offset="100%" stopColor="var(--brand-purple)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold">
          {value}%
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Complete</p>
    </div>
  );
}

function EditIdentityDialog({
  open,
  onOpenChange,
  profile,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: Profile | null;
  userId: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? "",
    handle: profile?.handle ?? "",
    creator_title: profile?.creator_title ?? "",
    category: profile?.category ?? "",
    years_experience: profile?.years_experience?.toString() ?? "",
    country: profile?.country ?? "",
    timezone: profile?.timezone ?? "",
  });
  useEffect(() => {
    if (open) {
      setForm({
        display_name: profile?.display_name ?? "",
        handle: profile?.handle ?? "",
        creator_title: profile?.creator_title ?? "",
        category: profile?.category ?? "",
        years_experience: profile?.years_experience?.toString() ?? "",
        country: profile?.country ?? "",
        timezone: profile?.timezone ?? "",
      });
    }
  }, [open, profile]);

  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name || null,
        handle: form.handle.replace(/^@/, "").trim() || null,
        creator_title: form.creator_title || null,
        category: form.category || null,
        years_experience: form.years_experience ? parseInt(form.years_experience, 10) : null,
        country: form.country || null,
        timezone: form.timezone || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit identity</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Display name">
            <Input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </Field>
          <Field label="Handle">
            <Input
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })}
            />
          </Field>
          <Field label="Creator title">
            <Input
              placeholder="Motion designer & YouTube educator"
              value={form.creator_title}
              onChange={(e) => setForm({ ...form, creator_title: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Years experience">
              <Input
                type="number"
                min="0"
                value={form.years_experience}
                onChange={(e) => setForm({ ...form, years_experience: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country">
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="e.g. Germany"
              />
            </Field>
            <Field label="Timezone">
              <Input
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                placeholder="e.g. CET"
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
        {profile?.bio || "Tell other creators who you are and what you make."}
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
              <Textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} />
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = langInput.trim();
                      if (v && !languages.includes(v)) setLanguages([...languages, v]);
                      setLangInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const v = langInput.trim();
                    if (v && !languages.includes(v)) setLanguages([...languages, v]);
                    setLangInput("");
                  }}
                >
                  Add
                </Button>
              </div>
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

/* -------------------------- SKILLS -------------------------- */

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
      ? "border-primary/40 bg-primary/10 text-primary"
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
            <span key={s.id} className={`rounded-full border px-3 py-1 text-xs ${chipCls}`}>
              {s.name}
            </span>
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
                <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
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
                            : "border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
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

/* -------------------------- AVAILABILITY -------------------------- */

function AvailabilityCard({
  profile,
  onChange,
}: {
  profile: Profile | null;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<string[]>(profile?.available_days ?? []);
  const [times, setTimes] = useState<string[]>(profile?.available_times ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDays(profile?.available_days ?? []);
      setTimes(profile?.available_times ?? []);
    }
  }, [open, profile]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ available_days: days, available_times: times })
      .eq("id", profile!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onChange();
    setOpen(false);
  }

  return (
    <SectionCard title="Availability" onEdit={() => setOpen(true)}>
      <div className="space-y-3">
        <Row label="Days">
          {profile?.available_days.length ? (
            profile.available_days.map((d) => <Chip key={d}>{d}</Chip>)
          ) : (
            <span className="text-sm text-muted-foreground">Not set</span>
          )}
        </Row>
        <Row label="Times">
          {profile?.available_times.length ? (
            profile.available_times.map((t) => <Chip key={t}>{t}</Chip>)
          ) : (
            <span className="text-sm text-muted-foreground">Not set</span>
          )}
        </Row>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit availability</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Days">
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const on = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Times">
              <div className="flex flex-wrap gap-2">
                {TIMES.map((t) => {
                  const on = times.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTimes(on ? times.filter((x) => x !== t) : [...times, t])}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        on
                          ? "border-[var(--brand-purple)] bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </Field>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/* -------------------------- TEXT CARD -------------------------- */

function TextCard({
  title,
  field,
  value,
  placeholder,
  onChange,
}: {
  title: string;
  field: "teaching_style" | "learning_goals";
  value: string;
  placeholder: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setText(value);
  }, [open, value]);

  async function save() {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: text || null } as Partial<
        Pick<Profile, "teaching_style" | "learning_goals">
      >)
      .eq("id", u.user!.id);
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
                  href={profile.social_links[key]}
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
    <div className="rounded-3xl border border-border/60 bg-surface p-6">
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
