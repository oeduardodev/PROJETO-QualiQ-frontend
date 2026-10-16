-- The earlier approval workflow stored actor and date for submission and approval.
-- Reconstruct only these known events; older edits cannot be inferred reliably.
INSERT INTO public.risk_history
  (risk_id, entity, entity_id, action, after_data, changed_by, changed_by_name, changed_at)
SELECT r.id, 'risk', r.id, 'submitted',
  jsonb_build_object('approval_state', 'pending'), r.submitted_by, p.name, r.submitted_at
FROM public.risks r
LEFT JOIN public.profiles p ON p.id = r.submitted_by
WHERE r.submitted_at IS NOT NULL;

INSERT INTO public.risk_history
  (risk_id, entity, entity_id, action, after_data, changed_by, changed_by_name, changed_at)
SELECT r.id, 'risk', r.id, 'approved',
  jsonb_build_object('approval_state', 'approved'), r.approved_by, p.name, r.approved_at
FROM public.risks r
LEFT JOIN public.profiles p ON p.id = r.approved_by
WHERE r.approved_at IS NOT NULL;

-- Existing related records receive a baseline without invented earlier changes.
INSERT INTO public.risk_history (risk_id, entity, entity_id, action, after_data)
SELECT risk_id, 'factor', id, 'baseline', to_jsonb(f)
FROM public.risk_factors f;

INSERT INTO public.risk_history (risk_id, entity, entity_id, action, after_data)
SELECT risk_id, 'action', id, 'baseline', to_jsonb(a)
FROM public.risk_preventive_actions a;

INSERT INTO public.risk_history (risk_id, entity, entity_id, action, after_data)
SELECT risk_id, 'plan', id, 'baseline', to_jsonb(p)
FROM public.risk_contingency_plans p;
