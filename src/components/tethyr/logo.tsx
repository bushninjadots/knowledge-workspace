import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 group ${className}`}>
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-brand glow-purple">
        <span className="font-display text-base font-bold text-background">T</span>
      </span>
      <span className="font-display text-xl font-semibold tracking-tight">Tethyr</span>
    </Link>
  );
}
