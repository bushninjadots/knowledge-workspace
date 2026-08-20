import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/tethyr/auth-shell";
import { OAuthButtons } from "@/components/tethyr/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-error";
import { safeRedirectPath } from "@/lib/validators";
import { useSkillsCatalog } from "@/hooks/use-current-user";
import { canonicalLinks, robotsMeta } from "@/lib/seo";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Tethyr" },
      {
        name: "description",
        content:
          "Join Tethyr — the collaboration network where builders create projects together and get known for what they make.",
      },
      ...robotsMeta(),
    ],
    links: canonicalLinks("/signup"),
  }),
  component: SignupPage,
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  ),
});

function SignupPage() {
  // Optional ?redirect=/path — continue to the intended page after signup.
  // Only same-origin absolute paths are honored (open-redirect guard).
  const { redirect: redirectParam } = useSearch({ strict: false }) as {
    redirect?: string;
  };
  const redirectTarget = safeRedirectPath(redirectParam) ?? "/dashboard";
  const { data: skills = [], isLoading: skillsLoading } = useSkillsCatalog();
  const [craft, setCraft] = useState<string | null>(null);
  const skillChoices = useMemo(() => skills.slice(0, 36), [skills]);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    const cleanHandle = handle.replace(/^@/, "").trim();
    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(cleanHandle)) {
      errors.handle = "Handle must be 1–30 characters: letters, numbers, _ or -";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const cleanHandle = handle.replace(/^@/, "").trim();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectTarget}`,
          data: {
            display_name: name,
            handle: cleanHandle,
            craft,
          },
        },
      });
      if (error) {
        toast.error(getAuthErrorMessage(error));
        return;
      }
      if (!data.session) {
        toast.success("Check your email to confirm your account");
        return;
      }
      toast.success("Welcome to Tethyr ✨");
      navigate({ to: redirectTarget });
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Start building"
      subtitle="Claim your handle, pick your craft, and join builders creating work that speaks for itself."
      footer={
        <>
          Already a member?{" "}
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
      <div className="space-y-4">
        <OAuthButtons redirectTarget={redirectTarget} />
        <div className="flex items-center gap-3" role="separator" aria-label="or">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      </div>
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Alex"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="handle">Handle</Label>
            <Input
              id="handle"
              placeholder="@alex"
              required
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                if (fieldErrors.handle) setFieldErrors((prev) => ({ ...prev, handle: "" }));
              }}
              aria-describedby={fieldErrors.handle ? "handle-error" : undefined}
              aria-invalid={!!fieldErrors.handle}
            />
            {fieldErrors.handle && (
              <p id="handle-error" className="text-sm text-destructive mt-1">
                {fieldErrors.handle}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@studio.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: "" }));
            }}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            aria-invalid={!!fieldErrors.password}
          />
          {fieldErrors.password && (
            <p id="password-error" className="text-sm text-destructive mt-1">
              {fieldErrors.password}
            </p>
          )}
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-foreground">Your main craft</legend>
          <p className="text-xs text-muted-foreground">
            Choose the closest match. You can add more skills after joining.
          </p>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
            {(skillsLoading ? [] : skillChoices).map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => setCraft(skill.name)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  craft === skill.name
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                }`}
              >
                {skill.name}
              </button>
            ))}
            {!skillsLoading && skillChoices.length === 0 && (
              <span className="text-xs text-muted-foreground">
                You can choose skills in your studio after joining.
              </span>
            )}
          </div>
        </fieldset>
        <Button type="submit" variant="default" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create my profile"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Let's build with respect and keep Tethyr a place where creators thrive.
        </p>
      </form>
    </AuthShell>
  );
}
