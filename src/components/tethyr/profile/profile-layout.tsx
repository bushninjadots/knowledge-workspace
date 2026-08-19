import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Camera,
  MapPin,
  Clock,
  BookOpen,
  Sparkles,
  Users,
  MessageCircle,
  ExternalLink,
  Globe,
  Github,
  Twitter,
  Instagram,
  Twitch,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/tethyr/follow-button";
import { RequestSessionDialog } from "@/components/tethyr/sessions/request-session-dialog";
import { useSessionRequests } from "@/hooks/use-sessions";
import { BannerStrip } from "@/components/tethyr/profile-sections";
import { FavoriteBadge } from "@/components/tethyr/achievements";
import { DragDropFileInput } from "@/components/tethyr/drag-drop-file-input";
import { WorkspaceGrid } from "@/components/tethyr/workspace/workspace-grid";
import { PROFILE_LAYOUT_PRESETS, PROFILE_MODULES } from "@/lib/workspace-layouts";
import { StudioDirection } from "@/components/tethyr/profile/studio-direction";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { validateImageFile } from "@/lib/validators";
import { completenessPercent } from "@/lib/profile-completeness";
import { useUserPalette, paletteToStyle } from "@/lib/dominant-color";
import { BackgroundPickerDialog } from "@/components/tethyr/profile/background-picker-dialog";
import type { ProfileBackground } from "@/lib/background-themes";
import type { Profile, TeachSkillMeta } from "@/hooks/use-current-user";
import type { ProjectRow } from "@/components/tethyr/profile-sections";

export type Skill = { id: string; slug: string; name: string; category: string };

export type Tab = "overview" | "skills" | "projects" | "communities" | "activity";

const SOCIAL_ICONS: Record<string, typeof Globe> = {
  website: Globe,
  youtube: Twitter,
  instagram: Instagram,
  x: Twitter,
  tiktok: Sparkles,
  twitch: Twitch,
  github: Github,
};

export function ProfileLayout({
  profile,
  avatarSigned,
  bannerSigned,
  background,
  publicBackground,
  userId,
  isOwnProfile,
  teachIds,
  learnIds,
  projects,
  onChange,
  tabContent,
}: {
  profile: Profile | null;
  avatarSigned: string | null;
  bannerSigned: string | null;
  background: ProfileBackground | null;
  publicBackground: ProfileBackground | null;
  userId: string;
  isOwnProfile: boolean;
  teachIds: string[];
  teachMeta: Record<string, TeachSkillMeta>;
  learnIds: string[];
  projects: ProjectRow[];
  coverUrls: Record<string, string>;
  projectSkillIds: Record<string, string[]>;
  skills: Skill[];
  onChange: () => void;
  tabContent: Record<Tab, React.ReactNode>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const palette = useUserPalette(bannerSigned);

  const { data: requestsData } = useSessionRequests();
  const hasPendingRequest = (requestsData ?? []).some(
    (r) => r.to_user_id === userId && r.status === "pending",
  );

  const accentStyle = paletteToStyle(palette);

  const completeness = completenessPercent({
    profile,
    teachCount: teachIds.length,
    learnCount: learnIds.length,
    projectsCount: projects.length,
  });

  return (
    <div
      className="animate-room-enter mx-auto max-w-7xl bg-noise px-4 py-6 sm:px-6 sm:py-8"
      style={accentStyle}
    >
      <div className="space-y-6">
        {/* BANNER + HEADER */}
        <div className="relative overflow-hidden rounded-xl border card-border bg-surface p-5 sm:p-6">
          {isOwnProfile ? (
            <BannerStrip
              bannerSigned={bannerSigned}
              bannerCaption={profile?.banner_caption ?? null}
              userId={userId}
              onChange={onChange}
            />
          ) : (
            <div
              className="relative -m-6 mb-6 h-48 overflow-hidden rounded-t-3xl border border-b-0 transition-colors duration-500 sm:-m-8 sm:mb-8 sm:h-72"
              style={{ borderColor: palette?.dominant ?? "transparent" }}
            >
              {bannerSigned ? (
                <img
                  src={bannerSigned}
                  alt=""
                  decoding="async"
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="h-full w-full bg-[linear-gradient(120deg,var(--brand-purple)_0%,var(--brand-green)_100%)] opacity-40" />
              )}
            </div>
          )}

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* AVATAR */}
            <div className="relative shrink-0 -mt-16 sm:-mt-20">
              {isOwnProfile ? (
                <DragDropFileInput
                  accept="image/*"
                  onFiles={(files) => {
                    const file = files[0];
                    if (file) {
                      const dt = new DataTransfer();
                      dt.items.add(file);
                      const fakeEvent = {
                        target: { files: dt.files },
                      } as React.ChangeEvent<HTMLInputElement>;
                      handleAvatarUpload(fakeEvent, userId, onChange);
                    }
                  }}
                >
                  <div className="h-28 w-28 overflow-hidden rounded-full bg-gradient-brand ring-4 ring-surface shadow-sm sm:h-32 sm:w-32">
                    <AvatarContent avatarSigned={avatarSigned} name={profile?.display_name} />
                  </div>
                  <button className="absolute -bottom-2 -right-2 rounded-full bg-primary p-2 text-background shadow-sm transition hover:scale-105">
                    <Camera className="h-4 w-4" />
                  </button>
                </DragDropFileInput>
              ) : (
                <div className="h-28 w-28 overflow-hidden rounded-full bg-gradient-brand ring-4 ring-surface shadow-sm sm:h-32 sm:w-32">
                  <AvatarContent avatarSigned={avatarSigned} name={profile?.display_name} />
                </div>
              )}
            </div>

            {/* IDENTITY */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-2xl font-semibold break-words sm:text-3xl">
                      {profile?.display_name || "Untitled member"}
                    </h1>
                    <FavoriteBadge type={profile?.favorite_achievement} />
                  </div>
                  {profile?.creator_title && (
                    <p className="mt-0.5 text-sm text-foreground/80 break-words">
                      {profile.creator_title}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">@{profile?.handle ?? "—"}</p>
                </div>
                {isOwnProfile && (
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setBgOpen(true)}
                    >
                      <Palette className="mr-1.5 h-4 w-4" />
                      Background
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      onClick={() => setEditOpen(true)}
                      aria-label="Edit identity"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                        />
                      </svg>
                    </Button>
                  </div>
                )}
              </div>

              {profile?.bio && (
                <p className="mt-2 max-w-xl text-sm text-muted-foreground whitespace-pre-wrap break-words">
                  {profile.bio}
                </p>
              )}

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

              {/* ACTION BUTTONS (public profile) */}
              {!isOwnProfile && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <FollowButton targetUserId={userId} />
                  <RequestSessionDialog
                    toUserId={userId}
                    toUserName={profile?.display_name ?? "User"}
                    hasPendingRequest={hasPendingRequest}
                  />
                  <Button size="sm" className="rounded-full">
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                    Message
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full">
                    <Users className="mr-1.5 h-3.5 w-3.5" />
                    Connect
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full">
                    <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                    Collaborate
                  </Button>
                </div>
              )}
            </div>

            {/* COMPLETENESS (own) or REPUTATION (public) */}
            {isOwnProfile && (
              <div className="shrink-0">
                <CompletenessRing value={completeness} />
              </div>
            )}
          </div>
        </div>

        <StudioDirection
          projects={projects.map((project) => ({
            id: project.id,
            title: project.title,
            status: project.status,
          }))}
          learningGoals={profile?.learning_goals}
          availability={profile?.availability}
          canEdit={isOwnProfile}
        />

        {/* STUDIO WORKSPACE + SIDEBAR */}
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            {customizing && isOwnProfile && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-[var(--user-accent-border,var(--primary))] bg-surface-elevated/20 px-4 py-3">
                <div>
                  <p className="section-label">Private Studio layout</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This changes your private view only. Your public Studio has its own arrangement.
                  </p>
                </div>
                {profile?.handle && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/u/$handle" params={{ handle: profile.handle }}>
                      Preview public Studio
                    </Link>
                  </Button>
                )}
              </div>
            )}

            <div className="mb-4 flex justify-end">
              {isOwnProfile && profile?.handle && (
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link to="/u/$handle" params={{ handle: profile.handle }}>
                    View public Studio
                  </Link>
                </Button>
              )}
            </div>

            <WorkspaceGrid
              page="profile"
              userId={userId}
              modules={PROFILE_MODULES}
              layoutPresets={PROFILE_LAYOUT_PRESETS}
              canCustomize={isOwnProfile}
              defaultCustomizing={customizing}
              showModuleTitles={false}
              showSectionNav
              workspaceLabel="Studio"
              onCustomizingChange={setCustomizing}
              renderModule={(id) => tabContent[id as Tab] ?? null}
            />
          </div>

          <ProfileSidebar profile={profile} />
        </div>
      </div>

      {/* EDIT IDENTITY DIALOG (own profile only) */}
      {isOwnProfile && (
        <>
          <EditIdentityDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            profile={profile}
            userId={userId}
            onSaved={onChange}
          />
          <BackgroundPickerDialog
            open={bgOpen}
            onOpenChange={setBgOpen}
            background={background}
            publicBackground={publicBackground}
            userId={userId}
            onSaved={onChange}
          />
        </>
      )}
    </div>
  );
}

function AvatarContent({
  avatarSigned,
  name,
}: {
  avatarSigned: string | null;
  name?: string | null;
}) {
  return avatarSigned ? (
    <img
      src={avatarSigned}
      alt={`${name ?? "User"} avatar`}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-background">
      {(name ?? "?").charAt(0).toUpperCase()}
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
  const gradientId = "completeness-ring";
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="relative h-20 w-20">
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
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Complete</p>
    </div>
  );
}

/* -------- SIDEBAR -------- */

function ProfileSidebar({ profile }: { profile: Profile | null }) {
  const socialLinks = profile?.social_links ?? {};
  const hasSocialLinks = Object.values(socialLinks).some((v) => v);

  if (!hasSocialLinks) return null;

  return (
    <div className="w-full shrink-0 space-y-3 lg:w-72">
      {/* SOCIAL LINKS */}
      {hasSocialLinks && (
        <div className="rounded-xl bg-surface-elevated/30 p-5">
          <h3 className="mb-3 text-sm font-semibold">Links</h3>
          <div className="space-y-1.5">
            {Object.entries(socialLinks).map(([key, url]) => {
              if (!url) return null;
              const Icon = SOCIAL_ICONS[key] ?? Globe;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-surface-sunken hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate capitalize">{key}</span>
                  <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-40" />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- EDIT IDENTITY DIALOG -------- */

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
    bio: profile?.bio ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name || null,
        handle: form.handle || null,
        creator_title: form.creator_title || null,
        category: form.category || null,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
        country: form.country || null,
        timezone: form.timezone || null,
        bio: form.bio || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Profile updated");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit identity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Display name">
            <Input
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              placeholder="Your name"
            />
          </Field>
          <Field label="Handle">
            <Input
              value={form.handle}
              onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
              placeholder="yourhandle"
            />
          </Field>
          <Field label="Title">
            <Input
              value={form.creator_title}
              onChange={(e) => setForm((f) => ({ ...f, creator_title: e.target.value }))}
              placeholder="Video Editor & Motion Designer"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Video Editing"
              />
            </Field>
            <Field label="Years experience">
              <Input
                type="number"
                value={form.years_experience}
                onChange={(e) => setForm((f) => ({ ...f, years_experience: e.target.value }))}
                placeholder="5"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Country">
              <Input
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder="UK"
              />
            </Field>
            <Field label="Timezone">
              <Input
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                placeholder="GMT"
              />
            </Field>
          </div>
          <Field label="Bio">
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Tell people about yourself..."
              className="flex min-h-[80px] w-full rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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

/* -------- HELPERS -------- */

async function handleAvatarUpload(
  e: React.ChangeEvent<HTMLInputElement>,
  userId: string,
  onChange: () => void,
) {
  const file = e.target.files?.[0];
  if (!file) return;
  const check = validateImageFile(file);
  if (!check.ok) return toast.error(check.error);
  const path = `${userId}/avatar.${check.ext}`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: check.contentType });
  if (upErr) return toast.error(friendlyError(upErr));
  const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
  if (error) return toast.error(friendlyError(error));
  toast.success("Avatar updated");
  onChange();
}
