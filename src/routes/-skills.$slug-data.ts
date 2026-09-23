// Route-adjacent data module for /skills/$slug: loads a skill from the catalog
// by slug. Shared by the route loader (which feeds the SEO head with the real
// skill name instead of the raw slug) and the hub page's query — the loader
// prefetches under the same key the page reads, so SSR renders the name and
// the client hydrates without a second fetch.
import { supabase } from "@/integrations/supabase/client";

export type HubSkill = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  tools: string[];
};

export const skillQueryKey = (slug: string) => ["skill", slug] as const;

export async function fetchSkillBySlug(slug: string): Promise<HubSkill | null> {
  const { data, error } = await supabase
    .from("skills")
    .select("id, slug, name, category, description, tools")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as HubSkill | null;
}
