-- Fictional Helpdesk cases for the homologation establishment only.
DO $$
DECLARE
  v_tenant uuid := '00000000-0000-4000-8000-000000000001';
  v_ti uuid;
  v_maintenance uuid;
  v_warehouse uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.establishments
    WHERE id = v_tenant AND status = 'active'
  ) THEN
    RAISE NOTICE 'Ambiente de homologação ausente; chamados de demonstração ignorados';
    RETURN;
  END IF;

  SELECT id INTO v_ti FROM public.processes
  WHERE establishment_id = v_tenant AND NOT obsolete
    AND (title ILIKE '%Tecnologia da Informação%' OR title ILIKE '%Suporte de TI%')
  ORDER BY CASE WHEN title = 'Tecnologia da Informação' THEN 0 ELSE 1 END, id
  LIMIT 1;

  SELECT id INTO v_maintenance FROM public.processes
  WHERE establishment_id = v_tenant AND NOT obsolete
    AND title ILIKE '%Manutenção%'
  ORDER BY CASE WHEN title = 'Manutenção de equipamentos' THEN 0 ELSE 1 END, id
  LIMIT 1;

  SELECT id INTO v_warehouse FROM public.processes
  WHERE establishment_id = v_tenant AND NOT obsolete
    AND (title ILIKE '%Almoxarifado%' OR title ILIKE '%Estoque%' OR title ILIKE '%Expedição%')
  ORDER BY CASE WHEN title ILIKE '%Almoxarifado%' THEN 0 ELSE 1 END, id
  LIMIT 1;

  -- The production trigger stamps the current time. Preserve older dates only
  -- for these fictional inserts; all normal writes keep using the trigger.
  ALTER TABLE public.helpdesk_tickets DISABLE TRIGGER z_stamp_helpdesk_status_change;

  INSERT INTO public.helpdesk_tickets
    (id, establishment_id, title, description, category, status, priority,
     requester_name, process_id, created_at, updated_at, status_changed_at)
  SELECT demo.id, v_tenant, demo.title, demo.description, demo.category,
    demo.status, demo.priority, demo.requester_name, demo.process_id,
    demo.created_at, demo.status_changed_at, demo.status_changed_at
  FROM (VALUES
    ('7e100000-0000-4000-8000-000000000001'::uuid,
     'Acesso ao sistema restabelecido',
     'Exemplo fictício: acesso de uma equipe ao sistema interno foi normalizado.',
     'ti', 'fechado', 'alta', 'Equipe administrativa', v_ti,
     now() - interval '35 days', now() - interval '27 days'),
    ('7e100000-0000-4000-8000-000000000002'::uuid,
     'Impressora de etiquetas configurada',
     'Exemplo fictício: a impressora foi reinstalada e testada com a equipe.',
     'ti', 'resolvido', 'media', 'Equipe de expedição', v_ti,
     now() - interval '24 days', now() - interval '16 days'),
    ('7e100000-0000-4000-8000-000000000003'::uuid,
     'Esteira de produção reparada',
     'Exemplo fictício: troca de rolamento e teste operacional concluídos.',
     'manutencao', 'fechado', 'urgente', 'Equipe de produção', v_maintenance,
     now() - interval '31 days', now() - interval '20 days'),
    ('7e100000-0000-4000-8000-000000000004'::uuid,
     'Revisão preventiva do compressor concluída',
     'Exemplo fictício: inspeção e ajustes preventivos finalizados.',
     'manutencao', 'resolvido', 'baixa', 'Equipe de manutenção', v_maintenance,
     now() - interval '22 days', now() - interval '11 days'),
    ('7e100000-0000-4000-8000-000000000005'::uuid,
     'Reposição de luvas entregue',
     'Exemplo fictício: materiais entregues e saldo de estoque conferido.',
     'almoxarifado', 'fechado', 'media', 'Equipe assistencial', v_warehouse,
     now() - interval '19 days', now() - interval '9 days'),
    ('7e100000-0000-4000-8000-000000000006'::uuid,
     'Divergência de estoque corrigida',
     'Exemplo fictício: contagem física conciliada com o registro do sistema.',
     'almoxarifado', 'resolvido', 'alta', 'Equipe do almoxarifado', v_warehouse,
     now() - interval '28 days', now() - interval '14 days')
  ) AS demo(id, title, description, category, status, priority, requester_name,
            process_id, created_at, status_changed_at)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.helpdesk_tickets existing WHERE existing.id = demo.id
  )
  ON CONFLICT (id) DO NOTHING;

  ALTER TABLE public.helpdesk_tickets ENABLE TRIGGER z_stamp_helpdesk_status_change;
END $$;
