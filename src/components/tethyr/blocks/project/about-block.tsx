// ── Project About Block ──────────────────────────────────────────────────────
// Renders the project README / description. In view mode it displays rendered
// markdown. In edit mode it links to the existing rich README editor.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

/** Minimal markdown-to-HTML (shared — could extract to lib later). */
function mdToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="rounded-lg bg-surface-sunken p-3 text-xs font-mono overflow-x-auto"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-surface-sunken px-1 py-0.5 text-xs font-mono">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank">$1</a>')
    .replace(/^### (.+)$/gm, "<h3 class='text-lg font-medium mt-4 mb-2'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-xl font-semibold mt-5 mb-2'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-2xl font-semibold mt-6 mb-3'>$1</h1>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc text-sm'>$1</li>")
    .replace(/\n\n/g, "</p><p class='text-sm leading-relaxed mb-3'>")
    .replace(/\n/g, "<br />");
}

function ProjectAboutBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["project-about", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data } = await supabase
        .from("projects")
        .select("description, vision, readme")
        .eq("id", projectId)
        .maybeSingle();
      return data as { description: string | null; vision: string | null; readme: string | null } | null;
    },
    enabled: !!projectId,
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!data) return null;

  const content = data.readme || data.vision || data.description;
  if (!content) return null;

  const html = mdToHtml(content);

  return (
    <div className="prose-custom">
      <div
        className="text-sm leading-relaxed text-foreground"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

registerBlock({
  type: "project-about",
  category: "project",
  label: "About / README",
  description: "The project's description, vision, and README content.",
  icon: "FileText",
  defaults: {},
  component: ProjectAboutBlock,
});

export { ProjectAboutBlock };