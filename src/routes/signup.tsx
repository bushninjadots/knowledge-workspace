import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/tethyr/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Tethyr" },
      { name: "description", content: "Join the Tethyr knowledge network for creators." },
    ],
  }),
  component: SignupPage,
});

const crafts = [
  "Video Editing",
  "Graphic Design",
  "Motion Design",
  "Photography",
  "YouTube",
  "Streaming",
  "SEO",
  "WordPress",
  "Development",
  "Music",
];

function SignupPage() {
  const [craft, setCraft] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const cleanHandleCheck = handle.replace(/^@/, "").trim();
    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(cleanHandleCheck)) {
      toast.error("Handle must be 1–30 characters: letters, numbers, _ or -");
      return;
    }
    setLoading(true);
    const cleanHandle = handle.replace(/^@/, "").trim();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          display_name: name,
          handle: cleanHandle,
          craft,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome to Tethyr ✨");
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthShell
      title="Join Tethyr"
      subtitle="Claim your handle and start trading skills."
      footer={
        <>
          Already a member?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
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
              onChange={(e) => setHandle(e.target.value)}
            />
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
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Your main craft</Label>
          <div className="flex flex-wrap gap-2">
            {crafts.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCraft(c)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  craft === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" variant="brand" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create my profile"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By joining you agree to keep the network kind and credit your teachers.
        </p>
      </form>
    </AuthShell>
  );
}
