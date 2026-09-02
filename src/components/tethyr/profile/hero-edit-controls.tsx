// ── Hero header owner controls ───────────────────────────────────────────────
// Restores the in-place editing affordances that used to live on the profile
// hero: change banner, write a banner caption, edit identity fields, and open
// the appearance (backdrop) editor. Rendered as an overlay inside the header
// block's `relative` frame, owner-only.

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Palette, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BackgroundPickerDialog } from "@/components/tethyr/profile/background-picker-dialog";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/error-message";
import { validateImageFile } from "@/lib/validators";
import type { ProfileBackground } from "@/lib/background-themes";

const CAPTION_MAX = 60;
const QUICK_EMOJI = ["✨", "🚀", "🌿", "💜", "🎨", "🔥", "🌊", "☕️", "🎧", "🌸"];

export type HeroIdentity = {
  display_name: string | null;
  handle: string | null;
  creator_title: string | null;
  bio?: string | null;
  category: string | null;
  country: string | null;
  timezone: string | null;
  banner_caption?: string | null;
  background?: ProfileBackground | null;
  public_background?: ProfileBackground | null;
};

export function HeroEditControls({
  userId,
  identity,
  hasBanner,
  onChanged,
}: {
  userId: string;
  identity: HeroIdentity;
  hasBanner: boolean;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(identity.banner_caption ?? "");
  const [savingCaption, setSavingCaption] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["profile-header-block"] });
    void queryClient.invalidateQueries({ queryKey: ["current-user"] });
    onChanged?.();
  }

  async function uploadBanner(file: File) {
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    const path = `${userId}/banner.${check.ext}`;
    const { error: upErr } = await supabase.storage
      .from("banners")
      .upload(path, file, { upsert: true, contentType: check.contentType });
    if (upErr) {
      setUploading(false);
      return toast.error(friendlyError(upErr));
    }
    const { error } = await supabase.from("profiles").update({ banner_url: path }).eq("id", userId);
    setUploading(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Banner updated");
    refresh();
  }

  async function saveCaption() {
    const trimmed = captionDraft.trim();
    setSavingCaption(true);
    const { error } = await supabase
      .from("profiles")
      .update({ banner_caption: trimmed.length > 0 ? trimmed : null })
      .eq("id", userId);
    setSavingCaption(false);
    if (error) return toast.error(friendlyError(error));
    setEditingCaption(false);
    toast.success(trimmed ? "Caption updated" : "Caption cleared");
    refresh();
  }

  return (
    <>
      <div className="absolute right-3 top-3 z-20 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setCaptionDraft(identity.banner_caption ?? "");
            setEditingCaption(true);
            setTimeout(() => captionRef.current?.focus(), 0);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition hover:bg-background"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {identity.banner_caption ? "Edit caption" : "Add caption"}
        </button>

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition hover:bg-background disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : hasBanner ? "Change banner" : "Add banner"}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition hover:bg-background"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit identity
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onClick={() => setIdentityOpen(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit identity details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAppearanceOpen(true)}>
              <Palette className="mr-2 h-3.5 w-3.5" />
              Change appearance
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadBanner(file);
          e.target.value = "";
        }}
      />

      {editingCaption && (
        <div className="absolute inset-x-3 bottom-3 z-30 flex flex-col gap-2 rounded-lg border border-border bg-background/95 p-3 backdrop-blur-sm">
          <Input
            ref={captionRef}
            value={captionDraft}
            maxLength={CAPTION_MAX}
            placeholder="Say something about this banner…"
            onChange={(e) => setCaptionDraft(e.target.value.slice(0, CAPTION_MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveCaption();
              if (e.key === "Escape") setEditingCaption(false);
            }}
            className="h-9 text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Insert ${emoji}`}
                  onClick={() => setCaptionDraft((p) => (p + emoji).slice(0, CAPTION_MAX))}
                  className="rounded-md px-1.5 py-0.5 text-base leading-none hover:bg-muted"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {captionDraft.length}/{CAPTION_MAX}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditingCaption(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void saveCaption()} disabled={savingCaption}>
                {savingCaption ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <IdentityDialog
        open={identityOpen}
        onOpenChange={setIdentityOpen}
        userId={userId}
        identity={identity}
        onSaved={refresh}
      />

      <BackgroundPickerDialog
        open={appearanceOpen}
        onOpenChange={setAppearanceOpen}
        background={identity.background ?? null}
        publicBackground={identity.public_background ?? null}
        userId={userId}
        onSaved={() => {
          setAppearanceOpen(false);
          refresh();
        }}
      />
    </>
  );
}

function IdentityDialog({
  open,
  onOpenChange,
  userId,
  identity,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  identity: HeroIdentity;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    display_name: identity.display_name ?? "",
    handle: identity.handle ?? "",
    creator_title: identity.creator_title ?? "",
    bio: identity.bio ?? "",
    category: identity.category ?? "",
    country: identity.country ?? "",
    timezone: identity.timezone ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim() || null,
        handle: form.handle.trim() || null,
        creator_title: form.creator_title.trim() || null,
        bio: form.bio.trim() || null,
        category: form.category.trim() || null,
        country: form.country.trim() || null,
        timezone: form.timezone.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Identity updated");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit identity</DialogTitle>
          <DialogDescription>
            How you're introduced across Tethyr. Your work still speaks first.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Display name"
            value={form.display_name}
            onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
          />
          <Field
            label="Handle"
            value={form.handle}
            placeholder="yourhandle"
            onChange={(v) => setForm((f) => ({ ...f, handle: v }))}
          />
          <Field
            label="Title"
            value={form.creator_title}
            placeholder="Motion designer"
            onChange={(v) => setForm((f) => ({ ...f, creator_title: v }))}
          />
          <Field
            label="Category"
            value={form.category}
            placeholder="Design"
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          />
          <Field
            label="Country"
            value={form.country}
            onChange={(v) => setForm((f) => ({ ...f, country: v }))}
          />
          <Field
            label="Timezone"
            value={form.timezone}
            placeholder="Europe/Madrid"
            onChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bio</Label>
            <Textarea
              rows={4}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="What are you building, and what do you want to build next?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
