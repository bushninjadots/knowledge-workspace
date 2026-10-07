// The look of the profile header's photo and banner: photo shape, photo ring,
// banner overlay and caption position. Lives in the header block's settings,
// next to the photo and banner uploads, so everything about the header's
// photo and banner is in one place. These are part of the member's profile
// (they show wherever the photo and banner do: Studio, dashboard, public
// page), so each change saves straight away rather than waiting for Publish.

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/error-message";
import {
  AVATAR_RINGS,
  AVATAR_RING_WIDTHS,
  AVATAR_SHAPES,
  BORDER_SWATCHES,
  avatarShapeStyle,
  emptyBackground,
  normalizeAvatarRing,
  normalizeAvatarShape,
  type ProfileBackground,
} from "@/lib/background-themes";
import { CURRENT_USER_KEY, useCurrentUser } from "@/hooks/use-current-user";
import { Choice } from "@/components/tethyr/studio/studio-controls";
import { cn } from "@/lib/utils";
import { BannerOverlayPicker } from "./banner-overlay";

type HeaderLook = Pick<
  ProfileBackground,
  | "avatarShape"
  | "avatarRing"
  | "avatarRingColor"
  | "avatarRingWidth"
  | "bannerOverlay"
  | "bannerCaptionPosition"
>;

/**
 * Saves header-look changes to the member's profile. A separate public look
 * (Appearance → visitors see their own backdrop) is what the public page
 * reads, so the change goes to both and the header looks the same everywhere.
 */
function useSaveHeaderLook(userId: string) {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  return async (patch: HeaderLook) => {
    const background = { ...(me?.background ?? emptyBackground()), ...patch };
    const publicBackground = me?.profile?.public_background as ProfileBackground | null | undefined;
    const { error } = await supabase
      .from("profiles")
      .update({
        background,
        ...(publicBackground ? { public_background: { ...publicBackground, ...patch } } : {}),
      })
      .eq("id", userId);
    if (error) {
      toast.error(friendlyError(error));
      return false;
    }
    void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
    void queryClient.invalidateQueries({ queryKey: ["profile-header-block"] });
    return true;
  };
}

export function HeaderLookControls({ userId }: { userId: string }) {
  const { data: me } = useCurrentUser();
  const save = useSaveHeaderLook(userId);
  // Local copy so a click shows at once; the profile catches up on save.
  const [look, setLook] = useState<HeaderLook>({});
  useEffect(() => {
    const bg = me?.background;
    setLook({
      avatarShape: bg?.avatarShape,
      avatarRing: bg?.avatarRing,
      avatarRingColor: bg?.avatarRingColor,
      avatarRingWidth: bg?.avatarRingWidth,
      bannerOverlay: bg?.bannerOverlay,
      bannerCaptionPosition: bg?.bannerCaptionPosition,
    });
  }, [me?.background]);
  const change = (patch: HeaderLook) => {
    const previous = look;
    setLook((current) => ({ ...current, ...patch }));
    void save(patch).then((ok) => {
      if (!ok) setLook(previous);
    });
  };
  const ring = normalizeAvatarRing(look.avatarRing, look.avatarRingColor);
  const shape = normalizeAvatarShape(look.avatarShape);

  return (
    <section aria-labelledby="header-look-heading" className="border-b border-border py-3">
      <p id="header-look-heading" className="t-label mb-1">
        Photo &amp; banner look
      </p>
      <p className="mb-3 text-2xs leading-snug text-muted-foreground-subtle">
        Shows wherever your photo and banner appear: here, your dashboard and your public page.
        Saves straight away.
      </p>

      <p className="t-label mb-1.5">Photo shape</p>
      <div className="mb-4 grid grid-cols-4 gap-1" role="group" aria-label="Photo shape">
        {AVATAR_SHAPES.map((option) => {
          const selected = shape === option.id;
          const shapeStyle = avatarShapeStyle({ ...emptyBackground(), avatarShape: option.id });
          return (
            <button
              key={option.id}
              type="button"
              title={`${option.label}: ${option.description}`}
              aria-pressed={selected}
              onClick={() => change({ avatarShape: option.id })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-sm border px-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]",
                selected
                  ? "border-[var(--user-accent)] bg-[var(--user-accent-subtle)]"
                  : "border-border hover:bg-[var(--surface-sunken)]",
              )}
            >
              <span
                aria-hidden
                className="block h-6 w-6 bg-[var(--user-accent,var(--primary))]"
                style={{
                  borderRadius: option.id === "circle" ? "9999px" : undefined,
                  clipPath: (shapeStyle as Record<string, string>)["--avatar-clip"] ?? "none",
                }}
              />
              <span className="text-3xs text-foreground">{option.label}</span>
            </button>
          );
        })}
      </div>

      <Choice
        label="Photo ring"
        hint="A thin outline around your photo. Accent uses your page's accent colour."
        value={ring}
        options={AVATAR_RINGS.map((option) => [option.id, option.label])}
        onChange={(value) =>
          change({
            avatarRing: value as HeaderLook["avatarRing"],
            // Seed a colour so "Custom" shows something straight away.
            ...(value === "custom" && !look.avatarRingColor
              ? { avatarRingColor: BORDER_SWATCHES[0] }
              : {}),
          })
        }
      />
      {ring !== "none" && (
        <Choice
          label="Ring thickness"
          value={look.avatarRingWidth ?? "medium"}
          options={AVATAR_RING_WIDTHS.map((option) => [option.id, option.label])}
          onChange={(value) => change({ avatarRingWidth: value as HeaderLook["avatarRingWidth"] })}
        />
      )}
      {ring === "custom" && (
        <div className="-mt-2 mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Ring colour">
          {BORDER_SWATCHES.map((swatch) => {
            const selected = (look.avatarRingColor ?? "").toLowerCase() === swatch;
            return (
              <button
                key={swatch}
                type="button"
                aria-label={`Ring colour ${swatch}`}
                aria-pressed={selected}
                onClick={() => change({ avatarRingColor: swatch })}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-sm border-2 pointer-coarse:h-10 pointer-coarse:w-10",
                  selected ? "border-foreground" : "border-border",
                )}
                style={{ backgroundColor: swatch }}
              >
                {selected && <Check className="h-3 w-3 text-white mix-blend-difference" />}
              </button>
            );
          })}
        </div>
      )}

      <p className="t-label mb-1">Banner overlay</p>
      <p className="mb-1.5 text-2xs leading-snug text-muted-foreground-subtle">
        Keeps your caption readable over the banner image.
      </p>
      <BannerOverlayPicker
        className="mb-4 grid-cols-2 sm:grid-cols-2"
        value={look.bannerOverlay}
        onChange={(value) => change({ bannerOverlay: value })}
      />
      <Choice
        label="Caption position"
        value={look.bannerCaptionPosition ?? "right"}
        options={[
          ["left", "Left"],
          ["center", "Centre"],
          ["right", "Right"],
        ]}
        onChange={(value) =>
          change({ bannerCaptionPosition: value as HeaderLook["bannerCaptionPosition"] })
        }
      />
    </section>
  );
}
