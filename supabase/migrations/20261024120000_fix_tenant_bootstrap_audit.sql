-- Settings copied while bootstrapping a new establishment run without an
-- authenticated user, so the audit triggers must take the tenant directly
-- from the audited row instead of relying on current_establishment_id().
CREATE OR REPLACE FUNCTION public.audit_editable_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_reason text := nullif(btrim(current_setting('app.edit_reason', true)), '');
  v_tenant uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tenant := coalesce(nullif(to_jsonb(NEW)->>'establishment_id', '')::uuid,
      public.current_establishment_id());
    IF v_tenant IS NULL THEN
      RAISE EXCEPTION 'Estabelecimento indisponível' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.edit_history
      (entity_name, record_id, action, after_data, changed_by, establishment_id)
    VALUES (TG_TABLE_NAME, coalesce(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'level'),
      'created', to_jsonb(NEW), auth.uid(), v_tenant);
  ELSIF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    v_tenant := coalesce(nullif(to_jsonb(NEW)->>'establishment_id', '')::uuid,
      public.current_establishment_id());
    IF v_tenant IS NULL THEN
      RAISE EXCEPTION 'Estabelecimento indisponível' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.edit_history
      (entity_name, record_id, action, justification, before_data, after_data, changed_by,
        establishment_id)
    VALUES (TG_TABLE_NAME, coalesce(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'level'),
      'updated', v_reason, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_tenant);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_editable_record() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_dimension_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dimension_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_tenant uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_dimension_id := NEW.dimension_id;
    v_before := jsonb_build_object('link', NULL);
    v_after := jsonb_build_object('link', to_jsonb(NEW));
    v_tenant := coalesce(NEW.establishment_id, public.current_establishment_id());
  ELSIF TG_OP = 'DELETE' THEN
    v_dimension_id := OLD.dimension_id;
    v_before := jsonb_build_object('link', to_jsonb(OLD));
    v_after := jsonb_build_object('link', NULL);
    v_tenant := coalesce(OLD.establishment_id, public.current_establishment_id());
  ELSE
    v_dimension_id := NEW.dimension_id;
    v_before := jsonb_build_object('link', to_jsonb(OLD));
    v_after := jsonb_build_object('link', to_jsonb(NEW));
    v_tenant := coalesce(NEW.establishment_id, public.current_establishment_id());
  END IF;
  IF v_before IS DISTINCT FROM v_after THEN
    IF v_tenant IS NULL THEN
      RAISE EXCEPTION 'Estabelecimento indisponível' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.edit_history
      (entity_name, record_id, action, justification, before_data, after_data, changed_by,
        establishment_id)
    VALUES ('dimensions', v_dimension_id::text, 'updated',
      nullif(btrim(current_setting('app.edit_reason', true)), ''),
      v_before, v_after, auth.uid(), v_tenant);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_dimension_link() FROM PUBLIC, anon, authenticated;
