import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { TethyrBall } from "./tethyr-ball";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background bg-noise px-4 py-12">
      {/* Grid pattern */}
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />

      {/* Animated floating orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/4 h-[480px] w-[480px] rounded-full opacity-20 blur-3xl animate-[orb-drift_12s_ease-in-out_infinite_alternate]"
          style={{ background: "radial-gradient(circle, var(--brand-purple), transparent 60%)" }}
        />
        <div
          className="absolute -bottom-32 right-1/4 h-[360px] w-[360px] rounded-full opacity-15 blur-3xl animate-[orb-drift_10s_ease-in-out_infinite_alternate-reverse]"
          style={{ background: "radial-gradient(circle, var(--brand-green), transparent 60%)" }}
        />
        <div
          className="absolute top-1/3 right-1/6 h-[200px] w-[200px] rounded-full opacity-10 blur-3xl animate-[orb-drift_14s_ease-in-out_infinite_alternate]"
          style={{ background: "radial-gradient(circle, var(--brand-green), transparent 60%)" }}
        />
      </div>

      <div className="relative w-full max-w-md animate-room-enter">
        <div className="mb-8 flex justify-center">
          <TethyrBall size="md" />
        </div>
        <div className="rounded-3xl border border-border/60 bg-surface/80 p-8 shadow-card backdrop-blur-xl bg-noise">
          <div className="mb-6 space-y-1 text-center">
            <h1 className="font-display text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes orb-drift {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.05); }
          100% { transform: translate(-20px, 15px) scale(0.95); }
        }
`}</style>
    </div>
  );
}
