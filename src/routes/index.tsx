import { lazy, Suspense } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useAuthUser } from "@/hooks/use-current-user";
import {
  fetchFeaturedProjects,
  fetchLandingStats,
  fetchRecentActivity,
} from "@/components/tethyr/landing/data";
import { Navbar } from "@/components/tethyr/navbar";
import { Footer } from "@/components/tethyr/footer";
import { HeroShowcase } from "@/components/tethyr/landing/hero-showcase";
import { LandingStats } from "@/components/tethyr/landing/landing-stats";
import { HeroActions } from "@/components/tethyr/hero-actions";
const SectionReveal = lazy(() =>
  import("@/components/tethyr/section-reveal").then((m) => ({ default: m.SectionReveal })),
);
import { Button } from "@/components/ui/button";
import { absoluteUrl, jsonLd, seoMeta, SITE } from "@/lib/seo";

// Below-the-fold landing sections are code-split so their JS stays off the
// initial critical path — the landing bundle's size was the dominant driver of
// the page's total blocking time. They still stream in via Suspense during SSR,
// so search engines keep seeing the full page.
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

function SectionSkeleton() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-hidden="true">
      <div className="mb-10 space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-surface-elevated" />
        <div className="h-8 w-72 animate-pulse rounded bg-surface-elevated" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-xl border border-border/60 bg-surface"
          />
        ))}
      </div>
    </section>
  );
}

function scrollToContent() {
  document.getElementById("landing-content")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    // Prefetch the landing sections so their content streams with the SSR
    // HTML — no skeleton flash, no client refetch, and no hydration
    // mismatch when the client cache is warm on repeat visits.
    await Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ["landing-stats"],
        queryFn: fetchLandingStats,
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ["landing-featured-projects"],
        queryFn: fetchFeaturedProjects,
        staleTime: 60_000,
      }),
      queryClient.prefetchQuery({
        queryKey: ["landing-activity"],
        queryFn: fetchRecentActivity,
        staleTime: 60_000,
      }),
    ]);
    return {};
  },
  head: () => {
    const base = seoMeta({ path: "/", title: SITE.tagline, description: SITE.description });
    const siteUrl = absoluteUrl("/");
    return {
      ...base,
      meta: [
        ...base.meta,
        ...jsonLd(
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE.name,
            description: SITE.description,
            ...(siteUrl ? { url: siteUrl } : {}),
            ...(siteUrl ? { logo: `${siteUrl}og-image.png` } : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE.name,
            description: SITE.description,
            ...(siteUrl ? { url: siteUrl } : {}),
          },
        ),
      ],
    };
  },
  component: HomePage,
});

function HomePage() {
  const { data: authUser, isLoading: authLoading } = useAuthUser();
  const isAuthed = Boolean(authUser?.id);
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
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground animate-stagger">
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
          <Suspense fallback={<SectionSkeleton />}>
            <HowItWorks />
          </Suspense>
        </SectionReveal>
        <SectionReveal>
          <Suspense fallback={<SectionSkeleton />}>
            <TrendingSkills />
          </Suspense>
        </SectionReveal>
        <SectionReveal>
          <Suspense fallback={<SectionSkeleton />}>
            <FeaturedProjects />
          </Suspense>
        </SectionReveal>
        <SectionReveal>
          <Suspense fallback={<SectionSkeleton />}>
            <RecentActivity />
          </Suspense>
        </SectionReveal>
        <SectionReveal>
          <Suspense fallback={<SectionSkeleton />}>
            <CommunitySpaces />
          </Suspense>
        </SectionReveal>
      </main>

      <Suspense fallback={<SectionSkeleton />}>
        <SectionReveal>
          <section className="px-4 py-24 sm:px-6">
            <div className="relative mx-auto max-w-5xl overflow-hidden rounded-xl border border-border/60 bg-surface p-12 text-center sm:p-20">
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
                  Claim your handle, start a project, and join builders creating work that speaks
                  for itself. You're known by what you make — not what you claim.
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
      </Suspense>

      <Footer />
    </div>
  );
}
