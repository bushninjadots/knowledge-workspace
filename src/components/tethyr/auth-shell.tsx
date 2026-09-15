import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { TethyrBall } from "./tethyr-ball";
import { useOnlineStatus } from "@/hooks/use-online-status";

function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-2 rounded-xl border border-caution/30 bg-caution/10 px-4 py-3 text-sm text-caution-foreground"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        You're offline. Check your connection — sign in and sign up need access to the server.
      </span>
    </div>
  );
}

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

      <div className="relative w-full max-w-md animate-room-enter">
        <div className="mb-8 flex justify-center">
          <TethyrBall size="md" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-8">
          <OfflineNotice />
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
    </div>
  );
}
