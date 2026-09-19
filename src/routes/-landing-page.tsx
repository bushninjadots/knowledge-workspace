// Landing page sections + hero. Code-split from the eager route surface
// (loader prefetch + SEO head) in index.tsx so the entry chunk stays small.
import { lazy, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useAuthUser } from "@/hooks/use-current-user";
import { Navbar } from "@/components/tethyr/navbar";
import { Footer } from "@/components/tethyr/footer";
import { HeroShowcase } from "@/components/tethyr/landing/hero-showcase";
import { LandingStats } from "@/components/tethyr/landing/landing-stats";
import { HeroActions } from "@/components/tethyr/hero-actions";
import { Button } from "@/components/ui/button";

// Below-the-fold landing sections are code-split so their JS stays off the
// initial critical path — the landing bundle's size was the dominant driver of
// the page's total blocking time. They still stream in via Suspense during SSR,
// so search engines keep seeing the full page.
const SectionReveal = lazy(() =>
  import("@/components/tethyr/section-reveal").then((m) => ({ default: m.SectionReveal })),
);
const HowItWorks = lazy(() =>
  import("@/components/tethyr/landing/how-it-works").then((m) => ({ default: m.HowItWorks })),
);
const TrendingSkills = lazy(() =>
  import("@/components/tethyr/landing/trending-skills").then((m) => ({
    default: m.TrendingSkills,
  })),
);
const FeaturedProjects = lazy(() =>
  import("@/components/tethyr/landing/featured-projects").then((m) => ({
    default: m.FeaturedProjects,
  })),
);
const RecentActivity = lazy(() =>
  import("@/components/tethyr/landing/recent-activity").then((m) => ({
    default: m.RecentActivity,
  })),
);
const CommunitySpaces = lazy(() =>
  import("@/components/tethyr/landing/community-spaces").then((m) => ({
    default: m.CommunitySpaces,
  })),
);
const Faq = lazy(() => import("@/components/tethyr/landing/faq").then((m) => ({ default: m.Faq })));

function SectionSkeleton() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-hidden="true">
      <div className="mb-10 space-y-3">
        <div className="h-3 w-24 animate-gentle-pulse rounded bg-surface-elevated" />
        <div className="h-8 w-72 animate-gentle-pulse rounded bg-surface-elevated" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-44 animate-gentle-pulse rounded-xl border border-border/60 bg-surface"
          />
        ))}
      </div>
    </section>
  );
}

function scrollToContent() {
  document.getElementById("main-content")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

export function HomePage() {
  const { data: authUser, isLoading: authLoading } = useAuthUser();
  const isAuthed = Boolean(authUser?.id);
  const ctaReady = !authLoading;

  return (
    <div className="min-h-screen bg-background">
      <Navbar publicOnly />

      <section className="relative overflow-hidden bg-noise">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground animate-stagger">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Early access — now open
              </span>
              <h1 className="mt-7 max-w-3xl font-display text-[3.25rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl md:text-7xl lg:text-[5.75rem]">
                Build together.
                <br />
                Get known for what you make
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl lg:mx-0">
                The collaboration network where builders create projects together, grow through real
                contributions, and earn recognition for the work they do — not the claims they make.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
                {!ctaReady ? (
                  <div className="h-12 w-40 animate-gentle-pulse rounded-full bg-surface-elevated" />
                ) : isAuthed ? (
                  <>
                    <Button asChild size="lg" variant="default" className="transition-lift">
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
                    <Button asChild size="lg" variant="default" className="transition-lift">
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
          className="absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2.5 text-muted-foreground/80 transition-lift hover:text-foreground"
        >
          <span className="text-[11px] font-medium tracking-[0.25em] uppercase">Scroll</span>
          <span className="h-9 w-px animate-scroll-line bg-gradient-to-b from-muted-foreground/80 to-transparent" />
        </button>
      </section>

      <LandingStats />
      {/* Same id as every other frame so the global skip link lands here too */}
      <main id="main-content">
        <SectionReveal id="how-it-works" className="content-visibility-auto">
          <Suspense fallback={<SectionSkeleton />}>
            <HowItWorks />
          </Suspense>
        </SectionReveal>
        <SectionReveal id="trending-skills" className="content-visibility-auto">
          <Suspense fallback={<SectionSkeleton />}>
            <TrendingSkills />
          </Suspense>
        </SectionReveal>
        <SectionReveal id="featured-projects" className="content-visibility-auto">
          <Suspense fallback={<SectionSkeleton />}>
            <FeaturedProjects />
          </Suspense>
        </SectionReveal>
        <SectionReveal id="recent-activity" className="content-visibility-auto">
          <Suspense fallback={<SectionSkeleton />}>
            <RecentActivity />
          </Suspense>
        </SectionReveal>
        <SectionReveal id="community-spaces" className="content-visibility-auto">
          <Suspense fallback={<SectionSkeleton />}>
            <CommunitySpaces />
          </Suspense>
        </SectionReveal>
        <SectionReveal>
          <Suspense fallback={<SectionSkeleton />}>
            <Faq />
          </Suspense>
        </SectionReveal>
      </main>

      <Suspense fallback={<SectionSkeleton />}>
        <SectionReveal>
          <section className="px-4 py-24 sm:px-6">
            <div className="relative mx-auto max-w-5xl overflow-hidden rounded-xl border border-border/60 bg-surface p-12 text-center sm:p-20">
              <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" />
              <div className="relative">
                <h2 className="font-display text-3xl font-semibold sm:text-4xl lg:text-5xl">
                  Ready to build something together?
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
                  Claim your handle, start a project, and join builders creating work that speaks
                  for itself. You're known by what you make — not what you claim.
                </p>
                <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  {!ctaReady ? (
                    <div className="h-12 w-48 animate-gentle-pulse rounded-full bg-surface-elevated" />
                  ) : isAuthed ? (
                    <>
                      <Button asChild size="lg" variant="default" className="transition-lift">
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
                      <Button asChild size="lg" variant="default" className="transition-lift">
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
      </Suspense>

      <Footer />
    </div>
  );
}
