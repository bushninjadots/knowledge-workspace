import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DragDropFileInput } from "@/components/tethyr/drag-drop-file-input";
import { useCropConfirm } from "@/components/tethyr/profile/crop-confirm-dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/error-message";
import { validateImageFile } from "@/lib/validators";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { cn } from "@/lib/utils";

const PROTECTED_HANDLES = new Set([
  "admin",
  "staff",
  "support",
  "mod",
  "moderator",
  "help",
  "billing",
  "api",
  "status",
  "logout",
  "login",
  "signup",
  "register",
  "settings",
  "profile",
  "dashboard",
  "projects",
  "spaces",
  "discover",
  "messaging",
  "notifications",
]);

interface ProfileMediaControlsProps {
  ownerId: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  onSaved: () => void;
}

type IdentityRow = {
  display_name: string | null;
  handle: string | null;
  creator_title: string | null;
  banner_caption: string | null;
};

export function ProfileMediaControls({
  ownerId,
  avatarUrl,
  bannerUrl,
  onSaved,
}: ProfileMediaControlsProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const { data: me } = useCurrentUser();
  const { requestCrop, dialog: cropDialog } = useCropConfirm(
    // The member's appearance gives the preview their chosen silhouette.
    (me?.background ?? null) as { avatarShape?: string | null } | null,
  );
  const avatarPath = avatarUrl?.startsWith("http") ? null : avatarUrl;
  const bannerPath = bannerUrl?.startsWith("http") ? null : bannerUrl;
  const { data: signedAvatarUrl } = useSignedStorageUrl("avatars", avatarPath);
  const { data: signedBannerUrl } = useSignedStorageUrl("banners", bannerPath);
  const avatarPreviewUrl = avatarUrl?.startsWith("http") ? avatarUrl : signedAvatarUrl;
  const bannerPreviewUrl = bannerUrl?.startsWith("http") ? bannerUrl : signedBannerUrl;

  const { data: identity, isLoading: identityLoading } = useQuery({
    queryKey: ["profile-header-block", ownerId],
    queryFn: async (): Promise<IdentityRow | null> => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, handle, creator_title, banner_caption")
        .eq("id", ownerId)
        .maybeSingle();
      return data as unknown as IdentityRow | null;
    },
    enabled: !!ownerId,
  });

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!identity || savingIdentity) return;
    setDisplayName(identity.display_name ?? "");
    setHandle(identity.handle ?? "");
    setTitle(identity.creator_title ?? "");
    setCaption(identity.banner_caption ?? "");
  }, [identity, savingIdentity]);

  async function upload(
    kind: "avatar" | "banner",
    payload: File | Blob,
    meta: { ext: string; contentType: string },
  ) {
    setUploading(kind);
    // The payload has already been validated and optionally centre-cropped via
    // the confirm dialog (squares for avatars, 3:1 for banners) — what is
    // stored is what is shown.
    const bucket = kind === "avatar" ? "avatars" : "banners";
    const previousPath = kind === "avatar" ? avatarUrl : bannerUrl;
    // Use a unique path so the signed URL changes and the browser never serves
    // a stale cached copy when the media is replaced at the same extension.
    const path = `${ownerId}/${kind}-${Date.now()}.${meta.ext}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, payload, { upsert: true, contentType: meta.contentType });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase
        .from("profiles")
        .update(kind === "avatar" ? { avatar_url: path } : { banner_url: path })
        .eq("id", ownerId);
      if (profileError) throw profileError;
      // Clean up the previous file — best-effort, never fail the upload for it.
      if (previousPath && previousPath !== path && !previousPath.startsWith("http")) {
        try {
          await supabase.storage.from(bucket).remove([previousPath]);
        } catch {
          // ignore cleanup errors
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["profile-header-block", ownerId] });
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success(`${kind === "avatar" ? "Profile photo" : "Banner"} updated`);
      onSaved();
    } catch (error) {
      toast.error(friendlyError(error as Error, `${kind} upload failed`));
    } finally {
      setUploading(null);
    }
  }

  async function saveIdentity() {
    const name = displayName.trim();
    const normHandle = handle.trim().toLowerCase().replace(/^@/, "");
    if (!name) return toast.error("Display name is required.");
    if (normHandle) {
      if (!/^[a-z0-9_]{3,30}$/.test(normHandle)) {
        return toast.error(
          "Handle must be 3-30 characters using letters, numbers, or underscores.",
        );
      }
      if (PROTECTED_HANDLES.has(normHandle)) return toast.error("That handle is reserved.");
      const { data: existing, error: handleError } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", normHandle)
        .neq("id", ownerId)
        .maybeSingle();
      if (handleError) {
        return toast.error(friendlyError(handleError, "Couldn't check handle availability"));
      }
      if (existing) return toast.error("That handle is already in use.");
    }
    setSavingIdentity(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: name || null,
          handle: normHandle || null,
          creator_title: title.trim() || null,
          banner_caption: caption.trim() || null,
        })
        .eq("id", ownerId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile-header-block", ownerId] });
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Identity updated");
      onSaved();
    } catch (error) {
      toast.error(friendlyError(error as Error, "Couldn't save your identity"));
    } finally {
      setSavingIdentity(false);
    }
  }

  return (
    <div className="mb-4 space-y-3 border-b border-border/30 pb-4">
      <p className="text-[11px] font-medium text-muted-foreground">Header identity</p>
      {identityLoading && (
        <p className="text-[10px] text-muted-foreground">Loading current identity…</p>
      )}
      <div className="space-y-2">
        <Label className="text-[11px] font-medium">Display name</Label>
        <Input
          className="h-8 text-xs"
          value={displayName}
          placeholder="Your name"
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-[11px] font-medium">Handle</Label>
        <Input
          className="h-8 text-xs"
          value={handle}
          placeholder="yourhandle"
          onChange={(e) => setHandle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-[11px] font-medium">Creator title</Label>
        <Input
          className="h-8 text-xs"
          value={title}
          placeholder="What do you do?"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-[11px] font-medium">Banner caption</Label>
        <Input
          className="h-8 text-xs"
          value={caption}
          maxLength={60}
          placeholder="Say something fun about your banner…"
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-full text-xs"
        onClick={saveIdentity}
        disabled={savingIdentity || identityLoading}
      >
        {savingIdentity ? "Saving…" : "Save identity"}
      </Button>

      <div className="pt-1">
        <p className="text-[11px] font-medium text-muted-foreground">Profile media</p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
          Preview the exact assets used across your profile. Animated GIFs remain animated after upload.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DragDropFileInput
          accept="image/*"
          disabled={uploading !== null}
          onFiles={(files) => {
            const file = files[0];
            if (!file) return;
            const check = validateImageFile(file);
            if (!check.ok) return toast.error(check.error);
            requestCrop(file, "avatar", (payload, meta) => void upload("avatar", payload, meta));
          }}
          className="rounded-md"
        >
          <div className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 bg-surface/40 px-2 py-2 text-center text-[10px] text-muted-foreground transition-colors hover:border-[var(--user-accent-border,var(--border-strong))]">
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt="Current profile photo"
                className="h-10 w-10 rounded-full object-cover ring-1 ring-border/70"
              />
            ) : uploading === "avatar" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            <span className="font-medium text-foreground">{avatarUrl ? "Change photo" : "Upload photo"}</span>
            <span className="text-[9px] text-muted-foreground/80">Square crop</span>
          </div>
        </DragDropFileInput>
        <DragDropFileInput
          accept="image/*"
          disabled={uploading !== null}
          onFiles={(files) => {
            const file = files[0];
            if (!file) return;
            const check = validateImageFile(file);
            if (!check.ok) return toast.error(check.error);
            requestCrop(file, "banner", (payload, meta) => void upload("banner", payload, meta));
          }}
          className="rounded-md"
        >
          <div className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 bg-surface/40 px-2 py-2 text-center text-[10px] text-muted-foreground transition-colors hover:border-[var(--user-accent-border,var(--border-strong))]">
            {bannerPreviewUrl ? (
              <img
                src={bannerPreviewUrl}
                alt="Current profile banner"
                className={cn("h-10 w-full object-cover", bannerUrl?.toLowerCase().endsWith(".gif") ? "rounded-md" : "rounded-md")}
              />
            ) : uploading === "banner" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            <span className="font-medium text-foreground">{bannerUrl ? "Change banner" : "Upload banner"}</span>
            <span className="text-[9px] text-muted-foreground/80">Wide crop · GIFs play</span>
          </div>
        </DragDropFileInput>
      </div>
      {cropDialog}
    </div>
  );
}
