import { useCallback, useEffect, useRef, useState } from "react";
import { Crop } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { avatarShapeCss } from "@/components/ui/avatar";
import { avatarShapeStyle } from "@/lib/background-themes";
import {
  AVATAR_CROP_ASPECT,
  BANNER_CROP_ASPECT,
  centerCropRect,
  cropImageToAspect,
  cropUploadMeta,
} from "@/lib/image-crop";

type CropShape = "avatar" | "banner";

const SHAPE_ASPECT: Record<CropShape, number> = {
  avatar: AVATAR_CROP_ASPECT,
  banner: BANNER_CROP_ASPECT,
};

/**
 * "How will this look?" — a 2-second confirm step for identity media.
 *
 * Renders a live preview of the centre-crop (the exact math used at upload
 * time) in the member's chosen profile-picture silhouette, and either hands
 * back the file or the cropped blob. Auto-uploads when no crop would change
 * the image, so the common case stays one click.
 *
 * @param avatarBackground the member's appearance document, so avatar
 *   previews take their own chosen shape (circle, hexagon, bloom…) instead
 *   of a generic rounded square.
 */
export function useCropConfirm(
  avatarBackground?: {
    avatarShape?: string | null;
    avatarRing?: string | null;
    avatarRingColor?: string | null;
  } | null,
): {
  /** Feed user-selected files here instead of uploading directly. */
  requestCrop: (
    file: File,
    shape: CropShape,
    onConfirmed: (payload: File | Blob, meta: { ext: string; contentType: string }) => void,
  ) => void;
  /** The preview dialog — mount once per component. */
  dialog: React.ReactNode;
} {
  const [pending, setPending] = useState<{
    file: File;
    shape: CropShape;
    onConfirmed: (payload: File | Blob, meta: { ext: string; contentType: string }) => void;
  } | null>(null);
  const [previewStyle, setPreviewStyle] = useState<React.CSSProperties>({});
  const [needsCrop, setNeedsCrop] = useState(false);
  const [ready, setReady] = useState(false);
  const urlRef = useRef<string | null>(null);

  const releaseUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setReady(false);
  }, []);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    setReady(false);
    void (async () => {
      // Decode once to compute the same rect the uploader will use.
      let rect: ReturnType<typeof centerCropRect> = null;
      let w = 0;
      let h = 0;
      try {
        const bitmap = await createImageBitmap(pending.file);
        w = bitmap.width;
        h = bitmap.height;
        rect = centerCropRect(w, h, SHAPE_ASPECT[pending.shape]);
        bitmap.close();
      } catch {
        rect = null;
      }
      if (cancelled) return;
      setNeedsCrop(!!rect);
      const url = URL.createObjectURL(pending.file);
      urlRef.current = url;
      if (rect) {
        // Crop math rendered as CSS: a square/3:1 box with the image scaled so
        // the visible region equals the stored crop.
        const aspect = SHAPE_ASPECT[pending.shape];
        const boxW = aspect >= 1 ? 224 : 224 * aspect;
        const boxH = aspect >= 1 ? 224 / aspect : 224;
        setPreviewStyle({
          width: boxW,
          height: boxH,
          backgroundImage: `url(${url})`,
          backgroundSize: `${(w / rect.sw) * 100}% ${(h / rect.sh) * 100}%`,
          backgroundPosition: `${rect.sw >= w ? "50%" : `${(rect.sx / (w - rect.sw)) * 100}%`} ${
            rect.sh >= h ? "50%" : `${(rect.sy / (h - rect.sh)) * 100}%`
          }`,
          backgroundRepeat: "no-repeat",
        });
      } else {
        // No crop needed: fit the whole image.
        const aspect = SHAPE_ASPECT[pending.shape];
        const boxW = aspect >= 1 ? 224 : 224 * aspect;
        const boxH = aspect >= 1 ? 224 / aspect : 224;
        setPreviewStyle({
          width: boxW,
          height: boxH,
          backgroundImage: `url(${url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
      releaseUrl();
    };
  }, [pending, releaseUrl]);

  const confirm = useCallback(async () => {
    if (!pending) return;
    const { file, shape, onConfirmed } = pending;
    setPending(null);
    const crop = await cropImageToAspect(file, SHAPE_ASPECT[shape]);
    const meta = cropUploadMeta(file, crop);
    onConfirmed(crop?.blob ?? file, meta);
  }, [pending]);

  const requestCrop = useCallback(
    (
      file: File,
      shape: CropShape,
      onConfirmed: (payload: File | Blob, meta: { ext: string; contentType: string }) => void,
    ) => {
      setPending({ file, shape, onConfirmed });
    },
    [],
  );

  const dialog = (
    <Dialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Crop className="h-4 w-4 text-muted-foreground" />
            How your {pending?.shape === "banner" ? "banner" : "photo"} will appear
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <div
            aria-hidden="true"
            className={`overflow-hidden border border-border/60 bg-surface-sunken ${pending?.shape === "avatar" ? "" : "rounded-lg"}`}
            style={{
              ...(ready ? previewStyle : undefined),
              // Avatars preview in the member's own silhouette: the vars
              // resolve radius (9999px fallback → circle) and clip together,
              // so a hex member sees a hex crop, a circle member a circle.
              ...(pending?.shape === "avatar"
                ? { ...avatarShapeCss, ...avatarShapeStyle(avatarBackground) }
                : {}),
            }}
          >
            {!ready && <div className="h-[149px] w-[224px] animate-gentle-pulse" />}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {needsCrop
            ? "We trim to the shape it's shown in, keeping the middle in frame. The original file stays untouched on your device."
            : "This image already fits — it will be uploaded as-is."}
        </p>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!ready} onClick={() => void confirm()}>
            {needsCrop ? "Crop & upload" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { requestCrop, dialog };
}
