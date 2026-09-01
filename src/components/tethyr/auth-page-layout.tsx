// ── Authenticated Page Layout ────────────────────────────────────────────────────
// Consistent layout for all authenticated pages.
// The sidebar (DashboardSidebar) is the true start of the canvas — content
// uses the full remaining viewport width, not a narrow centered container.
//
// Usage:
//   <AuthPageLayout>
//     <YourPageContent />
//   </AuthPageLayout>

import { ReactNode } from "react";

interface AuthPageLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Pages that are text/editor heavy (settings, legal, profile setup) can pass
 * a readable max-width so lines don't get too long on wide screens.
 */
interface AuthPageLayoutConstrainedProps extends AuthPageLayoutProps {
  /** Cap line length for readability — e.g. "max-w-3xl" or "max-w-4xl". */
  constrained?: boolean;
  /** Override the max-width for constrained mode. */
  maxWidth?: string;
}

export function AuthPageLayout({ children, className }: AuthPageLayoutProps) {
  return (
    <div className={`flex-1 min-w-0 ${className ?? ""}`}>
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
    </div>
  );
}

/**
 * Constrained variant — full width container, but content is capped for
 * readability (settings pages, legal pages, etc.).
 */
export function AuthPageLayoutConstrained({
  children,
  className,
  maxWidth = "max-w-3xl",
}: AuthPageLayoutConstrainedProps) {
  return (
    <div className={`flex-1 min-w-0 ${className ?? ""}`}>
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className={maxWidth}>{children}</div>
      </div>
    </div>
  );
}
