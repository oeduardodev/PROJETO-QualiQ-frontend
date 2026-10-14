-- Processes own a unique three-letter base code. Numbered codes belong to records
-- linked to a process, with a separate, durable counter for each module and base.
DROP TRIGGER IF EXISTS processes_assign_code ON public.processes;
DROP FUNCTION IF EXISTS public.assign_process_code();
DROP TABLE IF EXISTS public.process_code_counters;

DO $$
DECLARE
  item record;
  candidate text;
  number_index integer;
BEGIN
  CREATE TEMP TABLE reserved_process_tags (tag text PRIMARY KEY) ON COMMIT DROP;
  FOR item IN SELECT id, code, title FROM public.processes ORDER BY created_at NULLS LAST, id LOOP
    candidate := upper(left(regexp_replace(
      CASE WHEN item.code ~* '^[a-z]{3}(-[0-9]+)?$' THEN split_part(item.code, '-', 1)
           ELSE item.title END, '[^a-zA-Z]', '', 'g'), 3));
    IF length(candidate) <> 3 OR EXISTS (SELECT 1 FROM reserved_process_tags WHERE tag = candidate) THEN
      candidate := NULL;
      FOR number_index IN 0..17575 LOOP
        candidate := chr(65 + number_index / 676) ||
          chr(65 + (number_index / 26) % 26) || chr(65 + number_index % 26);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM reserved_process_tags WHERE tag = candidate);
      END LOOP;
      IF EXISTS (SELECT 1 FROM reserved_process_tags WHERE tag = candidate) THEN
        RAISE EXCEPTION 'No process tags remain';
      END IF;
    END IF;
    INSERT INTO reserved_process_tags VALUES (candidate);
    UPDATE public.processes SET code = candidate WHERE id = item.id;
  END LOOP;
END $$;

ALTER TABLE public.processes ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.processes ALTER COLUMN code SET DEFAULT '';
ALTER TABLE public.processes ADD CONSTRAINT processes_code_format CHECK (code ~ '^[A-Z]{3}$');
CREATE UNIQUE INDEX processes_code_unique ON public.processes (code);

CREATE FUNCTION public.normalize_process_code() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.code := upper(regexp_replace(coalesce(NEW.code, ''), '[[:space:]]+', '', 'g'));
  IF NEW.code !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'A sigla do processo deve ter exatamente 3 letras' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.normalize_process_code() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER processes_normalize_code BEFORE INSERT OR UPDATE OF code ON public.processes
FOR EACH ROW EXECUTE FUNCTION public.normalize_process_code();

-- Existing named colors remain readable, while newly selected colors are stored as hex.
ALTER TABLE public.dimensions DROP CONSTRAINT IF EXISTS dimensions_color_key_fkey;
UPDATE public.dimensions AS d SET color_key = c.line_color
FROM public.dimension_colors AS c WHERE d.color_key = c.key;
ALTER TABLE public.dimensions ADD CONSTRAINT dimensions_color_hex
  CHECK (color_key ~ '^#[0-9A-Fa-f]{6}$');
CREATE OR REPLACE FUNCTION public.set_configured_dimension_color_default() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.color_key IS NULL THEN
    SELECT line_color INTO NEW.color_key FROM public.dimension_colors
    WHERE is_active ORDER BY is_default DESC, order_index, key LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_configured_dimension_color_default() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.module_code_counters (
  process_code text NOT NULL CHECK (process_code ~ '^[A-Z]{3}$'),
  module_code text NOT NULL CHECK (module_code ~ '^[A-Z]{3}$'),
  last_number bigint NOT NULL CHECK (last_number >= 0),
  PRIMARY KEY (process_code, module_code)
);
REVOKE ALL ON public.module_code_counters FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.assign_module_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  process_id uuid;
  process_tag text;
  previous_process_id uuid;
  next_number bigint;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'slas' THEN
      process_id := coalesce(NEW.client_process_id, NEW.supplier_process_id);
      IF TG_OP = 'UPDATE' THEN
        previous_process_id := coalesce(OLD.client_process_id, OLD.supplier_process_id);
      END IF;
    WHEN 'action_plans' THEN
      SELECT t.process_id INTO process_id FROM public.tickets AS t WHERE t.id = NEW.ticket_id;
      IF TG_OP = 'UPDATE' THEN
        SELECT t.process_id INTO previous_process_id FROM public.tickets AS t WHERE t.id = OLD.ticket_id;
      END IF;
    ELSE
      process_id := NEW.process_id;
      IF TG_OP = 'UPDATE' THEN previous_process_id := OLD.process_id; END IF;
  END CASE;

  IF TG_OP = 'UPDATE' AND process_id IS NOT DISTINCT FROM previous_process_id
     AND NEW.code IS NOT NULL AND OLD.code IS NOT NULL THEN
    NEW.code := OLD.code;
    RETURN NEW;
  END IF;
  IF process_id IS NULL THEN
    NEW.code := NULL;
    RETURN NEW;
  END IF;
  SELECT code INTO process_tag FROM public.processes WHERE id = process_id;
  IF process_tag IS NULL THEN
    RAISE EXCEPTION 'Processo sem sigla para gerar código' USING ERRCODE = '23503';
  END IF;
  INSERT INTO public.module_code_counters (process_code, module_code, last_number)
  VALUES (process_tag, TG_ARGV[0], 1)
  ON CONFLICT (process_code, module_code) DO UPDATE
    SET last_number = public.module_code_counters.last_number + 1
  RETURNING last_number INTO next_number;
  NEW.code := process_tag || '.' || TG_ARGV[0] || '.' ||
    lpad(next_number::text, greatest(3, length(next_number::text)), '0');
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.assign_module_code() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.slas ADD COLUMN code text;
ALTER TABLE public.risks ADD COLUMN code text;
ALTER TABLE public.indicators ADD COLUMN code text;
ALTER TABLE public.tickets ADD COLUMN code text;
ALTER TABLE public.helpdesk_tickets ADD COLUMN code text;
ALTER TABLE public.documents ADD COLUMN code text;
ALTER TABLE public.action_plans ADD COLUMN code text;

DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('slas', 'SLA'), ('risks', 'RSC'), ('indicators', 'IND'),
    ('tickets', 'NTF'), ('helpdesk_tickets', 'HDP'),
    ('documents', 'DOC'), ('action_plans', 'PDA')
  ) AS options(table_name, module_code) LOOP
    EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (code) WHERE code IS NOT NULL',
      item.table_name || '_code_unique', item.table_name);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (code IS NULL OR code ~ %L)',
      item.table_name, item.table_name || '_code_format',
      '^[A-Z]{3}\.' || item.module_code || '\.[0-9]{3,}$');
    EXECUTE format('CREATE TRIGGER assign_module_code BEFORE INSERT OR UPDATE ON public.%I '
      || 'FOR EACH ROW EXECUTE FUNCTION public.assign_module_code(%L)',
      item.table_name, item.module_code);
  END LOOP;
END $$;

-- Backfill in stable order so historic records receive predictable numbering.
DO $$
DECLARE
  item record;
  row_id uuid;
BEGIN
  FOR item IN SELECT table_name FROM (VALUES
    ('slas'), ('risks'), ('indicators'), ('tickets'),
    ('helpdesk_tickets'), ('documents'), ('action_plans')
  ) AS options(table_name) LOOP
    FOR row_id IN EXECUTE format('SELECT id FROM public.%I ORDER BY created_at NULLS LAST, id', item.table_name) LOOP
      EXECUTE format('UPDATE public.%I SET code = NULL WHERE id = $1', item.table_name) USING row_id;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.risks ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.indicators ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.tickets ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.action_plans ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.risks ALTER COLUMN code SET DEFAULT '';
ALTER TABLE public.indicators ALTER COLUMN code SET DEFAULT '';
ALTER TABLE public.tickets ALTER COLUMN code SET DEFAULT '';
ALTER TABLE public.action_plans ALTER COLUMN code SET DEFAULT '';
ALTER TABLE public.helpdesk_tickets ADD CONSTRAINT helpdesk_process_requires_code
  CHECK (process_id IS NULL OR code IS NOT NULL);
ALTER TABLE public.documents ADD CONSTRAINT document_process_requires_code
  CHECK (process_id IS NULL OR code IS NOT NULL);
ALTER TABLE public.slas ADD CONSTRAINT sla_process_requires_code
  CHECK (coalesce(client_process_id, supplier_process_id) IS NULL OR code IS NOT NULL);

CREATE FUNCTION public.reassign_codes_after_process_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.slas SET code = NULL
    WHERE coalesce(client_process_id, supplier_process_id) = NEW.id;
  UPDATE public.risks SET code = NULL WHERE process_id = NEW.id;
  UPDATE public.indicators SET code = NULL WHERE process_id = NEW.id;
  UPDATE public.tickets SET code = NULL WHERE process_id = NEW.id;
  UPDATE public.helpdesk_tickets SET code = NULL WHERE process_id = NEW.id;
  UPDATE public.documents SET code = NULL WHERE process_id = NEW.id;
  UPDATE public.action_plans SET code = NULL
    WHERE ticket_id IN (SELECT id FROM public.tickets WHERE process_id = NEW.id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.reassign_codes_after_process_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reassign_module_codes_after_process_change
AFTER UPDATE OF code ON public.processes FOR EACH ROW
WHEN (OLD.code IS DISTINCT FROM NEW.code)
EXECUTE FUNCTION public.reassign_codes_after_process_change();

CREATE FUNCTION public.reassign_action_plan_codes_after_ticket_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.action_plans SET code = NULL WHERE ticket_id = NEW.id;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.reassign_action_plan_codes_after_ticket_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reassign_action_plan_codes_after_ticket_change
AFTER UPDATE OF process_id ON public.tickets FOR EACH ROW
WHEN (OLD.process_id IS DISTINCT FROM NEW.process_id)
EXECUTE FUNCTION public.reassign_action_plan_codes_after_ticket_change();

NOTIFY pgrst, 'reload schema';
