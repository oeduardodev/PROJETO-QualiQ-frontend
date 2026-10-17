ALTER TABLE public.action_plans ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE public.action_plans
  ADD COLUMN process_id uuid REFERENCES public.processes(id),
  ADD COLUMN origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','notification','critical_analysis','system')),
  ADD COLUMN owner_id uuid REFERENCES public.profiles(id),
  ADD COLUMN controller_id uuid REFERENCES public.profiles(id),
  ADD COLUMN participant_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN how_mode text NOT NULL DEFAULT 'text' CHECK(how_mode IN ('text','tasks')),
  ADD COLUMN tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  ADD COLUMN approved_progress integer NOT NULL DEFAULT 0 CHECK(approved_progress BETWEEN 0 AND 100),
  ADD COLUMN review_state text NOT NULL DEFAULT 'none' CHECK(review_state IN ('none','pending','approved','rejected')),
  ADD COLUMN active boolean NOT NULL DEFAULT true;
UPDATE public.action_plans p SET process_id=t.process_id,origin='notification' FROM public.tickets t WHERE t.id=p.ticket_id;
CREATE TABLE public.action_plan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),plan_id uuid NOT NULL REFERENCES public.action_plans(id),
  action text NOT NULL,justification text NOT NULL,before_data jsonb,after_data jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id),changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.action_plan_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),plan_id uuid NOT NULL REFERENCES public.action_plans(id),
  body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 10000),created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.action_plan_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),plan_id uuid NOT NULL REFERENCES public.action_plans(id),
  name text NOT NULL,storage_path text NOT NULL UNIQUE,mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/png','image/jpeg','image/webp')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.operation_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,route text NOT NULL,record_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz
);
ALTER TABLE public.operation_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbox_read ON public.operation_inbox FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY inbox_update ON public.operation_inbox FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
REVOKE ALL ON public.operation_inbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE(read_at) ON public.operation_inbox TO authenticated;
CREATE FUNCTION public.can_access_action_plan(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.action_plans WHERE id=p_id AND (lower(public.get_user_role()::text)='admin' OR owner_id=auth.uid() OR controller_id=auth.uid() OR auth.uid()=ANY(participant_ids) OR (owner_id IS NULL AND public.is_admin_or_gestor())));
$$;
REVOKE ALL ON FUNCTION public.can_access_action_plan(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_action_plan(uuid) TO authenticated;
CREATE POLICY action_participant_read ON public.action_plans FOR SELECT TO authenticated USING(public.can_access_action_plan(id));
CREATE POLICY operation_profile_read ON public.profiles FOR SELECT TO authenticated USING(public.get_user_role() IS NOT NULL);
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['action_plan_history','action_plan_comments','action_plan_evidence'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('CREATE POLICY participant_read ON public.%I FOR SELECT TO authenticated USING(public.can_access_action_plan(plan_id))',tab);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
  END LOOP;
END $$;
CREATE POLICY participant_comment ON public.action_plan_comments FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.can_access_action_plan(plan_id));
CREATE POLICY participant_evidence ON public.action_plan_evidence FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.can_access_action_plan(plan_id) AND storage_path LIKE plan_id::text||'/'||auth.uid()::text||'/%');
GRANT INSERT(plan_id,body) ON public.action_plan_comments TO authenticated;
GRANT INSERT(plan_id,name,storage_path,mime_type) ON public.action_plan_evidence TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('action-evidence','action-evidence',false,10485760,ARRAY['application/pdf','image/png','image/jpeg','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY action_evidence_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='action-evidence' AND public.can_access_action_plan((storage.foldername(name))[1]::uuid));
CREATE POLICY action_evidence_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='action-evidence' AND (storage.foldername(name))[2]=auth.uid()::text AND public.can_access_action_plan((storage.foldername(name))[1]::uuid));

DROP TRIGGER assign_module_code ON public.action_plans;
CREATE FUNCTION public.operation_plan_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tag text; n bigint;
BEGIN
  IF TG_OP='UPDATE' THEN NEW.code:=OLD.code; RETURN NEW; END IF;
  IF NEW.ticket_id IS NOT NULL THEN SELECT process_id INTO NEW.process_id FROM public.tickets WHERE id=NEW.ticket_id; NEW.origin:='notification'; END IF;
  SELECT code INTO tag FROM public.processes WHERE id=NEW.process_id;
  tag:=coalesce(tag,'GER');
  LOOP
    n:=public.next_operation_number('plan:'||tag); NEW.code:=tag||'.PDA.'||lpad(n::text,greatest(4,length(n::text)),'0');
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.action_plans WHERE code=NEW.code);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER operation_plan_code BEFORE INSERT OR UPDATE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION public.operation_plan_code();
CREATE FUNCTION public.audit_operation_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE reason text:=current_setting('orbis.operation_reason',true); action text:=current_setting('orbis.operation_action',true); recipient uuid;
BEGIN
  IF TG_OP='UPDATE' AND nullif(btrim(reason),'') IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória para alterar o plano'; END IF;
  INSERT INTO public.action_plan_history(plan_id,action,justification,before_data,after_data,changed_by)
  VALUES(NEW.id,coalesce(nullif(action,''),lower(TG_OP)),coalesce(nullif(reason,''),'Criação do plano'),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW),auth.uid());
  FOR recipient IN SELECT DISTINCT r FROM unnest(NEW.participant_ids||ARRAY[NEW.owner_id,NEW.controller_id]) r WHERE r IS NOT NULL LOOP
    IF TG_OP='INSERT' OR NOT(recipient=ANY(OLD.participant_ids||ARRAY[coalesce(OLD.owner_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(OLD.controller_id,'00000000-0000-0000-0000-000000000000'::uuid)])) OR (NEW.review_state='pending' AND OLD.review_state<>'pending' AND recipient=NEW.controller_id) THEN
      INSERT INTO public.operation_inbox(user_id,title,route,record_id) VALUES(recipient,'Plano de ação: '||NEW.title,'/planos-acao',NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_operation_plan AFTER INSERT OR UPDATE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION public.audit_operation_plan();
CREATE FUNCTION public.notify_ticket_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.operation_inbox(user_id,title,route,record_id) VALUES(NEW.assigned_to,'Notificação encaminhada: '||NEW.title,'/notificacoes/painel',NEW.id);
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER notify_ticket_assignment AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_assignment();

REVOKE INSERT,UPDATE,DELETE ON public.action_plans FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.save_operation_plan(p_id uuid,p_expected_updated_at timestamptz,p_payload jsonb,p_reason text)
RETURNS public.action_plans LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.action_plans; p public.action_plans; participants uuid[]; v_tasks jsonb; task jsonb; owner uuid; controller uuid; ticket uuid; process uuid; v_progress integer; initial_status text;
BEGIN
  IF public.get_user_role() IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF p_id IS NULL AND NOT public.is_admin_or_gestor() THEN RAISE EXCEPTION 'Somente administradores e gestores podem criar planos'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO old FROM public.action_plans WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR old.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Plano alterado. Recarregue'; END IF;
    IF NOT old.active OR (lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' AND old.owner_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Somente o responsável pode editar o plano'; END IF;
    IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  END IF;
  owner:=(p_payload->>'owner_id')::uuid; controller:=(p_payload->>'controller_id')::uuid;
  ticket:=nullif(p_payload->>'ticket_id','')::uuid; process:=nullif(p_payload->>'process_id','')::uuid;
  SELECT coalesce(array_agg(DISTINCT value::uuid),'{}'::uuid[]) INTO participants FROM jsonb_array_elements_text(coalesce(p_payload->'participant_ids','[]'::jsonb));
  IF nullif(btrim(p_payload->>'title'),'') IS NULL OR owner IS NULL OR controller IS NULL THEN RAISE EXCEPTION 'Título, responsável principal e controlador são obrigatórios'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(participants||ARRAY[owner,controller]) r WHERE NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=r)) THEN RAISE EXCEPTION 'Usuários inválidos'; END IF;
  IF ticket IS NOT NULL THEN
    SELECT process_id INTO process FROM public.tickets WHERE id=ticket AND (lower(public.get_user_role()::text)='admin' OR assigned_to=auth.uid() OR created_by=auth.uid());
    IF NOT FOUND THEN RAISE EXCEPTION 'Notificação não acessível'; END IF;
  END IF;
  IF p_id IS NOT NULL AND (old.ticket_id IS DISTINCT FROM ticket OR old.process_id IS DISTINCT FROM process) THEN RAISE EXCEPTION 'A origem do plano não pode ser alterada'; END IF;
  v_tasks:=coalesce(p_payload->'tasks','[]'::jsonb);
  IF jsonb_typeof(v_tasks)<>'array' OR jsonb_array_length(v_tasks)>100 THEN RAISE EXCEPTION 'Lista de tarefas inválida'; END IF;
  IF p_payload->>'how_mode'='tasks' THEN
    IF jsonb_array_length(v_tasks)=0 THEN RAISE EXCEPTION 'Cadastre pelo menos uma tarefa'; END IF;
    FOR task IN SELECT value FROM jsonb_array_elements(v_tasks) LOOP
      IF nullif(btrim(task->>'title'),'') IS NULL OR nullif(task->>'due_date','') IS NULL OR nullif(task->>'id','') IS NULL THEN RAISE EXCEPTION 'Tarefa sem título, identificador ou prazo'; END IF;
      PERFORM (task->>'due_date')::date; PERFORM (task->>'id')::uuid;
      IF nullif(p_payload->>'when','') IS NOT NULL AND (task->>'due_date')::date>(p_payload->>'when')::date THEN RAISE EXCEPTION 'O prazo da tarefa deve estar dentro do prazo do plano'; END IF;
    END LOOP;
    IF (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(v_tasks)) THEN RAISE EXCEPTION 'Tarefas duplicadas'; END IF;
    -- Metadata edits cannot forge task completion. Completion has its own audited operation.
    SELECT jsonb_agg(value||jsonb_build_object('completed',coalesce((SELECT (x->>'completed')::boolean FROM jsonb_array_elements(coalesce(old.tasks,'[]'::jsonb)) x WHERE x->>'id'=value->>'id'),false))) INTO v_tasks FROM jsonb_array_elements(v_tasks);
    SELECT round(100.0*count(*) FILTER(WHERE (value->>'completed')::boolean)/count(*))::integer INTO v_progress FROM jsonb_array_elements(v_tasks);
  ELSE v_tasks:='[]'::jsonb; v_progress:=coalesce(old.approved_progress,0); END IF;
  SELECT key INTO initial_status FROM public.action_plan_statuses WHERE is_initial AND is_active LIMIT 1;
  IF initial_status IS NULL THEN RAISE EXCEPTION 'Etapa inicial não configurada'; END IF;
  PERFORM set_config('orbis.operation_reason',coalesce(nullif(btrim(p_reason),''),'Criação do plano'),true);
  PERFORM set_config('orbis.operation_action','save',true);
  IF p_id IS NULL THEN
    INSERT INTO public.action_plans(title,ticket_id,process_id,origin,owner_id,controller_id,participant_ids,what,why,"where","when",who,how,how_much,how_mode,tasks,status)
    VALUES(btrim(p_payload->>'title'),ticket,process,CASE WHEN ticket IS NOT NULL THEN 'notification' ELSE 'manual' END,owner,controller,participants,p_payload->>'what',p_payload->>'why',p_payload->>'where',nullif(p_payload->>'when','')::date,(SELECT string_agg(name,', ') FROM public.profiles WHERE id=ANY(participants)),p_payload->>'how',p_payload->>'how_much',coalesce(p_payload->>'how_mode','text'),v_tasks,initial_status) RETURNING * INTO p;
  ELSE
    UPDATE public.action_plans SET title=btrim(p_payload->>'title'),owner_id=owner,controller_id=controller,participant_ids=participants,
      what=p_payload->>'what',why=p_payload->>'why',"where"=p_payload->>'where',"when"=nullif(p_payload->>'when','')::date,who=(SELECT string_agg(name,', ') FROM public.profiles WHERE id=ANY(participants)),
      how=p_payload->>'how',how_much=p_payload->>'how_much',how_mode=coalesce(p_payload->>'how_mode','text'),tasks=v_tasks,progress=v_progress,
      review_state=CASE WHEN old.tasks IS DISTINCT FROM v_tasks OR old.controller_id IS DISTINCT FROM controller THEN 'pending' ELSE old.review_state END,
      updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO p;
  END IF;
  RETURN p;
END $$;
CREATE FUNCTION public.update_operation_task(p_id uuid,p_expected_updated_at timestamptz,p_task uuid,p_completed boolean,p_reason text)
RETURNS public.action_plans LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.action_plans; v_tasks jsonb; v_progress integer;
BEGIN
  SELECT * INTO p FROM public.action_plans WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR p.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Plano alterado. Recarregue'; END IF;
  IF NOT public.can_access_action_plan(p.id) OR NOT p.active OR p.how_mode<>'tasks' OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Operação não permitida ou sem justificativa'; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.tasks) t WHERE t->>'id'=p_task::text) THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;
  SELECT jsonb_agg(CASE WHEN t->>'id'=p_task::text THEN t||jsonb_build_object('completed',p_completed) ELSE t END) INTO v_tasks FROM jsonb_array_elements(p.tasks) t;
  SELECT round(100.0*count(*) FILTER(WHERE (t->>'completed')::boolean)/count(*))::integer INTO v_progress FROM jsonb_array_elements(v_tasks) t;
  PERFORM set_config('orbis.operation_reason',btrim(p_reason),true); PERFORM set_config('orbis.operation_action','task',true);
  UPDATE public.action_plans a SET tasks=v_tasks,progress=v_progress,review_state='pending',updated_at=clock_timestamp() WHERE id=p.id RETURNING a.* INTO p;
  RETURN p;
END $$;
CREATE FUNCTION public.transition_operation_plan(p_id uuid,p_expected_updated_at timestamptz,p_action text,p_reason text)
RETURNS public.action_plans LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.action_plans; next_status text;
BEGIN
  SELECT * INTO p FROM public.action_plans WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR p.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Plano alterado. Recarregue'; END IF;
  IF NOT public.can_access_action_plan(p.id) OR nullif(btrim(p_reason),'') IS NULL OR NOT p.active THEN RAISE EXCEPTION 'Operação não permitida ou sem justificativa'; END IF;
  CASE p_action
    WHEN 'request' THEN
      IF p.owner_id IS NULL OR p.controller_id IS NULL THEN RAISE EXCEPTION 'Configure responsável e controlador'; END IF;
      IF p.how_mode='text' THEN
        SELECT next_status_key INTO next_status FROM public.action_plan_statuses WHERE key=p.status;
        IF next_status IS NULL THEN RAISE EXCEPTION 'Plano já está na última etapa'; END IF;
        p.progress:=CASE WHEN EXISTS(SELECT 1 FROM public.action_plan_statuses WHERE key=next_status AND is_terminal) THEN 100 ELSE 50 END;
      END IF; p.review_state:='pending';
    WHEN 'approve','reject' THEN
      IF p.controller_id IS DISTINCT FROM auth.uid() OR p.review_state<>'pending' THEN RAISE EXCEPTION 'Somente o controlador pode aprovar o progresso pendente'; END IF;
      p.review_state:=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END;
      IF p_action='approve' THEN
        p.approved_progress:=p.progress;
        SELECT key INTO next_status FROM public.action_plan_statuses WHERE is_active AND
          CASE WHEN p.progress=100 THEN is_terminal WHEN p.progress=0 THEN is_initial ELSE NOT is_initial AND NOT is_terminal AND key<>'atrasado' END
          ORDER BY order_index LIMIT 1;
        IF next_status IS NULL THEN RAISE EXCEPTION 'Etapa de progresso não configurada'; END IF;
        p.status:=next_status;
      END IF;
    WHEN 'deactivate' THEN
      IF lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' AND p.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Somente o responsável pode inativar'; END IF;
      p.active:=false;
    ELSE RAISE EXCEPTION 'Ação inválida';
  END CASE;
  PERFORM set_config('orbis.operation_reason',btrim(p_reason),true); PERFORM set_config('orbis.operation_action',p_action,true);
  UPDATE public.action_plans a SET progress=p.progress,approved_progress=p.approved_progress,review_state=p.review_state,status=p.status,active=p.active,updated_at=clock_timestamp() WHERE id=p.id RETURNING a.* INTO p;
  RETURN p;
END $$;
DO $$ DECLARE f regprocedure; BEGIN
  FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('save_operation_plan','update_operation_task','transition_operation_plan') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);
  END LOOP;
END $$;
