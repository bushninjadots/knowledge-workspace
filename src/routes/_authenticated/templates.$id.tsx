// ── Template Detail Route ─────────────────────────────────────────────────────
// Shows a single template: name, description, creator, usage/fork counts, type,
// category, lineage, and a visual preview of the sections/blocks.
// Authenticated users can apply, fork, or remix the template.

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTemplate, useApplyTemplate } from "@/hooks/use-templates";
import { useForkLayout, useRemixLayout, useLineage } from "@/hooks/use-fork";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Blocks,
  Calendar,
  LayoutGrid,
  User,
  TrendingUp,
  ArrowLeft,
  Download,
  GitFork,
  PenTool,
} from "lucide-react";
import type { LayoutSection } from "@/lib/page-blocks";

export const Route = createFileRoute("/_authenticated/templates/$id")({
  head: () => ({ meta: [{ title: "Template — Tethyr" }] }),
  component: TemplateDetailPage,
});

function TemplateDetailPage() {
  const { id } = Route.useParams();
  const { data: template, isLoading, isError } = useTemplate(id);
  const applyTemplate = useApplyTemplate();
  const forkLayout = useForkLayout();
  const remixLayout = useRemixLayout();
  const { data: lineage = [] } = useLineage(id);

  const [showRemixForm, setShowRemixForm] = useState(false);
  const [remixName, setRemixName] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-noise px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !template) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <LayoutGrid className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-destructive">Template not found.</p>
        <Link to="/templates" className="mt-2 text-xs text-muted-foreground underline">
          Browse templates
        </Link>
      </div>
    );
  }

  const sectionCount = template.sections?.length ?? 0;
  const blockCount =
    template.sections?.reduce(
      (sum: number, s: LayoutSection) => sum + (s.blocks?.length ?? 0),
      0,
    ) ?? 0;

  const handleApply = () => {
    applyTemplate.mutate({
      templateId: template.id,
      pageId: "",
      layoutId: "",
      ownerId: "",
      ownerType: "profile",
    });
  };

  const handleFork = () => {
    forkLayout.mutate({ parentLayoutId: template.id });
  };

  const handleRemix = () => {
    if (!remixName.trim()) return;
    remixLayout.mutate(
      {
        parentLayoutId: template.id,
        name: remixName.trim(),
        category: template.category ?? undefined,
      },
      {
        onSuccess: () => {
          setShowRemixForm(false);
          setRemixName("");
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-noise px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Back link */}
        <Link
          to="/templates"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Templates
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="mb-1 text-xl font-semibold">{template.name}</h1>
          {template.description && (
            <p className="mb-3 text-sm text-muted-foreground">{template.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-surface-elevated px-2 py-0.5 capitalize">
              {template.type.replace(/_/g, " ")}
            </span>
            {template.category && (
              <span className="rounded-full bg-surface-elevated px-2 py-0.5 capitalize">
                {template.category}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Blocks className="h-3 w-3" />
              {sectionCount} sections, {blockCount} blocks
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {template.usageCount} uses
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="h-3 w-3" />
              {template.forkCount} forks
            </span>
            {template.creatorHandle && (
              <Link
                to="/u/$handle"
                params={{ handle: template.creatorHandle }}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <User className="h-3 w-3" />@{template.creatorHandle}
              </Link>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(template.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Lineage */}
        {lineage.length > 0 && (
          <div className="mb-4 rounded-lg border border-card-border bg-surface/50 px-4 py-3">
            <h3 className="mb-1 text-[11px] font-medium text-muted-foreground">Lineage</h3>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>Forked from</span>
              {[...lineage].reverse().map((node, i) => (
                <span key={node.layoutId} className="flex items-center gap-1">
                  <code className="rounded bg-surface-elevated px-1 text-[10px]">
                    {node.parentId ? "template" : "original"}
                  </code>
                  {i < lineage.length - 1 && <span className="text-[10px]">→</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Section preview */}
        <div className="mb-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Layout preview
          </h2>
          {(template.sections ?? []).map((section, si) => (
            <SectionPreviewRow key={section.id ?? si} section={section} index={si} />
          ))}
        </div>

        <Separator className="mb-6" />

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleApply}
            disabled={applyTemplate.isPending}
          >
            <Download className="h-3.5 w-3.5" />
            {applyTemplate.isPending ? "Applying..." : "Apply template"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleFork}
            disabled={forkLayout.isPending}
          >
            <GitFork className="h-3.5 w-3.5" />
            {forkLayout.isPending ? "Forking..." : "Fork layout"}
          </Button>

          {!showRemixForm ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowRemixForm(true)}
            >
              <PenTool className="h-3.5 w-3.5" />
              Remix
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                className="h-8 w-40 text-xs"
                placeholder="Your version name..."
                value={remixName}
                onChange={(e) => setRemixName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRemix()}
              />
              <Button
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={handleRemix}
                disabled={!remixName.trim() || remixLayout.isPending}
              >
                {remixLayout.isPending ? "Publishing..." : "Publish remix"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setShowRemixForm(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Fork/Remix explainer */}
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          <strong>Fork:</strong> copy the layout to your account for private customization.{" "}
          <strong>Remix:</strong> fork, customize, and publish your version as a new community
          template.
        </p>

        {/* Made with Tethyr */}
        <div className="mt-12 flex items-center justify-center gap-1 text-[11px] text-muted-foreground/50">
          <span>Layout by</span>
          {template.creatorHandle ? (
            <Link
              to="/u/$handle"
              params={{ handle: template.creatorHandle }}
              className="underline decoration-muted-foreground/30 underline-offset-2 hover:text-muted-foreground"
            >
              @{template.creatorHandle}
            </Link>
          ) : (
            <span>Tethyr</span>
          )}
          <span>• Tethyr</span>
        </div>
      </div>
    </div>
  );
}

// ── Section Preview Row ──────────────────────────────────────────────────────

const SECTION_LAYOUT_LABELS: Record<string, string> = {
  full: "Full width",
  two_column: "Two columns",
  three_column: "Three columns",
  sidebar_left: "Sidebar left",
  sidebar_right: "Sidebar right",
  feature: "Feature",
};

function SectionPreviewRow({ section, index }: { section: LayoutSection; index: number }) {
  const blockCount = section.blocks?.length ?? 0;
  const layoutLabel = SECTION_LAYOUT_LABELS[section.layout] ?? section.layout;

  return (
    <div className="rounded-lg border border-card-border bg-surface/50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {index + 1}
        </span>
        <span className="text-[11px] font-medium">{layoutLabel}</span>
        <span className="text-[10px] text-muted-foreground">
          {blockCount} block{blockCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {section.blocks.map((block, bi) => (
          <span
            key={block.id ?? bi}
            className="rounded-md bg-surface-elevated px-2 py-1 text-[10px] text-muted-foreground"
          >
            {block.type}
          </span>
        ))}
      </div>
    </div>
  );
}
