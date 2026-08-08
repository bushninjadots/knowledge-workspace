-- ============================================================
-- Auto-record project activity.
--
-- The Activity tab previously had to aggregate across five tables
-- client-side. These triggers write a structured event into
-- project_activity whenever the real work happens, so the tab can
-- simply read one table.
--
-- The functions are SECURITY DEFINER so the write succeeds even when
-- the triggering user is a contributor (project_activity's RLS policy
-- only lets the project owner insert directly).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Project update posted → 'update'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_project_update_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
  VALUES (
    NEW.project_id,
    NEW.author_id,
    'update',
    NEW.title,
    NEW.body,
    jsonb_build_object('week_number', NEW.week_number),
    NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_activity_update ON public.project_updates;
CREATE TRIGGER trg_project_activity_update
AFTER INSERT ON public.project_updates
FOR EACH ROW
EXECUTE FUNCTION public.record_project_update_activity();

-- ------------------------------------------------------------
-- 2. Milestone completed → 'milestone_done'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_project_milestone_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    INSERT INTO project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    VALUES (
      NEW.project_id,
      NULL,
      'milestone_done',
      'Completed milestone: ' || NEW.title,
      NEW.description,
      jsonb_build_object('milestone_id', NEW.id),
      COALESCE(NEW.updated_at, now())
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_activity_milestone ON public.project_milestones;
CREATE TRIGGER trg_project_activity_milestone
AFTER UPDATE ON public.project_milestones
FOR EACH ROW
EXECUTE FUNCTION public.record_project_milestone_activity();

-- ------------------------------------------------------------
-- 3. Discussion started → 'discussion'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_project_discussion_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
  VALUES (
    NEW.project_id,
    NEW.author_id,
    'discussion',
    'Started discussion: ' || NEW.title,
    NEW.body,
    jsonb_build_object('discussion_id', NEW.id, 'category', NEW.category),
    NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_activity_discussion ON public.project_discussions;
CREATE TRIGGER trg_project_activity_discussion
AFTER INSERT ON public.project_discussions
FOR EACH ROW
EXECUTE FUNCTION public.record_project_discussion_activity();

-- ------------------------------------------------------------
-- 4. Repository linked → 'repo_linked'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_project_repo_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
  VALUES (
    NEW.project_id,
    NULL,
    'repo_linked',
    'Linked repository ' || COALESCE(NEW.metadata->>'full_name', NEW.url),
    NULL,
    jsonb_build_object('url', NEW.url),
    NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_activity_repo ON public.project_repositories;
CREATE TRIGGER trg_project_activity_repo
AFTER INSERT ON public.project_repositories
FOR EACH ROW
EXECUTE FUNCTION public.record_project_repo_activity();

-- ------------------------------------------------------------
-- 5. Files added (uploaded_files array diff) → 'file_added'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_project_files_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_paths text[];
  f jsonb;
  label text;
BEGIN
  SELECT COALESCE(array_agg(e->>'path'), ARRAY[]::text[])
  INTO old_paths
  FROM jsonb_array_elements(COALESCE(OLD.uploaded_files, '[]'::jsonb)) e;

  FOR f IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.uploaded_files, '[]'::jsonb))
  LOOP
    IF NOT (f->>'path') = ANY (old_paths) THEN
      label := CASE
        WHEN NULLIF(f->>'dir', '') IS NOT NULL THEN (f->>'dir') || '/' || COALESCE(f->>'name', 'file')
        ELSE COALESCE(f->>'name', 'file')
      END;
      INSERT INTO project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
      VALUES (
        NEW.id,
        auth.uid(),
        'file_added',
        'Added ' || label,
        NULL,
        jsonb_build_object('path', f->>'path'),
        now()
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_activity_files ON public.projects;
CREATE TRIGGER trg_project_activity_files
AFTER UPDATE ON public.projects
FOR EACH ROW
WHEN (OLD.uploaded_files IS DISTINCT FROM NEW.uploaded_files)
EXECUTE FUNCTION public.record_project_files_activity();

-- ------------------------------------------------------------
-- Backfill — only when project_activity is empty, so re-runs are safe.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.project_activity LIMIT 1) THEN

    INSERT INTO public.project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    SELECT project_id, author_id, 'update', title, body,
           jsonb_build_object('week_number', week_number), created_at
    FROM public.project_updates;

    INSERT INTO public.project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    SELECT project_id, NULL, 'milestone_done', 'Completed milestone: ' || title, description,
           jsonb_build_object('milestone_id', id), COALESCE(updated_at, created_at)
    FROM public.project_milestones
    WHERE status = 'done';

    INSERT INTO public.project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    SELECT project_id, author_id, 'discussion', 'Started discussion: ' || title, body,
           jsonb_build_object('discussion_id', id, 'category', category), created_at
    FROM public.project_discussions;

    INSERT INTO public.project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    SELECT project_id, NULL, 'repo_linked',
           'Linked repository ' || COALESCE(metadata->>'full_name', url), NULL,
           jsonb_build_object('url', url), created_at
    FROM public.project_repositories;

    INSERT INTO public.project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    SELECT p.id, NULL, 'file_added',
           'Added ' || CASE
             WHEN NULLIF(f->>'dir', '') IS NOT NULL THEN (f->>'dir') || '/' || COALESCE(f->>'name', 'file')
             ELSE COALESCE(f->>'name', 'file')
           END,
           NULL, jsonb_build_object('path', f->>'path'), p.updated_at
    FROM public.projects p
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.uploaded_files, '[]'::jsonb)) f;

  END IF;
END;
$$;
