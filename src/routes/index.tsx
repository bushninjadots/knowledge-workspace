import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/tethyr/navbar";
import { Footer } from "@/components/tethyr/footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tethyr — Where people build together" },
      {
        name: "description",
        content:
          "A collaborative network where people discover, build, collaborate, and grow. People become known through what they build together.",
      },
    ],
  }),
  component: HomePage,
});

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
              Where people <span className="text-gradient-brand">build together</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Build together. Grow together. People share what they know, grow their skills, and become known through what they build together.
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
              Claim your handle and join the first wave of people building Tethyr together. People
              become known through what they build.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
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
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
