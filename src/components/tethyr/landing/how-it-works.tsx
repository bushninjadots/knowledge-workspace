import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass, FolderKanban, UserPlus } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Claim your profile",
      desc: "Add your handle, your craft, and the skills you share or want to grow. Your profile tells the story of what you've built.",
      icon: UserPlus,
      href: "/signup",
      cta: "Start building",
    },
    {
      n: "02",
      title: "Find collaborators",
      desc: "Explore projects, open roles, and community spaces. Connect with builders working on the same things — matched by complementary skills.",
      icon: Compass,
      href: "/explore",
      cta: "Discover",
    },
    {
      n: "03",
      title: "Build & earn recognition",
      desc: "Join a project, contribute, and share progress. Every contribution builds your reputation — recognition comes from what you make, not what you claim.",
      icon: FolderKanban,
      href: "/community",
      cta: "See the community",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mb-12 max-w-2xl">
        <p className="section-label mb-3">How it works</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Build, connect, get recognized
        </h2>
        <p className="mt-3 text-muted-foreground">
          Three steps from claiming your identity to earning recognition through real work — not
          résumés.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.n}
            className="group relative overflow-hidden rounded-xl bg-surface-elevated/30 p-6 transition hover:bg-surface-elevated/50"
          >
            <span className="numeric text-xs font-medium text-muted-foreground-subtle">
              {step.n}
            </span>
            <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-surface-elevated">
              <step.icon className="h-4 w-4 text-foreground" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            <Link
              to={step.href}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition group-hover:gap-2.5"
            >
              {step.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
