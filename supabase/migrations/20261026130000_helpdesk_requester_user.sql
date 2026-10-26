-- Keep the original requester name for older tickets while linking new selections to a profile.
ALTER TABLE public.helpdesk_tickets
  ADD COLUMN requester_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Link older names only when exactly one user in the same establishment matches.
ALTER TABLE public.helpdesk_tickets DISABLE TRIGGER USER;
UPDATE public.helpdesk_tickets AS ticket
SET requester_id = profile.id
FROM public.profiles AS profile
WHERE ticket.establishment_id = profile.establishment_id
  AND lower(btrim(ticket.requester_name)) = lower(btrim(profile.name))
  AND (
    SELECT count(*)
    FROM public.profiles AS candidate
    WHERE candidate.establishment_id = ticket.establishment_id
      AND lower(btrim(candidate.name)) = lower(btrim(ticket.requester_name))
  ) = 1;
ALTER TABLE public.helpdesk_tickets ENABLE TRIGGER USER;

ALTER TABLE public.helpdesk_tickets
  ADD CONSTRAINT helpdesk_tickets_requester_id_tenant_fk
  FOREIGN KEY (establishment_id, requester_id)
  REFERENCES public.profiles(establishment_id, id);

CREATE INDEX helpdesk_tickets_requester_id_idx ON public.helpdesk_tickets(requester_id);
GRANT UPDATE (requester_id) ON public.helpdesk_tickets TO authenticated;

CREATE OR REPLACE FUNCTION public.update_audited_record(
  p_entity text, p_id uuid, p_patch jsonb, p_justification text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_allowed text[];
  v_set text;
  v_saved jsonb;
BEGIN
  IF auth.uid() IS NULL OR nullif(btrim(p_justification), '') IS NULL THEN
    RAISE EXCEPTION 'Justification is required' USING ERRCODE = '22023';
  END IF;
  v_allowed := CASE p_entity
    WHEN 'value_chain_categories' THEN ARRAY['name','description','color_key']
    WHEN 'notification_classifications' THEN
      ARRAY['name','code','sla_hours','analysis_tool','requires_root_cause','active','form_schema']
    WHEN 'notification_types' THEN ARRAY['name','classification_id','risk_id','sla_id','active']
    WHEN 'helpdesk_tickets' THEN ARRAY[
      'title','description','category','status','priority','requester_id','requester_name',
      'assigned_to','process_id','custom_fields'
    ]
    WHEN 'sipoc_nodes' THEN ARRAY['title','description','custom_fields']
    ELSE NULL
  END;
  IF v_allowed IS NULL OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
    OR p_patch = '{}'::jsonb OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_patch) AS key WHERE key <> ALL(v_allowed)
    ) THEN
    RAISE EXCEPTION 'Invalid editable fields' USING ERRCODE = '22023';
  END IF;

  SELECT string_agg(
    format('%I = (jsonb_populate_record(NULL::public.%I, $1)).%I', key, p_entity, key), ', '
  ) INTO v_set FROM jsonb_object_keys(p_patch) AS key;
  PERFORM set_config('app.edit_reason', btrim(p_justification), true);
  EXECUTE format('UPDATE public.%I AS target SET %s WHERE id = $2 RETURNING to_jsonb(target)',
    p_entity, v_set) INTO v_saved USING p_patch, p_id;
  IF v_saved IS NULL THEN
    RAISE EXCEPTION 'Record not found or edit not allowed' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_saved;
END;
$$;
