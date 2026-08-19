-- Connect Library resources to projects with explicit visibility and
-- permissions. An item's owner can link a note/document/link/upload to a
-- project; the project's contributors (and the project owner) can then read it,
-- on top of the item owner's existing CRUD access. Unlinked items stay private
-- to their owner, exactly as before.

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_library_items_project ON public.library_items(project_id);

-- Project members (contributors + the project owner) can read items that are
-- explicitly linked to their project. This is additive to the existing
-- "Owner CRUD items" policy — only the owner can write.
DROP POLICY IF EXISTS "Project members read linked items" ON public.library_items;
CREATE POLICY "Project members read linked items"
  ON public.library_items FOR SELECT
  USING (
    project_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.project_contributors pc
        WHERE pc.project_id = library_items.project_id
          AND pc.profile_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = library_items.project_id
          AND p.profile_id = auth.uid()
      )
    )
  );
