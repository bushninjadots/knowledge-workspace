// Public, read-only view of one shared library item at /library/shared/$id.
// A visitor opening a share link sees the item's content rendered the same way
// the owner sees it (markdown/html for notes, the link, or an upload notice),
// plus a path into Tethyr — but no editing, no owner identity leak beyond what
// the item itself shows, and nothing at all once sharing is revoked (the RLS
// policy makes the row invisible, so the page reads "not available").
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, FileCode2, Globe, Upload } from "lucide-react";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSharedLibraryItem } from "@/hooks/use-library";
import { SectionShell } from "@/components/tethyr/section-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/library/shared/$id")({
  head: () =>
    seoMeta({
      path: "/library/shared/$id",
      title: "Shared item — Tethyr",
      description: "A note or resource shared from a Tethyr library.",
      noindex: true,
    }),
  component: SharedLibraryItemPage,
});

function SharedLibraryItemPage() {
  const { id } = Route.useParams();
  const { data: item, isLoading } = useSharedLibraryItem(id);

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
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : !item ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              This item isn&apos;t available
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              The link is broken, or the owner has stopped sharing it.
            </p>
          </div>
        ) : (
          <article>
            <header className="mb-6">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                Shared from a Tethyr library
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
                {item.title}
              </h1>
            </header>

            {(item.type === "note" || item.type === "document") && (
              <Card asChild>
                <div className="prose-custom bg-surface/40 px-4 py-6 sm:px-6">
                  {item.content_format === "markdown" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.content) }} />
                  )}
                </div>
              </Card>
            )}
            {item.type === "link" && item.url && (
              <Card className="bg-surface/40 p-6">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 shrink-0 text-teaching" aria-hidden />
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-trust underline hover:opacity-80"
                  >
                    {item.url}
                  </a>
                </div>
              </Card>
            )}
            {item.type === "upload" && (
              <Card className="bg-surface/40 p-6">
                <div className="flex items-center gap-3">
                  <Upload className="h-5 w-5 shrink-0 text-ai" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    This is an uploaded file — it stays private to its owner.
                  </p>
                </div>
              </Card>
            )}

            <footer className="mt-8 flex items-center gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <FileCode2 className="h-3.5 w-3.5" aria-hidden />
              <span>Shared read-only from Tethyr — the owner can revoke this link anytime.</span>
            </footer>
          </article>
        )}
      </div>
    </SectionShell>
  );
}
