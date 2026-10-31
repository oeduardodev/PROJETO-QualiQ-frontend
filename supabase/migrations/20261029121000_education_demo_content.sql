-- Demo content for the homologation establishment only. No attendance or progress is fabricated.
-- External material: Fundação Estudar 5W2H video (292 s). The PDF is served by QualiQ.
DO $$
DECLARE
  v_tenant uuid := '00000000-0000-4000-8000-000000000001';
  v_owner uuid;
  v_plan uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.establishments WHERE id=v_tenant)
    OR NOT EXISTS (SELECT 1 FROM public.establishment_modules
      WHERE establishment_id=v_tenant AND module_id='education' AND enabled) THEN
    RAISE NOTICE 'Educação continuada não habilitada no ambiente de homologação; carga ignorada';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.learning_items WHERE id='71000000-0000-4000-8000-000000000001') THEN
    RAISE NOTICE 'Conteúdo de demonstração já inserido';
    RETURN;
  END IF;

  SELECT id INTO v_owner FROM public.profiles
  WHERE establishment_id=v_tenant AND is_active
    AND 'educacao/gerenciamento'=ANY(edit_access)
  ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, created_at, id LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE NOTICE 'Nenhum responsável habilitado para montar treinamentos; carga ignorada';
    RETURN;
  END IF;

  -- Link the sample track to an existing training action plan when one exists.
  SELECT id INTO v_plan FROM public.action_plans
  WHERE establishment_id=v_tenant AND active
    AND (title ILIKE '%trein%' OR title ILIKE '%capacita%')
  ORDER BY created_at DESC, id LIMIT 1;

  INSERT INTO public.learning_items
    (id,establishment_id,kind,title,description,owner_id,action_plan_id)
  VALUES
    ('71000000-0000-4000-8000-000000000001',v_tenant,'training',
      'Demonstração · Registro e acompanhamento de incidentes',
      'Percorra as telas de registro e acompanhamento de incidentes do QualiQ. Responda às avaliações para liberar cada etapa e assine a presença ao final.',v_owner,NULL),
    ('71000000-0000-4000-8000-000000000002',v_tenant,'training',
      'Demonstração · Planos de ação 5W2H',
      'Conheça o método 5W2H em vídeo e no guia PDF do QualiQ. Aplique os conceitos no módulo Planos de Ação. Uma avaliação ocorre durante o vídeo.',v_owner,v_plan),
    ('71000000-0000-4000-8000-000000000003',v_tenant,'training',
      'Demonstração · Indicadores e análise crítica',
      'Explore o painel de indicadores, a alimentação dos resultados e o registro de análises críticas no QualiQ.',v_owner,NULL),
    ('71000000-0000-4000-8000-000000000004',v_tenant,'track',
      'Demonstração · Ciclo de melhoria contínua no QualiQ',
      'Trilha sequencial: registrar um incidente, estruturar um plano de ação e acompanhar resultados por indicadores. Cada treinamento precisa ser concluído antes do próximo.',v_owner,v_plan);

  INSERT INTO public.learning_stages
    (id,establishment_id,training_id,position,title,resource_kind,resource_url,duration_seconds)
  VALUES
    ('72000000-0000-4000-8000-000000000001',v_tenant,'71000000-0000-4000-8000-000000000001',1,
      'Registrar um incidente no QualiQ','link','https://qualiq-homo.vercel.app/incidentes/realizacao',0),
    ('72000000-0000-4000-8000-000000000002',v_tenant,'71000000-0000-4000-8000-000000000001',2,
      'Consultar o painel de incidentes','link','https://qualiq-homo.vercel.app/incidentes/painel',0),
    ('72000000-0000-4000-8000-000000000003',v_tenant,'71000000-0000-4000-8000-000000000002',1,
      'Vídeo: método 5W2H e plano de ação','youtube','https://www.youtube.com/watch?v=d-era9ZzW1k',292),
    ('72000000-0000-4000-8000-000000000004',v_tenant,'71000000-0000-4000-8000-000000000002',2,
      'PDF: guia de plano de ação no QualiQ','pdf',
      'https://qualiq-homo.vercel.app/educacao/guia-planos-acao-qualiq.pdf',0),
    ('72000000-0000-4000-8000-000000000005',v_tenant,'71000000-0000-4000-8000-000000000002',3,
      'Aplicar o 5W2H em Planos de Ação','link','https://qualiq-homo.vercel.app/planos-acao',0),
    ('72000000-0000-4000-8000-000000000006',v_tenant,'71000000-0000-4000-8000-000000000003',1,
      'Consultar o painel de indicadores','link','https://qualiq-homo.vercel.app/indicadores/painel',0),
    ('72000000-0000-4000-8000-000000000007',v_tenant,'71000000-0000-4000-8000-000000000003',2,
      'Alimentar resultados e registrar análise crítica','link','https://qualiq-homo.vercel.app/indicadores/alimentacao',0);

  INSERT INTO public.learning_quizzes
    (id,establishment_id,stage_id,title,cue_seconds,passing_score,position)
  VALUES
    ('73000000-0000-4000-8000-000000000001',v_tenant,'72000000-0000-4000-8000-000000000001','Verificação: registro',0,100,1),
    ('73000000-0000-4000-8000-000000000002',v_tenant,'72000000-0000-4000-8000-000000000002','Verificação: acompanhamento',0,100,1),
    ('73000000-0000-4000-8000-000000000003',v_tenant,'72000000-0000-4000-8000-000000000003','Pausa no vídeo: fundamentos do 5W2H',180,70,1),
    ('73000000-0000-4000-8000-000000000004',v_tenant,'72000000-0000-4000-8000-000000000004','Verificação: plano de ação',0,70,1),
    ('73000000-0000-4000-8000-000000000005',v_tenant,'72000000-0000-4000-8000-000000000005','Verificação: uso do QualiQ',0,100,1),
    ('73000000-0000-4000-8000-000000000006',v_tenant,'72000000-0000-4000-8000-000000000006','Verificação: painel',0,100,1),
    ('73000000-0000-4000-8000-000000000007',v_tenant,'72000000-0000-4000-8000-000000000007','Verificação: análise crítica',0,100,1);

  INSERT INTO public.learning_questions
    (id,establishment_id,quiz_id,position,prompt,options,correct_index)
  VALUES
    ('74000000-0000-4000-8000-000000000001',v_tenant,'73000000-0000-4000-8000-000000000001',1,
      'Em qual tela do QualiQ se inicia um novo registro de incidente?',
      ARRAY['Incidentes > Registrar Incidente','Indicadores > Painel','Documentos > Hierarquia'],0),
    ('74000000-0000-4000-8000-000000000002',v_tenant,'73000000-0000-4000-8000-000000000002',1,
      'Onde acompanhar o fluxo dos incidentes registrados?',
      ARRAY['Matriz de Valor','Painel de Incidentes','Perfil do usuário'],1),
    ('74000000-0000-4000-8000-000000000003',v_tenant,'73000000-0000-4000-8000-000000000003',1,
      'No 5W2H, a pergunta What define qual parte do plano?',
      ARRAY['Quem aprovará o usuário','O que será feito','Quanto tempo o vídeo terá'],1),
    ('74000000-0000-4000-8000-000000000004',v_tenant,'73000000-0000-4000-8000-000000000003',2,
      'Qual pergunta do 5W2H identifica o responsável pela execução?',
      ARRAY['Where','How much','Who'],2),
    ('74000000-0000-4000-8000-000000000005',v_tenant,'73000000-0000-4000-8000-000000000003',3,
      'Qual campo do 5W2H trata do custo ou dos recursos necessários?',
      ARRAY['How much','When','Why'],0),
    ('74000000-0000-4000-8000-000000000006',v_tenant,'73000000-0000-4000-8000-000000000004',1,
      'Um plano de ação claro deve indicar quem executa a atividade e qual outro elemento?',
      ARRAY['A cor do cartão','O prazo da ação','O número de acessos ao painel'],1),
    ('74000000-0000-4000-8000-000000000007',v_tenant,'73000000-0000-4000-8000-000000000004',2,
      'A pergunta Why do 5W2H registra:',
      ARRAY['O custo da ação','O local da ação','A justificativa da ação'],2),
    ('74000000-0000-4000-8000-000000000008',v_tenant,'73000000-0000-4000-8000-000000000005',1,
      'Qual módulo do QualiQ reúne os campos do plano pelo método 5W2H?',
      ARRAY['Helpdesk','Planos de Ação','Usuários'],1),
    ('74000000-0000-4000-8000-000000000009',v_tenant,'73000000-0000-4000-8000-000000000006',1,
      'Onde consultar os resultados históricos dos indicadores?',
      ARRAY['Registrar Incidente','Painel de Indicadores','Controle de Cópias'],1),
    ('74000000-0000-4000-8000-000000000010',v_tenant,'73000000-0000-4000-8000-000000000007',1,
      'Em qual área do QualiQ são lançados resultados e análises críticas?',
      ARRAY['Documentos > Painel','Usuários > Perfil','Indicadores > Alimentação e Análise Crítica'],2);

  INSERT INTO public.learning_track_courses
    (id,establishment_id,track_id,training_id,position)
  VALUES
    ('75000000-0000-4000-8000-000000000001',v_tenant,'71000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000001',1),
    ('75000000-0000-4000-8000-000000000002',v_tenant,'71000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000002',2),
    ('75000000-0000-4000-8000-000000000003',v_tenant,'71000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000003',3);

  UPDATE public.learning_items SET published=true
  WHERE id IN ('71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003');
  UPDATE public.learning_items SET published=true
  WHERE id='71000000-0000-4000-8000-000000000004';
END $$;
