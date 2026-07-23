import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Video,
  Palette,
  Camera,
  Music,
  Code,
  Search,
  Youtube,
  Twitch,
  PencilRuler,
  ArrowRight,
} from "lucide-react";
import { Navbar } from "@/components/tethyr/navbar";
import { Footer } from "@/components/tethyr/footer";
import { Button } from "@/components/ui/button";
import { IconLearn, IconTeach, IconConnect, IconGrow } from "@/components/tethyr/icons-system";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tethyr — Where creators build together" },
      {
        name: "description",
        content:
          "A premium creative campus where creators discover, learn, collaborate, and grow. People become known through what they build together.",
      },
    ],
  }),
  component: HomePage,
});

const loopSteps = [
  { label: "Discover", color: "text-primary" },
  { label: "Learn", color: "text-secondary" },
  { label: "Collaborate", color: "text-primary" },
  { label: "Build", color: "text-secondary" },
  { label: "Share", color: "text-primary" },
  { label: "Earn", color: "text-secondary" },
  { label: "Grow", color: "text-primary" },
];

const rooms = [
  {
    icon: Palette,
    title: "Projects",
    desc: "Creative studios where ideas become reality",
    accent: "green" as const,
  },
  {
    icon: Code,
    title: "Skills",
    desc: "Workshops for teaching and learning craft",
    accent: "purple" as const,
  },
  {
    icon: Sparkles,
    title: "Community",
    desc: "Open space for conversations and connections",
    accent: "green" as const,
  },
  {
    icon: Video,
    title: "Messages",
    desc: "Meeting table for deeper collaboration",
    accent: "purple" as const,
  },
];

const audiences = [
  { icon: Video, label: "Video Editors" },
  { icon: Palette, label: "Graphic Designers" },
  { icon: PencilRuler, label: "Motion Designers" },
  { icon: Camera, label: "Photographers" },
  { icon: Youtube, label: "YouTubers" },
  { icon: Twitch, label: "Streamers" },
  { icon: Search, label: "SEO Specialists" },
  { icon: Sparkles, label: "WordPress Pros" },
  { icon: Code, label: "Developers" },
  { icon: Music, label: "Musicians" },
];

const pillars = [
  {
    icon: IconLearn,
    title: "Discover",
    body: "Find creators who've mastered what you're learning. Real knowledge from people who've done the work.",
    accent: "green" as const,
  },
  {
    icon: IconConnect,
    title: "Collaborate",
    body: "Swap skills with other creators. Build projects together. Connections that turn into partnerships.",
    accent: "purple" as const,
  },
  {
    icon: IconGrow,
    title: "Grow",
    body: "Your reputation grows with everything you teach and build. Become known through what you create.",
    accent: "green" as const,
  },
];

function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden bg-noise">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
        <div
          className="pointer-events-none absolute top-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, oklch(0.92 0.23 142 / 0.3), oklch(0.65 0.26 305 / 0.2), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-28 sm:px-6 sm:pt-32 sm:pb-36">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm animate-stagger">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow-green" />
              Early access — now open
            </span>
            <h1 className="mt-8 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
              Where creators <span className="text-gradient-brand">build together</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Skills for skills. Creators teach each other, learn from each other, and become known
              through what they build together.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="default"
                className="shadow-glow-green transition-lift"
              >
                <Link to="/signup">
                  Join Tethyr <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="transition-lift">
                <Link to="/login">Log in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-border/60 bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-10">
            The creative cycle
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {loopSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3 sm:gap-4">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-lift hover:-translate-y-0.5 ${step.color}`}
                >
                  {step.label}
                </span>
                {i < loopSteps.length - 1 && <span className="hidden text-border sm:block">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center mb-14">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            Every room serves a purpose
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tethyr is organized into rooms — each one designed for a different part of the creative
            process.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {rooms.map((room, i) => (
            <div
              key={room.title}
              className={`group relative overflow-hidden rounded-3xl border border-border/60 bg-surface p-6 transition-lift hover:-translate-y-1 hover:border-primary/40 animate-room-enter animate-stagger inner-glow`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <span
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                  room.accent === "green"
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary/15 text-secondary"
                }`}
              >
                <room.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">{room.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{room.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center mb-14">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            Three pillars, one campus
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every creator is a teacher and a student. Tethyr makes that trade simple, safe, and
            genuinely fun.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {pillars.map((p, i) => (
            <div
              key={p.title}
              className={`group relative overflow-hidden rounded-3xl border border-border/60 bg-surface p-8 transition-lift hover:-translate-y-1 hover:border-primary/40 inner-glow animate-stagger`}
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <span
                className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${
                  p.accent === "green"
                    ? "bg-primary/10 text-primary shadow-glow-green"
                    : "bg-secondary/15 text-secondary shadow-glow-purple"
                }`}
              >
                <p.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-6 font-display text-xl font-semibold">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-8">
            Built for
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {audiences.map((a, i) => (
              <span
                key={a.label}
                className={`inline-flex items-center gap-2.5 rounded-full border border-border/60 bg-background/60 px-5 py-2.5 text-sm text-muted-foreground backdrop-blur-sm transition-lift hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground animate-stagger`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <a.icon className="h-4 w-4 text-primary" />
                {a.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-border/60 bg-surface p-12 text-center sm:p-20">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" />
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(ellipse at 30% 0%, oklch(0.92 0.23 142 / 0.2), transparent 50%), radial-gradient(ellipse at 70% 100%, oklch(0.65 0.26 305 / 0.2), transparent 50%)",
            }}
          />
          <div className="relative">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl lg:text-5xl">
              Ready to build something <span className="text-gradient-brand">together</span>?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
              Claim your handle and join the first wave of creators building Tethyr together. People
              become known through what they build.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="brand"
                className="shadow-glow-green transition-lift"
              >
                <Link to="/signup">
                  Create your profile <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="transition-lift">
                <Link to="/login">I already have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
