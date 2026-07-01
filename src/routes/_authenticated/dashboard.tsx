import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Bell, Search } from "lucide-react";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tethyr" },
      { name: "description", content: "Your Tethyr dashboard." },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = pathname === "/dashboard";
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">
            <DashboardSidebar onNavigate={() => setOpen(false)} />
          </div>
          <button
            className="absolute right-4 top-4 rounded-full bg-surface p-2"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
          <button
            className="rounded-full p-2 hover:bg-surface md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative hidden flex-1 max-w-md sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search creators, skills, sessions…"
              className="h-10 rounded-full border-border/60 bg-surface/60 pl-9"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-sm font-semibold text-background">
              A
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8">{isIndex ? <DashboardHome /> : <Outlet />}</main>
      </div>
    </div>
  );
}

function DashboardHome() {
  const stats = [
    { label: "Skills offered", value: "0", hint: "Add your first one" },
    { label: "Sessions taught", value: "0", hint: "Teach to earn trust" },
    { label: "Sessions learned", value: "0", hint: "Find a mentor" },
    { label: "Trust score", value: "—", hint: "Builds with activity" },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-3xl border border-border/60 bg-surface p-8 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--brand-purple), transparent 60%)" }}
        />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Welcome to Tethyr
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
          Let's get you <span className="text-gradient-brand">connected</span>.
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Finish your profile, list one skill you can teach, and tell us one skill you want to
          learn. That's it — Tethyr does the rest.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="default" asChild>
            <a href="/profile">Complete profile</a>
          </Button>
          <Button variant="outline">Browse creators</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-surface p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
