-- Process records feed SIPOC and the value chain. Preserve them and audit every change.
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS objective text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS obsolete boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.process_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('baseline', 'created', 'updated')),
  before_data jsonb,
  after_data jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS process_history_process_idx ON public.process_history(process_id, changed_at DESC);
ALTER TABLE public.process_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS process_history_admin_read ON public.process_history;
CREATE POLICY process_history_admin_read ON public.process_history
  FOR SELECT TO authenticated USING (lower(public.get_user_role()::text) = 'admin');
GRANT SELECT ON public.process_history TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.process_history FROM PUBLIC, anon, authenticated;

-- Validate users even when a client writes directly to the table.
CREATE OR REPLACE FUNCTION public.validate_process_users() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF array_position(NEW.participant_ids, NULL) IS NOT NULL
    OR cardinality(NEW.participant_ids) <> (
      SELECT count(DISTINCT user_id) FROM unnest(NEW.participant_ids) AS participant(user_id)
    )
    OR EXISTS (
      SELECT 1 FROM unnest(NEW.participant_ids) AS participant(user_id)
      WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
    ) THEN
    RAISE EXCEPTION 'Invalid process participants' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_process_users() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_process_users ON public.processes;
CREATE TRIGGER validate_process_users BEFORE INSERT OR UPDATE OF participant_ids
  ON public.processes FOR EACH ROW EXECUTE FUNCTION public.validate_process_users();

CREATE OR REPLACE FUNCTION public.validate_process_definition() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF btrim(NEW.description) = '' OR btrim(NEW.objective) = '' THEN
    RAISE EXCEPTION 'Process description and objective are required' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_process_definition() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_process_definition ON public.processes;
CREATE TRIGGER validate_process_definition BEFORE INSERT OR UPDATE OF description, objective
  ON public.processes FOR EACH ROW EXECUTE FUNCTION public.validate_process_definition();

CREATE OR REPLACE FUNCTION public.audit_process() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.process_history(process_id, action, after_data, changed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
  ELSIF to_jsonb(NEW) - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - 'updated_at' THEN
    INSERT INTO public.process_history(process_id, action, before_data, after_data, changed_by)
    VALUES (NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_process() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS audit_process ON public.processes;
CREATE TRIGGER audit_process AFTER INSERT OR UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.audit_process();

-- A baseline makes pre-existing processes visible in the new history without
-- claiming that their earlier edits were audited.
INSERT INTO public.process_history(process_id, action, after_data)
SELECT process.id, 'baseline', to_jsonb(process)
FROM public.processes AS process
WHERE NOT EXISTS (
  SELECT 1 FROM public.process_history AS history
  WHERE history.process_id = process.id AND history.action = 'baseline'
);

CREATE OR REPLACE FUNCTION public.prevent_process_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Processes must be made obsolete, not deleted' USING ERRCODE = '23503';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_process_delete() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS prevent_process_delete ON public.processes;
CREATE TRIGGER prevent_process_delete BEFORE DELETE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_process_delete();

DROP POLICY IF EXISTS "insert_processes_admin_gestor" ON public.processes;
DROP POLICY IF EXISTS "update_processes_admin_gestor" ON public.processes;
DROP POLICY IF EXISTS "delete_processes_admin_gestor" ON public.processes;
DROP POLICY IF EXISTS processes_admin_insert ON public.processes;
DROP POLICY IF EXISTS processes_admin_update ON public.processes;
CREATE POLICY processes_admin_insert ON public.processes FOR INSERT TO authenticated
  WITH CHECK (lower(public.get_user_role()::text) = 'admin');
CREATE POLICY processes_admin_update ON public.processes FOR UPDATE TO authenticated
  USING (lower(public.get_user_role()::text) = 'admin')
  WITH CHECK (lower(public.get_user_role()::text) = 'admin');
REVOKE DELETE ON public.processes FROM PUBLIC, anon, authenticated;
