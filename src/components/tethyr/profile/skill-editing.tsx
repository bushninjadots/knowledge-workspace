import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import {
  Pencil,
  GraduationCap,
  BookOpen,
  Search as SearchIcon,
  Check,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateProofFile, isSafeUrl } from "@/lib/validators";
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
import { SectionCard } from "./section-card";
import type { Skill } from "./profile-layout";
import type {
  TeachSkillMeta,
  SkillVerificationLevel,
  SkillExperienceLevel,
} from "@/hooks/use-current-user";

type TeachSkill = Skill & { meta: TeachSkillMeta };

export function SkillEditingSection({
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
        title="Skills I share"
        icon={<GraduationCap className="h-4 w-4" />}
        selected={teachSkills}
        allSkills={allSkills}
        userId={userId}
        onChange={onChange}
      />
      <SkillsCard
        title="Skills I’m growing"
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
        return toast.error(friendlyError(error));
      }
    }
    if (toAdd.length) {
      const { error } = await supabase
        .from(table)
        .insert(toAdd.map((skill_id) => ({ profile_id: userId, skill_id })));
      if (error) {
        setSaving(false);
        return toast.error(friendlyError(error));
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
        return toast.error(friendlyError(error));
      }
    }
    if (toAdd.length) {
      const { error } = await supabase
        .from("profile_skills_teach")
        .insert(toAdd.map((skill_id) => ({ profile_id: userId, skill_id })));
      if (error) {
        setSaving(false);
        return toast.error(friendlyError(error));
      }
    }
    setSaving(false);
    toast.success("Saved");
    onChange();
    setOpen(false);

    // Immediately guide the user into the level/proof step for the first skill
    // they just added, so "set experience & proof" is impossible to miss.
    const firstNew = toAdd[0];
    if (firstNew) {
      const skill = allSkills.find((s) => s.id === firstNew);
      if (skill) {
        setProofEditing({
          ...skill,
          meta: {
            verification_level: "self_declared" as SkillVerificationLevel,
            experience_level: "intermediate" as SkillExperienceLevel,
            proof_url: null,
            proof_note: null,
          },
        });
      }
    }
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
            <div
              key={s.id}
              className="group flex flex-col items-start gap-1.5 rounded-xl border border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] px-3 py-1.5 transition hover:border-[var(--user-accent-border,var(--primary))]/70"
            >
              <button
                type="button"
                onClick={() => setProofEditing(s)}
                className="flex flex-col items-start gap-1 text-left"
                title={`Set level & proof for ${s.name}`}
              >
                <span className="text-xs font-medium text-primary group-hover:underline">
                  {s.name}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  <VerificationBadge
                    level={s.meta.verification_level}
                    proofUrl={s.meta.proof_url}
                  />
                  <ExperienceBadge level={s.meta.experience_level} />
                </span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProofEditing(s)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <Pencil className="h-3 w-3" />
                  Set level &amp; proof
                </button>
                <Link
                  to="/skills/$slug"
                  params={{ slug: s.slug }}
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  View skill
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add skills to share</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Pick what you can teach. After adding, set your experience level and share proof for
                each one.
              </p>
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
    if (upErr) return toast.error(friendlyError(upErr));
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
    if (error) return toast.error(friendlyError(error));
    toast.success("Skill updated");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set level & proof — {skill.name}</DialogTitle>
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
