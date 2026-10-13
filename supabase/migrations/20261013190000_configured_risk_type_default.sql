-- Risk inserts without a type use the configured active default.
CREATE FUNCTION public.set_configured_risk_type_default() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.risk_type IS NULL THEN
    SELECT key INTO NEW.risk_type
    FROM public.risk_types
    WHERE is_active
    ORDER BY is_default DESC, order_index, key
    LIMIT 1;
    IF NEW.risk_type IS NULL THEN
      RAISE EXCEPTION 'No active risk type configured' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_configured_risk_type_default() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.risks ALTER COLUMN risk_type DROP DEFAULT;
CREATE TRIGGER a_set_risk_type_default BEFORE INSERT ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_risk_type_default();
NOTIFY pgrst, 'reload schema';
