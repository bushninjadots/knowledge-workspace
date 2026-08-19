import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { AuthShell } from "@/components/tethyr/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-error";
import { safeRedirectPath } from "@/lib/validators";
import { canonicalLinks, robotsMeta } from "@/lib/seo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Tethyr" },
      { name: "description", content: "Set a new password for your Tethyr account." },
      ...robotsMeta(),
    ],
    links: canonicalLinks("/reset-password"),
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { redirect: redirectParam } = useSearch({ strict: false }) as {
    redirect?: string;
  };
  const redirectTarget = safeRedirectPath(redirectParam) ?? "/dashboard";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const authStateResolved = useRef(false);

  useEffect(() => {
    let active = true;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        authStateResolved.current = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        setHasSession(!!session);
        setSessionChecked(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        authStateResolved.current = true;
        setHasSession(true);
        setSessionChecked(true);
        return;
      }
      if (authStateResolved.current) return;
      // Supabase can establish the recovery session asynchronously from the
      // URL hash. Give PASSWORD_RECOVERY a chance to arrive before showing an
      // expired-link state.
      fallbackTimer = setTimeout(() => {
        if (!active || authStateResolved.current) return;
        setHasSession(false);
        setSessionChecked(true);
      }, 1500);
    });

    return () => {
      active = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    if (password !== confirmation) {
      errors.confirmPassword = "Passwords do not match";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(friendlyError(error));
        return;
      }
      toast.success("Password updated");
      navigate({ to: redirectTarget });
    } catch (err) {
      toast.error(
        getAuthErrorMessage(err, "Something went wrong. Please request a new reset link."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a new password and get back to building."
      footer={
        <>
          Remembered your password?{" "}
          <Link
            to="/login"
            search={redirectParam ? { redirect: redirectParam } : undefined}
            className="text-primary hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      {!sessionChecked ? (
        <p className="text-center text-sm text-muted-foreground">Checking your reset link…</p>
      ) : !hasSession ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            This reset link is invalid or has expired. Request a new one from the login page.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Back to login</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: "" }));
              }}
              aria-describedby={fieldErrors.password ? "new-password-error" : undefined}
              aria-invalid={!!fieldErrors.password}
            />
            {fieldErrors.password && (
              <p id="new-password-error" className="text-sm text-destructive mt-1">
                {fieldErrors.password}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              minLength={8}
              required
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                if (fieldErrors.confirmPassword)
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              aria-describedby={fieldErrors.confirmPassword ? "confirm-password-error" : undefined}
              aria-invalid={!!fieldErrors.confirmPassword}
            />
            {fieldErrors.confirmPassword && (
              <p id="confirm-password-error" className="text-sm text-destructive mt-1">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
