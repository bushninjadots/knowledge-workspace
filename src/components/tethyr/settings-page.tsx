import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  KeyRound,
  Mail,
  LogOut,
  User,
  Palette,
  CalendarClock,
  Check,
  AlertTriangle,
  Loader2,
  Paintbrush,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/tethyr/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useCurrentUser } from "@/hooks/use-current-user";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { CATEGORY_LABELS, ALL_CATEGORIES } from "@/lib/notification-categories";
import { deleteAccount } from "@/lib/account-server";
import { friendlyError } from "@/lib/error-message";
import {
  BACKGROUND_COLORS,
  BACKGROUND_PATTERNS,
  BACKGROUND_GRADIENTS,
  clampStrength,
  BACKGROUND_MIN_STRENGTH,
  BACKGROUND_MAX_STRENGTH,
  BACKGROUND_DEFAULT_STRENGTH,
  hasAppearanceSettings,
  type CardBorderPreference,
  type AccentMode,
  type ContentDensity,
  type ProfileBackground,
} from "@/lib/background-themes";

export function SettingsPage() {
  const navigate = useNavigate();
  const { data: authUser } = useAuthUser();
  const { data: me, refresh: refreshUser } = useCurrentUser();
  const prefs = useNotificationPreferences();
  const bg = (me?.profile as Record<string, unknown> | null)?.background as
    ProfileBackground | null | undefined;

  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Appearance — seeded from the user's current background on mount
  const [bgMode, setBgMode] = useState<"color" | "pattern" | "gradient">(
    bg?.mode === "pattern" ? "pattern" : bg?.mode === "gradient" ? "gradient" : "color",
  );
  const [selectedTint, setSelectedTint] = useState(bg?.color ?? "sky");
  const [selectedPattern, setSelectedPattern] = useState(bg?.pattern ?? "dots");
  const [selectedGradient, setSelectedGradient] = useState(bg?.gradient ?? "tethyr");
  const [strength, setStrength] = useState(bg?.strength ?? BACKGROUND_DEFAULT_STRENGTH);
  const [cardBorders, setCardBorders] = useState<CardBorderPreference>(
    bg?.cardBorders ?? "neutral",
  );
  const [accentMode, setAccentMode] = useState<AccentMode>(bg?.accentMode ?? "dynamic");
  const [customAccent, setCustomAccent] = useState(bg?.accentColor ?? "#38bdf8");
  const [density, setDensity] = useState<ContentDensity>(bg?.density ?? "comfortable");
  const [bannerOverlay, setBannerOverlay] = useState<"none" | "soft" | "strong">(
    bg?.bannerOverlay ?? "soft",
  );
  const [bannerCaptionPosition, setBannerCaptionPosition] = useState<"left" | "center" | "right">(
    bg?.bannerCaptionPosition ?? "right",
  );
  const [savingAppearance, setSavingAppearance] = useState(false);

  // The current-user query resolves after this page mounts. Re-seed the local
  // controls when it does so saving appearance cannot overwrite a persisted
  // preference with the initial defaults.
  useEffect(() => {
    if (!me?.profile) return;
    const stored = me.profile.background;
    const storedColor = stored?.color ?? null;
    const colorOption = BACKGROUND_COLORS.find(
      (color) =>
        color.id === storedColor || color.color.toLowerCase() === storedColor?.toLowerCase(),
    );
    setBgMode(
      stored?.mode === "pattern" ? "pattern" : stored?.mode === "gradient" ? "gradient" : "color",
    );
    setSelectedTint(colorOption?.id ?? "sky");
    setSelectedPattern(stored?.pattern ?? "dots");
    setSelectedGradient(stored?.gradient ?? "tethyr");
    setStrength(stored?.strength ?? BACKGROUND_DEFAULT_STRENGTH);
    setCardBorders(stored?.cardBorders ?? "neutral");
    setAccentMode(stored?.accentMode ?? "dynamic");
    setCustomAccent(stored?.accentColor ?? "#38bdf8");
    setDensity(stored?.density ?? "comfortable");
    setBannerOverlay(stored?.bannerOverlay ?? "soft");
    setBannerCaptionPosition(stored?.bannerCaptionPosition ?? "right");
  }, [me?.profile]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated");
      setNewPassword("");
    } catch (err) {
      toast.error(friendlyError(err, "Failed to update password"));
    } finally {
      setChangingPassword(false);
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (newEmail === authUser?.email) {
      toast.error("That's already your email");
      return;
    }
    setChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success("Confirmation email sent — check your inboxes to finish the change");
      setNewEmail("");
    } catch (err) {
      toast.error(friendlyError(err, "Failed to update email"));
    } finally {
      setChangingEmail(false);
    }
  }

  async function handleDeleteAccount() {
    if (!authUser?.email || confirmEmail.trim() !== authUser.email) return;
    setDeleting(true);
    try {
      const result = await deleteAccount();
      if (!result.ok) throw new Error("Account deletion failed");
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (err) {
      toast.error(friendlyError(err, "Failed to delete account"));
      setDeleting(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  async function saveAppearance() {
    if (!me?.userId) return;
    setSavingAppearance(true);
    const payload: ProfileBackground = {
      mode: bgMode,
      color: BACKGROUND_COLORS.find((color) => color.id === selectedTint)?.color ?? selectedTint,
      pattern: selectedPattern,
      gradient: selectedGradient,
      image_url: bg?.image_url ?? null,
      strength,
      cardBorders,
      accentMode,
      accentColor: accentMode === "custom" ? customAccent : null,
      density,
      bannerOverlay,
      bannerCaptionPosition,
    };
    const { error } = await supabase
      .from("profiles")
      .update({ background: hasAppearanceSettings(payload) ? payload : null })
      .eq("id", me.userId);
    setSavingAppearance(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Appearance saved");
    refreshUser();
  }

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Account, security, and what you want to hear about — all in one place.
          </p>
        </header>

        <div className="space-y-8">
          {/* Account & security */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Account &amp; security
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The email you signed up with and your sign-in password.
            </p>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface-elevated/40 px-3 py-2">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm">{authUser?.email ?? "—"}</span>
                </div>
              </div>

              <form onSubmit={changeEmail} className="space-y-3 border-t border-border/60 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-email">Change email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      autoComplete="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={changingEmail || !newEmail}
                  >
                    {changingEmail ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Update email"
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  We email a confirmation link to your new address (and a heads-up to your current
                  one). The change only takes effect once you confirm it.
                </p>
              </form>

              <form onSubmit={changePassword} className="space-y-3 border-t border-border/60 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" disabled={changingPassword || !newPassword}>
                    {changingPassword ? "Updating…" : "Update password"}
                  </Button>
                </div>
              </form>
            </div>
          </section>

          {/* Appearance */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Paintbrush className="h-4 w-4 text-muted-foreground" />
              Appearance
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Customize how Tethyr looks and feels.
            </p>

            <div className="mt-4 space-y-4">
              {/* Theme */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">Light, dark, or system</p>
                </div>
                <ThemeToggle variant="icon" />
              </div>

              {/* Background Mode */}
              <div className="space-y-2">
                <p className="font-medium">Background</p>
                <div className="flex gap-1">
                  {(["color", "pattern", "gradient"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setBgMode(mode)}
                      className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${
                        bgMode === mode
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface text-muted-foreground hover:bg-surface/80"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {bgMode === "color" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {BACKGROUND_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedTint(c.id)}
                        aria-label={c.label}
                        className={`h-7 w-7 rounded-full border-2 transition ${
                          selectedTint === c.id
                            ? "border-primary scale-110"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.color }}
                      />
                    ))}
                  </div>
                )}

                {bgMode === "pattern" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {BACKGROUND_PATTERNS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPattern(p.id)}
                        className={`rounded-md px-3 py-1.5 text-sm transition ${
                          selectedPattern === p.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface text-muted-foreground hover:bg-surface/80"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}

                {bgMode === "gradient" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {BACKGROUND_GRADIENTS.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setSelectedGradient(g.id)}
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition ${
                          selectedGradient === g.id
                            ? "border-primary scale-110"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                        }}
                        aria-label={g.label}
                      />
                    ))}
                  </div>
                )}

                {/* Strength slider */}
                <div className="flex items-center gap-3 pt-1">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                    Strength
                  </Label>
                  <input
                    type="range"
                    min={BACKGROUND_MIN_STRENGTH}
                    max={BACKGROUND_MAX_STRENGTH}
                    value={strength}
                    onChange={(e) => setStrength(clampStrength(Number(e.target.value)))}
                    className="flex-1 accent-primary"
                  />
                  <span className="w-8 text-right text-xs text-muted-foreground">{strength}</span>
                </div>
              </div>

              {/* Accent Color */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Accent Color</p>
                  <p className="text-sm text-muted-foreground">
                    {accentMode === "dynamic" ? "Follows your banner" : "Custom accent"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customAccent}
                    onChange={(e) => setCustomAccent(e.target.value)}
                    disabled={accentMode === "dynamic"}
                    className="h-7 w-7 cursor-pointer rounded-md border border-border disabled:opacity-40"
                  />
                  <div className="flex gap-1">
                    {(["dynamic", "custom"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setAccentMode(mode)}
                        className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${
                          accentMode === mode
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface text-muted-foreground hover:bg-surface/80"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Density */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Density</p>
                  <p className="text-sm text-muted-foreground">Spacing between elements</p>
                </div>
                <div className="flex gap-1">
                  {(["comfortable", "compact"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDensity(d)}
                      className={`rounded-md px-3 py-1.5 text-sm transition ${
                        density === d
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface text-muted-foreground hover:bg-surface/80"
                      }`}
                    >
                      {d === "comfortable" ? "Comfortable" : "Compact"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Borders */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Card Borders</p>
                  <p className="text-sm text-muted-foreground">How card edges are styled</p>
                </div>
                <div className="flex gap-1">
                  {(["neutral", "accent", "none"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setCardBorders(b)}
                      className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${
                        cardBorders === b
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface text-muted-foreground hover:bg-surface/80"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-border/60 pt-4">
                <div>
                  <p className="font-medium">Studio banner</p>
                  <p className="text-sm text-muted-foreground">
                    Use the same banner treatment on Dashboard and Studio.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(["none", "soft", "strong"] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setBannerOverlay(value)}
                      className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${bannerOverlay === value ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-surface/80"}`}
                    >
                      {value === "none" ? "No overlay" : `${value} overlay`}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(["left", "center", "right"] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setBannerCaptionPosition(value)}
                      className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${bannerCaptionPosition === value ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-surface/80"}`}
                    >
                      Caption {value}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={saveAppearance} disabled={savingAppearance} className="w-full">
                {savingAppearance ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Save appearance
              </Button>
            </div>
          </section>

          {/* Notifications */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Notifications
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Mute whole categories — anything you mute stops appearing in the bell and the
              notifications page.
            </p>
            <div className="mt-4 space-y-1.5">
              {ALL_CATEGORIES.map((category) => {
                const muted = prefs.isMuted(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => prefs.toggle(category)}
                    aria-pressed={muted}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                      muted
                        ? "border-border/60 bg-surface-elevated/40"
                        : "border-border/60 bg-background/40 hover:bg-surface-elevated/40"
                    }`}
                  >
                    <span className="text-sm">{CATEGORY_LABELS[category]}</span>
                    <span
                      className={`flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition ${
                        muted
                          ? "justify-start border-border bg-surface-sunken"
                          : "justify-end border-primary/30 bg-primary"
                      }`}
                      aria-hidden="true"
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full text-background ${
                          muted ? "bg-muted-foreground/60" : "bg-primary-foreground"
                        }`}
                      >
                        {!muted && <Check className="h-3 w-3" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Unmuted = shown · Muted = hidden. Preferences follow your account across devices.
            </p>
          </section>

          {/* Where things live */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-muted-foreground" />
              Your space
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Editing for your identity, appearance, skills, and schedule lives with the surface it
              changes.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                to="/profile"
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-sm transition hover:bg-surface-elevated/40"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                Studio — identity, skills, links
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-sm transition hover:bg-surface-elevated/40"
              >
                <Palette className="h-4 w-4 text-muted-foreground" />
                Studio — appearance
              </Link>
              <Link
                to="/sessions"
                search={{ tab: "availability" }}
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-sm transition hover:bg-surface-elevated/40"
              >
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Sessions — weekly schedule
              </Link>
              <Link
                to="/notifications"
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-sm transition hover:bg-surface-elevated/40"
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                Notifications page
              </Link>
            </div>
          </section>

          {/* Sign out */}
          <section className="rounded-lg border border-border/60 bg-surface-elevated/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  Signed in as {authUser?.email ?? "member"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Signing out returns you to the login page.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut} className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            </div>
          </section>

          {/* Danger zone */}
          <section className="rounded-lg border border-destructive/25 bg-destructive/5 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Delete account
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanently removes your account, profile, projects, and all of your data. This can't
              be undone.
            </p>
            <div className="mt-4">
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete account
              </Button>
            </div>
          </section>
        </div>
      </div>

      {/* Confirm deletion — typing your email proves you understand what's being removed. */}
      <Dialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your profile, projects, messages, and reputation — there's no
              undo. Type <span className="font-medium text-foreground">{authUser?.email}</span> to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Label htmlFor="confirm-delete-email">Your email</Label>
            <Input
              id="confirm-delete-email"
              type="email"
              autoComplete="off"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={authUser?.email ?? "you@example.com"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting || confirmEmail.trim() !== (authUser?.email ?? "")}
              onClick={handleDeleteAccount}
              className="gap-1.5"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete forever"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
