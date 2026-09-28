// Public, read-only view of one shared library collection at
// /library/shared/collection/$id. A visitor sees the collection's name and
// its notes/links rendered read-only; uploads show metadata only (files stay
// private to the owner's storage session). Revoking the collection's `shared`
// flag hides everything at once via RLS.
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, ExternalLink, FileText, Globe, Upload } from "lucide-react";
import { useSharedLibraryCollection } from "@/hooks/use-library";
import { SectionShell } from "@/components/tethyr/section-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/library/shared/collection/$id")({
  head: () =>
    seoMeta({
      path: "/library/shared/collection/$id",
      title: "Shared collection — Tethyr",
      description: "A collection of notes and resources shared from a Tethyr library.",
      noindex: true,
    }),
  component: SharedCollectionPage,
});

function SharedCollectionPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useSharedLibraryCollection(id);

  return (
    <SectionShell backTo="/" mainClassName="bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-xs text-muted-foreground"
          >
            <Link to="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Tethyr
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3 rounded-lg" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              This collection isn&apos;t available
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              The link is broken, or the owner has stopped sharing it.
            </p>
          </div>
        ) : (
          <div>
            <header className="mb-6">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                Shared from a Tethyr library
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
                {data.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.items.length === 1 ? "1 item" : `${data.items.length} items`} · read-only
              </p>
            </header>

            {data.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing in this collection yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.items.map((item) => (
                  <li key={item.id}>
                    <Card className="bg-surface/40 p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0" aria-hidden>
                          {item.type === "link" ? (
                            <Globe className="h-4 w-4 text-teaching" />
                          ) : item.type === "upload" ? (
                            <Upload className="h-4 w-4 text-ai" />
                          ) : (
                            <FileText className="h-4 w-4 text-trust" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.title}
                          </p>
                          {item.type === "link" && item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-trust hover:underline"
                            >
                              <span className="truncate">{item.url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : item.type === "upload" ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Uploaded file — stays private to its owner.
                            </p>
                          ) : (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {item.content.replace(/<[^>]*>/g, " ").slice(0, 200) || "Empty note"}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}

            <footer className="mt-8 flex items-center gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              <span>Shared read-only from Tethyr — the owner can revoke this link anytime.</span>
            </footer>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
