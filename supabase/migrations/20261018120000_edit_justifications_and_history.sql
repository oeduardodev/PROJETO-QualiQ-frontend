-- Audit editable configuration and operational records in the same transaction as each write.
CREATE TABLE public.edit_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('baseline', 'created', 'updated')),
  justification text,
  before_data jsonb,
  after_data jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX edit_history_record_idx
  ON public.edit_history(entity_name, record_id, changed_at DESC, id DESC);
ALTER TABLE public.edit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY edit_history_read ON public.edit_history FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);
GRANT SELECT ON public.edit_history TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.edit_history FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.audit_editable_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_reason text := nullif(btrim(current_setting('app.edit_reason', true)), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.edit_history(entity_name, record_id, action, after_data, changed_by)
    VALUES (TG_TABLE_NAME, coalesce(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'level'),
      'created', to_jsonb(NEW), auth.uid());
  ELSIF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    INSERT INTO public.edit_history
      (entity_name, record_id, action, justification, before_data, after_data, changed_by)
    VALUES (TG_TABLE_NAME, coalesce(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'level'),
      'updated', v_reason, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_editable_record() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'value_chain_categories', 'dimensions', 'sipoc_nodes', 'helpdesk_tickets',
    'notification_classifications', 'notification_types', 'document_levels'
  ] LOOP
    EXECUTE format(
      'INSERT INTO public.edit_history(entity_name, record_id, action, after_data) '
      || 'SELECT %L, coalesce(to_jsonb(t)->>''id'', to_jsonb(t)->>''level''), ''baseline'', to_jsonb(t) '
      || 'FROM public.%I AS t', v_table, v_table
    );
    EXECUTE format(
      'CREATE TRIGGER audit_editable_record AFTER INSERT OR UPDATE ON public.%I '
      || 'FOR EACH ROW EXECUTE FUNCTION public.audit_editable_record()', v_table
    );
  END LOOP;
END $$;

-- Dimension link selections are part of the edit form and must appear in its history.
CREATE FUNCTION public.audit_dimension_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dimension_id uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_dimension_id := NEW.dimension_id;
    v_before := jsonb_build_object('link', NULL);
    v_after := jsonb_build_object('link', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_dimension_id := OLD.dimension_id;
    v_before := jsonb_build_object('link', to_jsonb(OLD));
    v_after := jsonb_build_object('link', NULL);
  ELSE
    v_dimension_id := NEW.dimension_id;
    v_before := jsonb_build_object('link', to_jsonb(OLD));
    v_after := jsonb_build_object('link', to_jsonb(NEW));
  END IF;
  IF v_before IS DISTINCT FROM v_after THEN
    INSERT INTO public.edit_history
      (entity_name, record_id, action, justification, before_data, after_data, changed_by)
    VALUES ('dimensions', v_dimension_id::text, 'updated',
      nullif(btrim(current_setting('app.edit_reason', true)), ''),
      v_before, v_after, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_dimension_link() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_dimension_link AFTER INSERT OR UPDATE OR DELETE ON public.dimension_links
  FOR EACH ROW EXECUTE FUNCTION public.audit_dimension_link();

-- Use the caller's table privileges and row policies; only the listed fields can be edited.
CREATE FUNCTION public.update_audited_record(
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
      'title','description','category','status','priority','requester_name','assigned_to','process_id',
      'custom_fields'
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
REVOKE ALL ON FUNCTION public.update_audited_record(text, uuid, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_audited_record(text, uuid, jsonb, text)
  TO authenticated;

-- Preserve the existing dimension transaction while passing the reason to its audit trigger.
CREATE FUNCTION public.save_dimension_with_reason(
  p_id uuid, p_version_id uuid, p_name text, p_description text, p_objective text,
  p_classification_key text, p_color_key text, p_order_index integer,
  p_indicator_ids uuid[], p_plan_ids uuid[], p_justification text
) RETURNS public.dimensions LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_id IS NOT NULL AND nullif(btrim(p_justification), '') IS NULL THEN
    RAISE EXCEPTION 'Justification is required' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.edit_reason', coalesce(nullif(btrim(p_justification), ''), ''), true);
  RETURN public.save_dimension_with_links(p_id, p_version_id, p_name, p_description,
    p_objective, p_classification_key, p_color_key, p_order_index, p_indicator_ids, p_plan_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.save_dimension_with_reason(
  uuid, uuid, text, text, text, text, text, integer, uuid[], uuid[], text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_dimension_with_reason(
  uuid, uuid, text, text, text, text, text, integer, uuid[], uuid[], text
) TO authenticated;

CREATE FUNCTION public.save_document_level_with_reason(
  p_level integer, p_name text, p_justification text
) RETURNS public.document_levels LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_level IS NOT NULL AND nullif(btrim(p_justification), '') IS NULL THEN
    RAISE EXCEPTION 'Justification is required' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.edit_reason', coalesce(nullif(btrim(p_justification), ''), ''), true);
  RETURN public.save_document_level(p_level, p_name);
END;
$$;
REVOKE ALL ON FUNCTION public.save_document_level_with_reason(integer, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_document_level_with_reason(integer, text, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
