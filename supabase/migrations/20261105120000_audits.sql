-- Audits retain a snapshot of their subjects and checklist. Completion is atomic.
INSERT INTO public.module_catalog (id, name, is_base, implemented)
VALUES ('audits', 'Auditorias', true, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, implemented = true;

UPDATE public.profiles SET module_access = array_append(module_access, 'audits')
WHERE role IN ('admin', 'gestor', 'auditor') AND custom_role_id IS NULL
  AND NOT ('audits' = ANY(module_access));
UPDATE public.profiles SET edit_access = array_append(edit_access, 'auditorias/gerenciamento')
WHERE role = 'admin' AND custom_role_id IS NULL
  AND NOT ('auditorias/gerenciamento' = ANY(edit_access));

CREATE OR REPLACE FUNCTION public.user_can_edit(p_page text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND p.is_active AND p.role <> 'implantacao' AND p_page = ANY(p.edit_access)
    AND public.establishment_has_module(
      CASE WHEN p_page = 'helpdesk' THEN 'helpdesk'
      WHEN p_page IN ('valor','dimensoes') THEN 'strategy'
      WHEN p_page LIKE 'indicadores/%' THEN 'indicators'
      WHEN p_page LIKE 'processos/slas/%' THEN 'slas'
      WHEN p_page LIKE 'processos/%' THEN 'processes'
      WHEN p_page LIKE 'riscos/%' THEN 'risks'
      WHEN p_page LIKE 'documentos/%' THEN 'documents'
      WHEN p_page LIKE 'incidentes/%' THEN 'incidents'
      WHEN p_page LIKE 'educacao/%' THEN 'education'
      WHEN p_page LIKE 'pesquisas/%' THEN 'surveys'
      WHEN p_page LIKE 'auditorias/%' THEN 'audits'
      WHEN p_page = 'planos-acao' THEN 'action_plans'
      WHEN p_page = 'usuarios' THEN 'users' ELSE p_page END));
$$;

CREATE TABLE public.audit_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  kind text NOT NULL CHECK (kind IN ('risk', 'indicator', 'document', 'custom')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
  checks text[] NOT NULL DEFAULT '{}',
  auto_apply_risk boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, kind),
  UNIQUE (establishment_id, id),
  CHECK (cardinality(checks) <= 30 AND (kind = 'risk' OR cardinality(checks) > 0))
);

CREATE FUNCTION public.validate_audit_template() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(NEW.checks) AS criterion
    WHERE length(btrim(criterion)) NOT BETWEEN 3 AND 300) THEN
    RAISE EXCEPTION 'Critério de auditoria inválido' USING ERRCODE = '22023';
  END IF;
  IF NEW.kind <> 'risk' AND NEW.auto_apply_risk THEN
    RAISE EXCEPTION 'Ajuste automático disponível somente para riscos' USING ERRCODE = '22023';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER validate_audit_template BEFORE INSERT OR UPDATE ON public.audit_templates
FOR EACH ROW EXECUTE FUNCTION public.validate_audit_template();
REVOKE ALL ON FUNCTION public.validate_audit_template() FROM PUBLIC, anon, authenticated;

INSERT INTO public.audit_templates (establishment_id, kind, title, checks, auto_apply_risk)
SELECT e.id, d.kind, d.title, d.checks, d.auto_apply_risk
FROM public.establishments e CROSS JOIN (VALUES
  ('risk', 'Auditoria de barreiras de riscos', ARRAY[]::text[], true),
  ('indicator', 'Auditoria de indicadores', ARRAY['Fonte e rastreabilidade dos dados', 'Cálculo e meta do indicador', 'Análise crítica e ações decorrentes'], false),
  ('document', 'Auditoria de documentos', ARRAY['Versão e aprovação vigentes', 'Acesso e distribuição', 'Revisão e prazo de validade'], false),
  ('custom', 'Auditoria avulsa', ARRAY['Requisito avaliado'], false)
) AS d(kind, title, checks, auto_apply_risk);

CREATE FUNCTION public.seed_audit_templates() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_templates (establishment_id, kind, title, checks, auto_apply_risk)
  VALUES
    (NEW.id, 'risk', 'Auditoria de barreiras de riscos', '{}', true),
    (NEW.id, 'indicator', 'Auditoria de indicadores', ARRAY['Fonte e rastreabilidade dos dados', 'Cálculo e meta do indicador', 'Análise crítica e ações decorrentes'], false),
    (NEW.id, 'document', 'Auditoria de documentos', ARRAY['Versão e aprovação vigentes', 'Acesso e distribuição', 'Revisão e prazo de validade'], false),
    (NEW.id, 'custom', 'Auditoria avulsa', ARRAY['Requisito avaliado'], false);
  RETURN NEW;
END $$;
CREATE TRIGGER seed_audit_templates AFTER INSERT ON public.establishments
FOR EACH ROW EXECUTE FUNCTION public.seed_audit_templates();
REVOKE ALL ON FUNCTION public.seed_audit_templates() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  kind text NOT NULL CHECK (kind IN ('risk', 'indicator', 'document', 'custom')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  process_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  auto_apply_risk boolean NOT NULL DEFAULT false,
  summary text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid REFERENCES public.profiles(id),
  completed_at timestamptz,
  UNIQUE (establishment_id, id),
  FOREIGN KEY (establishment_id, process_id) REFERENCES public.processes(establishment_id, id)
);
CREATE INDEX audits_tenant_time_idx ON public.audits(establishment_id, created_at DESC);

CREATE TABLE public.audit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  audit_id uuid NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('risk', 'indicator', 'document', 'custom')),
  risk_id uuid,
  indicator_id uuid,
  document_id uuid,
  subject_label text NOT NULL,
  criterion text NOT NULL,
  barrier_snapshot text,
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'conform', 'partial', 'nonconform')),
  evidence text NOT NULL DEFAULT '',
  improvement text NOT NULL DEFAULT '',
  action_proposal text NOT NULL DEFAULT '',
  notification_proposal text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (establishment_id, audit_id) REFERENCES public.audits(establishment_id, id),
  FOREIGN KEY (establishment_id, risk_id) REFERENCES public.risks(establishment_id, id),
  FOREIGN KEY (establishment_id, indicator_id) REFERENCES public.indicators(establishment_id, id),
  FOREIGN KEY (establishment_id, document_id) REFERENCES public.documents(establishment_id, id),
  CHECK ((subject_type = 'risk' AND risk_id IS NOT NULL AND indicator_id IS NULL AND document_id IS NULL)
    OR (subject_type = 'indicator' AND indicator_id IS NOT NULL AND risk_id IS NULL AND document_id IS NULL)
    OR (subject_type = 'document' AND document_id IS NOT NULL AND risk_id IS NULL AND indicator_id IS NULL)
    OR (subject_type = 'custom' AND risk_id IS NULL AND indicator_id IS NULL AND document_id IS NULL))
);
CREATE INDEX audit_items_audit_idx ON public.audit_items(establishment_id, audit_id);
CREATE INDEX audit_items_risk_idx ON public.audit_items(risk_id) WHERE risk_id IS NOT NULL;
CREATE INDEX audit_items_indicator_idx ON public.audit_items(indicator_id) WHERE indicator_id IS NOT NULL;
CREATE INDEX audit_items_document_idx ON public.audit_items(document_id) WHERE document_id IS NOT NULL;

CREATE TABLE public.audit_risk_impacts (
  audit_id uuid NOT NULL,
  risk_id uuid NOT NULL,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id),
  old_probability integer NOT NULL,
  new_probability integer NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (audit_id, risk_id),
  FOREIGN KEY (establishment_id, audit_id) REFERENCES public.audits(establishment_id, id),
  FOREIGN KEY (establishment_id, risk_id) REFERENCES public.risks(establishment_id, id)
);

ALTER TABLE public.risk_history ADD COLUMN audit_id uuid;
ALTER TABLE public.risk_history ADD CONSTRAINT risk_history_audit_tenant_fkey
  FOREIGN KEY (establishment_id, audit_id) REFERENCES public.audits(establishment_id, id);
CREATE INDEX risk_history_audit_idx ON public.risk_history(audit_id) WHERE audit_id IS NOT NULL;
CREATE FUNCTION public.link_audit_risk_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.audit_id := nullif(current_setting('app.audit_id', true), '')::uuid;
  RETURN NEW;
END $$;
CREATE TRIGGER link_audit_risk_history BEFORE INSERT ON public.risk_history
  FOR EACH ROW EXECUTE FUNCTION public.link_audit_risk_history();
REVOKE ALL ON FUNCTION public.link_audit_risk_history() FROM PUBLIC, anon, authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['audit_templates','audits','audit_items','audit_risk_impacts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (establishment_id = public.current_establishment_id() AND public.user_has_module_access(''audits''))', t || '_read', t);
    IF t <> 'audit_templates' THEN
      EXECUTE format('CREATE TRIGGER tenant_row_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_row()', t);
    END IF;
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;
CREATE POLICY audit_templates_write ON public.audit_templates FOR UPDATE TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.user_can_edit('auditorias/gerenciamento'))
  WITH CHECK (establishment_id = public.current_establishment_id() AND public.user_can_edit('auditorias/gerenciamento'));
GRANT UPDATE (title, checks, auto_apply_risk) ON public.audit_templates TO authenticated;

CREATE FUNCTION public.create_audit(p_kind text, p_title text, p_process_id uuid,
  p_checks text[], p_auto_apply_risk boolean) RETURNS public.audits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := public.current_establishment_id();
  v_audit public.audits;
  v_subject record;
  v_check text;
  v_barrier text;
  v_count integer := 0;
BEGIN
  IF v_tenant IS NULL OR NOT public.user_can_edit('auditorias/gerenciamento') THEN
    RAISE EXCEPTION 'Sem permissão para criar auditoria' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('risk','indicator','document','custom')
    OR length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 200
    OR cardinality(coalesce(p_checks,'{}')) > 30
    OR EXISTS (SELECT 1 FROM unnest(coalesce(p_checks,'{}')) AS c WHERE length(btrim(c)) NOT BETWEEN 3 AND 300)
    OR (p_kind <> 'custom' AND p_process_id IS NULL)
    OR (p_kind = 'custom' AND cardinality(coalesce(p_checks,'{}')) = 0)
    OR (p_kind IN ('indicator','document') AND cardinality(coalesce(p_checks,'{}')) = 0)
    OR (p_kind <> 'risk' AND coalesce(p_auto_apply_risk, false)) THEN
    RAISE EXCEPTION 'Dados da auditoria inválidos' USING ERRCODE = '22023';
  END IF;
  IF p_process_id IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM public.processes WHERE id = p_process_id AND establishment_id = v_tenant AND NOT obsolete) THEN
    RAISE EXCEPTION 'Processo indisponível' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.audits(establishment_id, kind, title, process_id, auto_apply_risk, created_by)
  VALUES (v_tenant, p_kind, btrim(p_title), p_process_id, coalesce(p_auto_apply_risk,false), auth.uid())
  RETURNING * INTO v_audit;

  IF p_kind = 'risk' THEN
    FOR v_subject IN SELECT * FROM public.risks
      WHERE establishment_id = v_tenant AND process_id = p_process_id
        AND is_active AND approval_state = 'approved' ORDER BY title, id LOOP
      -- A blank barrier is an explicit gap; it cannot reduce probability.
      FOR v_barrier IN SELECT btrim(x) FROM regexp_split_to_table(coalesce(v_subject.barriers,''), E'[\n;]+') AS x
        WHERE btrim(x) <> '' LOOP
        INSERT INTO public.audit_items(establishment_id,audit_id,subject_type,risk_id,subject_label,criterion,barrier_snapshot)
        VALUES (v_tenant,v_audit.id,'risk',v_subject.id,v_subject.title,v_barrier,v_subject.barriers);
        v_count := v_count + 1;
      END LOOP;
      IF NOT EXISTS (SELECT 1 FROM public.audit_items
        WHERE audit_id = v_audit.id AND risk_id = v_subject.id) THEN
        INSERT INTO public.audit_items(establishment_id,audit_id,subject_type,risk_id,subject_label,criterion,barrier_snapshot)
        VALUES (v_tenant,v_audit.id,'risk',v_subject.id,v_subject.title,'Barreiras não cadastradas',v_subject.barriers);
        v_count := v_count + 1;
      END IF;
      FOREACH v_check IN ARRAY coalesce(p_checks,'{}') LOOP
        INSERT INTO public.audit_items(establishment_id,audit_id,subject_type,risk_id,subject_label,criterion,barrier_snapshot)
        VALUES (v_tenant,v_audit.id,'risk',v_subject.id,v_subject.title,btrim(v_check),v_subject.barriers);
        v_count := v_count + 1;
      END LOOP;
    END LOOP;
  ELSIF p_kind IN ('indicator','document') THEN
    FOR v_subject IN
      SELECT id, title FROM public.indicators WHERE p_kind = 'indicator'
        AND establishment_id = v_tenant AND process_id = p_process_id AND NOT obsolete
      UNION ALL
      SELECT id, title FROM public.documents WHERE p_kind = 'document'
        AND establishment_id = v_tenant AND process_id = p_process_id AND deleted_at IS NULL
    LOOP
      FOREACH v_check IN ARRAY p_checks LOOP
        INSERT INTO public.audit_items(establishment_id,audit_id,subject_type,indicator_id,document_id,subject_label,criterion)
        VALUES (v_tenant,v_audit.id,p_kind,
          CASE WHEN p_kind = 'indicator' THEN v_subject.id END,
          CASE WHEN p_kind = 'document' THEN v_subject.id END,
          v_subject.title,btrim(v_check));
        v_count := v_count + 1;
      END LOOP;
    END LOOP;
  ELSE
    FOREACH v_check IN ARRAY p_checks LOOP
      INSERT INTO public.audit_items(establishment_id,audit_id,subject_type,subject_label,criterion)
      VALUES (v_tenant,v_audit.id,'custom',v_audit.title,btrim(v_check));
      v_count := v_count + 1;
    END LOOP;
  END IF;
  IF v_count = 0 THEN RAISE EXCEPTION 'Nenhum registro encontrado para este processo' USING ERRCODE = '22023'; END IF;
  RETURN v_audit;
END $$;
REVOKE ALL ON FUNCTION public.create_audit(text,text,uuid,text[],boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_audit(text,text,uuid,text[],boolean) TO authenticated;

CREATE FUNCTION public.save_audit_item(p_id uuid, p_result text, p_evidence text,
  p_improvement text, p_action_proposal text, p_notification_proposal text) RETURNS public.audit_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_item public.audit_items;
BEGIN
  IF NOT public.user_can_edit('auditorias/gerenciamento') THEN
    RAISE EXCEPTION 'Sem permissão para avaliar auditoria' USING ERRCODE = '42501';
  END IF;
  IF p_result NOT IN ('pending','conform','partial','nonconform')
    OR length(coalesce(p_evidence,'')) > 5000 OR length(coalesce(p_improvement,'')) > 3000
    OR length(coalesce(p_action_proposal,'')) > 3000 OR length(coalesce(p_notification_proposal,'')) > 3000 THEN
    RAISE EXCEPTION 'Avaliação inválida' USING ERRCODE = '22023';
  END IF;
  -- Serialize item edits with completion of the parent audit.
  PERFORM 1 FROM public.audits a JOIN public.audit_items i ON i.audit_id=a.id
    WHERE i.id=p_id AND a.establishment_id=public.current_establishment_id() FOR UPDATE OF a;
  UPDATE public.audit_items i SET result=p_result, evidence=coalesce(p_evidence,''),
    improvement=coalesce(p_improvement,''), action_proposal=coalesce(p_action_proposal,''),
    notification_proposal=coalesce(p_notification_proposal,''), updated_at=now()
  FROM public.audits a WHERE i.id=p_id AND i.establishment_id=public.current_establishment_id()
    AND a.id=i.audit_id AND a.establishment_id=i.establishment_id AND a.status='open'
  RETURNING i.* INTO v_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado ou auditoria concluída' USING ERRCODE = 'P0002'; END IF;
  RETURN v_item;
END $$;
REVOKE ALL ON FUNCTION public.save_audit_item(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_audit_item(uuid,text,text,text,text,text) TO authenticated;

-- A probability reduction approved by a completed audit retains the risk's
-- approval. Other risk edits keep the original approval workflow unchanged.
CREATE OR REPLACE FUNCTION public.enforce_risk_approval() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_role text := lower(coalesce(public.get_user_role()::text, ''));
  v_content_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.approval_state := 'draft';
    NEW.submitted_at := NULL;
    NEW.submitted_by := NULL;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.rejection_reason := NULL;
    RETURN NEW;
  END IF;

  IF current_setting('app.audit_probability_risk', true) = OLD.id::text
    AND NEW.probability = OLD.probability - 1
    AND NEW.approval_state = OLD.approval_state
    AND OLD.approval_state = 'approved'
    AND ROW(NEW.code,NEW.title,NEW.description,NEW.process_id,NEW.step_id,
      NEW.impact,NEW.risk_type,NEW.barriers,NEW.status,NEW.owner,NEW.owner_id,NEW.custom_fields)
      IS NOT DISTINCT FROM ROW(OLD.code,OLD.title,OLD.description,OLD.process_id,OLD.step_id,
      OLD.impact,OLD.risk_type,OLD.barriers,OLD.status,OLD.owner,OLD.owner_id,OLD.custom_fields) THEN
    NEW.submitted_at := OLD.submitted_at;
    NEW.submitted_by := OLD.submitted_by;
    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
    NEW.rejection_reason := OLD.rejection_reason;
    RETURN NEW;
  END IF;

  v_content_changed := ROW(NEW.code, NEW.title, NEW.description, NEW.process_id,
    NEW.step_id, NEW.probability, NEW.impact, NEW.risk_type, NEW.barriers,
    NEW.status, NEW.owner, NEW.owner_id, NEW.custom_fields)
    IS DISTINCT FROM ROW(OLD.code, OLD.title, OLD.description, OLD.process_id,
    OLD.step_id, OLD.probability, OLD.impact, OLD.risk_type, OLD.barriers,
    OLD.status, OLD.owner, OLD.owner_id, OLD.custom_fields);

  IF NEW.approval_state IS DISTINCT FROM OLD.approval_state THEN
    IF v_content_changed THEN
      RAISE EXCEPTION 'Save risk changes before changing approval state' USING ERRCODE = '22023';
    END IF;
    IF NEW.approval_state = 'pending' AND OLD.approval_state IN ('draft', 'rejected')
      AND v_role IN ('admin', 'gestor') THEN
      NEW.submitted_at := now();
      NEW.submitted_by := auth.uid();
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := NULL;
    ELSIF NEW.approval_state = 'approved' AND OLD.approval_state = 'pending'
      AND v_role = 'admin' THEN
      NEW.approved_at := now();
      NEW.approved_by := auth.uid();
      NEW.rejection_reason := NULL;
    ELSIF NEW.approval_state = 'rejected' AND OLD.approval_state = 'pending'
      AND v_role = 'admin' AND nullif(btrim(NEW.rejection_reason), '') IS NOT NULL THEN
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := btrim(NEW.rejection_reason);
    ELSE
      RAISE EXCEPTION 'Invalid risk approval transition' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF OLD.approval_state = 'pending' AND v_content_changed THEN
      RAISE EXCEPTION 'A pending risk cannot be edited' USING ERRCODE = '22023';
    END IF;
    IF v_content_changed AND OLD.approval_state IN ('approved', 'rejected') THEN
      NEW.approval_state := 'draft';
      NEW.submitted_at := NULL;
      NEW.submitted_by := NULL;
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := NULL;
    ELSE
      NEW.submitted_at := OLD.submitted_at;
      NEW.submitted_by := OLD.submitted_by;
      NEW.approved_at := OLD.approved_at;
      NEW.approved_by := OLD.approved_by;
      NEW.rejection_reason := OLD.rejection_reason;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.complete_audit(p_id uuid, p_summary text) RETURNS public.audits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_audit public.audits; v_risk record; v_old integer;
BEGIN
  IF NOT public.user_can_edit('auditorias/gerenciamento') THEN
    RAISE EXCEPTION 'Sem permissão para concluir auditoria' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(p_summary,'')) > 5000 THEN
    RAISE EXCEPTION 'Resumo muito longo' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_audit FROM public.audits
    WHERE id=p_id AND establishment_id=public.current_establishment_id() FOR UPDATE;
  IF NOT FOUND OR v_audit.status <> 'open' THEN
    RAISE EXCEPTION 'Auditoria indisponível ou já concluída' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_items WHERE audit_id=p_id AND result='pending') THEN
    RAISE EXCEPTION 'Avalie todos os itens antes de concluir' USING ERRCODE = '22023';
  END IF;
  IF v_audit.kind='risk' AND v_audit.auto_apply_risk
    AND public.user_can_edit('riscos/gerenciamento') THEN
    FOR v_risk IN SELECT r.id, r.probability FROM public.risks r
      WHERE r.establishment_id=v_audit.establishment_id AND r.process_id=v_audit.process_id
        AND r.is_active AND r.approval_state='approved' AND r.probability>1
        AND EXISTS (SELECT 1 FROM public.audit_items i WHERE i.audit_id=p_id AND i.risk_id=r.id)
        AND NOT EXISTS (SELECT 1 FROM public.audit_items i WHERE i.audit_id=p_id AND i.risk_id=r.id
          AND (i.result<>'conform' OR i.criterion='Barreiras não cadastradas'
            OR i.barrier_snapshot IS DISTINCT FROM r.barriers))
      FOR UPDATE OF r LOOP
      v_old := v_risk.probability;
      PERFORM set_config('app.audit_id', p_id::text, true);
      PERFORM set_config('app.risk_change_reason', 'Auditoria ' || v_audit.title || ' (' || p_id || '): barreiras conformes', true);
      PERFORM set_config('app.audit_probability_risk', v_risk.id::text, true);
      UPDATE public.risks SET probability=v_old-1 WHERE id=v_risk.id;
      INSERT INTO public.audit_risk_impacts(audit_id,risk_id,establishment_id,old_probability,new_probability)
      VALUES (p_id,v_risk.id,v_audit.establishment_id,v_old,v_old-1);
    END LOOP;
  END IF;
  UPDATE public.audits SET status='completed', summary=btrim(coalesce(p_summary,'')),
    completed_by=auth.uid(), completed_at=now() WHERE id=p_id RETURNING * INTO v_audit;
  RETURN v_audit;
END $$;
REVOKE ALL ON FUNCTION public.complete_audit(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_audit(uuid,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
