-- Fictional survey data for the homologation tenant only.
DO $$
DECLARE
  v_tenant uuid := '00000000-0000-4000-8000-000000000001';
  v_production uuid;
  v_maintenance uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.establishments WHERE id = v_tenant AND status = 'active') THEN
    RAISE NOTICE 'Ambiente de homologação ausente; pesquisas de demonstração ignoradas';
    RETURN;
  END IF;

  SELECT id INTO v_production FROM public.processes
  WHERE establishment_id = v_tenant AND title = 'Produção e controle de qualidade' AND NOT obsolete
  ORDER BY id LIMIT 1;
  SELECT id INTO v_maintenance FROM public.processes
  WHERE establishment_id = v_tenant AND title = 'Manutenção de equipamentos' AND NOT obsolete
  ORDER BY id LIMIT 1;
  IF v_production IS NULL OR v_maintenance IS NULL THEN
    RAISE NOTICE 'Processos de demonstração ausentes; pesquisas ignoradas';
    RETURN;
  END IF;

  INSERT INTO public.survey_criteria (id, establishment_id, sector, name) VALUES
    ('77000000-0000-4000-8000-000000000001', v_tenant, 'Produção', 'Qualidade da entrega'),
    ('77000000-0000-4000-8000-000000000002', v_tenant, 'Atendimento', 'Comunicação com o cliente'),
    ('77000000-0000-4000-8000-000000000003', v_tenant, 'Manutenção', 'Tempo de resposta')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.surveys
    (id, establishment_id, title, description, process_id, status, questions, created_at)
  VALUES
    ('77100000-0000-4000-8000-000000000001', v_tenant,
      'Produção e qualidade (demonstração)',
      'Pesquisa fictícia para testar resultados, NPS e análise de respostas.',
      v_production, 'published', jsonb_build_array(
        jsonb_build_object('id', 'prod_quality', 'type', 'likert',
          'prompt', 'Como você avalia a qualidade do produto entregue?', 'required', true,
          'criterion_id', '77000000-0000-4000-8000-000000000001',
          'low_label', 'Muito insatisfeito', 'high_label', 'Muito satisfeito'),
        jsonb_build_object('id', 'prod_communication', 'type', 'likert',
          'prompt', 'Como você avalia a comunicação durante o atendimento?', 'required', true,
          'criterion_id', '77000000-0000-4000-8000-000000000002',
          'low_label', 'Muito insatisfeito', 'high_label', 'Muito satisfeito'),
        jsonb_build_object('id', 'prod_nps', 'type', 'nps',
          'prompt', 'Qual a chance de recomendar nossa produção a outra empresa?', 'required', true,
          'criterion_id', '77000000-0000-4000-8000-000000000001',
          'low_label', 'Nada provável', 'high_label', 'Muito provável'),
        jsonb_build_object('id', 'prod_comment', 'type', 'text',
          'prompt', 'O que funcionou bem e o que podemos melhorar?', 'required', false,
          'criterion_id', '77000000-0000-4000-8000-000000000002')
      ), now() - interval '20 days'),
    ('77100000-0000-4000-8000-000000000002', v_tenant,
      'Manutenção de equipamentos (demonstração)',
      'Pesquisa fictícia para testar a avaliação do serviço e o tratamento das respostas.',
      v_maintenance, 'published', jsonb_build_array(
        jsonb_build_object('id', 'maint_time', 'type', 'likert',
          'prompt', 'Como você avalia o tempo de resposta da manutenção?', 'required', true,
          'criterion_id', '77000000-0000-4000-8000-000000000003',
          'low_label', 'Muito insatisfeito', 'high_label', 'Muito satisfeito'),
        jsonb_build_object('id', 'maint_communication', 'type', 'likert',
          'prompt', 'As etapas do atendimento foram comunicadas com clareza?', 'required', true,
          'criterion_id', '77000000-0000-4000-8000-000000000002',
          'low_label', 'Discordo totalmente', 'high_label', 'Concordo totalmente'),
        jsonb_build_object('id', 'maint_nps', 'type', 'nps',
          'prompt', 'Qual a chance de recomendar este serviço de manutenção?', 'required', true,
          'criterion_id', '77000000-0000-4000-8000-000000000003',
          'low_label', 'Nada provável', 'high_label', 'Muito provável'),
        jsonb_build_object('id', 'maint_comment', 'type', 'text',
          'prompt', 'Conte o que podemos melhorar no atendimento.', 'required', false,
          'criterion_id', '77000000-0000-4000-8000-000000000002')
      ), now() - interval '20 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.survey_links
    (id, establishment_id, survey_id, process_id, delivery_mode, active, created_at)
  VALUES
    ('77200000-0000-4000-8000-000000000001', v_tenant,
      '77100000-0000-4000-8000-000000000001', v_production, 'E-mail', true,
      now() - interval '19 days'),
    ('77200000-0000-4000-8000-000000000002', v_tenant,
      '77100000-0000-4000-8000-000000000001', v_production, 'QR Code', false,
      now() - interval '19 days'),
    ('77200000-0000-4000-8000-000000000003', v_tenant,
      '77100000-0000-4000-8000-000000000002', v_maintenance, 'E-mail', true,
      now() - interval '19 days')
  ON CONFLICT (id) DO NOTHING;

  WITH sample (id, survey_id, link_id, process_id, answers, days_ago, analysis, action_taken) AS (
    VALUES
      ('77300000-0000-4000-8000-000000000001'::uuid,
        '77100000-0000-4000-8000-000000000001'::uuid,
        '77200000-0000-4000-8000-000000000001'::uuid, v_production,
        '{"prod_quality":5,"prod_communication":5,"prod_nps":10,"prod_comment":"Entrega no prazo e comunicação excelente."}'::jsonb,
        14, 'As avaliações indicam satisfação consistente com entrega e atendimento.'::text,
        'Manter o acompanhamento semanal dos prazos e compartilhar o elogio com a equipe.'::text),
      ('77300000-0000-4000-8000-000000000002',
        '77100000-0000-4000-8000-000000000001',
        '77200000-0000-4000-8000-000000000001', v_production,
        '{"prod_quality":4,"prod_communication":4,"prod_nps":9,"prod_comment":"Produto atendeu às expectativas."}',
        12, NULL, NULL),
      ('77300000-0000-4000-8000-000000000003',
        '77100000-0000-4000-8000-000000000001',
        '77200000-0000-4000-8000-000000000001', v_production,
        '{"prod_quality":3,"prod_communication":4,"prod_nps":7,"prod_comment":"A qualidade foi boa, mas houve pequeno atraso."}',
        10, NULL, NULL),
      ('77300000-0000-4000-8000-000000000004',
        '77100000-0000-4000-8000-000000000001',
        '77200000-0000-4000-8000-000000000001', v_production,
        '{"prod_quality":2,"prod_communication":2,"prod_nps":4,"prod_comment":"Precisamos de avisos antes de mudanças no prazo."}',
        8, 'A nota baixa aponta falha na comunicação de alterações no prazo de entrega.',
        'Revisar os avisos de atraso e definir contato preventivo com o cliente.'),
      ('77300000-0000-4000-8000-000000000005',
        '77100000-0000-4000-8000-000000000001',
        '77200000-0000-4000-8000-000000000002', v_production,
        '{"prod_quality":5,"prod_communication":4,"prod_nps":9,"prod_comment":"Fácil responder pelo QR Code; produto muito bom."}',
        6, NULL, NULL),
      ('77300000-0000-4000-8000-000000000006',
        '77100000-0000-4000-8000-000000000001',
        '77200000-0000-4000-8000-000000000002', v_production,
        '{"prod_quality":4,"prod_communication":3,"prod_nps":8,"prod_comment":"Mais atualizações durante a produção ajudariam."}',
        5, NULL, NULL),
      ('77300000-0000-4000-8000-000000000007',
        '77100000-0000-4000-8000-000000000001',
        '77200000-0000-4000-8000-000000000002', v_production,
        '{"prod_quality":1,"prod_communication":2,"prod_nps":3,"prod_comment":"Recebemos um item com defeito e ainda aguardamos retorno."}',
        3, NULL, NULL),
      ('77300000-0000-4000-8000-000000000008',
        '77100000-0000-4000-8000-000000000002',
        '77200000-0000-4000-8000-000000000003', v_maintenance,
        '{"maint_time":5,"maint_communication":5,"maint_nps":10,"maint_comment":"Técnico resolveu rapidamente e explicou o serviço."}',
        13, 'Atendimento rápido e explicações claras foram destacados positivamente.',
        'Registrar a prática de explicação final no roteiro padrão da equipe.'),
      ('77300000-0000-4000-8000-000000000009',
        '77100000-0000-4000-8000-000000000002',
        '77200000-0000-4000-8000-000000000003', v_maintenance,
        '{"maint_time":4,"maint_communication":4,"maint_nps":8,"maint_comment":"Bom atendimento, embora a visita pudesse ser mais cedo."}',
        11, NULL, NULL),
      ('77300000-0000-4000-8000-000000000010',
        '77100000-0000-4000-8000-000000000002',
        '77200000-0000-4000-8000-000000000003', v_maintenance,
        '{"maint_time":3,"maint_communication":3,"maint_nps":6,"maint_comment":"Aguardamos mais tempo que o previsto para o retorno."}',
        9, 'O retorno ocorreu após o prazo informado e reduziu a confiança no atendimento.',
        'Ajustar a previsão comunicada e acompanhar chamados próximos do prazo.'),
      ('77300000-0000-4000-8000-000000000011',
        '77100000-0000-4000-8000-000000000002',
        '77200000-0000-4000-8000-000000000003', v_maintenance,
        '{"maint_time":2,"maint_communication":2,"maint_nps":4,"maint_comment":"Faltou informação sobre a peça de reposição."}',
        4, NULL, NULL),
      ('77300000-0000-4000-8000-000000000012',
        '77100000-0000-4000-8000-000000000002',
        '77200000-0000-4000-8000-000000000003', v_maintenance,
        '{"maint_time":4,"maint_communication":5,"maint_nps":9,"maint_comment":"Equipe atenciosa e equipamento funcionando bem."}',
        2, NULL, NULL)
  )
  INSERT INTO public.survey_responses
    (id, establishment_id, survey_id, link_id, process_id, answers, submitted_at,
     review_status, critical_analysis, action_taken, reviewed_at)
  SELECT id, v_tenant, survey_id, link_id, process_id, answers,
    now() - days_ago * interval '1 day',
    CASE WHEN analysis IS NULL THEN 'pending' ELSE 'reviewed' END,
    analysis, action_taken,
    CASE WHEN analysis IS NOT NULL
      THEN now() - days_ago * interval '1 day' + interval '4 hours' END
  FROM sample
  ON CONFLICT (id) DO NOTHING;
END $$;
