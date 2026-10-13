-- Inserts that omit status use the active initial/default option from Supabase.
CREATE FUNCTION public.set_configured_status_default() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.status IS NOT NULL THEN
    RETURN NEW;
  END IF;
  EXECUTE format(
    'SELECT key FROM public.%I WHERE is_active ORDER BY %I DESC, order_index, key LIMIT 1',
    TG_ARGV[0], TG_ARGV[1]
  ) INTO v_status;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'No active status configured for %', TG_TABLE_NAME USING ERRCODE = '22023';
  END IF;
  NEW.status := v_status;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_configured_status_default() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.tickets ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.helpdesk_tickets ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.action_plans ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.risks ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.slas ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.risk_preventive_actions ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.risk_contingency_plans ALTER COLUMN status DROP DEFAULT;

CREATE TRIGGER a_set_ticket_status_default BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_status_default('ticket_statuses', 'is_initial');
CREATE TRIGGER a_set_helpdesk_status_default BEFORE INSERT ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_status_default('helpdesk_statuses', 'is_initial');
CREATE TRIGGER a_set_action_plan_status_default BEFORE INSERT ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_status_default('action_plan_statuses', 'is_initial');
CREATE TRIGGER a_set_risk_status_default BEFORE INSERT ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_status_default('risk_statuses', 'is_default');
CREATE TRIGGER a_set_sla_status_default BEFORE INSERT ON public.slas
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_status_default('sla_statuses', 'is_default');
CREATE TRIGGER a_set_preventive_action_status_default BEFORE INSERT ON public.risk_preventive_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_status_default('risk_preventive_action_statuses', 'is_default');
CREATE TRIGGER a_set_contingency_plan_status_default BEFORE INSERT ON public.risk_contingency_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_status_default('risk_contingency_plan_statuses', 'is_default');

NOTIFY pgrst, 'reload schema';
