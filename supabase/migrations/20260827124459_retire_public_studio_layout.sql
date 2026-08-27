-- WorkspaceGrid profile editing is retired: the Creativity Studio (/studio) is
-- the only profile editor, so the owner-driven public arrival is gone. The
-- public Studio now renders a fixed composition, so the column is dead.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS public_studio_layout;