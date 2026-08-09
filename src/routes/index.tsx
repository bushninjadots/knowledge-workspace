import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Navbar } from "@/components/tethyr/navbar";
import { Footer } from "@/components/tethyr/footer";
import {
  CommunitySpaces,
  FeaturedProjects,
  HeroShowcase,
  HowItWorks,
  LandingStats,
  RecentActivity,
  TrendingSkills,
} from "@/components/tethyr/landing-sections";
import { HeroActions } from "@/components/tethyr/hero-actions";
import { SectionReveal } from "@/components/tethyr/section-reveal";
import { Button } from "@/components/ui/button";

function scrollToContent() {
  document.getElementById("landing-content")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tethyr — Build together, get known for what you make" },
      {
        name: "description",
        content:
          "Tethyr is the collaboration network where builders create projects together, grow through real contributions, and become known for what they make — not what they claim.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: me, isLoading: authLoading } = useCurrentUser();
  const isAuthed = Boolean(me?.userId);
  const ctaReady = !authLoading;

  return (
    <div className="min-h-screen bg-background">
      <Navbar publicOnly />

      <section className="relative overflow-hidden bg-noise">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
        <div
          className="pointer-events-none absolute top-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, oklch(0.92 0.23 142 / 0.3), oklch(0.65 0.26 305 / 0.2), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-44 sm:px-6 sm:pt-32">
          <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm animate-stagger">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow-green" />
                Early access — now open
              </span>
              <h1 className="mt-8 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
                Build together.
                <br />
                Get known for <span className="text-gradient-brand">what you make</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl lg:mx-0">
                The collaboration network where builders create projects together, grow through real
                contributions, and earn recognition for the work they do — not the claims they make.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
                {!ctaReady ? (
                  <div className="h-12 w-40 animate-pulse rounded-full bg-surface-elevated" />
                ) : isAuthed ? (
                  <>
                    <Button
                      asChild
                      size="lg"
                      variant="default"
                      className="shadow-glow-green transition-lift"
                    >
                      <Link to="/dashboard">
                        Dashboard <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="transition-lift">
                      <Link to="/explore">Explore projects</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="transition-lift">
                      <Link to="/profile">Your studio</Link>
                    </Button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
            <HeroShowcase />
          </div>

          <HeroActions />
        </div>

        <button
          type="button"
          onClick={scrollToContent}
          aria-label="Scroll to content"
          className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2.5 text-muted-foreground/80 transition hover:text-foreground md:flex"
        >
          <span className="text-[11px] font-medium tracking-[0.25em] uppercase">Scroll</span>
          <span className="h-9 w-px animate-scroll-line bg-gradient-to-b from-muted-foreground/80 to-transparent" />
        </button>
      </section>

      <LandingStats />
      <main id="landing-content">
        <SectionReveal>
          <HowItWorks />
        </SectionReveal>
        <SectionReveal>
          <TrendingSkills />
        </SectionReveal>
        <SectionReveal>
          <FeaturedProjects />
        </SectionReveal>
        <SectionReveal>
          <RecentActivity />
        </SectionReveal>
        <SectionReveal>
          <CommunitySpaces />
        </SectionReveal>
      </main>

      <SectionReveal>
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
                Claim your handle, start a project, and join builders creating work that speaks for
                itself. You're known by what you make — not what you claim.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                {!ctaReady ? (
                  <div className="h-12 w-48 animate-pulse rounded-full bg-surface-elevated" />
                ) : isAuthed ? (
                  <>
                    <Button
                      asChild
                      size="lg"
                      variant="default"
                      className="shadow-glow-green transition-lift"
                    >
                      <Link to="/dashboard">
                        Back to your workspace <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="transition-lift">
                      <Link to="/explore">Explore projects</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      asChild
                      size="lg"
                      variant="default"
                      className="shadow-glow-green transition-lift"
                    >
                      <Link to="/signup">
                        Create your profile <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="transition-lift">
                      <Link to="/login">I already have an account</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </SectionReveal>

      <Footer />
    </div>
  );
}
