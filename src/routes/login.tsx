import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/tethyr/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { safeRedirectPath } from "@/lib/validators";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Tethyr" },
      { name: "description", content: "Log in to your Tethyr account." },
    ],
  }),
  component: LoginPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
});

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  // Optional ?redirect=/path — send the user back after a successful login.
  // Only same-origin absolute paths are honored (open-redirect guard).
  const { redirect: redirectParam } = useSearch({ strict: false }) as {
    redirect?: string;
  };
  const redirectTarget = safeRedirectPath(redirectParam) ?? "/dashboard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Welcome back");
      navigate({ to: redirectTarget });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset() {
    if (!email.trim()) {
      toast.error("Enter your email first");
      return;
    }
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Check your email for a password reset link");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue building and growing."
      footer={
        <>
          New to Tethyr?{" "}
          <Link
            to="/signup"
            search={redirectParam ? { redirect: redirectParam } : undefined}
            className="text-primary hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@studio.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={requestPasswordReset}
              disabled={resetting}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {resetting ? "Sending…" : "Forgot password?"}
            </button>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}
