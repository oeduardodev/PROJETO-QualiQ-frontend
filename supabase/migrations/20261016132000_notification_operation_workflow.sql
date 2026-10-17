CREATE TABLE public.operation_code_counters (scope text PRIMARY KEY, last_number bigint NOT NULL);
REVOKE ALL ON public.operation_code_counters FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.next_operation_number(p_scope text) RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO public.operation_code_counters VALUES(p_scope,1)
  ON CONFLICT(scope) DO UPDATE SET last_number=public.operation_code_counters.last_number+1
  RETURNING last_number;
$$;
REVOKE ALL ON FUNCTION public.next_operation_number(text) FROM PUBLIC,anon,authenticated;
ALTER TABLE public.tickets
  ADD COLUMN assigned_to uuid REFERENCES public.profiles(id),
  ADD COLUMN due_at timestamptz,
  ADD COLUMN treatment text,
  ADD COLUMN classification_id uuid REFERENCES public.notification_classifications(id),
  ADD COLUMN analysis_tool_snapshot text,
  ADD COLUMN requires_root_cause_snapshot boolean NOT NULL DEFAULT false;
UPDATE public.tickets t SET classification_id=n.classification_id FROM public.notification_types n WHERE n.id=t.notification_type_id;
CREATE TABLE public.ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES public.tickets(id),
  action text NOT NULL,reason text NOT NULL,before_data jsonb,after_data jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id),changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY ticket_history_read ON public.ticket_history FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.tickets WHERE id=ticket_id));
GRANT SELECT ON public.ticket_history TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.ticket_history FROM PUBLIC,anon,authenticated;

INSERT INTO public.ticket_statuses(key,label,order_index,is_terminal) VALUES
('validacao','Validação administrativa',35,false),('arquivado','Arquivadas',50,true)
ON CONFLICT(key) DO NOTHING;
UPDATE public.ticket_statuses SET next_status_key='validacao' WHERE key='plano';
UPDATE public.ticket_statuses SET next_status_key='concluido' WHERE key='validacao';
-- Preserve existing codes and generate immutable identifiers for new records only.
DROP TRIGGER assign_module_code ON public.tickets;
ALTER TABLE public.tickets DROP CONSTRAINT tickets_code_format;
CREATE FUNCTION public.notification_type_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.notification_classifications; n bigint;
BEGIN
  SELECT * INTO c FROM public.notification_classifications WHERE id=NEW.classification_id;
  IF TG_OP='UPDATE' AND NEW.classification_id IS NOT DISTINCT FROM OLD.classification_id THEN NEW.code:=OLD.code; RETURN NEW; END IF;
  IF c.id IS NULL OR NOT c.active OR c.code IS NULL OR c.code !~ '^[A-Z][A-Z0-9]{1,7}$' THEN RAISE EXCEPTION 'Configure a sigla da classificação antes de cadastrar tipos'; END IF;
  LOOP
    n:=public.next_operation_number('type:'||c.code);
    NEW.code:=c.code||'.'||lpad(n::text,greatest(4,length(n::text)),'0');
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.notification_types WHERE code=NEW.code);
  END LOOP;
  NEW.analysis_tool:=c.analysis_tool; NEW.requires_root_cause:=c.requires_root_cause; NEW.sla_hours:=c.sla_hours;
  RETURN NEW;
END $$;
CREATE TRIGGER notification_type_code BEFORE INSERT OR UPDATE ON public.notification_types FOR EACH ROW EXECUTE FUNCTION public.notification_type_code();
CREATE FUNCTION public.notification_ticket_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tag text; n bigint;
BEGIN
  IF TG_OP='UPDATE' THEN NEW.code:=OLD.code; RETURN NEW; END IF;
  SELECT replace(code,'.','') INTO tag FROM public.notification_types WHERE id=NEW.notification_type_id;
  tag:=coalesce(tag,'NTF');
  LOOP
    n:=public.next_operation_number('notification');
    NEW.code:='RESG-'||lpad(n::text,greatest(2,length(n::text)),'0')||'-'||tag;
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.tickets WHERE code=NEW.code);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER notification_ticket_code BEFORE INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.notification_ticket_code();
CREATE FUNCTION public.validate_notification_classification() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  NEW.code:=upper(btrim(NEW.code));
  IF NEW.code IS NULL OR NEW.code !~ '^[A-Z][A-Z0-9]{1,7}$' OR NEW.sla_hours IS NULL OR NEW.sla_hours<=0 THEN RAISE EXCEPTION 'Informe sigla de 2 a 8 caracteres e prazo positivo'; END IF;
  IF EXISTS(SELECT 1 FROM public.notification_classifications WHERE code=NEW.code AND id<>NEW.id) THEN RAISE EXCEPTION 'Sigla já utilizada'; END IF;
  IF TG_OP='UPDATE' AND NEW.code IS DISTINCT FROM OLD.code AND EXISTS(SELECT 1 FROM public.notification_types WHERE classification_id=OLD.id) THEN RAISE EXCEPTION 'A sigla não pode mudar após o cadastro dos tipos'; END IF;
  IF jsonb_typeof(coalesce(NEW.form_schema,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'Questionário inválido'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.form_schema) f WHERE coalesce(f->>'name','') !~ '^[a-z][a-z0-9_]{0,49}$' OR nullif(btrim(f->>'label'),'') IS NULL OR f->>'type' NOT IN ('text','number','date','select'))
    OR (SELECT count(*)<>count(DISTINCT f->>'name') FROM jsonb_array_elements(NEW.form_schema) f) THEN RAISE EXCEPTION 'Campos inválidos ou duplicados'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_notification_classification BEFORE INSERT OR UPDATE ON public.notification_classifications FOR EACH ROW EXECUTE FUNCTION public.validate_notification_classification();
CREATE FUNCTION public.validate_notification_answers(p_schema jsonb,p_answers jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE f jsonb; answer text;
BEGIN
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text)>100000 THEN RAISE EXCEPTION 'Respostas inválidas'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(coalesce(p_schema,'[]'::jsonb)) LOOP
    answer:=p_answers->>(f->>'name');
    IF (f->>'required')::boolean AND nullif(btrim(answer),'') IS NULL THEN RAISE EXCEPTION 'Preencha o campo %',f->>'label'; END IF;
    IF nullif(answer,'') IS NOT NULL THEN
      IF f->>'type'='select' AND NOT(coalesce(f->'options','[]'::jsonb) ? answer) THEN RAISE EXCEPTION 'Opção inválida para %',f->>'label'; END IF;
      IF f->>'type'='number' AND answer !~ '^-?[0-9]+(\.[0-9]+)?$' THEN RAISE EXCEPTION 'Número inválido'; END IF;
      IF f->>'type'='date' THEN PERFORM answer::date; END IF;
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_notification_answers(jsonb,jsonb) FROM PUBLIC,anon,authenticated;

-- Direct API writes cannot skip triage, assignment, or administrative validation.
REVOKE INSERT,UPDATE,DELETE ON public.tickets FROM PUBLIC,anon,authenticated;
REVOKE UPDATE(title,description,process_id,step_id,status,severity,classification_flag,incident_type,free_description,incident_datetime,risk_id,sla_id,notification_type_id,analysis_completed,custom_fields,updated_at) ON public.tickets FROM authenticated;
CREATE FUNCTION public.save_operation_ticket(p_id uuid,p_expected_updated_at timestamptz,p_payload jsonb,p_reason text)
RETURNS public.tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.tickets; saved public.tickets; typ public.notification_types; c public.notification_classifications; step uuid; process uuid;
BEGIN
  IF public.get_user_role() IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  SELECT * INTO typ FROM public.notification_types WHERE id=(p_payload->>'notification_type_id')::uuid;
  SELECT * INTO c FROM public.notification_classifications WHERE id=typ.classification_id;
  IF typ.id IS NULL OR c.id IS NULL OR NOT typ.active OR NOT c.active THEN RAISE EXCEPTION 'Selecione classificação e tipo ativos'; END IF;
  process:=(p_payload->>'process_id')::uuid; step:=nullif(p_payload->>'step_id','')::uuid;
  IF nullif(btrim(p_payload->>'title'),'') IS NULL OR NOT EXISTS(SELECT 1 FROM public.processes WHERE id=process AND NOT obsolete) THEN RAISE EXCEPTION 'Título e processo válidos são obrigatórios'; END IF;
  IF step IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sipoc_nodes WHERE id=step AND node_type='P' AND process_id=process) THEN RAISE EXCEPTION 'Etapa inválida'; END IF;
  PERFORM public.validate_notification_answers(c.form_schema,coalesce(p_payload->'custom_fields','{}'::jsonb));
  IF p_id IS NULL THEN
    INSERT INTO public.tickets(title,description,process_id,step_id,notification_type_id,classification_id,classification_flag,incident_type,incident_datetime,risk_id,sla_id,custom_fields,created_by)
    VALUES(btrim(p_payload->>'title'),p_payload->>'description',process,step,typ.id,c.id,c.name,typ.name,nullif(p_payload->>'incident_datetime','')::timestamptz,typ.risk_id,typ.sla_id,coalesce(p_payload->'custom_fields','{}'::jsonb),auth.uid()) RETURNING * INTO saved;
  ELSE
    SELECT * INTO old FROM public.tickets WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR old.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Registro alterado. Recarregue'; END IF;
    IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
    IF lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' AND (old.assigned_to IS DISTINCT FROM auth.uid() OR old.status NOT IN ('analise','plano')) THEN RAISE EXCEPTION 'Somente o gestor designado pode realizar a tratativa'; END IF;
    IF old.status IN ('concluido','arquivado') THEN RAISE EXCEPTION 'Investigação encerrada'; END IF;
    IF lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' AND (typ.id IS DISTINCT FROM old.notification_type_id OR process IS DISTINCT FROM old.process_id) THEN RAISE EXCEPTION 'Reclassificação é administrativa'; END IF;
    UPDATE public.tickets SET title=btrim(p_payload->>'title'),description=p_payload->>'description',step_id=step,process_id=process,
      notification_type_id=typ.id,classification_id=c.id,classification_flag=c.name,incident_type=typ.name,
      custom_fields=coalesce(p_payload->'custom_fields','{}'::jsonb),treatment=p_payload->>'treatment',
      analysis_completed=CASE WHEN c.id IS DISTINCT FROM old.classification_id THEN false ELSE coalesce((p_payload->>'analysis_completed')::boolean,false) END,
      analysis_tool_snapshot=CASE WHEN c.id IS DISTINCT FROM old.classification_id THEN c.analysis_tool ELSE old.analysis_tool_snapshot END,
      requires_root_cause_snapshot=CASE WHEN c.id IS DISTINCT FROM old.classification_id THEN c.requires_root_cause ELSE old.requires_root_cause_snapshot END,
      due_at=CASE WHEN c.id IS DISTINCT FROM old.classification_id AND old.assigned_to IS NOT NULL THEN now()+c.sla_hours*interval '1 hour' ELSE old.due_at END,
      status=CASE WHEN c.id IS DISTINCT FROM old.classification_id AND old.status='validacao' THEN 'analise' ELSE old.status END,
      updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO saved;
  END IF;
  INSERT INTO public.ticket_history(ticket_id,action,reason,before_data,after_data,changed_by)
  VALUES(saved.id,CASE WHEN p_id IS NULL THEN 'registered' ELSE 'updated' END,coalesce(nullif(btrim(p_reason),''),'Registro inicial'),CASE WHEN p_id IS NULL THEN NULL ELSE to_jsonb(old) END,to_jsonb(saved),auth.uid());
  RETURN saved;
END $$;
CREATE FUNCTION public.transition_operation_ticket(p_id uuid,p_expected_updated_at timestamptz,p_action text,p_manager uuid,p_reason text)
RETURNS public.tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.tickets; previous public.tickets; c public.notification_classifications; target text; admin boolean:=coalesce(lower(public.get_user_role()::text)='admin',false);
BEGIN
  IF auth.uid() IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT * INTO t FROM public.tickets WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR t.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Registro alterado. Recarregue'; END IF;
  previous:=t;
  SELECT * INTO c FROM public.notification_classifications WHERE id=t.classification_id;
  CASE p_action
    WHEN 'forward' THEN
      IF NOT admin OR t.status NOT IN ('aberto','analise','plano') OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_manager AND lower(role::text)='gestor') OR c.sla_hours IS NULL OR c.sla_hours<=0 THEN RAISE EXCEPTION 'Configure o prazo da classificação e selecione um gestor'; END IF;
      target:='analise'; t.assigned_to:=p_manager; t.due_at:=now()+c.sla_hours*interval '1 hour'; t.analysis_tool_snapshot:=c.analysis_tool; t.requires_root_cause_snapshot:=c.requires_root_cause;
    WHEN 'archive' THEN
      IF NOT admin OR t.status IN ('concluido','arquivado') THEN RAISE EXCEPTION 'Arquivamento não permitido'; END IF;
      target:='arquivado';
    WHEN 'submit' THEN
      IF t.assigned_to IS DISTINCT FROM auth.uid() OR t.status NOT IN ('analise','plano') OR nullif(btrim(t.treatment),'') IS NULL THEN RAISE EXCEPTION 'O gestor deve registrar a tratativa antes de enviar'; END IF;
      IF (t.requires_root_cause_snapshot OR EXISTS(SELECT 1 FROM public.analysis_tools WHERE key=t.analysis_tool_snapshot AND requires_completion)) AND NOT t.analysis_completed THEN RAISE EXCEPTION 'Conclua a análise de causa'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.action_plans WHERE ticket_id=t.id) THEN RAISE EXCEPTION 'Estruture o plano de ação antes de enviar'; END IF;
      target:='validacao';
    WHEN 'accept','return' THEN
      IF NOT admin OR t.status<>'validacao' THEN RAISE EXCEPTION 'Validação não permitida'; END IF;
      target:=CASE WHEN p_action='accept' THEN 'concluido' ELSE 'analise' END;
    ELSE RAISE EXCEPTION 'Ação inválida';
  END CASE;
  UPDATE public.tickets SET status=target,assigned_to=t.assigned_to,due_at=t.due_at,analysis_tool_snapshot=t.analysis_tool_snapshot,requires_root_cause_snapshot=t.requires_root_cause_snapshot,updated_at=clock_timestamp() WHERE id=t.id RETURNING * INTO t;
  INSERT INTO public.ticket_history(ticket_id,action,reason,before_data,after_data,changed_by) VALUES(t.id,p_action,btrim(p_reason),to_jsonb(previous),to_jsonb(t),auth.uid());
  RETURN t;
END $$;
-- The assigned manager can see forwarded tickets irrespective of the process category.
CREATE POLICY assigned_ticket_read ON public.tickets FOR SELECT TO authenticated USING(assigned_to=auth.uid());

CREATE TABLE public.public_notification_links (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),classification_id uuid NOT NULL REFERENCES public.notification_classifications(id),
  process_id uuid NOT NULL REFERENCES public.processes(id),created_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',active boolean NOT NULL DEFAULT true,
  submissions integer NOT NULL DEFAULT 0,max_submissions integer NOT NULL DEFAULT 1000
);
ALTER TABLE public.public_notification_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_notification_links FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.create_public_notification_link(p_classification uuid,p_process uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token uuid;
BEGIN
  IF lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' OR NOT EXISTS(SELECT 1 FROM public.notification_classifications WHERE id=p_classification AND active) OR NOT EXISTS(SELECT 1 FROM public.processes WHERE id=p_process AND NOT obsolete) THEN RAISE EXCEPTION 'Não autorizado ou vínculo inválido'; END IF;
  INSERT INTO public.public_notification_links(classification_id,process_id,created_by) VALUES(p_classification,p_process,auth.uid()) RETURNING public_notification_links.token INTO token;
  RETURN token;
END $$;
CREATE FUNCTION public.read_public_notification_form(p_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object('classification',c.name,'process',p.title,'schema',coalesce(c.form_schema,'[]'::jsonb),'types',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]'::jsonb) FROM public.notification_types WHERE classification_id=c.id AND active))
  INTO result FROM public.public_notification_links l JOIN public.notification_classifications c ON c.id=l.classification_id JOIN public.processes p ON p.id=l.process_id
  WHERE l.token=p_token AND l.active AND l.expires_at>now() AND l.submissions<l.max_submissions AND c.active AND NOT p.obsolete;
  IF result IS NULL THEN RAISE EXCEPTION 'Link inválido ou expirado'; END IF;
  RETURN result;
END $$;
CREATE FUNCTION public.submit_public_notification(p_token uuid,p_payload jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.public_notification_links; c public.notification_classifications; typ public.notification_types; t public.tickets;
BEGIN
  SELECT * INTO l FROM public.public_notification_links WHERE token=p_token FOR UPDATE;
  PERFORM public.read_public_notification_form(p_token);
  SELECT * INTO c FROM public.notification_classifications WHERE id=l.classification_id;
  SELECT * INTO typ FROM public.notification_types WHERE id=(p_payload->>'notification_type_id')::uuid AND classification_id=c.id AND active;
  IF typ.id IS NULL OR length(btrim(coalesce(p_payload->>'title',''))) NOT BETWEEN 3 AND 200 OR octet_length(p_payload::text)>100000 THEN RAISE EXCEPTION 'Informe título e tipo válidos'; END IF;
  PERFORM public.validate_notification_answers(c.form_schema,coalesce(p_payload->'custom_fields','{}'::jsonb));
  INSERT INTO public.tickets(title,description,process_id,notification_type_id,classification_id,classification_flag,incident_type,custom_fields,risk_id,sla_id)
  VALUES(btrim(p_payload->>'title'),p_payload->>'description',l.process_id,typ.id,c.id,c.name,typ.name,coalesce(p_payload->'custom_fields','{}'::jsonb),typ.risk_id,typ.sla_id) RETURNING * INTO t;
  UPDATE public.public_notification_links SET submissions=submissions+1 WHERE token=p_token;
  INSERT INTO public.ticket_history(ticket_id,action,reason,after_data) VALUES(t.id,'public_registration','Registro por formulário público',to_jsonb(t));
  RETURN t.code;
END $$;
DO $$ DECLARE f regprocedure; BEGIN
  FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('save_operation_ticket','transition_operation_ticket','create_public_notification_link','read_public_notification_form','submit_public_notification') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.read_public_notification_form(uuid),public.submit_public_notification(uuid,jsonb) TO anon;
