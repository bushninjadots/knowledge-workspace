import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Camera,
  MapPin,
  Clock,
  Globe,
  Github,
  Twitter,
  Instagram,
  Twitch,
  Link2,
  Pencil,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCurrentUser, useSkillsCatalog } from "@/hooks/use-current-user";
import { PageShell } from "@/components/tethyr/page/page-shell";
import { EditModeProvider } from "@/components/tethyr/page/edit-mode-context";
import { setupCompletenessPercent, showcaseCompletenessPercent } from "@/lib/profile-completeness";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { useUserPalette, paletteToStyle } from "@/lib/dominant-color";
import { appearanceStyle, type ProfileBackground } from "@/lib/background-themes";
import { BannerStrip } from "@/components/tethyr/profile-sections";
import { FavoriteBadge } from "@/components/tethyr/achievements";
import { DragDropFileInput } from "@/components/tethyr/drag-drop-file-input";
import { BackgroundPickerDialog } from "@/components/tethyr/profile/background-picker-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { validateImageFile } from "@/lib/validators";
import { SkillEditingSection } from "@/components/tethyr/profile/skill-editing";
import { GitHubConnect } from "@/components/tethyr/profile/github-connect";
import {
  normalizeProfileHandle,
  validateProfileInput,
  validateProfileUrl,
} from "@/lib/profile-validation";
import "@/components/tethyr/blocks/register-all";

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
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Studio failed to load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while loading your studio. Please try again.
        </p>
        <a href="/profile" className="mt-4 inline-block text-sm text-primary hover:underline">
          Try again
        </a>
      </div>
    </div>
  ),
});

function ProfilePage() {
  const profileQuery = useCurrentUser();
  const skillsQuery = useSkillsCatalog();
  const refresh = profileQuery.refresh;

  const { github: githubParam } = useSearch({ strict: false }) as {
    github?: string;
  };
  const focusGithubToken = githubParam === "token";
  const githubScrolledRef = useRef(false);

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

  const { profile, userId, teachIds, teachMeta, learnIds, projects } = profileQuery.data;

  const isComplete =
    setupCompletenessPercent({
      profile,
      teachCount: teachIds?.length ?? 0,
      learnCount: learnIds?.length ?? 0,
      projectsCount: projects?.length ?? 0,
    }) >= 40;

  if (!isComplete) {
    return (
      <ProfileSetupForm
        profile={profile}
        userId={userId}
        onSaved={refresh}
        refresh={refresh}
        avatarSigned={profileQuery.data.avatarSigned}
        bannerSigned={profileQuery.data.bannerSigned}
        background={profileQuery.data.background}
        publicBackground={profile?.public_background ?? null}
        teachIds={teachIds ?? []}
        teachMeta={teachMeta ?? {}}
        learnIds={learnIds ?? []}
        allSkills={skillsQuery.data ?? []}
      />
    );
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-label">Personal creative space</p>
            <h1 className="mt-1 font-display text-2xl font-semibold">Your Studio</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              One Studio system. Infinite personalities. Shape the space around the work you want to
              be known for.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Create → Customize → Personalize → Arrange → Preview → Publish
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <EditModeProvider>
          <PageShell
            ownerId={userId}
            ownerType="profile"
            isOwner
            profileMedia={{
              avatarUrl: profile?.avatar_url ?? null,
              bannerUrl: profile?.banner_url ?? null,
            }}
            onProfileMediaSaved={refresh}
          />
        </EditModeProvider>
      </div>
    </>
  );
}

/* ── Profile Setup Form ─────────────────────────────────────────────────── */

const SOCIAL_ICONS: Record<string, typeof Globe> = {
  website: Globe,
  youtube: Twitter,
  instagram: Instagram,
  x: Twitter,
  tiktok: Sparkles,
  twitch: Twitch,
  github: Github,
};

type ProfileType = import("@/hooks/use-current-user").Profile;

function ProfileSetupForm({
  profile,
  userId,
  onSaved,
  refresh,
  avatarSigned,
  bannerSigned,
  background,
  publicBackground,
  teachIds,
  teachMeta,
  learnIds,
  allSkills,
}: {
  profile: ProfileType | null;
  userId: string;
  onSaved: () => void;
  refresh: () => void;
  avatarSigned: string | null;
  bannerSigned: string | null;
  background: ProfileBackground | null;
  publicBackground: ProfileBackground | null;
  teachIds: string[];
  teachMeta: Record<string, import("@/hooks/use-current-user").TeachSkillMeta>;
  learnIds: string[];
  allSkills: import("@/hooks/use-current-user").Skill[];
}) {
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? "",
    handle: profile?.handle ?? "",
    creator_title: profile?.creator_title ?? "",
    category: profile?.category ?? "",
    years_experience: profile?.years_experience?.toString() ?? "",
    country: profile?.country ?? "",
    timezone: profile?.timezone ?? "",
    languages: profile?.languages ?? [],
    langInput: "",
    bio: profile?.bio ?? "",
    teaching_style: profile?.teaching_style ?? "",
    learning_goals: profile?.learning_goals ?? "",
    favourite_tools: profile?.favourite_tools?.join(", ") ?? "",
    software_stack: profile?.software_stack?.join(", ") ?? "",
    availability: profile?.availability ?? "",
    portfolio_label: "",
    portfolio_url: "",
    portfolioLinks: (profile?.portfolio_links ?? []) as { label: string; url: string }[],
    social_links: profile?.social_links ?? {},
  });
  const [saving, setSaving] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken">(
    "idle",
  );
  const palette = useUserPalette(bannerSigned);

  const accentStyle = {
    ...paletteToStyle(palette),
    ...appearanceStyle(background),
  };

  const setupCompleteness = setupCompletenessPercent({
    profile,
    teachCount: teachIds.length,
    learnCount: learnIds.length,
    projectsCount: 0,
  });
  const showcaseCompleteness = showcaseCompletenessPercent({
    profile,
    teachCount: teachIds.length,
    learnCount: learnIds.length,
    projectsCount: 0,
  });

  async function save() {
    if (saving) return;
    const displayName = form.display_name.trim();
    const handle = normalizeProfileHandle(form.handle);
    const validationError = validateProfileInput({
      displayName,
      handle,
      yearsExperience: form.years_experience,
    });
    if (validationError) return toast.error(validationError);
    if (handleStatus === "taken") return toast.error("That handle is already in use.");
    const linksToValidate = [
      ...form.portfolioLinks.map((link) => link.url),
      ...(form.portfolio_label.trim() && form.portfolio_url.trim() ? [form.portfolio_url] : []),
      ...Object.values(form.social_links),
    ].filter(Boolean);
    if (linksToValidate.some((url) => !validateProfileUrl(url))) {
      return toast.error("Links must use a valid https:// URL.");
    }
    const years = form.years_experience.trim() ? Number(form.years_experience) : null;
    setSaving(true);

    const portfolioLinks: { label: string; url: string }[] =
      form.portfolioLinks.length > 0
        ? form.portfolioLinks
        : form.portfolio_label.trim()
          ? [{ label: form.portfolio_label.trim(), url: form.portfolio_url.trim() }]
          : [];

    const socialLinks: Record<string, string> = {};
    for (const [key, url] of Object.entries(form.social_links)) {
      if (typeof url === "string" && url.trim()) socialLinks[key] = url.trim();
    }

    const updateData = {
      display_name: displayName || null,
      handle: handle || null,
      creator_title: form.creator_title || null,
      category: form.category || null,
      years_experience: years,
      country: form.country || null,
      timezone: form.timezone || null,
      bio: form.bio || null,
      teaching_style: form.teaching_style || null,
      learning_goals: form.learning_goals || null,
      favourite_tools: form.favourite_tools.trim()
        ? form.favourite_tools
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined,
      software_stack: form.software_stack.trim()
        ? form.software_stack
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined,
      availability: ["available", "busy", "learning", "looking_for_team", "mentoring"].includes(
        form.availability,
      )
        ? (form.availability as
            "available" | "busy" | "learning" | "looking_for_team" | "mentoring")
        : null,
      languages: form.languages.length > 0 ? form.languages : undefined,
      portfolio_links: portfolioLinks.length > 0 ? portfolioLinks : null,
      social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
    };

    const { error } = await supabase.from("profiles").update(updateData).eq("id", userId);

    setSaving(false);
    if (error) {
      // Older preview projects can have only the original profile columns.
      // Retry with the stable subset instead of silently leaving the form stuck.
      const fallback = await supabase
        .from("profiles")
        .update({
          display_name: updateData.display_name,
          handle: updateData.handle,
          creator_title: updateData.creator_title,
          category: updateData.category,
          years_experience: updateData.years_experience,
          country: updateData.country,
          timezone: updateData.timezone,
          bio: updateData.bio,
          portfolio_links: updateData.portfolio_links,
          social_links: updateData.social_links,
        })
        .eq("id", userId);
      if (fallback.error) return toast.error(friendlyError(fallback.error));
    }
    toast.success("Profile updated");
    // First save celebration — fires once per session
    const key = `tethyr:first-save:${userId}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      const existing = document.getElementById("setup-celebration");
      if (!existing) {
        const el = document.createElement("div");
        el.id = "setup-celebration";
        el.innerHTML = `
          <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-[var(--user-accent,var(--trust))]/30 bg-[var(--user-accent-subtle,var(--learning-subtle))] px-5 py-3 text-sm font-medium text-[var(--user-accent-foreground,var(--background))] shadow-lg animate-bounce">
            ✨ Your studio is taking shape — keep going!
          </div>
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
      }
    }
    onSaved();
  }

  return (
    <div
      className={`animate-room-enter mx-auto max-w-7xl bg-noise px-4 py-6 sm:px-6 sm:py-8 ${background?.density === "compact" ? "tethyr-density-compact" : ""}`}
      style={accentStyle}
    >
      <div className="space-y-6">
        {/* BANNER + HEADER */}
        <div className="relative overflow-hidden rounded-xl border card-border bg-surface p-5 sm:p-6">
          {profile && (
            <BannerStrip
              bannerSigned={bannerSigned}
              bannerCaption={profile.banner_caption ?? null}
              overlay={background?.bannerOverlay ?? "soft"}
              captionPosition={background?.bannerCaptionPosition ?? "right"}
              userId={userId}
              onChange={refresh}
            />
          )}

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* AVATAR */}
            <div className="relative shrink-0 -mt-16 sm:-mt-20">
              <DragDropFileInput
                accept="image/*"
                onFiles={async (files) => {
                  const file = files[0];
                  if (!file) return;
                  const check = validateImageFile(file);
                  if (!check.ok) return toast.error(check.error);
                  const path = `${userId}/avatar.${check.ext}`;
                  setSaving(true);
                  try {
                    await supabase.storage
                      .from("avatars")
                      .upload(path, file, { upsert: true, contentType: check.contentType });
                    const { error: profileErr } = await supabase
                      .from("profiles")
                      .update({ avatar_url: path })
                      .eq("id", userId);
                    if (profileErr) {
                      setSaving(false);
                      return toast.error(friendlyError(profileErr));
                    }
                  } catch (err) {
                    setSaving(false);
                    return toast.error(friendlyError(err as Error, "Avatar upload failed"));
                  }
                  setSaving(false);
                  toast.success("Avatar updated");
                  onSaved();
                }}
              >
                <div className="h-28 w-28 overflow-hidden rounded-full bg-[var(--user-accent,var(--trust))] ring-4 ring-surface shadow-sm sm:h-32 sm:w-32">
                  {avatarSigned ? (
                    <img
                      src={avatarSigned}
                      alt={`${form.display_name ?? "User"} avatar`}
                      width="128"
                      height="128"
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-background">
                      {(form.display_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Change avatar"
                  title="Change avatar"
                  className="absolute -bottom-2 -right-2 rounded-full bg-primary p-2 text-background shadow-sm transition hover:scale-105"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </DragDropFileInput>
            </div>

            {/* IDENTITY */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-2xl font-semibold break-words sm:text-3xl">
                      {form.display_name || "Untitled member"}
                    </h1>
                    <FavoriteBadge type={profile?.favorite_achievement} />
                  </div>
                  {form.creator_title && (
                    <p className="mt-0.5 text-sm text-foreground/80 break-words">
                      {form.creator_title}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">@{form.handle ?? "—"}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="shrink-0">
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit identity
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-48">
                    <DropdownMenuItem onClick={() => setBgOpen(true)}>
                      <Link2 className="mr-2 h-3.5 w-3.5" />
                      Change appearance
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {form.bio && (
                <p className="mt-2 max-w-xl text-sm text-muted-foreground whitespace-pre-wrap break-words">
                  {form.bio}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {form.category && <Chip>{form.category}</Chip>}
                {form.years_experience && <Chip>{form.years_experience} yrs experience</Chip>}
                {form.country && (
                  <Chip>
                    <MapPin className="mr-1 inline h-3 w-3" />
                    {form.country}
                  </Chip>
                )}
                {form.timezone && (
                  <Chip>
                    <Clock className="mr-1 inline h-3 w-3" />
                    {form.timezone}
                  </Chip>
                )}
                {form.languages.length > 0 && (
                  <Chip>
                    <span className="inline">{form.languages.join(", ")}</span>
                  </Chip>
                )}
              </div>
            </div>

            {/* COMPLETENESS */}
            <div className="shrink-0">
              <CompletenessRing value={setupCompleteness} label="Setup" />
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Showcase {showcaseCompleteness}%
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-start justify-between gap-4 border-b border-border/60 pb-4 sm:flex-row">
          <div>
            <p className="section-label">Your Studio</p>
            <h2 className="mt-1 font-display text-lg font-semibold">
              Tell people what you're about
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Add your name, what you do, where you're based, and a few links so people can find and
              work with you.
            </p>
          </div>
        </div>

        {/* IDENTITY FORM */}
        <div className="rounded-xl border card-border bg-surface p-5 sm:p-6">
          <h3 className="mb-4 font-display text-lg font-semibold">Identity</h3>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <LabeledInput
                label="Display name"
                value={form.display_name}
                onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
                placeholder="Your name"
              />
              <div>
                <LabeledInput
                  label="Handle"
                  value={form.handle}
                  onChange={(v) => {
                    setHandleStatus("idle");
                    setForm((f) => ({ ...f, handle: v }));
                  }}
                  placeholder="yourhandle"
                />
                {handleStatus !== "idle" && (
                  <p
                    className={`mt-1 text-xs ${handleStatus === "taken" ? "text-destructive" : "text-muted-foreground"}`}
                    role="status"
                  >
                    {handleStatus === "checking"
                      ? "Checking handle…"
                      : handleStatus === "available"
                        ? "Handle is available"
                        : "Handle is already taken"}
                  </p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 px-0 text-xs"
                  disabled={!form.handle.trim() || handleStatus === "checking"}
                  onClick={async () => {
                    const candidate = normalizeProfileHandle(form.handle);
                    const validation = validateProfileInput({
                      displayName: "Member",
                      handle: candidate,
                      yearsExperience: "",
                    });
                    if (validation && validation.includes("Handle")) return toast.error(validation);
                    setHandleStatus("checking");
                    const { data, error } = await supabase
                      .from("profiles")
                      .select("id")
                      .eq("handle", candidate)
                      .neq("id", userId)
                      .maybeSingle();
                    if (error) {
                      setHandleStatus("idle");
                      return toast.error(friendlyError(error, "Could not check handle"));
                    }
                    setHandleStatus(data ? "taken" : "available");
                  }}
                >
                  Check availability
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <LabeledInput
                label="Title"
                value={form.creator_title}
                onChange={(v) => setForm((f) => ({ ...f, creator_title: v }))}
                placeholder="Video Editor & Motion Designer"
              />
              <LabeledInput
                label="Category"
                value={form.category}
                onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                placeholder="Video Editing"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <LabeledInput
                label="Years of experience"
                type="number"
                value={form.years_experience}
                onChange={(v) => setForm((f) => ({ ...f, years_experience: v }))}
                placeholder="5"
              />
              <LabeledInput
                label="Country"
                value={form.country}
                onChange={(v) => setForm((f) => ({ ...f, country: v }))}
                placeholder="UK"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <LabeledInput
                label="Timezone"
                value={form.timezone}
                onChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
                placeholder="GMT"
              />
              <LabeledInput
                label="Availability"
                value={form.availability}
                onChange={(v) => setForm((f) => ({ ...f, availability: v }))}
                placeholder="Weekdays, mornings"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Languages
              </Label>
              <div className="flex flex-wrap gap-2">
                {form.languages.map((l) => (
                  <button
                    key={l}
                    onClick={() =>
                      setForm((f) => ({ ...f, languages: f.languages.filter((x) => x !== l) }))
                    }
                    className="flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs"
                  >
                    {l}
                    <span aria-hidden="true" className="text-[10px]">
                      ×
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={form.langInput}
                  onChange={(e) => setForm((f) => ({ ...f, langInput: e.target.value }))}
                  placeholder="English"
                  maxLength={30}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = form.langInput.trim();
                      if (v && !form.languages.includes(v) && form.languages.length < 10)
                        setForm((f) => ({ ...f, languages: [...f.languages, v], langInput: "" }));
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const v = form.langInput.trim();
                    if (v && !form.languages.includes(v) && form.languages.length < 10)
                      setForm((f) => ({ ...f, languages: [...f.languages, v], langInput: "" }));
                  }}
                >
                  Add
                </Button>
              </div>
              {form.languages.length >= 10 && (
                <p className="mt-1 text-xs text-muted-foreground">Maximum 10 languages</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bio</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Tell people about yourself — what you build, what you're good at, what you're looking for."
                className="min-h-[80px] resize-y"
              />
            </div>
          </div>
        </div>

        {/* TOOLS & STACK */}
        <div className="rounded-xl border card-border bg-surface p-5 sm:p-6">
          <h3 className="mb-4 font-display text-lg font-semibold">Tools & software</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Comma-separated list — e.g. "Figma, Notion, Webflow" or "Python, TypeScript,
            PostgreSQL".
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Favourite tools
              </Label>
              <Input
                value={form.favourite_tools}
                onChange={(e) => setForm((f) => ({ ...f, favourite_tools: e.target.value }))}
                placeholder="Figma, Notion, Webflow"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Software stack
              </Label>
              <Input
                value={form.software_stack}
                onChange={(e) => setForm((f) => ({ ...f, software_stack: e.target.value }))}
                placeholder="Python, TypeScript, PostgreSQL, React"
              />
            </div>
          </div>
        </div>

        {/* TEACHING & LEARNING */}
        <div className="rounded-xl border card-border bg-surface p-5 sm:p-6">
          <h3 className="mb-4 font-display text-lg font-semibold">How you work</h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Teaching style
              </Label>
              <Textarea
                value={form.teaching_style}
                onChange={(e) => setForm((f) => ({ ...f, teaching_style: e.target.value }))}
                placeholder="How do you like to share your skills — pair programming, code reviews, written guides, live sessions?"
                className="min-h-[60px] resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Learning goals
              </Label>
              <Textarea
                value={form.learning_goals}
                onChange={(e) => setForm((f) => ({ ...f, learning_goals: e.target.value }))}
                placeholder="What do you want to get better at? What skills are you growing right now?"
                className="min-h-[60px] resize-y"
              />
            </div>
          </div>
        </div>

        {/* SKILLS */}
        <SkillEditingSection
          teachIds={teachIds}
          teachMeta={teachMeta}
          learnIds={learnIds}
          allSkills={allSkills}
          userId={userId}
          onChange={refresh}
        />

        {/* GITHUB */}
        <GitHubConnect autoOpenToken />

        {/* LINKS */}
        <div className="rounded-xl border card-border bg-surface p-5 sm:p-6">
          <h3 className="mb-4 font-display text-lg font-semibold">Links</h3>

          {/* Portfolio links */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Portfolio links</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.portfolioLinks.map((link, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs"
                >
                  <span className="truncate">{link.label}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        portfolioLinks: f.portfolioLinks.filter((_: unknown, j: number) => j !== i),
                      }))
                    }
                    className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${link.label}`}
                  >
                    <span aria-hidden="true" className="text-[10px]">
                      ×
                    </span>
                  </button>
                </span>
              ))}
            </div>
            {form.portfolioLinks.length === 0 && (
              <p className="text-xs text-muted-foreground">No portfolio links added yet.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                value={form.portfolio_label}
                onChange={(e) => setForm((f) => ({ ...f, portfolio_label: e.target.value }))}
                placeholder="Label — e.g. My website"
              />
              <Input
                value={form.portfolio_url}
                onChange={(e) => setForm((f) => ({ ...f, portfolio_url: e.target.value }))}
                placeholder="https://"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const label = form.portfolio_label.trim();
                const url = form.portfolio_url.trim();
                if (!label || !url) {
                  toast.error("Both label and URL are required.");
                  return;
                }
                if (!validateProfileUrl(url)) {
                  toast.error("Use a valid https:// URL.");
                  return;
                }
                setForm((f) => ({
                  ...f,
                  portfolioLinks: [...f.portfolioLinks, { label, url }],
                  portfolio_label: "",
                  portfolio_url: "",
                }));
              }}
            >
              Add link
            </Button>
          </div>

          {/* Social links */}
          <div className="mt-6 flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Social links</h4>
          </div>
          <div className="mt-2 space-y-3">
            {Object.entries(SOCIAL_ICONS).map(([key, Icon]) => {
              const url = form.social_links[key] ?? "";
              return (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <Input
                      value={url}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          social_links: { ...f.social_links, [key]: e.target.value },
                        }))
                      }
                      placeholder={`https://${key}.com/you`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SAVE */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={save} busy={saving} size="lg" className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" />
                Save profile
              </>
            )}
          </Button>
        </div>
      </div>

      <BackgroundPickerDialog
        open={bgOpen}
        onOpenChange={setBgOpen}
        background={background}
        publicBackground={publicBackground}
        userId={userId}
        onSaved={() => {
          setBgOpen(false);
          onSaved();
          refresh();
        }}
      />
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

function CompletenessRing({ value, label = "Complete" }: { value: number; label?: string }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const gradientId = "completeness-ring";
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="relative h-20 w-20" role="img" aria-label={`Profile completeness: ${value}%`}>
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r={r} stroke="hsl(var(--border))" strokeWidth="6" fill="none" />
          <circle
            cx="40"
            cy="40"
            r={r}
            stroke={`url(#${gradientId})`}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s" }}
          />
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--user-accent, var(--trust))" />
              <stop offset="100%" stopColor="var(--user-accent-subtle, var(--learning-subtle))" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold">
          {value}%
        </div>
      </div>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
