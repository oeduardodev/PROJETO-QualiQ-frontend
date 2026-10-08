-- Keep the next number for each process tag even when a process is deleted.
CREATE TABLE public.process_code_counters (
  tag text PRIMARY KEY,
  last_number bigint NOT NULL CHECK (last_number >= 0)
);

-- Existing codes keep their current value. Their highest number starts the counter.
INSERT INTO public.process_code_counters (tag, last_number)
SELECT upper(split_part(code, '-', 1)), max(split_part(code, '-', 2)::bigint)
FROM public.processes
WHERE code ~ '^[A-Za-z]{3}-[0-9]{1,15}$'
GROUP BY upper(split_part(code, '-', 1));

REVOKE ALL ON public.process_code_counters FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.assign_process_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_tag text;
  next_number bigint;
BEGIN
  -- A normal edit must retain its code, including older free-form codes.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.code IS NOT DISTINCT FROM OLD.code
      AND (NEW.code IS NULL OR NEW.code !~ '^[A-Za-z]{3}$') THEN
      RETURN NEW;
    END IF;
  END IF;

  requested_tag := nullif(upper(regexp_replace(NEW.code, '[[:space:]]+', '', 'g')), '');
  IF requested_tag IS NULL THEN
    NEW.code := NULL;
    RETURN NEW;
  END IF;
  IF requested_tag !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid process tag' USING ERRCODE = '22023';
  END IF;

  -- Editing with the same tag must not consume another number.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.code ~ '^[A-Za-z]{3}-[0-9]+$'
      AND upper(split_part(OLD.code, '-', 1)) = requested_tag THEN
      NEW.code := OLD.code;
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.process_code_counters (tag, last_number)
  VALUES (requested_tag, 1)
  ON CONFLICT (tag) DO UPDATE
    SET last_number = public.process_code_counters.last_number + 1
  RETURNING last_number INTO next_number;

  NEW.code := requested_tag || '-' || lpad(next_number::text, greatest(3, length(next_number::text)), '0');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_process_code() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER processes_assign_code
BEFORE INSERT OR UPDATE OF code ON public.processes
FOR EACH ROW EXECUTE FUNCTION public.assign_process_code();
