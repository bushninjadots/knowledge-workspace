import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
  UserPlus,
  GraduationCap,
  ImageIcon,
  Trophy,
  Target,
  Check,
  Search as SearchIcon,
  Megaphone,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Until Supabase types are regenerated after migration, cast new columns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { validateImageFile, isSafeUrl, safeHref } from "@/lib/validators";
import { useDominantColor } from "@/lib/dominant-color";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DragDropFileInput } from "@/components/tethyr/drag-drop-file-input";
import { GalleryThumb } from "@/components/tethyr/project/project-resources";

export type ProjectStatus = "planning" | "active" | "paused" | "completed";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  planning: "border-border bg-background/60 text-muted-foreground",
  active:
    "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]",
  paused: "border-teaching/40 bg-teaching text-teaching",
  completed:
    "border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]",
};

export type SkillVerificationLevel = "self_declared" | "proof_certified" | "community_recognized";

export const VERIFICATION_LABEL: Record<SkillVerificationLevel, string> = {
  self_declared: "Self-declared",
  proof_certified: "Proof certified",
  community_recognized: "Community recognized",
};

export const VERIFICATION_STYLE: Record<SkillVerificationLevel, string> = {
  self_declared: "border-border/60 bg-background/40 text-muted-foreground",
  proof_certified:
    "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]",
  community_recognized:
    "border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]",
};

export type SkillExperienceLevel = "beginner" | "intermediate" | "advanced" | "expert";

export const EXPERIENCE_LABEL: Record<SkillExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export function ExperienceBadge({ level }: { level: SkillExperienceLevel }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground">
      {EXPERIENCE_LABEL[level]}
    </span>
  );
}

export function VerificationBadge({
  level,
  proofUrl,
}: {
  level: SkillVerificationLevel;
  proofUrl?: string | null;
}) {
  const Icon =
    level === "community_recognized" ? Trophy : level === "proof_certified" ? Check : null;
  const content = (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${VERIFICATION_STYLE[level]}`}
    >
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {VERIFICATION_LABEL[level]}
    </span>
  );
  if (level === "proof_certified" && proofUrl) {
    return (
      <a href={safeHref(proofUrl)} target="_blank" rel="noreferrer" className="hover:opacity-80">
        {content}
      </a>
    );
  }
  return content;
}

export type ProjectSkill = { id: string; name: string; category: string };

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
    <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
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

const QUICK_EMOJI = ["✨", "🚀", "🌿", "💜", "🎨", "🔥", "🌊", "☕️", "🎧", "🌸"];

const BANNER_CAPTION_MAX = 60;

/* -------- Banner strip (used inside HeaderCard) -------- */
export function BannerStrip({
  bannerSigned,
  bannerCaption,
  userId,
  onChange,
}: {
  bannerSigned: string | null;
  bannerCaption?: string | null;
  userId: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const accentColor = useDominantColor(bannerSigned);

  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(bannerCaption ?? "");
  const [savingCaption, setSavingCaption] = useState(false);
  const captionInputRef = useRef<HTMLInputElement>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    const path = `${userId}/banner.${check.ext}`;
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

  function openCaptionEditor() {
    setCaptionDraft(bannerCaption ?? "");
    setEditingCaption(true);
    setTimeout(() => captionInputRef.current?.focus(), 0);
  }

  function insertEmoji(emoji: string) {
    setCaptionDraft((prev) => (prev + emoji).slice(0, BANNER_CAPTION_MAX));
  }

  async function saveCaption() {
    const trimmed = captionDraft.trim();
    setSavingCaption(true);
    const { error } = await supabase
      .from("profiles")
      .update({ banner_caption: trimmed.length > 0 ? trimmed : null })
      .eq("id", userId);
    setSavingCaption(false);
    if (error) return toast.error(error.message);
    setEditingCaption(false);
    toast.success(trimmed ? "Caption updated" : "Caption cleared");
    onChange();
  }

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
          handle(fakeEvent);
        }
      }}
      disabled={uploading}
    >
      <div
        className="relative -m-6 mb-6 h-48 overflow-hidden rounded-t-3xl border border-b-0 transition-colors duration-500 sm:-m-8 sm:mb-8 sm:h-72"
        style={{ borderColor: accentColor ?? "transparent" }}
      >
        {bannerSigned ? (
          <img src={bannerSigned} alt="" className="h-full w-full object-cover object-center" />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(120deg,var(--brand-purple)_0%,var(--brand-green)_100%)] opacity-40" />
        )}

        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openCaptionEditor();
            }}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs text-foreground backdrop-blur hover:bg-background disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {bannerCaption ? "Edit caption" : "Add caption"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              ref.current?.click();
            }}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs text-foreground backdrop-blur hover:bg-background disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : bannerSigned ? "Change banner" : "Add banner"}
          </button>
        </div>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handle} />

        {editingCaption ? (
          <div
            className="absolute bottom-4 left-32 right-4 z-20 flex flex-col gap-2 rounded-xl bg-background/85 p-3 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              ref={captionInputRef}
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value.slice(0, BANNER_CAPTION_MAX))}
              placeholder="Say something fun about this banner…"
              maxLength={BANNER_CAPTION_MAX}
              className="h-9 bg-surface text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCaption();
                if (e.key === "Escape") setEditingCaption(false);
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {QUICK_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="rounded-lg px-1.5 py-0.5 text-base leading-none hover:bg-surface"
                    aria-label={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {captionDraft.length}/{BANNER_CAPTION_MAX}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setEditingCaption(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={saveCaption}
                  disabled={savingCaption}
                >
                  {savingCaption ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          bannerCaption && (
            <button
              onClick={openCaptionEditor}
              className="absolute bottom-4 right-4 z-20 max-w-44 truncate rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground backdrop-blur transition hover:bg-background/80 sm:max-w-xs"
              title="Click to edit caption"
            >
              {bannerCaption}
            </button>
          )
        )}
      </div>
    </DragDropFileInput>
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
      ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
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
  goal: string | null;
  vision: string | null;
  status: ProjectStatus;
  visibility: "public" | "private";
  stage: "planning" | "building" | "testing" | "launch" | "growing";
  started_at: string;
  progress_percent: number;
  cover_url: string | null;
  gallery: { url: string; caption?: string; type: "image" | "video" }[];
  resources: { title: string; url: string; type: "article" | "tool" | "video" | "doc" | "other" }[];
  media: string[];
  links: Record<string, string>;
  tags: string[];
  looking_for_feedback: boolean;
  looking_for_collaborators: boolean;
  is_featured: boolean;
  created_at: string;
};

export const PROJECT_LINK_KEYS: { key: string; label: string; icon: typeof Github }[] = [
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
  allSkills,
  projectSkillIds,
  onChange,
}: {
  projects: ProjectRow[];
  coverUrls: Record<string, string>;
  userId: string;
  allSkills: ProjectSkill[];
  projectSkillIds: Record<string, string[]>;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const isOwn = me?.userId === userId;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Rocket className="h-4 w-4" />
          Projects
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
          Start a project workspace for something you're building, learning, or working toward.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="card-border group relative overflow-hidden rounded-xl border bg-background/40 transition hover:border-[var(--user-accent-border,var(--border-strong))]"
            >
              <Link to="/projects/$id" params={{ id: p.id }} className="block text-left">
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
                    <h3 className="truncate font-display font-semibold" title={p.title}>
                      {p.title}
                    </h3>
                    {p.is_featured && <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </div>
                  {p.goal && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                      <Target className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-1" title={p.goal}>
                        {p.goal}
                      </span>
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Progress value={p.progress_percent} className="h-1.5" />
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {p.progress_percent}%
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${PROJECT_STATUS_STYLE[p.status]}`}
                    >
                      {PROJECT_STATUS_LABEL[p.status]}
                    </span>
                    {p.looking_for_feedback && (
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        <MessageCircle className="mr-1 inline h-3 w-3" />
                        Feedback
                      </span>
                    )}
                    {p.looking_for_collaborators && (
                      <span className="rounded-full border border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 px-2 py-0.5 text-[11px] text-[var(--brand-purple)]">
                        <UserPlus className="mr-1 inline h-3 w-3" />
                        Collab
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              {isOwn && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Project options"
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition hover:text-foreground group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setEditing(p)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        navigate({ to: "/community", search: { attach_project: p.id } })
                      }
                    >
                      <Megaphone className="mr-2 h-3.5 w-3.5" />
                      Post to Community
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProjectDialog
          project={editing}
          userId={userId}
          allSkills={allSkills}
          initialSkillIds={editing ? (projectSkillIds[editing.id] ?? []) : []}
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

const PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "paused", "completed"];

export function ProjectDialog({
  project,
  userId,
  allSkills,
  initialSkillIds,
  open,
  onOpenChange,
  onSaved,
}: {
  project: ProjectRow | null;
  userId: string;
  allSkills: ProjectSkill[];
  initialSkillIds: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [goal, setGoal] = useState(project?.goal ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "planning");
  const [visibility, setVisibility] = useState<"public" | "private">(
    project?.visibility ?? "public",
  );
  const [progress, setProgress] = useState(project?.progress_percent ?? 0);
  const [coverPath, setCoverPath] = useState<string | null>(project?.cover_url ?? null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>(project?.links ?? {});
  const [tags, setTags] = useState<string[]>(project?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [skillIds, setSkillIds] = useState<Set<string>>(new Set(initialSkillIds));
  const [skillSearch, setSkillSearch] = useState("");
  const [feedback, setFeedback] = useState(project?.looking_for_feedback ?? true);
  const [collab, setCollab] = useState(project?.looking_for_collaborators ?? false);
  const [featured, setFeatured] = useState(project?.is_featured ?? false);
  const [vision, setVision] = useState(project?.vision ?? "");
  const [galleryItems, setGalleryItems] = useState<
    { url: string; caption?: string; type: "image" | "video" }[]
  >(project?.gallery ?? []);
  const [resourceItems, setResourceItems] = useState<
    { title: string; url: string; type: "article" | "tool" | "video" | "doc" | "other" }[]
  >(project?.resources ?? []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredSkills = useMemo(
    () => allSkills.filter((s) => s.name.toLowerCase().includes(skillSearch.toLowerCase())),
    [allSkills, skillSearch],
  );

  useEffect(() => {
    if (open && project?.cover_url) {
      supabase.storage
        .from("project-media")
        .createSignedUrl(project.cover_url, 60 * 60)
        .then(({ data }: { data: { signedUrl: string } | null }) =>
          setCoverPreview(data?.signedUrl ?? null),
        );
    }
  }, [open, project?.cover_url]);

  async function uploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    const previousPath = coverPath;
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
    // Clean up the file we just replaced — best-effort, don't block the UI on it.
    if (previousPath && previousPath !== path) {
      supabase.storage.from("project-media").remove([previousPath]);
    }
  }

  async function save() {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const cleanLinks: Record<string, string> = {};
    for (const [k, v] of Object.entries(links)) {
      const val = v?.trim();
      if (!val) continue;
      if (!isSafeUrl(val)) {
        setSaving(false);
        return toast.error(`"${k}" must be a valid http(s) URL`);
      }
      cleanLinks[k] = val;
    }
    const fullPayload = {
      profile_id: userId,
      title: title.trim(),
      description: description.trim() || null,
      goal: goal.trim() || null,
      vision: vision.trim() || null,
      status,
      visibility,
      progress_percent: progress,
      cover_url: coverPath,
      gallery: galleryItems,
      resources: resourceItems,
      links: cleanLinks,
      tags,
      looking_for_feedback: feedback,
      looking_for_collaborators: collab,
      is_featured: featured,
    };

    // Basic payload without Phase 2 columns — fallback if they don't exist yet.
    const basicPayload = {
      profile_id: userId,
      title: title.trim(),
      description: description.trim() || null,
      goal: goal.trim() || null,
      status,
      progress_percent: progress,
      cover_url: coverPath,
      links: cleanLinks,
      tags,
      looking_for_feedback: feedback,
      looking_for_collaborators: collab,
      is_featured: featured,
    };

    async function trySave(payload: Record<string, any>) {
      if (project) {
        return await sb.from("projects").update(payload).eq("id", project.id);
      }
      return await sb.from("projects").insert(payload).select("id").single();
    }

    let projectId = project?.id;
    let saveResult = await trySave(fullPayload);
    // If extended columns don't exist, retry with basic payload.
    if (saveResult.error?.message?.includes("column")) {
      saveResult = await trySave(basicPayload);
    }
    if (saveResult.error) {
      setSaving(false);
      return toast.error(saveResult.error.message);
    }
    if (!project && saveResult.data) {
      projectId = saveResult.data.id;
    }

    // Sync project_skills against the catalog picker — diff against what
    // this project already had rather than blowing away and re-inserting.
    const previousSkillIds = new Set(initialSkillIds);
    const nextSkillIds = skillIds;
    const toAdd = [...nextSkillIds].filter((id) => !previousSkillIds.has(id));
    const toRemove = [...previousSkillIds].filter((id) => !nextSkillIds.has(id));
    if (projectId && toRemove.length) {
      const { error } = await supabase
        .from("project_skills")
        .delete()
        .eq("project_id", projectId)
        .in("skill_id", toRemove);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    if (projectId && toAdd.length) {
      const { error } = await supabase
        .from("project_skills")
        .insert(toAdd.map((skill_id) => ({ project_id: projectId, skill_id })));
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }

    setSaving(false);
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
            className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background/40 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))]"
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

          <Field label="Goal">
            <Input
              placeholder="What does'done'look like? e.g. Launch to first 10 users"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </Field>

          <Field label="Vision">
            <Textarea
              rows={3}
              placeholder="The longer-form why — what problem does this solve, who is it for?"
              value={vision}
              onChange={(e) => setVision(e.target.value)}
            />
          </Field>

          <Field label="Status">
            <div className="flex flex-wrap gap-2">
              {PROJECT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    status === s
                      ? PROJECT_STATUS_STYLE[s]
                      : "border-border bg-background/40 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                  }`}
                >
                  {PROJECT_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Visibility">
            <div className="flex flex-wrap gap-2">
              {(["public", "private"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    visibility === v
                      ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
                      : "border-border bg-background/40 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                  }`}
                >
                  {v === "public" ? "Public" : "Private"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Public projects appear in Explore and on your profile. Private projects are only
              visible to you and your contributors.
            </p>
          </Field>

          <Field label={`Progress — ${progress}%`}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>

          <Field label="Skills involved">
            <div className="relative mb-2">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search the skill catalog…"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
              {filteredSkills.map((s) => {
                const on = skillIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const next = new Set(skillIds);
                      if (on) next.delete(s.id);
                      else next.add(s.id);
                      setSkillIds(next);
                    }}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
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
              {filteredSkills.length === 0 && (
                <p className="py-2 text-xs text-muted-foreground">No matches</p>
              )}
            </div>
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

          <Field label="Gallery images">
            <div className="space-y-2">
              {galleryItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <GalleryThumb url={item.url} alt="" className="h-8 w-8 rounded object-cover" />
                  <span className="min-w-0 flex-1 truncate">{item.caption ?? item.url}</span>
                  <button
                    onClick={() => setGalleryItems(galleryItems.filter((_, i) => i !== idx))}
                    className="shrink-0 text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <Input
                placeholder="Paste an image URL and press Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) {
                      setGalleryItems([...galleryItems, { url: v, type: "image" }]);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
            </div>
          </Field>

          <Field label="Resources">
            <div className="space-y-2">
              {resourceItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">
                    {item.title} — {item.url}
                  </span>
                  <button
                    onClick={() => setResourceItems(resourceItems.filter((_, i) => i !== idx))}
                    className="shrink-0 text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input placeholder="Title" id="resource-title" className="flex-1" />
                <Input
                  placeholder="URL"
                  id="resource-url"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const titleEl = document.getElementById("resource-title") as HTMLInputElement;
                      const urlEl = e.target as HTMLInputElement;
                      const t = titleEl?.value.trim();
                      const u = urlEl.value.trim();
                      if (t && u) {
                        setResourceItems([...resourceItems, { title: t, url: u, type: "other" }]);
                        if (titleEl) titleEl.value = "";
                        urlEl.value = "";
                      }
                    }
                  }}
                />
              </div>
            </div>
          </Field>

          <div className="grid gap-2 rounded-xl border card-border bg-background/40 p-4">
            <Toggle
              label="Featured"
              description="Pin to top of your profile"
              checked={featured}
              onChange={setFeatured}
            />
            <Toggle
              label="Looking for feedback"
              description="Invite reviews from other people"
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
              label: () => e.kind.replace(/_/g, ""),
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
                  className={`absolute -left-8.5 flex h-6 w-6 items-center justify-center rounded-full ring-2 ${toneCls}`}
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
