import type { ReactNode } from "react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

/**
 * Frame for public, non-marketing pages (privacy, terms). A visitor arriving
 * from a search result or a shared link needs the same ways out as any other
 * public page: the site navbar, the footer's links, and the logo home link.
 * Rendering these pages bare made them navigation dead-ends — see
 * docs/TETHYR_VISUAL_UI_AUDIT_2026-09-09.md (G11).
 */
export function PublicPageFrame({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar publicOnly />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="prose prose-neutral dark:prose-invert mt-8 space-y-6 text-foreground">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
