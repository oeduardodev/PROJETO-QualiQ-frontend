ALTER TABLE public.documents ADD COLUMN content_pdf_path text;
ALTER TABLE public.documents ADD COLUMN content_synced_version integer;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('document-versions','document-versions',false,10485760,ARRAY['application/pdf']) ON CONFLICT(id) DO NOTHING;
-- PDF snapshots are only accessible to the server, never through public Storage URLs.
CREATE FUNCTION public.sync_operation_document(p_id uuid,p_expected_updated_at timestamptz,p_actor uuid,p_html text,p_pdf_path text)
RETURNS public.documents LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.documents;
BEGIN
  SELECT * INTO d FROM public.documents WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR d.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Documento alterado durante a sincronização'; END IF;
  IF d.status NOT IN ('rascunho','em_revisao') OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND (lower(role::text)='admin' OR id=d.owner_id)) THEN RAISE EXCEPTION 'Sincronização não permitida'; END IF;
  IF nullif(p_html,'') IS NULL OR octet_length(p_html)>10485760 OR p_pdf_path NOT LIKE d.id::text||'/%' THEN RAISE EXCEPTION 'Conteúdo inválido'; END IF;
  UPDATE public.documents SET content_html=p_html,content_pdf_path=p_pdf_path,content_synced_version=d.version,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO d;
  INSERT INTO public.document_workflows(document_id,from_status,to_status,changed_by,notes,version) VALUES(d.id,d.status,d.status,p_actor,'Conteúdo sincronizado do Google Docs',d.version);
  RETURN d;
END $$;
REVOKE ALL ON FUNCTION public.sync_operation_document(uuid,timestamptz,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_operation_document(uuid,timestamptz,uuid,text,text) TO service_role;

-- Notification configuration is administrative, regardless of direct API access.
DROP POLICY IF EXISTS app_insert ON public.notification_classifications;
DROP POLICY IF EXISTS app_update ON public.notification_classifications;
DROP POLICY IF EXISTS app_delete ON public.notification_classifications;
DROP POLICY IF EXISTS app_insert ON public.notification_types;
DROP POLICY IF EXISTS app_update ON public.notification_types;
DROP POLICY IF EXISTS app_delete ON public.notification_types;
CREATE POLICY config_admin_insert ON public.notification_classifications FOR INSERT TO authenticated WITH CHECK(lower(public.get_user_role()::text)='admin');
CREATE POLICY config_admin_update ON public.notification_classifications FOR UPDATE TO authenticated USING(lower(public.get_user_role()::text)='admin') WITH CHECK(lower(public.get_user_role()::text)='admin');
CREATE POLICY types_admin_insert ON public.notification_types FOR INSERT TO authenticated WITH CHECK(lower(public.get_user_role()::text)='admin');
CREATE POLICY types_admin_update ON public.notification_types FOR UPDATE TO authenticated USING(lower(public.get_user_role()::text)='admin') WITH CHECK(lower(public.get_user_role()::text)='admin');
REVOKE DELETE ON public.notification_classifications,public.notification_types FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.enforce_ticket_terminal_analysis() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.status<>'arquivado' AND EXISTS(SELECT 1 FROM public.ticket_statuses WHERE key=NEW.status AND is_terminal)
    AND (NEW.requires_root_cause_snapshot OR EXISTS(SELECT 1 FROM public.analysis_tools WHERE key=NEW.analysis_tool_snapshot AND requires_completion)) AND NOT NEW.analysis_completed THEN
    RAISE EXCEPTION 'Conclua a análise de causa antes de finalizar';
  END IF; RETURN NEW;
END $$;

-- Existing suggestion entry points use the same controlled creation operation.
CREATE OR REPLACE FUNCTION public.create_action_plans_from_suggestions(p_ticket_id uuid,p_suggestions jsonb)
RETURNS SETOF public.action_plans LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE suggestion jsonb; p public.action_plans;
BEGIN
  IF NOT public.is_admin_or_gestor() OR jsonb_typeof(p_suggestions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_suggestions) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Sugestões inválidas ou usuário não autorizado'; END IF;
  FOR suggestion IN SELECT value FROM jsonb_array_elements(p_suggestions) LOOP
    SELECT * INTO p FROM public.save_operation_plan(NULL,NULL,suggestion||jsonb_build_object('ticket_id',p_ticket_id,'owner_id',auth.uid(),'controller_id',auth.uid(),'participant_ids',jsonb_build_array(auth.uid()),'how_mode','text'),'Plano criado a partir de sugestão');
    RETURN NEXT p;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.create_plans_for_indicator_analysis(p_analysis_id uuid,p_ticket_id uuid)
RETURNS SETOF public.action_plans LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.indicator_result_analyses; i public.indicators; suggestion jsonb; p public.action_plans; ids uuid[]:='{}';
BEGIN
  IF NOT public.is_admin_or_gestor() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  SELECT * INTO a FROM public.indicator_result_analyses WHERE id=p_analysis_id FOR UPDATE;
  IF NOT FOUND OR cardinality(a.action_plan_ids)>0 THEN RAISE EXCEPTION 'Análise inexistente ou planos já criados'; END IF;
  SELECT * INTO i FROM public.indicators WHERE id=a.indicator_id;
  IF lower(public.get_user_role()::text)<>'admin' AND NOT EXISTS(SELECT 1 FROM public.processes WHERE id=i.process_id AND category_id=public.get_user_category_id()) THEN RAISE EXCEPTION 'Processo não autorizado'; END IF;
  IF p_ticket_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tickets WHERE id=p_ticket_id AND process_id=i.process_id) THEN RAISE EXCEPTION 'Notificação de outro processo'; END IF;
  FOR suggestion IN SELECT value FROM jsonb_array_elements(a.suggestions) LOOP
    SELECT * INTO p FROM public.save_operation_plan(NULL,NULL,suggestion||jsonb_build_object('ticket_id',p_ticket_id,'process_id',i.process_id,'owner_id',auth.uid(),'controller_id',auth.uid(),'participant_ids',jsonb_build_array(auth.uid()),'how_mode','text'),'Plano da análise crítica');
    PERFORM set_config('orbis.operation_reason','Vínculo com análise crítica',true);
    UPDATE public.action_plans SET origin='critical_analysis' WHERE id=p.id RETURNING * INTO p;
    ids:=array_append(ids,p.id); RETURN NEXT p;
  END LOOP;
  UPDATE public.indicator_result_analyses SET action_plan_ids=ids WHERE id=a.id;
END $$;
NOTIFY pgrst,'reload schema';
