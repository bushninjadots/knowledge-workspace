// ── Appearance (Backdrop) ───────────────────────────────────────────────────
// Self-contained control that surfaces the member's backdrop editor inside
// the Creation Studio's visual tab — so "Change appearance" is reachable
// while building, not only from the /profile edit menu. Reads the current
// user's background via useCurrentUser and opens the shared BackgroundPickerDialog.

import { useState, type CSSProperties } from "react";
import { Wallpaper } from "lucide-react";
import { BackgroundPickerDialog } from "@/components/tethyr/profile/background-picker-dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import { backgroundStyle } from "@/lib/background-themes";

export function AppearanceBackdrop() {
  const { data: me, refresh } = useCurrentUser();
  const [open, setOpen] = useState(false);

  const bg = me?.background ?? null;
  const hasBg = !!bg && !!bg.mode;
  const swatchStyle: CSSProperties = hasBg
    ? {
        ...backgroundStyle(bg, null),
        backgroundColor: backgroundStyle(bg, null).backgroundColor ?? "var(--background)",
      }
    : { background: "var(--surface-elevated)" };

  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Appearance
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-border/20 bg-surface/20 px-2 py-2 text-left transition-colors hover:border-border/40 hover:bg-surface-elevated/50"
        title="Change appearance — backdrop behind your space"
      >
        <span className="h-5 w-5 shrink-0 rounded border border-border/40" style={swatchStyle} />
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-medium text-foreground">Backdrop</span>
          <span className="block truncate text-[10px] text-muted-foreground/60">
            {hasBg ? "Color, pattern, or image" : "Set a backdrop"}
          </span>
        </span>
        <Wallpaper className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <BackgroundPickerDialog
        open={open}
        onOpenChange={setOpen}
        background={bg}
        publicBackground={me?.profile?.public_background ?? null}
        userId={me?.userId ?? ""}
        onSaved={refresh}
      />
    </div>
  );
}
