import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Search as SearchIcon, X } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { validateImageFile, isSafeUrl } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { GalleryThumb } from "@/components/tethyr/project/project-resources";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
  PROJECT_CREATION_STEPS,
  PROJECT_LINK_KEYS,
  canContinueProjectCreation,
} from "./types";
import type { ProjectRow, ProjectSkill, ProjectStatus } from "./types";
import { Field } from "./section-card";

import type { Database } from "@/integrations/supabase/types";

const sb = supabase;
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];

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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [creationStep, setCreationStep] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setCreationStep(0);
  }, [open, project?.id]);

  const panelClass = (step: number) => (project || creationStep === step ? "space-y-3" : "hidden");

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
      return toast.error(friendlyError(error));
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
    const fullPayload: ProjectInsert = {
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
    const basicPayload: ProjectInsert = {
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

    async function trySave(payload: ProjectInsert) {
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
      return toast.error(friendlyError(saveResult.error));
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
        return toast.error(friendlyError(error));
      }
    }
    if (projectId && toAdd.length) {
      const { error } = await supabase
        .from("project_skills")
        .insert(toAdd.map((skill_id) => ({ project_id: projectId, skill_id })));
      if (error) {
        setSaving(false);
        return toast.error(friendlyError(error));
      }
    }

    setSaving(false);
    toast.success(project ? "Project updated" : "Project published");
    onSaved();
    onOpenChange(false);
  }

  async function del() {
    if (!project) return;
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Deleted");
    setConfirmDeleteOpen(false);
    onSaved();
    onOpenChange(false);
  }

  function continueCreation() {
    if (!canContinueProjectCreation(creationStep, title)) {
      toast.error("Add a project title first");
      return;
    }
    setCreationStep((step) => Math.min(2, step + 1));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "Start a project"}</DialogTitle>
          {!project && (
            <p className="text-xs text-muted-foreground">
              Start with the story, then add the details that help people contribute.
            </p>
          )}
        </DialogHeader>
        {!project && (
          <div className="flex items-center gap-2" aria-label="Project setup progress">
            {PROJECT_CREATION_STEPS.map((label, index) => (
              <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  aria-current={creationStep === index ? "step" : undefined}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    creationStep >= index
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`truncate text-[11px] ${creationStep === index ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
                {index < 2 && <span className="h-px flex-1 bg-border/60" />}
              </div>
            ))}
          </div>
        )}
        <div className="max-h-[min(65vh,38rem)] space-y-3 overflow-y-auto pr-1">
          <div className={panelClass(0)}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background/40 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))]"
            >
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt=""
                  width="1200"
                  height="675"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
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
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                aria-required="true"
                placeholder="Give the project a clear working name"
              />
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
          </div>
          <div className={panelClass(1)}>
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
          </div>
          <div className={panelClass(2)}>
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
                        const titleEl = document.getElementById(
                          "resource-title",
                        ) as HTMLInputElement;
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
        </div>
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t border-border/60 bg-surface/95 px-6 py-3 sm:-mx-8 sm:px-8">
          {!project && creationStep > 0 && (
            <Button variant="ghost" onClick={() => setCreationStep((step) => step - 1)}>
              Back
            </Button>
          )}
          {!project && creationStep < 2 && (
            <Button className="ml-auto" onClick={continueCreation}>
              Continue
            </Button>
          )}
          {project && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {(project || creationStep === 2) && (
            <Button onClick={save} busy={saving} className={project ? "" : "ml-auto"}>
              {saving ? "Saving…" : project ? "Save" : "Publish project"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              This permanently deletes the project. You can always start a new one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={del}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
