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
import {
  IconLearn,
  IconTeach,
  IconConnect,
  IconGrow,
} from "@/components/tethyr/icons-system";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tethyr — Connected by what you know" },
      {
        name: "description",
        content:
          "A trusted knowledge network where creators teach and learn from each other. Share knowledge instead of paying money.",
      },
    ],
  }),
  component: HomePage,
});

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
    title: "Discover new skills",
    body: "Learn from creators who've mastered their craft. Every session is real knowledge from someone who's done the work.",
    accent: "green" as const,
  },
  {
    icon: IconTeach,
    title: "Share what you know",
    body: "You're an expert at something. Teach it, mentor through it, and help others level up while you deepen your own mastery.",
    accent: "purple" as const,
  },
  {
    icon: IconConnect,
    title: "Build meaningful connections",
    body: "Swap skills with other creators. Connect over shared interests and grow a network of people who actually get what you do.",
    accent: "green" as const,
  },
];

function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-150 w-200 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, var(--brand-purple), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Now in early access for creators
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Connected by <span className="text-gradient-brand">what you know</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Tethyr is a trusted knowledge network where creators teach each other and learn from
              each other. Skills for skills — not money, not gigs, not noise.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="default">
                <Link to="/signup">
                  Join the network <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">I already have an account</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Not a marketplace. Not LinkedIn. A community.
            </p>
          </div>
        </div>
      </section>

      {/* Audience strip */}
      <section className="border-y border-border/60 bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Built for
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {audiences.map((a) => (
              <div
                key={a.label}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm transition-colors hover:border-primary/40"
              >
                <a.icon className="h-4 w-4 text-primary" />
                {a.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            People share knowledge instead of paying money.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every creator is a teacher and a student. Tethyr makes that trade simple, safe, and
            genuinely fun.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="group relative overflow-hidden rounded-3xl border border-border/60 bg-surface p-7 transition-all hover:-translate-y-1 hover:border-primary/40"
            >
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                  p.accent === "green"
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary/15 text-secondary"
                }`}
              >
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-4xl border border-border/60 bg-surface p-10 text-center sm:p-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(circle at 20% 20%, color-mix(in oklab, var(--brand-green) 25%, transparent), transparent 50%), radial-gradient(circle at 80% 80%, color-mix(in oklab, var(--brand-purple) 25%, transparent), transparent 50%)",
            }}
          />
          <div className="relative">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              Ready to teach something. Ready to learn something else.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Claim your handle and join the first wave of creators building Tethyr together.
            </p>
            <div className="mt-8 flex justify-center">
              <Button asChild size="lg" variant="brand">
                <Link to="/signup">
                  Create your profile <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
