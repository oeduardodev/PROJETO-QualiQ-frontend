-- Per-establishment monthly AI limit. The existing hourly counter remains a
-- historical table; this function is the authoritative quota gate.
CREATE TABLE public.ai_monthly_usage (
  establishment_id uuid NOT NULL REFERENCES public.establishments(id),
  month_start date NOT NULL,
  requests integer NOT NULL DEFAULT 0 CHECK (requests >= 0),
  PRIMARY KEY (establishment_id,month_start)
);
ALTER TABLE public.ai_monthly_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_monthly_usage FROM PUBLIC,anon,authenticated;
CREATE POLICY ai_monthly_usage_read ON public.ai_monthly_usage FOR SELECT TO authenticated
USING (establishment_id=public.current_establishment_id());

CREATE OR REPLACE FUNCTION public.consume_ai_quota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tenant uuid; monthly_limit integer; count_after integer;
BEGIN
  tenant := public.current_establishment_id();
  IF tenant IS NULL OR NOT public.is_admin_or_gestor()
    OR NOT public.user_has_module_access('indicators') THEN RETURN false; END IF;
  SELECT ai_monthly_limit INTO monthly_limit FROM public.establishments
    WHERE id=tenant AND status='active' AND ai_mode='enabled';
  IF monthly_limit IS NULL OR monthly_limit=0 THEN RETURN false; END IF;
  INSERT INTO public.ai_monthly_usage(establishment_id,month_start,requests)
    VALUES(tenant,date_trunc('month',now() AT TIME ZONE 'UTC')::date,1)
    ON CONFLICT(establishment_id,month_start) DO UPDATE
      SET requests=public.ai_monthly_usage.requests+1
      WHERE public.ai_monthly_usage.requests<monthly_limit
    RETURNING requests INTO count_after;
  RETURN count_after IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.consume_ai_quota() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota() TO authenticated;

-- This helper is used by Storage policies and must include the tenant check
-- even though the caller's table queries also have RLS.
CREATE OR REPLACE FUNCTION public.can_access_action_plan(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.current_establishment_id() IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.action_plans p WHERE p.id=p_id
      AND p.establishment_id=public.current_establishment_id()
      AND (lower(public.get_user_role()::text)='admin' OR p.owner_id=auth.uid()
        OR p.controller_id=auth.uid() OR auth.uid()=ANY(p.participant_ids)
        OR (p.owner_id IS NULL AND public.is_admin_or_gestor())));
$$;

CREATE OR REPLACE FUNCTION public.indicator_result_actors()
RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p.id,p.name FROM public.profiles p
  WHERE p.establishment_id=public.current_establishment_id() AND p.id IN (
    SELECT h.created_by FROM public.indicator_history h
      WHERE h.establishment_id=public.current_establishment_id()
    UNION SELECT a.created_by FROM public.indicator_result_analyses a
      WHERE a.establishment_id=public.current_establishment_id()
    UNION SELECT d.changed_by FROM public.indicator_definition_history d
      WHERE d.establishment_id=public.current_establishment_id());
$$;

CREATE OR REPLACE FUNCTION public.save_document_level(p_level integer,p_name text)
RETURNS public.document_levels LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tenant uuid; saved public.document_levels;
BEGIN
  tenant := public.current_establishment_id();
  IF tenant IS NULL OR lower(coalesce(public.get_user_role()::text,'')) NOT IN ('admin','gestor')
    OR NOT public.user_can_edit('documentos/hierarquia') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Invalid level name' USING ERRCODE='22023';
  END IF;
  IF p_level IS NULL THEN
    PERFORM pg_advisory_xact_lock(70116,1);
    INSERT INTO public.document_levels(establishment_id,level,name)
      SELECT tenant,coalesce(max(level),0)+1,btrim(p_name)
      FROM public.document_levels WHERE establishment_id=tenant
      RETURNING * INTO saved;
  ELSE
    UPDATE public.document_levels SET name=btrim(p_name)
      WHERE establishment_id=tenant AND level=p_level RETURNING * INTO saved;
    IF NOT FOUND THEN RAISE EXCEPTION 'Level not found' USING ERRCODE='P0002'; END IF;
  END IF;
  RETURN saved;
END $$;

-- The pre-tenant risk-matrix RPC deleted every classification in the shared
-- table. Keep its established validation and response, scoped to one tenant.
CREATE OR REPLACE FUNCTION public.save_risk_matrix_classifications(p_items jsonb)
RETURNS SETOF public.risk_matrix_classifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tenant uuid; item jsonb; next_min integer := 1; next_max integer;
  label_value text; background text; foreground text;
BEGIN
  tenant := public.current_establishment_id();
  IF tenant IS NULL OR lower(coalesce(public.get_user_role()::text,''))<>'admin'
    OR NOT public.user_can_edit('riscos/gerenciamento') THEN
    RAISE EXCEPTION 'Only a tenant administrator can configure the risk matrix' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 25 THEN
    RAISE EXCEPTION 'Provide between 1 and 25 classifications' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(71015,40000);
  DELETE FROM public.risk_matrix_classifications WHERE establishment_id=tenant;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    next_max := (item->>'max_score')::integer;
    label_value := btrim(item->>'label');
    background := item->>'background_color';
    foreground := item->>'text_color';
    IF next_max IS NULL OR next_max<next_min OR next_max>25
      OR nullif(label_value,'') IS NULL
      OR background IS NULL OR background!~'^#[0-9A-Fa-f]{6}$'
      OR foreground IS NULL OR foreground!~'^#[0-9A-Fa-f]{6}$' THEN
      RAISE EXCEPTION 'Invalid risk matrix classification' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.risk_matrix_classifications
      (establishment_id,min_score,max_score,label,background_color,text_color)
    VALUES (tenant,next_min,next_max,label_value,background,foreground);
    next_min := next_max+1;
  END LOOP;
  IF next_min<>26 THEN
    RAISE EXCEPTION 'The classifications must cover scores 1 through 25' USING ERRCODE='22023';
  END IF;
  UPDATE public.risks r SET risk_level=c.label
    FROM public.risk_matrix_classifications c
    WHERE r.establishment_id=tenant AND c.establishment_id=tenant
      AND r.risk_score BETWEEN c.min_score AND c.max_score
      AND r.risk_level IS DISTINCT FROM c.label;
  RETURN QUERY SELECT * FROM public.risk_matrix_classifications
    WHERE establishment_id=tenant ORDER BY min_score;
END $$;

-- Public notification tokens remain usable for their own tenant while active.
-- The token is an unguessable UUID and cannot select a different tenant.
CREATE OR REPLACE FUNCTION public.read_public_notification_form(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object('classification',c.name,'process',p.title,
    'schema',coalesce(c.form_schema,'[]'::jsonb),
    'types',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',nt.id,'name',nt.name)),'[]'::jsonb)
      FROM public.notification_types nt WHERE nt.classification_id=c.id AND nt.active))
  INTO result FROM public.public_notification_links l
    JOIN public.notification_classifications c ON c.id=l.classification_id
    JOIN public.processes p ON p.id=l.process_id AND p.establishment_id=l.establishment_id
    JOIN public.establishments e ON e.id=l.establishment_id AND e.status='active'
  WHERE l.token=p_token AND l.active AND l.expires_at>now()
    AND l.submissions<l.max_submissions AND c.active AND NOT p.obsolete;
  IF result IS NULL THEN RAISE EXCEPTION 'Link inválido ou expirado'; END IF;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.submit_public_notification(p_token uuid,p_payload jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.public_notification_links; c public.notification_classifications;
  typ public.notification_types; t public.tickets;
BEGIN
  SELECT * INTO l FROM public.public_notification_links WHERE token=p_token FOR UPDATE;
  PERFORM public.read_public_notification_form(p_token);
  SELECT * INTO c FROM public.notification_classifications WHERE id=l.classification_id
    AND establishment_id=l.establishment_id;
  SELECT * INTO typ FROM public.notification_types
    WHERE id=(p_payload->>'notification_type_id')::uuid
      AND classification_id=c.id AND establishment_id=l.establishment_id AND active;
  IF typ.id IS NULL OR length(btrim(coalesce(p_payload->>'title',''))) NOT BETWEEN 3 AND 200
    OR octet_length(p_payload::text)>100000 THEN RAISE EXCEPTION 'Informe título e tipo válidos'; END IF;
  PERFORM public.validate_notification_answers(c.form_schema,coalesce(p_payload->'custom_fields','{}'::jsonb));
  INSERT INTO public.tickets(establishment_id,title,description,process_id,notification_type_id,
    classification_id,classification_flag,incident_type,custom_fields,risk_id,sla_id)
  VALUES(l.establishment_id,btrim(p_payload->>'title'),p_payload->>'description',l.process_id,
    typ.id,c.id,c.name,typ.name,coalesce(p_payload->'custom_fields','{}'::jsonb),typ.risk_id,typ.sla_id)
  RETURNING * INTO t;
  UPDATE public.public_notification_links SET submissions=submissions+1 WHERE token=p_token;
  INSERT INTO public.ticket_history(establishment_id,ticket_id,action,reason,after_data)
    VALUES(l.establishment_id,t.id,'public_registration','Registro por formulário público',to_jsonb(t));
  RETURN t.code;
END $$;

-- Existing action evidence policies are permissive. Compose a restrictive
-- tenant check with every read/write policy, including the auditor grant.
CREATE POLICY tenant_action_evidence_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (bucket_id<>'action-evidence' OR public.can_access_action_plan((storage.foldername(name))[1]::uuid));
CREATE POLICY tenant_action_evidence_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id<>'action-evidence' OR public.can_access_action_plan((storage.foldername(name))[1]::uuid));
CREATE POLICY tenant_action_evidence_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (bucket_id<>'action-evidence' OR public.can_access_action_plan((storage.foldername(name))[1]::uuid))
WITH CHECK (bucket_id<>'action-evidence' OR public.can_access_action_plan((storage.foldername(name))[1]::uuid));
CREATE POLICY tenant_action_evidence_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (bucket_id<>'action-evidence' OR public.can_access_action_plan((storage.foldername(name))[1]::uuid));

-- Avatar paths already begin with the owner UUID. A private bucket prevents
-- unauthenticated public URLs from bypassing the ownership policy.
UPDATE storage.buckets SET public=false WHERE id='profile-avatars';
DROP POLICY IF EXISTS profile_avatars_read ON storage.objects;
CREATE POLICY profile_avatars_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='profile-avatars' AND EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id::text=(storage.foldername(name))[1]
    AND p.establishment_id=public.current_establishment_id()));

-- Lists and grants for global administrators are served by the implantation
-- Edge Function. Conventional users only see their own establishment.
CREATE POLICY implantation_audit_read ON public.implantation_audit FOR SELECT TO authenticated
USING (public.is_implantation_user());
ALTER TABLE public.implantation_audit ENABLE ROW LEVEL SECURITY;
