import { useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DragDropFileInput } from "@/components/tethyr/drag-drop-file-input";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/error-message";
import { validateImageFile } from "@/lib/validators";

interface ProfileMediaControlsProps {
  ownerId: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  onSaved: () => void;
}

export function ProfileMediaControls({
  ownerId,
  avatarUrl,
  bannerUrl,
  onSaved,
}: ProfileMediaControlsProps) {
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);

  async function upload(kind: "avatar" | "banner", file: File) {
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(kind);
    const bucket = kind === "avatar" ? "avatars" : "banners";
    const path = `${ownerId}/${kind}.${check.ext}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: check.contentType });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase
        .from("profiles")
        .update(kind === "avatar" ? { avatar_url: path } : { banner_url: path })
        .eq("id", ownerId);
      if (profileError) throw profileError;
      toast.success(`${kind === "avatar" ? "Profile photo" : "Banner"} updated`);
      onSaved();
    } catch (error) {
      toast.error(friendlyError(error as Error, `${kind} upload failed`));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="mb-4 space-y-2 border-b border-border/30 pb-4">
      <p className="text-[11px] font-medium text-muted-foreground">Profile media</p>
      <div className="grid grid-cols-2 gap-2">
        <DragDropFileInput
          accept="image/*"
          disabled={uploading !== null}
          onFiles={(files) => files[0] && upload("avatar", files[0])}
          className="rounded-md"
        >
          <div className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/60 bg-surface/40 px-2 py-2 text-center text-[10px] text-muted-foreground">
            {uploading === "avatar" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            <span>{avatarUrl ? "Change photo" : "Upload photo"}</span>
          </div>
        </DragDropFileInput>
        <DragDropFileInput
          accept="image/*"
          disabled={uploading !== null}
          onFiles={(files) => files[0] && upload("banner", files[0])}
          className="rounded-md"
        >
          <div className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/60 bg-surface/40 px-2 py-2 text-center text-[10px] text-muted-foreground">
            {uploading === "banner" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            <span>{bannerUrl ? "Change banner" : "Upload banner"}</span>
          </div>
        </DragDropFileInput>
      </div>
    </div>
  );
}
