// ── Project About Block ──────────────────────────────────────────────────────
// Renders the project README / description. In view mode it displays rendered
// markdown (sanitized via the shared block renderer — escapes quotes and
// rejects javascript: URLs). In edit mode it links to the existing rich README
// editor.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { blockMarkdownToHtml } from "@/lib/block-markdown";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

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
      return data as {
        description: string | null;
        vision: string | null;
        readme: string | null;
      } | null;
    },
    enabled: !!projectId,
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!data) return null;

  const content = data.readme || data.vision || data.description;
  if (!content) return null;

  const html = blockMarkdownToHtml(content);

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
