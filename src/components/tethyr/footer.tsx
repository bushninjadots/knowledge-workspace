import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";
import { useCurrentUser } from "@/hooks/use-current-user";

export function Footer() {
  const { data: me } = useCurrentUser();
  const isAuthed = Boolean(me?.userId);
  return (
    <footer className="border-t border-border/60 bg-surface/30 bg-noise">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4 md:max-w-sm">
          <Logo variant="horizontal" size="md" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            The collaboration network where builders create projects together, grow through real
            contributions, and become known for what they make — not what they claim.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-green animate-gentle-pulse" />
            Active community
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 md:gap-12">
          {isAuthed && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
                Platform
              </h3>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link
                    to="/dashboard"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    to="/explore"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Projects
                  </Link>
                </li>
                <li>
                  <Link
                    to="/community"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Community
                  </Link>
                </li>
                <li>
                  <Link
                    to="/settings"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Settings
                  </Link>
                </li>
              </ul>
            </div>
          )}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              {isAuthed ? "Connect" : "Get started"}
            </h3>
            <ul className="space-y-2.5 text-sm">
              {!isAuthed && (
                <>
                  <li>
                    <Link
                      to="/signup"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Join Tethyr
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/login"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Log In
                    </Link>
                  </li>
                </>
              )}
              {isAuthed && (
                <>
                  <li>
                    <Link
                      to="/profile"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Your Studio
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/explore"
                      search={{ tab: "creators" }}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Discover people
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Legal
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  to="/privacy"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Tethyr. Known by what you make.
          </p>
          <p className="text-xs text-muted-foreground">Build together. Grow together.</p>
        </div>
      </div>
    </footer>
  );
}
