BEGIN;
DO $$ DECLARE tenant uuid := '40000000-0000-4000-8000-000000000001'; BEGIN
  INSERT INTO public.establishments(id,name,plan_id) VALUES(tenant,'Second tenant','start');
  ASSERT (SELECT count(*)=2 FROM public.risk_statuses WHERE key='identified'), 'Settings not copied';
  ASSERT (SELECT count(*)=1 FROM public.risk_statuses WHERE key='identified' AND establishment_id=tenant), 'Missing tenant setting';
  INSERT INTO public.profiles(id,name,role,establishment_id,is_active,module_access,edit_access)
  VALUES('10000000-0000-4000-8000-000000000002','New Admin','admin',tenant,true,
    ARRAY['dashboard','indicators','risks','documents'],
    ARRAY['dashboard','riscos/gerenciamento','documentos/hierarquia']);
  INSERT INTO public.processes(id,establishment_id,code)
  VALUES('20000000-0000-4000-8000-000000000002',tenant,'AAA-001');
  ASSERT (SELECT count(*)=2 FROM public.processes WHERE code='AAA-001'), 'Codes are still globally unique';
  INSERT INTO public.tickets(id,establishment_id,process_id,title)
  VALUES('30000000-0000-4000-8000-000000000002',tenant,
    '20000000-0000-4000-8000-000000000002','Second');
  ASSERT (SELECT count(*)=1 FROM public.tickets WHERE establishment_id=tenant), 'Tenant data missing';
  INSERT INTO public.profiles(id,name,role,establishment_id)
    VALUES('10000000-0000-4000-8000-000000000003','Deployment','admin',
      '00000000-0000-4000-8000-000000000001');
  UPDATE public.profiles SET category_id='50000000-0000-4000-8000-000000000001'
    WHERE id='10000000-0000-4000-8000-000000000003';
  PERFORM public.assign_implantation_role('10000000-0000-4000-8000-000000000003');
  ASSERT (SELECT role='implantacao' AND establishment_id IS NULL AND category_id IS NULL FROM public.profiles
    WHERE id='10000000-0000-4000-8000-000000000003'), 'Global role still has tenant';
  ASSERT NOT has_function_privilege('authenticated','public.assign_implantation_role(uuid)','EXECUTE'),
    'Global role can be assigned by a tenant user';
END $$;
CREATE POLICY test_process_read ON public.processes FOR SELECT TO authenticated USING(true);
CREATE POLICY test_process_insert ON public.processes FOR INSERT TO authenticated WITH CHECK(true);
CREATE POLICY test_ticket_read ON public.tickets FOR SELECT TO authenticated USING(true);
CREATE POLICY test_ticket_insert ON public.tickets FOR INSERT TO authenticated WITH CHECK(true);
CREATE POLICY test_document_levels_read ON public.document_levels FOR SELECT TO authenticated USING(true);
CREATE POLICY test_risk_matrix_read ON public.risk_matrix_classifications FOR SELECT TO authenticated USING(true);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
  ASSERT public.current_establishment_id()='00000000-0000-4000-8000-000000000001', 'Wrong homol tenant';
  ASSERT (SELECT count(*)=1 FROM public.tickets), 'RLS leaked second tenant';
  ASSERT (SELECT count(*)=1 FROM public.processes), 'Process RLS leaked';
  ASSERT public.establishment_has_module('helpdesk'), 'Homologation lost its add-on';
  ASSERT public.establishment_has_module('indicators'), 'Base module missing';
  ASSERT public.consume_ai_quota(), 'Homologation AI unavailable';
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE failed boolean := false; BEGIN
  ASSERT public.current_establishment_id()='40000000-0000-4000-8000-000000000001', 'Wrong second tenant';
  ASSERT (SELECT count(*)=1 FROM public.tickets), 'RLS leaked Homologation';
  ASSERT NOT public.establishment_has_module('helpdesk'), 'New tenant inherited add-on';
  ASSERT public.establishment_has_module('indicators'), 'Base module missing on Start';
  ASSERT NOT public.consume_ai_quota(), 'Disabled AI was consumed';
  PERFORM public.save_document_level(NULL,'New tenant level');
  ASSERT (SELECT count(*)=1 FROM public.document_levels WHERE name='New tenant level'
    AND establishment_id=public.current_establishment_id()), 'Document level was not tenant-scoped';
  PERFORM public.save_risk_matrix_classifications(
    '[{"max_score":10,"label":"Low","background_color":"#ffffff","text_color":"#000000"},
      {"max_score":25,"label":"High","background_color":"#000000","text_color":"#ffffff"}]'::jsonb);
  ASSERT (SELECT count(*)=2 FROM public.risk_matrix_classifications
    WHERE establishment_id=public.current_establishment_id()), 'Risk matrix was not tenant-scoped';
  BEGIN
    INSERT INTO public.tickets(establishment_id,process_id,title)
    VALUES('40000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001','Cross reference');
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  ASSERT failed, 'Cross-tenant FK allowed';
  failed:=false;
  BEGIN
    INSERT INTO public.tickets(establishment_id,process_id,title)
    VALUES('00000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001','Forged tenant');
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  ASSERT failed, 'Forged establishment allowed';
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
  ASSERT public.is_implantation_user(), 'Global role not recognized';
  ASSERT public.current_establishment_id() IS NULL, 'Global role reached a tenant';
  ASSERT (SELECT count(*)=0 FROM public.processes), 'Global role read operational data';
END $$;
RESET ROLE;
UPDATE public.establishments SET status='suspended'
  WHERE id='40000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
  ASSERT public.current_establishment_id() IS NULL, 'Suspended tenant is active';
  ASSERT (SELECT count(*)=0 FROM public.tickets), 'Suspended tenant can read';
END $$;
RESET ROLE;
ROLLBACK;
