-- Documents can only be changed through audited operations. Never delete records.
ALTER TABLE public.documents
  ADD COLUMN step_id uuid REFERENCES public.sipoc_nodes(id),
  ADD COLUMN approver_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN content_html text;
ALTER TABLE public.document_workflows ADD COLUMN version integer NOT NULL DEFAULT 1;
CREATE TABLE public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id),
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id),
  justification text NOT NULL,
  UNIQUE(document_id, version)
);
CREATE TABLE public.document_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id),
  version integer NOT NULL,
  approver_id uuid NOT NULL REFERENCES public.profiles(id),
  approved boolean NOT NULL,
  comment text NOT NULL CHECK (length(btrim(comment)) > 0),
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, version, approver_id)
);
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_document_versions ON public.document_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY read_document_decisions ON public.document_decisions FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.document_versions, public.document_decisions TO authenticated;
REVOKE ALL ON public.document_versions, public.document_decisions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.document_versions, public.document_decisions FROM authenticated;
-- Include a baseline for existing documents without fabricating prior versions.
INSERT INTO public.document_versions(document_id,version,snapshot,justification)
SELECT id,0,to_jsonb(d),'Estado inicial na implantação do histórico de versões'
FROM public.documents d;

REVOKE INSERT, UPDATE, DELETE ON public.documents FROM PUBLIC, anon, authenticated;
REVOKE UPDATE(title,type_id,process_id,drive_link,print_allowed) ON public.documents FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.save_document(uuid,public.document_status,public.document_status,text,uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.advance_document(uuid,public.document_status,public.document_status) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.prevent_document_delete() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Documentos devem ser inativados; exclusão definitiva não é permitida'; END $$;
CREATE TRIGGER prevent_document_delete BEFORE DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.prevent_document_delete();

CREATE OR REPLACE FUNCTION public.assign_document_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE process_tag text; type_tag text; next_number bigint;
BEGIN
  IF TG_OP='UPDATE' AND OLD.code IS NOT NULL THEN NEW.code:=OLD.code; RETURN NEW; END IF;
  IF NEW.process_id IS NULL OR NEW.type_id IS NULL THEN NEW.code:=NULL; RETURN NEW; END IF;
  SELECT code INTO process_tag FROM public.processes WHERE id=NEW.process_id;
  SELECT acronym INTO type_tag FROM public.document_types WHERE id=NEW.type_id;
  INSERT INTO public.document_code_counters VALUES(process_tag,type_tag,1)
  ON CONFLICT(process_acronym,type_acronym) DO UPDATE SET last_number=public.document_code_counters.last_number+1
  RETURNING last_number INTO next_number;
  NEW.code:=process_tag||'.'||type_tag||'.'||lpad(next_number::text,greatest(4,length(next_number::text)),'0');
  RETURN NEW;
END $$;

CREATE FUNCTION public.save_operation_document(p_id uuid,p_expected_updated_at timestamptz,p_payload jsonb,p_reason text)
RETURNS public.documents LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.documents; saved public.documents; owner uuid; step uuid; process uuid; typ uuid; approvers uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  IF p_id IS NULL THEN
    IF lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Somente administradores podem criar documentos'; END IF;
  ELSE
    SELECT * INTO d FROM public.documents WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR d.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Documento alterado. Recarregue a página'; END IF;
    IF lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' AND d.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
    IF d.status NOT IN ('rascunho','em_revisao') THEN RAISE EXCEPTION 'Inicie uma revisão antes de editar'; END IF;
  END IF;
  owner:=(p_payload->>'owner_id')::uuid; step:=(p_payload->>'step_id')::uuid;
  process:=(p_payload->>'process_id')::uuid; typ:=(p_payload->>'type_id')::uuid;
  SELECT array_agg(DISTINCT value::uuid) INTO approvers FROM jsonb_array_elements_text(p_payload->'approver_ids');
  IF nullif(btrim(p_payload->>'title'),'') IS NULL OR owner IS NULL OR process IS NULL OR typ IS NULL
    OR step IS NULL OR coalesce(cardinality(approvers),0)=0 THEN RAISE EXCEPTION 'Informe título, tipo, processo, etapa, responsável e aprovadores'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=owner)
    OR EXISTS(SELECT 1 FROM unnest(approvers) a WHERE NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=a))
    OR NOT EXISTS(SELECT 1 FROM public.sipoc_nodes WHERE id=step AND process_id=process AND node_type='P')
    OR NOT EXISTS(SELECT 1 FROM public.document_types WHERE id=typ AND active) THEN RAISE EXCEPTION 'Vínculos inválidos'; END IF;
  IF p_id IS NOT NULL AND (d.process_id IS DISTINCT FROM process OR d.type_id IS DISTINCT FROM typ) THEN
    RAISE EXCEPTION 'Processo e tipo não podem alterar a identidade de um documento existente';
  END IF;
  IF nullif(p_payload->>'drive_link','') IS NOT NULL AND p_payload->>'drive_link' !~ '^https://docs\.google\.com/document/d/[A-Za-z0-9_-]+(/|$)' THEN
    RAISE EXCEPTION 'Informe um link válido do Google Docs';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.documents(title,type_id,process_id,step_id,owner_id,approver_ids,drive_link,status,print_allowed)
    SELECT btrim(p_payload->>'title'),typ,process,step,owner,approvers,nullif(p_payload->>'drive_link',''),'rascunho',print_allowed FROM public.document_types WHERE id=typ
    RETURNING * INTO saved;
  ELSE
    UPDATE public.documents SET title=btrim(p_payload->>'title'),step_id=step,owner_id=owner,approver_ids=approvers,
      drive_link=nullif(p_payload->>'drive_link',''),updated_at=clock_timestamp()
    WHERE id=p_id RETURNING * INTO saved;
  END IF;
  INSERT INTO public.document_workflows(document_id,from_status,to_status,changed_by,notes,version)
  VALUES(saved.id,d.status,saved.status,auth.uid(),btrim(p_reason),saved.version);
  RETURN saved;
END $$;

CREATE FUNCTION public.transition_operation_document(p_id uuid,p_expected_updated_at timestamptz,p_action text,p_reason text)
RETURNS public.documents LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.documents; previous_status public.document_status; target public.document_status; is_admin boolean:=coalesce(lower(public.get_user_role()::text)='admin',false);
BEGIN
  IF auth.uid() IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Usuário e justificativa obrigatórios'; END IF;
  SELECT * INTO d FROM public.documents WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR d.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Documento alterado. Recarregue a página'; END IF;
  target:=d.status; previous_status:=d.status;
  CASE p_action
    WHEN 'submit' THEN
      IF d.status NOT IN ('rascunho','em_revisao') OR NOT(is_admin OR d.owner_id=auth.uid()) THEN RAISE EXCEPTION 'Envio não permitido'; END IF;
      IF d.owner_id IS NULL OR d.step_id IS NULL OR cardinality(d.approver_ids)=0 OR nullif(d.content_html,'') IS NULL OR d.content_synced_version IS DISTINCT FROM d.version THEN
        RAISE EXCEPTION 'Complete os responsáveis, a etapa e sincronize o conteúdo do Google Docs antes de enviar'; END IF;
      target:='em_validacao';
    WHEN 'approve','reject' THEN
      IF d.status<>'em_validacao' OR NOT(auth.uid()=ANY(d.approver_ids)) THEN RAISE EXCEPTION 'Somente aprovadores designados podem decidir'; END IF;
      INSERT INTO public.document_decisions(document_id,version,approver_id,approved,comment)
      VALUES(d.id,d.version,auth.uid(),p_action='approve',btrim(p_reason));
      IF p_action='reject' THEN target:='em_revisao';
      ELSIF NOT EXISTS(SELECT 1 FROM unnest(d.approver_ids) a WHERE NOT EXISTS(SELECT 1 FROM public.document_decisions WHERE document_id=d.id AND version=d.version AND approver_id=a AND approved)) THEN target:='aprovado'; END IF;
    WHEN 'publish' THEN
      IF NOT is_admin OR d.status<>'aprovado' THEN RAISE EXCEPTION 'Publicação não permitida'; END IF;
      target:='publicado';
    WHEN 'revise' THEN
      IF NOT is_admin OR d.status NOT IN ('publicado','aprovado','em_validacao') THEN RAISE EXCEPTION 'Revisão não permitida'; END IF;
      target:='em_revisao';
    WHEN 'deactivate' THEN
      IF NOT is_admin OR d.status='obsoleto' THEN RAISE EXCEPTION 'Inativação não permitida'; END IF;
      target:='obsoleto';
    ELSE RAISE EXCEPTION 'Ação inválida';
  END CASE;
  -- Each submitted edition has an immutable snapshot, including the content reviewed.
  IF p_action='submit' THEN
    INSERT INTO public.document_versions(document_id,version,snapshot,recorded_by,justification)
    VALUES(d.id,d.version,to_jsonb(d),auth.uid(),btrim(p_reason))
    ON CONFLICT(document_id,version) DO NOTHING;
  END IF;
  UPDATE public.documents SET status=target,
    version=version+CASE WHEN p_action IN ('revise','reject') THEN 1 ELSE 0 END,
    updated_at=clock_timestamp() WHERE id=d.id RETURNING * INTO d;
  INSERT INTO public.document_workflows(document_id,from_status,to_status,changed_by,notes,version)
  VALUES(d.id,previous_status,target,auth.uid(),p_action||': '||btrim(p_reason),d.version);
  RETURN d;
END $$;

ALTER TABLE public.controlled_copies
  ADD COLUMN justification text,
  ADD COLUMN due_date date,
  ADD COLUMN document_version integer,
  ADD COLUMN decision_reason text,
  ADD COLUMN approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN emailed_at timestamptz;
REVOKE INSERT,UPDATE,DELETE ON public.controlled_copies FROM PUBLIC,anon,authenticated;
REVOKE INSERT(document_id) ON public.controlled_copies FROM authenticated;
CREATE FUNCTION public.request_operation_copy(p_document_id uuid,p_reason text,p_due_date date)
RETURNS public.controlled_copies LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.documents; saved public.controlled_copies;
BEGIN
  IF public.get_user_role() IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  SELECT * INTO d FROM public.documents WHERE id=p_document_id FOR SHARE;
  IF NOT FOUND OR d.status<>'publicado' OR NOT EXISTS(SELECT 1 FROM public.document_types WHERE id=d.type_id AND public_panel)
    OR (d.print_allowed AND (SELECT print_allowed FROM public.document_types WHERE id=d.type_id)) THEN RAISE EXCEPTION 'Cópia controlada indisponível para este documento'; END IF;
  IF nullif(btrim(p_reason),'') IS NULL OR p_due_date IS NULL OR p_due_date<CURRENT_DATE THEN RAISE EXCEPTION 'Informe justificativa e prazo válido'; END IF;
  INSERT INTO public.controlled_copies(document_id,user_id,status,justification,due_date,document_version)
  VALUES(d.id,auth.uid(),'solicitada',btrim(p_reason),p_due_date,d.version) RETURNING * INTO saved;
  RETURN saved;
END $$;
CREATE FUNCTION public.transition_operation_copy(p_id uuid,p_expected_status public.copy_status,p_status public.copy_status,p_reason text)
RETURNS public.controlled_copies LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.controlled_copies;
BEGIN
  IF lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Somente administradores podem controlar cópias'; END IF;
  IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  IF NOT((p_expected_status='solicitada' AND p_status IN ('aprovada','recusada')) OR (p_expected_status='aprovada' AND p_status='entregue') OR(p_expected_status='entregue' AND p_status='recolhida')) THEN RAISE EXCEPTION 'Transição inválida'; END IF;
  UPDATE public.controlled_copies SET status=p_status,decision_reason=btrim(p_reason),approved_by=auth.uid(),
    delivery_date=CASE WHEN p_status='entregue' THEN CURRENT_DATE ELSE delivery_date END,
    return_date=CASE WHEN p_status='recolhida' THEN CURRENT_DATE ELSE return_date END
  WHERE id=p_id AND status=p_expected_status RETURNING * INTO c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cópia alterada. Recarregue'; END IF;
  RETURN c;
END $$;
DO $$ DECLARE f regprocedure; BEGIN
  FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('save_operation_document','transition_operation_document','request_operation_copy','transition_operation_copy') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);
  END LOOP;
END $$;
