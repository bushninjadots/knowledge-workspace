import { useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  UserPlus,
  Link2,
  X,
  Loader2,
  Camera,
  Pencil,
  Check,
  Activity,
  Globe,
  Github,
  Instagram,
  Twitter,
  Twitch,
  Youtube,
  PenLine,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import {
  useAttachProjectToTeam,
  useInviteToTeam,
  useMyTeamInvites,
  useRemoveMember,
  useRespondToTeamInvite,
  useSetMemberRole,
  useUpdateTeam,
  type TeamMemberRow,
  type TeamProjectRow,
  type TeamRole,
  type TeamRow,
} from "@/hooks/use-teams";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMyProjects } from "@/hooks/use-projects";
import { useTeamCredits } from "@/hooks/use-credits";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { validateImageFile } from "@/lib/validators";
import { validateProfileUrl } from "@/lib/profile-validation";
import { useCropConfirm } from "@/components/tethyr/profile/crop-confirm-dialog";
import { DragDropFileInput } from "@/components/tethyr/drag-drop-file-input";
import { supabase } from "@/integrations/supabase/client";
import { CreditsRoll } from "@/components/tethyr/project/project-credits";
import { ContributionGraph } from "@/components/tethyr/profile/contribution-graph";
import { ActivityTimeline } from "@/components/tethyr/activity-timeline";

const ROLE_LABEL: Record<TeamRole, string> = {
  lead: "Leads",
  core: "Core",
  contributor: "Contributors",
};

const ROLE_ORDER: TeamRole[] = ["lead", "core", "contributor"];

const CAPTION_MAX = 80;

/**
 * Social presence keys editable in Crew settings and shown as chips in the
 * crew header. Same keys as profiles.social_links so the two surfaces stay
 * consistent. The crew's own website has its own field (website_url) and chip,
 * so it is deliberately not one of the social keys.
 */
const SOCIAL_ICONS: Record<string, typeof Globe> = {
  youtube: Youtube,
  instagram: Instagram,
  x: Twitter,
  twitch: Twitch,
  github: Github,
};

/** Placeholder host per social key (origin.com is not the origin for all). */
const SOCIAL_HOST: Record<string, string> = {
  youtube: "youtube.com",
  instagram: "instagram.com",
  x: "x.com",
  twitch: "twitch.tv",
  github: "github.com",
};

export function TeamPage({
  team,
  members,
  projects,
}: {
  team: TeamRow;
  members: TeamMemberRow[];
  projects: TeamProjectRow[];
}) {
  const { data: me } = useCurrentUser();
  const isLead = members.some((m) => m.profile_id === me?.userId && m.role === "lead");

  const setRole = useSetMemberRole(team.id);
  const removeMember = useRemoveMember(team.id);
  const respond = useRespondToTeamInvite();
  const { data: invites = [] } = useMyTeamInvites();
  const pendingInvite = invites.find((i) => i.team_id === team.id);
  const creditsQuery = useTeamCredits(team.id);

  const shipped = projects.filter((p) => p.project).map((p) => p.project!);
  const memberIds = members.map((m) => m.profile_id);

  return (
    <div className="animate-room-enter mx-auto max-w-5xl bg-noise px-4 pb-16 pt-6 sm:px-8">
      {pendingInvite && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] px-4 py-3">
          <p className="text-sm text-foreground">You've been invited to join this crew.</p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                respond.mutate({ inviteId: pendingInvite.id, teamId: team.id, accept: true })
              }
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-background transition-fade hover:opacity-90"
            >
              Accept
            </button>
            <button
              onClick={() =>
                respond.mutate({ inviteId: pendingInvite.id, teamId: team.id, accept: false })
              }
              className="rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-lift hover:text-foreground"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Banner section — banner + profile photo + caption */}
      <header className="mb-10">
        <TeamBanner team={team} isLead={isLead} />

        <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:gap-6">
          <TeamAvatar team={team} isLead={isLead} onChanged={() => {}} />
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Crew</p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-foreground sm:text-4xl">
              {team.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">/{team.slug}</p>
            <TeamCaption team={team} isLead={isLead} />
            {team.description ? (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {team.description}
              </p>
            ) : null}
            <TeamLinks team={team} />
          </div>
        </div>
      </header>

      {/* Shipped work — the flagship */}
      <section aria-labelledby="shipped-work" className="mb-10">
        <h2 id="shipped-work" className="mb-4 text-sm font-semibold text-foreground/80">
          Shipped work
          <span className="ml-1 font-normal text-muted-foreground">({shipped.length})</span>
        </h2>
        {shipped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shipped work yet — attach a project.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shipped.map((p) => (
              <li key={p.id}>
                <Card asChild>
                  <Link
                    to="/projects/$id"
                    params={{ id: p.id }}
                    className="block p-4 transition-lift hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated/50"
                  >
                    <span className="block truncate font-medium text-foreground">{p.title}</span>
                    <span className="mt-1 block text-xs capitalize text-muted-foreground">
                      {p.status}
                    </span>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Crew activity — the work behind the projects */}
      <section aria-labelledby="crew-activity" className="mb-10">
        <h2
          id="crew-activity"
          className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground/80"
        >
          <Activity className="h-4 w-4 text-muted-foreground" />
          Crew activity
        </h2>
        {memberIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="rounded-xl bg-surface-elevated/30 p-4">
            <ContributionGraph profileIds={memberIds} />
            <div className="mt-5">
              <ActivityTimeline profileIds={memberIds} limit={6} />
            </div>
          </div>
        )}
      </section>

      {/* Roster */}
      <section aria-labelledby="roster" className="mb-10">
        <h2 id="roster" className="mb-4 text-sm font-semibold text-foreground/80">
          Roster
          <span className="ml-1 font-normal text-muted-foreground">({members.length})</span>
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No members yet — invite your first collaborator.
          </p>
        ) : (
          <div className="space-y-5">
            {ROLE_ORDER.map((role) => {
              const rows = members.filter((m) => m.role === role);
              if (rows.length === 0) return null;
              return (
                <div key={role}>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {ROLE_LABEL[role]}
                  </h3>
                  <ul className="space-y-2 border-l border-border/60 pl-4">
                    {rows.map((m) => (
                      <li
                        key={m.profile_id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        {m.profile?.handle ? (
                          <Link
                            to="/u/$handle"
                            params={{ handle: m.profile.handle }}
                            className="font-medium text-foreground underline-offset-2 hover:underline"
                          >
                            {m.profile.display_name || m.profile.handle}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">
                            {m.profile?.display_name || "Unknown"}
                          </span>
                        )}
                        {isLead && m.role !== "lead" && (
                          <span className="flex items-center gap-1">
                            {m.role !== "core" && (
                              <button
                                onClick={() =>
                                  setRole.mutate({ profileId: m.profile_id, role: "core" })
                                }
                                className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-lift hover:bg-surface-elevated hover:text-foreground"
                              >
                                Make core
                              </button>
                            )}
                            <button
                              onClick={() => removeMember.mutate(m.profile_id)}
                              className="rounded-md p-1 text-muted-foreground transition-lift hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Remove member"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Credits across all of the crew's projects */}
      <CreditsRoll
        credits={creditsQuery.data}
        isLoading={creditsQuery.isLoading}
        isError={creditsQuery.isError}
        onRetry={creditsQuery.refetch}
      />

      {/* Management (lead only) */}
      {isLead && <Management team={team} />}
    </div>
  );
}

function TeamAvatar({
  team,
  isLead,
  onChanged,
}: {
  team: TeamRow;
  isLead: boolean;
  onChanged: () => void;
}) {
  const { data: signedUrl } = useSignedStorageUrl("team-avatars", team.avatar_url);
  const updateTeam = useUpdateTeam(team.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const initial = (team.name ?? "C").charAt(0).toUpperCase();
  const { requestCrop, dialog: cropDialog } = useCropConfirm();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    // Confirm the square crop preview before anything is stored.
    requestCrop(file, "avatar", (payload, meta) => void doUpload(payload, meta));
  }

  async function doUpload(payload: File | Blob, meta: { ext: string; contentType: string }) {
    setUploading(true);
    try {
      // Use a unique path so the signed URL changes and the browser never serves
      // a stale cached copy when the crew picture is replaced.
      const previousPath = team.avatar_url;
      const path = `${team.id}/avatar-${Date.now()}.${meta.ext}`;
      const { error: upErr } = await supabase.storage
        .from("team-avatars")
        .upload(path, payload, { upsert: true, contentType: meta.contentType });
      if (upErr) throw upErr;
      await updateTeam.mutateAsync({ avatar_url: path });
      // Clean up the previous file — best-effort, don't block the UI.
      if (previousPath && previousPath !== path) {
        supabase.storage.from("team-avatars").remove([previousPath]);
      }
      toast.success("Crew picture updated");
      onChanged();
    } catch (err: unknown) {
      toast.error(friendlyError(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative -mt-10 shrink-0 sm:-mt-14">
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border card-border bg-surface text-3xl font-semibold text-foreground ring-4 ring-background sm:h-28 sm:w-28">
        {signedUrl ? (
          <img
            src={signedUrl}
            alt={`${team.name} avatar`}
            width="112"
            height="112"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          initial
        )}
      </div>
      {isLead && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-2 -right-2 rounded-full bg-primary p-2 text-background transition-spatial hover:scale-105 disabled:opacity-50"
            aria-label="Change crew picture"
            title="Change crew picture"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
          {cropDialog}
        </>
      )}
    </div>
  );
}

/**
 * The crew banner — the visual top of the page. Leads can upload/swap the
 * image (3:1 crop confirm, drag-and-drop) or remove it; the placeholder is a
 * quiet brand wash so the header still reads as a banner band.
 */
function TeamBanner({ team, isLead }: { team: TeamRow; isLead: boolean }) {
  const { data: signedUrl } = useSignedStorageUrl("team-covers", team.cover_url);
  const updateTeam = useUpdateTeam(team.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { requestCrop, dialog: cropDialog } = useCropConfirm();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    // Confirm the 3:1 crop preview before anything is stored.
    requestCrop(file, "banner", (payload, meta) => void doUpload(payload, meta));
  }

  async function doUpload(payload: File | Blob, meta: { ext: string; contentType: string }) {
    setUploading(true);
    try {
      // Unique path so the signed URL changes and replacement never serves a
      // stale cached copy (the upload convention every site follows).
      const previousPath = team.cover_url;
      const path = `${team.id}/banner-${Date.now()}.${meta.ext}`;
      const { error: upErr } = await supabase.storage
        .from("team-covers")
        .upload(path, payload, { upsert: true, contentType: meta.contentType });
      if (upErr) throw upErr;
      await updateTeam.mutateAsync({ cover_url: path });
      // Clean up the previous file — best-effort, don't block the UI.
      if (previousPath && previousPath !== path) {
        supabase.storage.from("team-covers").remove([previousPath]);
      }
      toast.success("Crew banner updated");
    } catch (err: unknown) {
      toast.error(friendlyError(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  const banner = (
    <div className="relative h-40 overflow-hidden rounded-xl bg-surface-sunken sm:h-56">
      {signedUrl ? (
        <img
          key={signedUrl}
          src={signedUrl}
          alt={`${team.name} banner`}
          width="1200"
          height="448"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      ) : (
        <div
          aria-hidden="true"
          className="h-full w-full bg-[linear-gradient(120deg,var(--ai)_0%,var(--trust)_100%)] opacity-30"
        />
      )}
      {isLead && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileRef.current?.click();
              }}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-background/80 px-2.5 py-1.5 text-xs text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              aria-label={team.cover_url ? "Change crew banner" : "Add crew banner"}
            >
              <Camera className="h-3.5 w-3.5" />
              {uploading ? "Uploading…" : team.cover_url ? "Change banner" : "Add banner"}
            </button>
            {team.cover_url && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void (async () => {
                    const path = team.cover_url ?? "";
                    setUploading(true);
                    try {
                      await updateTeam.mutateAsync({ cover_url: null });
                      supabase.storage.from("team-covers").remove([path]);
                      toast.success("Banner removed");
                    } catch {
                      toast.error("Couldn't remove banner");
                    } finally {
                      setUploading(false);
                    }
                  })();
                }}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-background/80 px-2.5 py-1.5 text-xs text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                aria-label="Remove crew banner"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </>
      )}
      {cropDialog}
    </div>
  );

  // Viewers see a purely presentational banner — skip the drag-and-drop
  // wrapper so there's never a not-allowed cursor or disabled wash.
  if (!isLead) return banner;

  return (
    <DragDropFileInput
      accept="image/*"
      onFiles={(files) => {
        const file = files[0];
        if (file) {
          // Simulate the change event for the existing handler
          const dt = new DataTransfer();
          dt.items.add(file);
          const fakeEvent = { target: { files: dt.files } } as React.ChangeEvent<HTMLInputElement>;
          handleFile(fakeEvent);
        }
      }}
      disabled={uploading}
    >
      {banner}
    </DragDropFileInput>
  );
}

/** The caption — a short one-line tagline under the crew name. Leads edit it
 *  in place (and it is the half of the banner section the page asks for). */
function TeamCaption({ team, isLead }: { team: TeamRow; isLead: boolean }) {
  const updateTeam = useUpdateTeam(team.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (!team.caption && !isLead) return null;

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {team.caption && (
          <p className="max-w-2xl text-sm text-foreground/80 break-words">{team.caption}</p>
        )}
        {isLead && (
          <button
            onClick={() => {
              setDraft(team.caption ?? "");
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-lift hover:bg-surface-elevated hover:text-foreground"
            aria-label={team.caption ? "Edit caption" : "Add a caption"}
          >
            <PenLine className="h-3 w-3" />
            {team.caption ? "Edit" : "Add a caption"}
          </button>
        )}
      </div>
    );
  }

  async function save() {
    const trimmed = draft.trim();
    setSaving(true);
    try {
      await updateTeam.mutateAsync({ caption: trimmed.length > 0 ? trimmed : null });
      toast.success(trimmed ? "Caption saved" : "Caption cleared");
      setEditing(false);
    } catch {
      toast.error("Couldn't save caption");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 max-w-2xl space-y-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, CAPTION_MAX))}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="A one-line tagline for the crew…"
        maxLength={CAPTION_MAX}
        aria-label="Crew caption"
        className="h-9"
      />
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">
          {draft.length}/{CAPTION_MAX}
        </span>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-background transition-fade hover:opacity-90 disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Save
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-lift hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Website + social chips, shown under the crew identity. Edited in Crew
 *  settings; displayed for everyone. */
function TeamLinks({ team }: { team: TeamRow }) {
  const links: { icon: typeof Globe; href: string; label: string }[] = [];
  if (team.website_url) links.push({ icon: Globe, href: team.website_url, label: "Website" });
  for (const [key, url] of Object.entries(team.social_links ?? {})) {
    if (url) links.push({ icon: SOCIAL_ICONS[key] ?? Globe, href: url, label: key });
  }
  if (links.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <a
            key={`${link.label}:${link.href}`}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs transition-lift hover:border-[var(--user-accent-border,var(--border-strong))]"
          >
            <Icon className="h-3 w-3" />
            <span className="capitalize">{link.label}</span>
          </a>
        );
      })}
    </div>
  );
}

function Management({ team }: { team: TeamRow }) {
  const [handle, setHandle] = useState("");
  const [inviting, setInviting] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState(team.description ?? "");
  const [editingDesc, setEditingDesc] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const invite = useInviteToTeam(team.id);
  const attach = useAttachProjectToTeam(team.id);
  const updateTeam = useUpdateTeam(team.id);
  const { data: myProjects = [] } = useMyProjects();

  async function handleInvite() {
    if (!handle.trim()) return;
    setInviting(true);
    try {
      await invite.mutateAsync(handle.trim());
      setHandle("");
      toast.success("Invite sent");
    } catch (err) {
      toast.error(friendlyError(err, "Invite failed"));
    } finally {
      setInviting(false);
    }
  }

  async function handleAttach(projectId: string) {
    setAttaching(projectId);
    try {
      await attach.mutateAsync(projectId);
      toast.success("Project attached");
    } catch {
      toast.error("Couldn't attach project");
    } finally {
      setAttaching(null);
    }
  }

  async function saveDesc() {
    setSavingDesc(true);
    try {
      await updateTeam.mutateAsync({ description: descDraft.trim() || null });
      toast.success("Description saved");
      setEditingDesc(false);
    } catch {
      toast.error("Couldn't save description");
    } finally {
      setSavingDesc(false);
    }
  }

  // Links group — website + social presence, saved together (same shape as
  // profiles.social_links so chips render identically everywhere).
  const [websiteDraft, setWebsiteDraft] = useState(team.website_url ?? "");
  const [socialDraft, setSocialDraft] = useState<Record<string, string>>(team.social_links ?? {});
  const [savingLinks, setSavingLinks] = useState(false);

  async function saveLinks() {
    const linksToValidate = [websiteDraft, ...Object.values(socialDraft)].filter(Boolean);
    if (linksToValidate.some((url) => !validateProfileUrl(url))) {
      return toast.error("Links must use a valid https:// URL.");
    }
    const socialLinks: Record<string, string> = {};
    for (const [key, url] of Object.entries(socialDraft)) {
      if (typeof url === "string" && url.trim()) socialLinks[key] = url.trim();
    }
    setSavingLinks(true);
    try {
      await updateTeam.mutateAsync({
        website_url: websiteDraft.trim() || null,
        social_links: socialLinks,
      });
      toast.success("Links saved");
    } catch {
      toast.error("Couldn't save links");
    } finally {
      setSavingLinks(false);
    }
  }

  return (
    <section aria-labelledby="crew-settings" className="rounded-xl bg-surface-elevated/30 p-5">
      <h2 id="crew-settings" className="mb-4 text-sm font-semibold text-foreground/80">
        Crew settings
      </h2>

      <div className="mb-5">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Pencil className="h-3.5 w-3.5" />
          Description
        </label>
        {editingDesc ? (
          <div className="space-y-2">
            <Textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="What this crew builds and who it's for…"
              aria-label="Crew description"
              className="min-h-0 resize-y"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveDesc}
                disabled={savingDesc}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-background transition-fade hover:opacity-90 disabled:opacity-40"
              >
                {savingDesc ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save
              </button>
              <button
                onClick={() => {
                  setEditingDesc(false);
                  setDescDraft(team.description ?? "");
                }}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-lift hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setDescDraft(team.description ?? "");
              setEditingDesc(true);
            }}
            className="block w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left text-sm transition-lift hover:border-[var(--user-accent-border,var(--border-strong))]"
          >
            {team.description ? (
              <span className="whitespace-pre-wrap text-foreground/80">{team.description}</span>
            ) : (
              <span className="text-muted-foreground">Add a description…</span>
            )}
          </button>
        )}
      </div>

      {/* Links — website + social presence (shown as chips in the crew header) */}
      <div className="mb-5">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Links
        </label>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Website</label>
            <Input
              value={websiteDraft}
              onChange={(e) => setWebsiteDraft(e.target.value)}
              placeholder="https://your-crew.example.com"
              aria-label="Crew website"
              className="max-w-md"
            />
          </div>
          {Object.entries(SOCIAL_ICONS).map(([key, Icon]) => {
            const url = socialDraft[key] ?? "";
            return (
              <div key={key} className="space-y-1.5">
                <label className="text-xs capitalize text-muted-foreground">{key}</label>
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    value={url}
                    onChange={(e) => setSocialDraft((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={`https://${SOCIAL_HOST[key] ?? `${key}.com`}/your-crew`}
                    aria-label={`Crew ${key} link`}
                    className="max-w-md"
                  />
                </div>
              </div>
            );
          })}
          <button
            onClick={() => void saveLinks()}
            disabled={savingLinks}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-background transition-fade hover:opacity-90 disabled:opacity-40"
          >
            {savingLinks && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save links
          </button>
        </div>
      </div>

      <div className="mb-5">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <UserPlus className="h-3.5 w-3.5" />
          Invite by handle
        </label>
        <div className="flex gap-2">
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="e.g. maya"
            aria-label="Invite by handle"
            className="max-w-xs"
          />
          <button
            onClick={handleInvite}
            disabled={!handle.trim() || inviting}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-background transition-fade hover:opacity-90 disabled:opacity-40"
          >
            {inviting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Invite
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          Attach a project
        </label>
        {myProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don't own any projects yet — create one to attach it here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {myProjects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => handleAttach(p.id)}
                  disabled={attaching === p.id}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left text-sm transition-lift hover:border-[var(--user-accent-border,var(--border-strong))]"
                >
                  <span className="truncate">{p.title}</span>
                  {attaching === p.id && (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
