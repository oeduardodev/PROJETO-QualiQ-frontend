-- Keep the card order within each value chain category.
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS order_index integer;

WITH initial_order AS (
  SELECT id, row_number() OVER (
    PARTITION BY category_id ORDER BY created_at, id
  ) - 1 AS position
  FROM public.processes
)
UPDATE public.processes AS process
SET order_index = initial_order.position
FROM initial_order
WHERE process.id = initial_order.id
  AND process.order_index IS NULL;

ALTER TABLE public.processes
  ALTER COLUMN order_index SET DEFAULT 0,
  ALTER COLUMN order_index SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processes_value_matrix_order
  ON public.processes (category_id, order_index, id);

CREATE OR REPLACE FUNCTION public.assign_value_matrix_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.category_id::text));
  NEW.order_index := (
    SELECT COALESCE(MAX(order_index) + 1, 0)
    FROM public.processes WHERE category_id = NEW.category_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_value_matrix_order ON public.processes;
CREATE TRIGGER trg_assign_value_matrix_order
BEFORE INSERT ON public.processes
FOR EACH ROW EXECUTE FUNCTION public.assign_value_matrix_order();

-- Gestores may edit their processes, but only admins arrange the value matrix.
CREATE OR REPLACE FUNCTION public.guard_value_matrix_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_index IS DISTINCT FROM OLD.order_index
     AND public.get_user_role() IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'Only admins may reorder value matrix processes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_value_matrix_order ON public.processes;
CREATE TRIGGER trg_guard_value_matrix_order
BEFORE UPDATE OF order_index ON public.processes
FOR EACH ROW EXECUTE FUNCTION public.guard_value_matrix_order();
