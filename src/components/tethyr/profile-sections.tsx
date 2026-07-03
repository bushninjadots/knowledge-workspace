import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pencil,
  Camera,
  Plus,
  X,
  Wrench,
  Layers,
  Rocket,
  History,
  ExternalLink,
  Github,
  Globe,
  Figma,
  Sparkles,
  MessageCircle,
  Users as UsersIcon,
  UserPlus,
  GraduationCap,
  ImageIcon,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validateImageFile, isSafeUrl } from "@/lib/validators";
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

/* -------- shared card shell -------- */
export function SectionCard({
  title,
  onEdit,
  children,
  action,
}: {
  title: React.ReactNode;
  onEdit?: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {action}
          {onEdit && (
            <Button variant="ghost" size="icon" className="rounded-full" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
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

/* -------- Banner strip (used inside HeaderCard) -------- */
export function BannerStrip({
  bannerSigned,
  userId,
  onChange,
}: {
  bannerSigned: string | null;
  userId: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    const path = `${userId}/banner-${Date.now()}.${check.ext}`;
    const { error: upErr } = await supabase.storage
      .from("banners")
      .upload(path, file, { upsert: true, contentType: check.contentType });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const { error } = await supabase.from("profiles").update({ banner_url: path }).eq("id", userId);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Banner updated");
    onChange();
  }


  return (
    <div className="relative -m-6 mb-6 h-40 overflow-hidden rounded-t-3xl sm:-m-8 sm:mb-8 sm:h-56">
      {bannerSigned ? (
        <img src={bannerSigned} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-[linear-gradient(120deg,var(--brand-purple)_0%,var(--brand-green)_100%)] opacity-40" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface" />
      <button
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs text-foreground backdrop-blur hover:bg-background disabled:opacity-50"
      >
        <Camera className="h-3.5 w-3.5" />
        {uploading ? "Uploading…" : bannerSigned ? "Change banner" : "Add banner"}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handle} />
    </div>
  );
}

/* -------- Free-text chip list (tools / stack) -------- */
export function ChipListCard({
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
  const [items, setItems] = useState<string[]>(values);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setItems(values);
  }, [open, values]);

  const chipCls =
    accent === "green"
      ? "border-primary/40 bg-primary/10 text-primary"
      : "border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]";

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: items } as never)
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(error.message);
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
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add the tools you use most.</p>
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
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {items.map((v) => (
                <button
                  key={v}
                  onClick={() => setItems(items.filter((x) => x !== v))}
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
                placeholder={placeholder}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = input.trim();
                    if (v && !items.includes(v)) setItems([...items, v]);
                    setInput("");
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const v = input.trim();
                  if (v && !items.includes(v)) setItems([...items, v]);
                  setInput("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
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

/* -------- Projects -------- */
export type ProjectRow = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  media: string[];
  links: Record<string, string>;
  tags: string[];
  looking_for_feedback: boolean;
  looking_for_collaborators: boolean;
  is_featured: boolean;
  created_at: string;
};

const PROJECT_LINK_KEYS: { key: string; label: string; icon: typeof Github }[] = [
  { key: "website", label: "Website", icon: Globe },
  { key: "github", label: "GitHub", icon: Github },
  { key: "figma", label: "Figma", icon: Figma },
  { key: "behance", label: "Behance", icon: Sparkles },
  { key: "dribbble", label: "Dribbble", icon: Sparkles },
];

export function ProjectsCard({
  projects,
  coverUrls,
  userId,
  onChange,
}: {
  projects: ProjectRow[];
  coverUrls: Record<string, string>;
  userId: string;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Rocket className="h-4 w-4" />
          Featured projects
        </span>
      }
      action={
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => setCreating(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          New
        </Button>
      }
    >
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Showcase what you're building. Add images, links, and tag skills.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setEditing(p)}
              className="group overflow-hidden rounded-2xl border border-border/60 bg-background/40 text-left transition hover:border-primary/40"
            >
              <div className="aspect-video overflow-hidden bg-background">
                {p.cover_url && coverUrls[p.cover_url] ? (
                  <img
                    src={coverUrls[p.cover_url]}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-display font-semibold">{p.title}</h3>
                  {p.is_featured && <Trophy className="h-3.5 w-3.5 text-primary" />}
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.looking_for_feedback && (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                      <MessageCircle className="mr-1 inline h-3 w-3" />
                      Feedback
                    </span>
                  )}
                  {p.looking_for_collaborators && (
                    <span className="rounded-full border border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 px-2 py-0.5 text-[10px] text-[var(--brand-purple)]">
                      <UserPlus className="mr-1 inline h-3 w-3" />
                      Collab
                    </span>
                  )}
                  {p.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProjectDialog
          project={editing}
          userId={userId}
          open={creating || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreating(false);
              setEditing(null);
            }
          }}
          onSaved={onChange}
        />
      )}
    </SectionCard>
  );
}

function ProjectDialog({
  project,
  userId,
  open,
  onOpenChange,
  onSaved,
}: {
  project: ProjectRow | null;
  userId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [coverPath, setCoverPath] = useState<string | null>(project?.cover_url ?? null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>(project?.links ?? {});
  const [tags, setTags] = useState<string[]>(project?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [feedback, setFeedback] = useState(project?.looking_for_feedback ?? true);
  const [collab, setCollab] = useState(project?.looking_for_collaborators ?? false);
  const [featured, setFeatured] = useState(project?.is_featured ?? false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && project?.cover_url) {
      supabase.storage
        .from("project-media")
        .createSignedUrl(project.cover_url, 60 * 60)
        .then(({ data }: { data: { signedUrl: string } | null }) => setCoverPreview(data?.signedUrl ?? null));
    }
  }, [open, project?.cover_url]);

  async function uploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    const path = `${userId}/${crypto.randomUUID()}.${check.ext}`;
    const { error } = await supabase.storage
      .from("project-media")
      .upload(path, file, { contentType: check.contentType });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data } = await supabase.storage.from("project-media").createSignedUrl(path, 60 * 60);
    setCoverPath(path);
    setCoverPreview(data?.signedUrl ?? null);
    setUploading(false);
  }


  async function save() {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const cleanLinks: Record<string, string> = {};
    for (const [k, v] of Object.entries(links)) {
      const val = v?.trim();
      if (!val) continue;
      if (!isSafeUrl(val)) return toast.error(`"${k}" must be a valid http(s) URL`);
      cleanLinks[k] = val;
    }
    const payload = {
      profile_id: userId,
      title: title.trim(),
      description: description.trim() || null,
      cover_url: coverPath,
      links: cleanLinks,
      tags,
      looking_for_feedback: feedback,
      looking_for_collaborators: collab,
      is_featured: featured,
    };
    const q = project
      ? supabase.from("projects").update(payload).eq("id", project.id)
      : supabase.from("projects").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(project ? "Project updated" : "Project published");
    onSaved();
    onOpenChange(false);
  }

  async function del() {
    if (!project) return;
    if (!confirm("Delete this project?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background/40 text-muted-foreground hover:border-primary/40"
          >
            {coverPreview ? (
              <img src={coverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-xs">
                <Camera className="h-6 w-6" />
                {uploading ? "Uploading…" : "Add cover image"}
              </div>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={uploadCover}
          />

          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field label="Links">
            <div className="space-y-2">
              {PROJECT_LINK_KEYS.map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex w-28 items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <Input
                    placeholder={`https://…`}
                    value={links[key] ?? ""}
                    onChange={(e) => setLinks({ ...links, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </Field>

          <Field label="Tags">
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  className="flex items-center gap-1 rounded-full border border-border bg-background/40 px-3 py-1 text-xs"
                >
                  {t}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={tagInput}
                placeholder="brand, motion, saas…"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = tagInput.trim();
                    if (v && !tags.includes(v)) setTags([...tags, v]);
                    setTagInput("");
                  }
                }}
              />
            </div>
          </Field>

          <div className="grid gap-2 rounded-xl border border-border/60 bg-background/40 p-4">
            <Toggle
              label="Featured"
              description="Pin to top of your profile"
              checked={featured}
              onChange={setFeatured}
            />
            <Toggle
              label="Looking for feedback"
              description="Invite reviews from other creators"
              checked={feedback}
              onChange={setFeedback}
            />
            <Toggle
              label="Looking for collaborators"
              description="Open to team-ups"
              checked={collab}
              onChange={setCollab}
            />
          </div>
        </div>
        <DialogFooter>
          {project && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={del}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : project ? "Save" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`h-6 w-10 shrink-0 rounded-full transition ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`block h-5 w-5 translate-y-0.5 rounded-full bg-background transition ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

/* -------- Activity timeline -------- */
export type ActivityRow = {
  id: string;
  kind: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const KIND_META: Record<
  string,
  {
    label: (m: Record<string, unknown>) => string;
    icon: typeof Sparkles;
    tone: "green" | "purple" | "muted";
  }
> = {
  joined_tethyr: { label: () => "Joined Tethyr", icon: Sparkles, tone: "purple" },
  avatar_updated: { label: () => "Updated avatar", icon: Camera, tone: "muted" },
  banner_updated: { label: () => "Updated banner", icon: ImageIcon, tone: "muted" },
  skill_teach_added: {
    label: (m) => `Added ${m.skill_name ?? "a skill"} to teaching`,
    icon: GraduationCap,
    tone: "green",
  },
  skill_learning_started: {
    label: (m) => `Started learning ${m.skill_name ?? "a skill"}`,
    icon: Sparkles,
    tone: "purple",
  },
  skill_wishlisted: {
    label: (m) => `Wishlisted ${m.skill_name ?? "a skill"}`,
    icon: Sparkles,
    tone: "muted",
  },
  project_published: {
    label: (m) => `Published project "${m.title ?? "Untitled"}"`,
    icon: Rocket,
    tone: "green",
  },
};

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 30 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function TimelineCard({ events }: { events: ActivityRow[] }) {
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Activity timeline
        </span>
      }
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your journey shows up here as you build.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-border/60 pl-6">
          {events.map((e) => {
            const meta = KIND_META[e.kind] ?? {
              label: () => e.kind.replace(/_/g, " "),
              icon: Sparkles,
              tone: "muted" as const,
            };
            const Icon = meta.icon;
            const toneCls =
              meta.tone === "green"
                ? "bg-primary/15 text-primary ring-primary/30"
                : meta.tone === "purple"
                  ? "bg-[var(--brand-purple)]/15 text-[var(--brand-purple)] ring-[var(--brand-purple)]/30"
                  : "bg-background text-muted-foreground ring-border";
            return (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full ring-2 ${toneCls}`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="flex items-center gap-2">
                  <p className="text-sm">{meta.label(e.metadata)}</p>
                  <span className="text-xs text-muted-foreground">· {relTime(e.created_at)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

export const PROFILE_ICONS = { Wrench, Layers, Rocket, History, ExternalLink };
