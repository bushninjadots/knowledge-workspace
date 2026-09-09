import { Link, useRouterState } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { isNavItemActive, mobilePrimaryNav } from "./navigation-manifest";

const ITEMS = mobilePrimaryNav;

export function MobilePrimaryNav({ onOpenMore }: { onOpenMore: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[10px] transition ${
                active
                  ? "bg-[var(--user-accent-subtle,var(--learning-subtle))] font-medium text-[var(--user-accent,var(--foreground))]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[10px] text-muted-foreground transition hover:text-foreground"
          aria-label="Open more navigation"
        >
          <MoreHorizontal className="h-4 w-4" />
          More
        </button>
      </div>
    </nav>
  );
}
