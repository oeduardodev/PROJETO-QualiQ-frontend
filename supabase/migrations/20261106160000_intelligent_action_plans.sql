-- Preserve the origin of plans imported from the intelligent suggestions screen.
ALTER TABLE public.action_plans DROP CONSTRAINT action_plans_origin_check;
ALTER TABLE public.action_plans ADD CONSTRAINT action_plans_origin_check
  CHECK (origin IN ('manual', 'notification', 'critical_analysis', 'system', 'ai'));

CREATE FUNCTION public.import_intelligent_action_plan(p_payload jsonb)
RETURNS public.action_plans
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan public.action_plans;
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Plano inválido' USING ERRCODE = '22023';
  END IF;
  IF NOT public.user_can_edit('planos-acao')
    OR NOT public.user_has_module_access('action_plans') THEN
    RAISE EXCEPTION 'Sem permissão para importar planos' USING ERRCODE = '42501';
  END IF;

  -- save_operation_plan enforces the same permissions, fields and audit trail
  -- used when creating a plan directly in the central.
  SELECT * INTO v_plan FROM public.save_operation_plan(
    NULL, NULL,
    p_payload || jsonb_build_object('ticket_id', NULL),
    'Plano importado de sugestão inteligente'
  );
  UPDATE public.action_plans SET origin = 'ai'
  WHERE id = v_plan.id AND establishment_id = public.current_establishment_id()
  RETURNING * INTO v_plan;
  RETURN v_plan;
END;
$$;

REVOKE ALL ON FUNCTION public.import_intelligent_action_plan(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_intelligent_action_plan(jsonb) TO authenticated;

-- Share the establishment's existing monthly AI allowance with this module.
CREATE OR REPLACE FUNCTION public.consume_ai_quota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  tenant uuid;
  monthly_limit integer;
  count_after integer;
BEGIN
  tenant := public.current_establishment_id();
  IF tenant IS NULL OR NOT public.is_admin_or_gestor()
    OR NOT (public.user_has_module_access('indicators')
      OR public.user_has_module_access('action_plans')) THEN RETURN false; END IF;
  SELECT ai_monthly_limit INTO monthly_limit FROM public.establishments
    WHERE id = tenant AND status = 'active' AND ai_mode = 'enabled';
  IF monthly_limit IS NULL OR monthly_limit = 0 THEN RETURN false; END IF;
  INSERT INTO public.ai_monthly_usage(establishment_id, month_start, requests)
    VALUES (tenant, date_trunc('month', now() AT TIME ZONE 'UTC')::date, 1)
    ON CONFLICT (establishment_id, month_start) DO UPDATE
      SET requests = public.ai_monthly_usage.requests + 1
      WHERE public.ai_monthly_usage.requests < monthly_limit
    RETURNING requests INTO count_after;
  RETURN count_after IS NOT NULL;
END;
$$;
