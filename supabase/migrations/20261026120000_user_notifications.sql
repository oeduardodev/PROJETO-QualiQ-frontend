-- Persistent, tenant-scoped notifications for user assignments.
ALTER TABLE public.operation_inbox
  ADD COLUMN actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN actor_name text,
  ADD COLUMN event_type text NOT NULL DEFAULT 'assignment';

CREATE INDEX operation_inbox_user_created_idx
  ON public.operation_inbox (establishment_id, user_id, created_at DESC);
CREATE INDEX operation_inbox_unread_idx
  ON public.operation_inbox (establishment_id, user_id, created_at DESC)
  WHERE read_at IS NULL;

-- The old plan trigger mixed audit and delivery. Keep the audit and let one
-- shared trigger create assignment notifications for every supported module.
CREATE OR REPLACE FUNCTION public.audit_operation_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  reason text := current_setting('orbis.operation_reason', true);
  action text := current_setting('orbis.operation_action', true);
BEGIN
  IF TG_OP = 'UPDATE' AND nullif(btrim(reason), '') IS NULL THEN
    RAISE EXCEPTION 'Justificativa obrigatória para alterar o plano';
  END IF;
  INSERT INTO public.action_plan_history
    (plan_id, action, justification, before_data, after_data, changed_by, establishment_id)
  VALUES
    (NEW.id, coalesce(nullif(action, ''), lower(TG_OP)),
     coalesce(nullif(reason, ''), 'Criação do plano'),
     CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END,
     to_jsonb(NEW), auth.uid(), NEW.establishment_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_ticket_assignment ON public.tickets;

CREATE FUNCTION public.notification_recipients(p_row jsonb, p_table text)
RETURNS uuid[] LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  ids uuid[] := '{}'::uuid[];
  field text;
  value text;
  scalar_fields text[];
  array_fields text[];
BEGIN
  CASE p_table
    WHEN 'action_plans' THEN
      scalar_fields := ARRAY['owner_id', 'controller_id'];
      array_fields := ARRAY['participant_ids'];
    WHEN 'documents' THEN
      scalar_fields := ARRAY['owner_id'];
      array_fields := ARRAY['approver_ids'];
    WHEN 'processes' THEN
      scalar_fields := ARRAY['owner_id'];
      array_fields := ARRAY['participant_ids'];
    WHEN 'risks' THEN scalar_fields := ARRAY['owner_id'];
    WHEN 'tickets' THEN scalar_fields := ARRAY['assigned_to'];
    WHEN 'helpdesk_tickets' THEN scalar_fields := ARRAY['assigned_to'];
    ELSE RETURN ids;
  END CASE;
  FOREACH field IN ARRAY coalesce(scalar_fields, '{}'::text[]) LOOP
    value := p_row->>field;
    -- Helpdesk previously accepted arbitrary names; retain those historical values.
    IF value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      ids := array_append(ids, value::uuid);
    END IF;
  END LOOP;
  FOREACH field IN ARRAY coalesce(array_fields, '{}'::text[]) LOOP
    FOR value IN SELECT jsonb_array_elements_text(coalesce(p_row->field, '[]'::jsonb)) LOOP
      ids := array_append(ids, value::uuid);
    END LOOP;
  END LOOP;
  RETURN ARRAY(SELECT DISTINCT id FROM unnest(ids) AS id WHERE id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.notification_recipients(jsonb, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.notify_user_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb := '{}'::jsonb;
  new_ids uuid[];
  old_ids uuid[] := '{}'::uuid[];
  recipient uuid;
  actor uuid := auth.uid();
  sender text;
  entity_label text;
  destination text;
  record_title text;
BEGIN
  IF TG_OP = 'UPDATE' THEN old_row := to_jsonb(OLD); END IF;
  new_ids := public.notification_recipients(new_row, TG_TABLE_NAME);
  old_ids := public.notification_recipients(old_row, TG_TABLE_NAME);
  CASE TG_TABLE_NAME
    WHEN 'action_plans' THEN entity_label := 'plano de ação'; destination := '/planos-acao';
    WHEN 'documents' THEN entity_label := 'documento'; destination := '/documentos/painel';
    WHEN 'processes' THEN entity_label := 'processo'; destination := '/processos/sipoc';
    WHEN 'risks' THEN entity_label := 'risco'; destination := '/riscos/painel';
    WHEN 'tickets' THEN entity_label := 'incidente'; destination := '/incidentes/painel';
    WHEN 'helpdesk_tickets' THEN entity_label := 'chamado'; destination := '/helpdesk';
  END CASE;
  record_title := coalesce(nullif(new_row->>'title', ''), entity_label);
  SELECT name INTO sender FROM public.profiles WHERE id = actor;

  FOREACH recipient IN ARRAY new_ids LOOP
    IF recipient = actor OR recipient = ANY(old_ids) THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = recipient AND establishment_id = NEW.establishment_id AND is_active
    ) THEN
      RAISE EXCEPTION 'Destinatário inválido ou de outro estabelecimento' USING ERRCODE = '23503';
    END IF;
    INSERT INTO public.operation_inbox
      (establishment_id, user_id, actor_id, actor_name, event_type, title, route, record_id)
    VALUES
      (NEW.establishment_id, recipient, actor, sender, 'assignment',
       'Você foi incluído em ' || entity_label || ': ' || record_title, destination, NEW.id);
  END LOOP;

  IF TG_TABLE_NAME = 'action_plans' AND TG_OP = 'UPDATE'
    AND new_row->>'review_state' = 'pending'
    AND old_row->>'review_state' IS DISTINCT FROM 'pending'
    AND nullif(new_row->>'controller_id', '') IS NOT NULL THEN
    recipient := (new_row->>'controller_id')::uuid;
    IF recipient <> actor AND recipient = ANY(old_ids) THEN
      INSERT INTO public.operation_inbox
        (establishment_id, user_id, actor_id, actor_name, event_type, title, route, record_id)
      VALUES
        (NEW.establishment_id, recipient, actor, sender, 'review',
         'Revisão solicitada no plano de ação: ' || record_title, destination, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_user_assignment() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_user_assignment AFTER INSERT OR UPDATE ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_assignment();
CREATE TRIGGER notify_user_assignment AFTER INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_assignment();
CREATE TRIGGER notify_user_assignment AFTER INSERT OR UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_assignment();
CREATE TRIGGER notify_user_assignment AFTER INSERT OR UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_assignment();
CREATE TRIGGER notify_user_assignment AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_assignment();
CREATE TRIGGER notify_user_assignment AFTER INSERT OR UPDATE ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_assignment();

-- Supabase Postgres Changes delivers new and read notifications to the owner.
ALTER TABLE public.operation_inbox REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'operation_inbox'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_inbox;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
