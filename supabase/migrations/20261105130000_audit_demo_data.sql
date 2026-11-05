-- Fictional examples for the homologation establishment only.
-- They never change source records or apply risk probability adjustments.
DO $$
DECLARE
  v_tenant uuid := '00000000-0000-4000-8000-000000000001';
  v_indicator public.indicators%ROWTYPE;
  v_document_process uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.establishments
    WHERE id = v_tenant AND status = 'active') THEN
    RAISE NOTICE 'Estabelecimento de homologação ausente; carga de auditorias ignorada';
    RETURN;
  END IF;

  SELECT i.* INTO v_indicator FROM public.indicators i
  JOIN public.processes p ON p.id = i.process_id AND p.establishment_id = i.establishment_id
  WHERE i.establishment_id = v_tenant AND NOT i.obsolete AND NOT p.obsolete
  ORDER BY CASE WHEN i.title = 'Reclamações de clientes por mês' THEN 0 ELSE 1 END, i.id
  LIMIT 1;

  IF v_indicator.id IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM public.audits WHERE id = 'a8100000-0000-4000-8000-000000000001') THEN
    INSERT INTO public.audits
      (id, establishment_id, kind, title, process_id, status, auto_apply_risk,
       summary, created_at, completed_at)
    VALUES
      ('a8100000-0000-4000-8000-000000000001', v_tenant, 'indicator',
       'Indicadores de produção (demonstração)', v_indicator.process_id, 'completed', false,
       'Exemplo fictício: dados rastreáveis; revisar a análise crítica e acompanhar a meta.',
       now() - interval '12 days', now() - interval '10 days');

    INSERT INTO public.audit_items
      (establishment_id, audit_id, subject_type, indicator_id, subject_label,
       criterion, result, evidence, improvement, action_proposal)
    VALUES
      (v_tenant, 'a8100000-0000-4000-8000-000000000001', 'indicator',
       v_indicator.id, v_indicator.title, 'Fonte e rastreabilidade dos dados', 'conform',
       'Evidência fictícia de demonstração: fonte identificada no registro do indicador.',
       '', ''),
      (v_tenant, 'a8100000-0000-4000-8000-000000000001', 'indicator',
       v_indicator.id, v_indicator.title, 'Cálculo e meta do indicador', 'partial',
       'Exemplo fictício: a meta está definida, mas a conferência do cálculo deve ser documentada.',
       'Registrar a validação periódica da fórmula.',
       'Propor plano para revisar a fórmula e sua evidência de cálculo.'),
      (v_tenant, 'a8100000-0000-4000-8000-000000000001', 'indicator',
       v_indicator.id, v_indicator.title, 'Análise crítica e ações decorrentes', 'nonconform',
       'Exemplo fictício: falta evidência de análise crítica recente.',
       'Definir responsável e periodicidade para a análise.',
       'Propor ação para registrar análise crítica e acompanhar o resultado.');
  END IF;

  SELECT p.id INTO v_document_process FROM public.processes p
  WHERE p.establishment_id = v_tenant AND NOT p.obsolete
    AND EXISTS (SELECT 1 FROM public.documents d
      WHERE d.establishment_id = v_tenant AND d.process_id = p.id AND d.deleted_at IS NULL)
  ORDER BY CASE WHEN p.title = 'Produção e controle de qualidade' THEN 0 ELSE 1 END, p.id
  LIMIT 1;

  IF v_document_process IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM public.audits WHERE id = 'a8100000-0000-4000-8000-000000000002') THEN
    INSERT INTO public.audits
      (id, establishment_id, kind, title, process_id, status, auto_apply_risk,
       summary, created_at, completed_at)
    VALUES
      ('a8100000-0000-4000-8000-000000000002', v_tenant, 'document',
       'Documentos do processo (demonstração)', v_document_process, 'completed', false,
       'Exemplo fictício: verificar a situação de cada documento e formalizar as melhorias propostas.',
       now() - interval '9 days', now() - interval '7 days');

    INSERT INTO public.audit_items
      (establishment_id, audit_id, subject_type, document_id, subject_label,
       criterion, result, evidence, improvement, action_proposal)
    SELECT v_tenant, 'a8100000-0000-4000-8000-000000000002', 'document',
      d.id, d.title, c.criterion,
      CASE
        WHEN c.position = 1 AND d.status = 'publicado' THEN 'conform'
        WHEN c.position = 1 THEN 'partial'
        WHEN c.position = 2 THEN 'conform'
        ELSE 'partial'
      END,
      'Evidência fictícia de demonstração; confirmar em auditoria real.',
      CASE WHEN c.position = 1 AND d.status <> 'publicado'
        THEN 'Concluir o fluxo de validação antes da distribuição.'
        WHEN c.position = 3 THEN 'Revisar o prazo e a necessidade de atualização.'
        ELSE '' END,
      CASE WHEN c.position = 1 AND d.status <> 'publicado'
        THEN 'Propor plano para regularizar a aprovação documental.' ELSE '' END
    FROM public.documents d
    CROSS JOIN (VALUES
      (1, 'Versão e aprovação vigentes'),
      (2, 'Acesso e distribuição'),
      (3, 'Revisão e prazo de validade')
    ) AS c(position, criterion)
    WHERE d.establishment_id = v_tenant AND d.process_id = v_document_process
      AND d.deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.audits
    WHERE id = 'a8100000-0000-4000-8000-000000000003') THEN
    INSERT INTO public.audits
      (id, establishment_id, kind, title, status, summary, created_at, completed_at)
    VALUES
      ('a8100000-0000-4000-8000-000000000003', v_tenant, 'custom',
       'Segurança do posto de trabalho (demonstração)', 'completed',
       'Exemplo fictício: registrar os pontos conformes e tratar os achados parciais e não conformes.',
       now() - interval '6 days', now() - interval '5 days');

    INSERT INTO public.audit_items
      (establishment_id, audit_id, subject_type, subject_label, criterion,
       result, evidence, improvement, action_proposal, notification_proposal)
    VALUES
      (v_tenant, 'a8100000-0000-4000-8000-000000000003', 'custom',
       'Segurança do posto de trabalho', 'Identificação de perigos no posto', 'conform',
       'Exemplo fictício: perigos listados no roteiro de inspeção.', '', '', ''),
      (v_tenant, 'a8100000-0000-4000-8000-000000000003', 'custom',
       'Segurança do posto de trabalho', 'Disponibilidade de equipamentos de proteção', 'partial',
       'Exemplo fictício: reposição de um item pendente.',
       'Definir nível mínimo de estoque.', 'Propor plano de reposição e conferência semanal.', ''),
      (v_tenant, 'a8100000-0000-4000-8000-000000000003', 'custom',
       'Segurança do posto de trabalho', 'Registro de orientações à equipe', 'nonconform',
       'Exemplo fictício: ausência de comprovante de orientação recente.',
       'Registrar orientações e presença.', 'Propor treinamento e acompanhamento mensal.',
       'Avaliar abertura de incidente para acompanhar a falha de registro.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.audits
    WHERE id = 'a8100000-0000-4000-8000-000000000004') THEN
    INSERT INTO public.audits
      (id, establishment_id, kind, title, status, created_at)
    VALUES
      ('a8100000-0000-4000-8000-000000000004', v_tenant, 'custom',
       'Organização do almoxarifado (demonstração)', 'open', now() - interval '2 days');

    INSERT INTO public.audit_items
      (establishment_id, audit_id, subject_type, subject_label, criterion, result)
    VALUES
      (v_tenant, 'a8100000-0000-4000-8000-000000000004', 'custom',
       'Organização do almoxarifado', 'Identificação das prateleiras', 'pending'),
      (v_tenant, 'a8100000-0000-4000-8000-000000000004', 'custom',
       'Organização do almoxarifado', 'Controle de validade dos materiais', 'pending'),
      (v_tenant, 'a8100000-0000-4000-8000-000000000004', 'custom',
       'Organização do almoxarifado', 'Registro de entrada e saída', 'pending');
  END IF;
END $$;
