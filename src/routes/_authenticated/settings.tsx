import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-current-user";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { CATEGORY_LABELS, ALL_CATEGORIES } from "@/lib/notification-categories";
import { deleteAccount } from "@/lib/account-server";
import { friendlyError } from "@/lib/error-message";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Tethyr" },
      {
        name: "description",
        content: "Manage your account, security, and notification preferences.",
      },
    ],
  }),
  component: SettingsPage,
});

export function SettingsPage() {
  const navigate = useNavigate();
  const { data: authUser } = useAuthUser();
  const prefs = useNotificationPreferences();

  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

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
