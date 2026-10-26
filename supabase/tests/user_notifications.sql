BEGIN;
INSERT INTO public.profiles (id, establishment_id, name) VALUES
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Alice'),
  ('10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'Bruno'),
  ('10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 'Carla');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

INSERT INTO public.processes (id, establishment_id, title, owner_id, participant_ids)
VALUES ('20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001', 'Processo',
  '10000000-0000-4000-8000-000000000002',
  ARRAY['10000000-0000-4000-8000-000000000002'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid]);
INSERT INTO public.action_plans (id, establishment_id, title, owner_id, controller_id)
VALUES ('20000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000001', 'Plano',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002');
INSERT INTO public.documents (establishment_id, title, owner_id, approver_ids)
VALUES ('40000000-0000-4000-8000-000000000001', 'Documento',
  '10000000-0000-4000-8000-000000000001',
  ARRAY['10000000-0000-4000-8000-000000000002'::uuid]);
INSERT INTO public.risks (establishment_id, title, owner_id)
VALUES ('40000000-0000-4000-8000-000000000001', 'Risco',
  '10000000-0000-4000-8000-000000000002');
INSERT INTO public.tickets (establishment_id, title, assigned_to)
VALUES ('40000000-0000-4000-8000-000000000001', 'Incidente',
  '10000000-0000-4000-8000-000000000002');
INSERT INTO public.helpdesk_tickets (id, establishment_id, title, assigned_to)
VALUES ('20000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000001', 'Chamado', 'Nome antigo');
UPDATE public.helpdesk_tickets SET assigned_to = '10000000-0000-4000-8000-000000000002'
  WHERE id = '20000000-0000-4000-8000-000000000003';

RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) = 6 FROM public.operation_inbox),
    'Each newly assigned user must receive one notification';
  ASSERT (SELECT count(*) = 0 FROM public.operation_inbox
    WHERE user_id = '10000000-0000-4000-8000-000000000001'),
    'Self assignments must not notify';
  ASSERT (SELECT count(*) = 6 FROM public.operation_inbox WHERE actor_name = 'Alice'),
    'Actor name missing';
END $$;

SET ROLE authenticated;
UPDATE public.processes SET title = 'Processo editado'
  WHERE id = '20000000-0000-4000-8000-000000000001';
SELECT set_config('orbis.operation_reason', 'Revisão', true);
UPDATE public.action_plans SET review_state = 'pending'
  WHERE id = '20000000-0000-4000-8000-000000000002';
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) = 7 FROM public.operation_inbox),
    'Editing without a new recipient must not duplicate assignments';
  ASSERT (SELECT count(*) = 1 FROM public.operation_inbox WHERE event_type = 'review'),
    'Controller review request missing';
END $$;
SET ROLE authenticated;
DO $$ DECLARE blocked boolean := false; BEGIN
  BEGIN
    UPDATE public.risks SET owner_id = '10000000-0000-4000-8000-000000000003';
  EXCEPTION WHEN foreign_key_violation THEN blocked := true; END;
  ASSERT blocked, 'Cross-tenant assignment was accepted';
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) = 7 FROM public.operation_inbox),
    'Rejected assignment created an inbox row';
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN
  ASSERT (SELECT count(*) = 7 FROM public.operation_inbox), 'Recipient cannot read history';
END $$;
UPDATE public.operation_inbox SET read_at = now() WHERE read_at IS NULL;
DO $$ BEGIN
  ASSERT (SELECT count(*) = 0 FROM public.operation_inbox WHERE read_at IS NULL),
    'Read status was not recorded';
END $$;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
DO $$ BEGIN
  ASSERT (SELECT count(*) = 0 FROM public.operation_inbox), 'Another tenant saw notifications';
END $$;
ROLLBACK;
