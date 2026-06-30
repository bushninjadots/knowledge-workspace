import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell } from "@/components/tethyr/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Alex" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="handle">Handle</Label>
            <Input id="handle" placeholder="@alex" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@studio.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="At least 8 characters" required />
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
        <Button type="submit" variant="brand" className="w-full">
          Create my profile
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By joining you agree to keep the network kind and credit your teachers.
        </p>
      </form>
    </AuthShell>
  );
}
