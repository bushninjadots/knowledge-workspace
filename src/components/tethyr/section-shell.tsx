import { type CSSProperties, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Swords, Tags, UsersRound, type LucideIcon } from "lucide-react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { Logo } from "./logo";
import { AppFrame } from "./app-frame";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-current-user";

/** The section destinations, same as the top navigation used to expose —
 * now presented in the sidebar so signed-in and signed-out visitors share
 * one navigation model. */
const PUBLIC_SECTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/skills", label: "Skills", icon: Tags },
  { to: "/challenges", label: "Challenges", icon: Swords },
  { to: "/teams", label: "Teams", icon: UsersRound },
];

/**
 * Signed-out / still-loading sidebar. Same geometry and item treatment as
 * the DashboardSidebar so swapping between the two never shifts layout.
 */
function PublicSectionSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      id="app-sidebar"
      className="relative flex h-full w-60 flex-col overflow-hidden border-r border-border bg-surface"
    >
      <div className="flex h-12 items-center gap-1 border-b border-border px-3">
        <Logo />
      </div>

      <nav aria-label="Section navigation" className="flex-1 overflow-y-auto px-2 pb-4 pt-5">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Discover
        </p>
        <div className="flex flex-col">
          {PUBLIC_SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-7 items-center gap-2 rounded-sm px-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  isActive
                    ? "bg-[var(--user-accent-subtle,var(--learning-subtle))] font-medium text-[var(--user-accent-text,var(--foreground))]"
                    : "text-muted-foreground hover:bg-surface-sunken hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto border-t border-border px-3 py-3">
        <div className="flex flex-col gap-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link to="/login" onClick={onNavigate}>
              Log in
            </Link>
          </Button>
          <Button asChild variant="default" size="sm" className="w-full justify-start rounded-full">
            <Link to="/signup" onClick={onNavigate}>
              Join Tethyr
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}

/**
 * Frame for the public section pages (skills, projects, profiles, teams,
 * shared library items): the same app frame as the signed-in app — full
 * member chrome when signed in, the section sidebar for visitors — so the
 * chrome never changes under the user's hands. Public pages stay public (no
 * auth gate, no noindex).
 *
 * `className`/`style` land on the frame root (page backgrounds, density);
 * `mainClassName`/`mainStyle` land on the content element (themed canvases
 * like a profile page's).
 */
export function SectionShell({
  children,
  className,
  style,
  mainClassName,
  mainStyle,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  mainClassName?: string;
  mainStyle?: CSSProperties;
}) {
  const { data: sessionUser } = useAuthUser();
  const isAuthed = Boolean(sessionUser);
  return (
    <AppFrame
      isAuthed={isAuthed}
      renderSidebar={(props) =>
        isAuthed ? (
          <DashboardSidebar {...props} />
        ) : (
          <PublicSectionSidebar onNavigate={props.onNavigate} />
        )
      }
      className={className}
      style={style}
      mainClassName={mainClassName}
      mainStyle={mainStyle}
    >
      {children}
    </AppFrame>
  );
}
