-- Fictional form-builder content for the homologation tenant only.
DO $$
DECLARE
  v_tenant uuid := '00000000-0000-4000-8000-000000000001';
  v_production uuid;
  v_maintenance uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.establishments WHERE id = v_tenant AND status = 'active') THEN
    RAISE NOTICE 'Ambiente de homologação ausente; formulários de demonstração ignorados';
    RETURN;
  END IF;

  SELECT id INTO v_production FROM public.processes
  WHERE establishment_id = v_tenant AND title = 'Produção e controle de qualidade' AND NOT obsolete
  ORDER BY id LIMIT 1;
  SELECT id INTO v_maintenance FROM public.processes
  WHERE establishment_id = v_tenant AND title = 'Manutenção de equipamentos' AND NOT obsolete
  ORDER BY id LIMIT 1;
  IF v_production IS NULL OR v_maintenance IS NULL THEN
    RAISE NOTICE 'Processos de demonstração ausentes; formulários ignorados';
    RETURN;
  END IF;

  INSERT INTO public.built_forms
    (id, establishment_id, title, description, process_id, sector, accent_color,
     thank_you_message, status, questions, created_at)
  VALUES
    ('78100000-0000-4000-8000-000000000001', v_tenant,
      'Avaliação da qualidade (demonstração)',
      'Formulário fictício para demonstrar perguntas de nota e escolha única.',
      v_production, 'Produção', '#2563eb', 'Obrigado por avaliar nosso processo de qualidade!',
      'published', jsonb_build_array(
        jsonb_build_object('id','quality_rating','type','rating','title','Como você avalia a qualidade da entrega?','description','Considere conformidade e prazo.','required',true,'options','[]'::jsonb),
        jsonb_build_object('id','quality_delivery','type','single','title','A entrega chegou no prazo combinado?','description','','required',true,'options',jsonb_build_array('Sim','Parcialmente','Não')),
        jsonb_build_object('id','quality_comment','type','long','title','O que podemos melhorar?','description','Resposta opcional.','required',false,'options','[]'::jsonb)
      ), now() - interval '18 days'),
    ('78100000-0000-4000-8000-000000000002', v_tenant,
      'Clima e comunicação interna (demonstração)',
      'Pesquisa fictícia para demonstrar respostas de múltipla escolha e texto.',
      v_production, 'Recursos Humanos', '#7c3aed', 'Sua opinião contribui para um ambiente melhor.',
      'published', jsonb_build_array(
        jsonb_build_object('id','climate_rating','type','rating','title','Como você avalia o ambiente de trabalho?','description','1 = precisa melhorar; 5 = excelente.','required',true,'options','[]'::jsonb),
        jsonb_build_object('id','climate_channels','type','multiple','title','Quais canais você usa para receber comunicados?','description','Selecione todos os que se aplicam.','required',true,'options',jsonb_build_array('E-mail','Reuniões','Chat interno','Quadro de avisos')),
        jsonb_build_object('id','climate_date','type','date','title','Quando foi seu último feedback individual?','description','Opcional.','required',false,'options','[]'::jsonb)
      ), now() - interval '12 days'),
    ('78100000-0000-4000-8000-000000000003', v_tenant,
      'Atendimento da manutenção (demonstração)',
      'Formulário fictício associado ao processo de manutenção de equipamentos.',
      v_maintenance, 'Manutenção', '#059669', 'Obrigado por compartilhar sua experiência.',
      'published', jsonb_build_array(
        jsonb_build_object('id','maintenance_name','type','short','title','Qual equipamento recebeu manutenção?','description','Resposta opcional.','required',false,'options','[]'::jsonb),
        jsonb_build_object('id','maintenance_rating','type','rating','title','Como você avalia o atendimento recebido?','description','1 = ruim; 5 = excelente.','required',true,'options','[]'::jsonb),
        jsonb_build_object('id','maintenance_result','type','single','title','O equipamento voltou a funcionar normalmente?','description','','required',true,'options',jsonb_build_array('Sim','Parcialmente','Não')),
        jsonb_build_object('id','maintenance_comment','type','long','title','Deixe um comentário','description','Resposta opcional.','required',false,'options','[]'::jsonb)
      ), now() - interval '7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.built_form_responses (id, establishment_id, form_id, answers, submitted_at)
  VALUES
    ('78200000-0000-4000-8000-000000000001', v_tenant, '78100000-0000-4000-8000-000000000001',
      '{"quality_rating":5,"quality_delivery":"Sim","quality_comment":"Entrega correta e dentro do prazo."}', now() - interval '16 days'),
    ('78200000-0000-4000-8000-000000000002', v_tenant, '78100000-0000-4000-8000-000000000001',
      '{"quality_rating":4,"quality_delivery":"Sim","quality_comment":"Boa qualidade; embalagem pode melhorar."}', now() - interval '13 days'),
    ('78200000-0000-4000-8000-000000000003', v_tenant, '78100000-0000-4000-8000-000000000001',
      '{"quality_rating":3,"quality_delivery":"Parcialmente","quality_comment":"Uma parte chegou depois do combinado."}', now() - interval '9 days'),
    ('78200000-0000-4000-8000-000000000004', v_tenant, '78100000-0000-4000-8000-000000000001',
      '{"quality_rating":5,"quality_delivery":"Sim","quality_comment":"Atendimento atencioso e produto conforme."}', now() - interval '3 days'),
    ('78200000-0000-4000-8000-000000000005', v_tenant, '78100000-0000-4000-8000-000000000002',
      '{"climate_rating":4,"climate_channels":["E-mail","Reuniões"],"climate_date":"2026-10-20"}', now() - interval '10 days'),
    ('78200000-0000-4000-8000-000000000006', v_tenant, '78100000-0000-4000-8000-000000000002',
      '{"climate_rating":3,"climate_channels":["Chat interno"],"climate_date":"2026-10-22"}', now() - interval '8 days'),
    ('78200000-0000-4000-8000-000000000007', v_tenant, '78100000-0000-4000-8000-000000000002',
      '{"climate_rating":5,"climate_channels":["E-mail","Chat interno","Reuniões"]}', now() - interval '5 days'),
    ('78200000-0000-4000-8000-000000000008', v_tenant, '78100000-0000-4000-8000-000000000002',
      '{"climate_rating":4,"climate_channels":["Quadro de avisos","E-mail"]}', now() - interval '2 days'),
    ('78200000-0000-4000-8000-000000000009', v_tenant, '78100000-0000-4000-8000-000000000003',
      '{"maintenance_name":"Bomba hidráulica","maintenance_rating":5,"maintenance_result":"Sim","maintenance_comment":"Retorno rápido e serviço bem explicado."}', now() - interval '6 days'),
    ('78200000-0000-4000-8000-000000000010', v_tenant, '78100000-0000-4000-8000-000000000003',
      '{"maintenance_name":"Seladora 02","maintenance_rating":4,"maintenance_result":"Sim","maintenance_comment":"Equipamento voltou a operar normalmente."}', now() - interval '4 days'),
    ('78200000-0000-4000-8000-000000000011', v_tenant, '78100000-0000-4000-8000-000000000003',
      '{"maintenance_name":"Esteira 01","maintenance_rating":2,"maintenance_result":"Parcialmente","maintenance_comment":"Precisamos de uma segunda visita."}', now() - interval '1 day'),
    ('78200000-0000-4000-8000-000000000012', v_tenant, '78100000-0000-4000-8000-000000000003',
      '{"maintenance_name":"Compressor","maintenance_rating":5,"maintenance_result":"Sim","maintenance_comment":"Equipe prestativa e eficiente."}', now() - interval '12 hours')
  ON CONFLICT (id) DO NOTHING;
END $$;
