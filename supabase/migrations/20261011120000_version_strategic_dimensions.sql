-- Orbis: Dimension planning versioning migration (corrected).
-- Assumptions: dimension_versions does not yet exist; roles use lowercase
-- and public.get_user_role() is operational. Checks normalize role case.
-- BACK UP YOUR DATABASE FIRST. This migration is transactional and must run once.
-- It deliberately REPLACES ALL RLS policies on public.dimensions and
-- public.dimension_links, restricting changes to admin in the latest version.
-- If you rely on existing policies, review/merge them before running.
-- Stop on any error; PostgreSQL will roll back this transaction.

BEGIN;

-- Each planning version owns its own dimensions and links. Older versions stay

-- available for reading after a new version is created.

CREATE TABLE public.dimension_versions (

  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  version_number integer NOT NULL UNIQUE CHECK (version_number > 0),

  label text NOT NULL CHECK (length(btrim(label)) > 0),

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()

);



INSERT INTO public.dimension_versions (version_number, label)

VALUES (1, 'Planejamento inicial');



ALTER TABLE public.dimensions

  ADD COLUMN version_id uuid REFERENCES public.dimension_versions(id),

  ADD COLUMN code text,

  ADD COLUMN classification_key text NOT NULL DEFAULT 'processos_internos',

  ADD COLUMN objective text;



UPDATE public.dimensions

SET version_id = (SELECT id FROM public.dimension_versions WHERE version_number = 1);



WITH numbered AS (

  SELECT id, row_number() OVER (ORDER BY created_at, id) AS number

  FROM public.dimensions

)

UPDATE public.dimensions AS dimension

SET code = 'DIM-' || lpad(numbered.number::text, 4, '0')

FROM numbered

WHERE dimension.id = numbered.id;



CREATE SEQUENCE public.dimension_code_seq;

SELECT setval(

  'public.dimension_code_seq',

  greatest((SELECT coalesce(max(substring(code from '^DIM-([0-9]+)$')::bigint), 0) FROM public.dimensions), 1),
  EXISTS (SELECT 1 FROM public.dimensions)

);

REVOKE ALL ON SEQUENCE public.dimension_code_seq FROM PUBLIC, anon, authenticated;



ALTER TABLE public.dimensions

  ALTER COLUMN version_id SET NOT NULL,

  ALTER COLUMN code SET NOT NULL,

  ADD CONSTRAINT dimensions_version_code_unique UNIQUE (version_id, code),

  ADD CONSTRAINT dimensions_classification_check CHECK (

    classification_key IN ('financeira', 'clientes', 'processos_internos', 'aprendizado_crescimento')

  ),

  ADD CONSTRAINT dimensions_code_format CHECK (code ~ '^DIM-[0-9]{4,}$');



CREATE INDEX dimensions_version_order_idx ON public.dimensions(version_id, order_index);



ALTER TABLE public.dimension_links

  ADD COLUMN version_id uuid REFERENCES public.dimension_versions(id);



UPDATE public.dimension_links AS link

SET version_id = dimension.version_id

FROM public.dimensions AS dimension

WHERE dimension.id = link.dimension_id;



ALTER TABLE public.dimension_links ALTER COLUMN version_id SET NOT NULL;

CREATE INDEX dimension_links_version_idx ON public.dimension_links(version_id);

-- The upserts in save_dimension_with_links require a unique key.
-- Stop instead of silently deleting any existing duplicate links.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.dimension_links
    GROUP BY dimension_id, item_type, item_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate dimension links found: review (dimension_id, item_type, item_id) before migrating';
  END IF;
END;
$$;

CREATE UNIQUE INDEX dimension_links_dimension_item_unique
  ON public.dimension_links(dimension_id, item_type, item_id);



CREATE FUNCTION public.assign_dimension_code()

RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$

BEGIN

  IF TG_OP = 'UPDATE' THEN

    IF NEW.code IS DISTINCT FROM OLD.code OR NEW.version_id IS DISTINCT FROM OLD.version_id THEN

      RAISE EXCEPTION 'Dimension code and version are permanent' USING ERRCODE = '23514';

    END IF;

  ELSIF NEW.code IS NULL THEN

    NEW.code := 'DIM-' || lpad(nextval('public.dimension_code_seq')::text, 4, '0');

  END IF;

  RETURN NEW;

END;

$$;

REVOKE EXECUTE ON FUNCTION public.assign_dimension_code() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER dimensions_assign_code

  BEFORE INSERT OR UPDATE OF code, version_id ON public.dimensions

  FOR EACH ROW EXECUTE FUNCTION public.assign_dimension_code();



CREATE FUNCTION public.set_dimension_link_version()

RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$

BEGIN

  SELECT version_id INTO NEW.version_id

  FROM public.dimensions WHERE id = NEW.dimension_id;

  IF NEW.version_id IS NULL THEN

    RAISE EXCEPTION 'Dimension not found' USING ERRCODE = '23503';

  END IF;

  RETURN NEW;

END;

$$;

REVOKE EXECUTE ON FUNCTION public.set_dimension_link_version() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER dimension_links_set_version

  BEFORE INSERT OR UPDATE OF dimension_id, version_id ON public.dimension_links

  FOR EACH ROW EXECUTE FUNCTION public.set_dimension_link_version();



-- Remove every old permissive policy, including the earlier Gestor write policy.

DO $$

DECLARE policy_record record;

BEGIN

  FOR policy_record IN

    SELECT tablename, policyname FROM pg_policies

    WHERE schemaname = 'public' AND tablename IN ('dimensions', 'dimension_links')

  LOOP

    EXECUTE format('DROP POLICY %I ON public.%I', policy_record.policyname, policy_record.tablename);

  END LOOP;

END;

$$;



ALTER TABLE public.dimension_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY dimension_versions_read ON public.dimension_versions

  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);



CREATE POLICY dimensions_read ON public.dimensions

  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);

CREATE POLICY dimensions_insert ON public.dimensions

  FOR INSERT TO authenticated WITH CHECK (

    lower(public.get_user_role()::text) = 'admin'

    AND version_id = (SELECT id FROM public.dimension_versions ORDER BY version_number DESC LIMIT 1)

  );

CREATE POLICY dimensions_update ON public.dimensions

  FOR UPDATE TO authenticated USING (

    lower(public.get_user_role()::text) = 'admin'

    AND version_id = (SELECT id FROM public.dimension_versions ORDER BY version_number DESC LIMIT 1)

  ) WITH CHECK (

    lower(public.get_user_role()::text) = 'admin'

    AND version_id = (SELECT id FROM public.dimension_versions ORDER BY version_number DESC LIMIT 1)

  );

CREATE POLICY dimensions_delete ON public.dimensions

  FOR DELETE TO authenticated USING (

    lower(public.get_user_role()::text) = 'admin'

    AND version_id = (SELECT id FROM public.dimension_versions ORDER BY version_number DESC LIMIT 1)

  );



CREATE POLICY dimension_links_read ON public.dimension_links

  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);

CREATE POLICY dimension_links_insert ON public.dimension_links

  FOR INSERT TO authenticated WITH CHECK (

    lower(public.get_user_role()::text) = 'admin'

    AND version_id = (SELECT id FROM public.dimension_versions ORDER BY version_number DESC LIMIT 1)

  );

CREATE POLICY dimension_links_update ON public.dimension_links

  FOR UPDATE TO authenticated USING (

    lower(public.get_user_role()::text) = 'admin'

    AND version_id = (SELECT id FROM public.dimension_versions ORDER BY version_number DESC LIMIT 1)

  ) WITH CHECK (

    lower(public.get_user_role()::text) = 'admin'

    AND version_id = (SELECT id FROM public.dimension_versions ORDER BY version_number DESC LIMIT 1)

  );

CREATE POLICY dimension_links_delete ON public.dimension_links

  FOR DELETE TO authenticated USING (

    lower(public.get_user_role()::text) = 'admin'

    AND version_id = (SELECT id FROM public.dimension_versions ORDER BY version_number DESC LIMIT 1)

  );



GRANT SELECT ON public.dimension_versions TO authenticated;
-- RLS is not a substitute for table-level SELECT privileges.
GRANT SELECT ON public.dimensions, public.dimension_links TO authenticated;

GRANT ALL ON public.dimension_versions TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.dimensions, public.dimension_links FROM PUBLIC, anon, authenticated;

GRANT INSERT (name, description, color_key, order_index, custom_fields, version_id, classification_key, objective)

  ON public.dimensions TO authenticated;

GRANT UPDATE (name, description, color_key, order_index, custom_fields, classification_key, objective, updated_at)

  ON public.dimensions TO authenticated;

GRANT DELETE ON public.dimensions TO authenticated;

GRANT INSERT (dimension_id, item_type, item_id, process_id)

  ON public.dimension_links TO authenticated;

GRANT DELETE ON public.dimension_links TO authenticated;



CREATE FUNCTION public.create_dimension_version(p_label text)

RETURNS public.dimension_versions

LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$

DECLARE

  previous_version public.dimension_versions;

  next_version public.dimension_versions;

  old_dimension public.dimensions;

  new_dimension_id uuid;

BEGIN

  IF auth.uid() IS NULL OR lower(coalesce(public.get_user_role()::text, '')) <> 'admin' THEN

    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';

  END IF;

  IF nullif(btrim(p_label), '') IS NULL THEN

    RAISE EXCEPTION 'Version label is required' USING ERRCODE = '22023';

  END IF;



  -- Serialize new versions with edits so a copied version has a consistent state.

  LOCK TABLE public.dimensions, public.dimension_links IN SHARE ROW EXCLUSIVE MODE;

  SELECT * INTO previous_version FROM public.dimension_versions

    ORDER BY version_number DESC LIMIT 1;

  INSERT INTO public.dimension_versions (version_number, label, created_by)

  VALUES (previous_version.version_number + 1, btrim(p_label), auth.uid())

  RETURNING * INTO next_version;



  FOR old_dimension IN

    SELECT * FROM public.dimensions

    WHERE version_id = previous_version.id

    ORDER BY order_index, id

  LOOP

    INSERT INTO public.dimensions (

      version_id, code, classification_key, name, description, objective,

      color_key, order_index, custom_fields

    ) VALUES (

      next_version.id, old_dimension.code, old_dimension.classification_key,

      old_dimension.name, old_dimension.description, old_dimension.objective,

      old_dimension.color_key, old_dimension.order_index, old_dimension.custom_fields

    ) RETURNING id INTO new_dimension_id;



    INSERT INTO public.dimension_links (dimension_id, item_type, item_id, process_id)

    SELECT new_dimension_id, item_type, item_id, process_id

    FROM public.dimension_links WHERE dimension_id = old_dimension.id;

  END LOOP;

  RETURN next_version;

END;

$$;

REVOKE EXECUTE ON FUNCTION public.create_dimension_version(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_dimension_version(text) TO authenticated;



-- Save the dimension and its two editable link types as one transaction.

-- Links to strategic analyses are kept intact.

CREATE FUNCTION public.save_dimension_with_links(

  p_id uuid,

  p_version_id uuid,

  p_name text,

  p_description text,

  p_objective text,

  p_classification_key text,

  p_color_key text,

  p_order_index integer,

  p_indicator_ids uuid[],

  p_plan_ids uuid[]

)

RETURNS public.dimensions

LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$

DECLARE

  saved_dimension public.dimensions;

  item_id uuid;

  linked_process_id uuid;

BEGIN

  IF auth.uid() IS NULL OR lower(coalesce(public.get_user_role()::text, '')) <> 'admin' THEN

    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';

  END IF;

  LOCK TABLE public.dimensions, public.dimension_links IN ROW EXCLUSIVE MODE;

  IF p_version_id IS DISTINCT FROM (

    SELECT id FROM public.dimension_versions ORDER BY version_number DESC LIMIT 1

  ) THEN

    RAISE EXCEPTION 'Only the current version can be edited' USING ERRCODE = '42501';

  END IF;

  IF nullif(btrim(p_name), '') IS NULL THEN

    RAISE EXCEPTION 'Dimension name is required' USING ERRCODE = '22023';

  END IF;



  IF p_id IS NULL THEN

    INSERT INTO public.dimensions (

      version_id, name, description, objective, classification_key,

      color_key, order_index

    ) VALUES (

      p_version_id, btrim(p_name), nullif(btrim(p_description), ''),

      nullif(btrim(p_objective), ''), p_classification_key,

      p_color_key, p_order_index

    ) RETURNING * INTO saved_dimension;

  ELSE

    UPDATE public.dimensions SET

      name = btrim(p_name),

      description = nullif(btrim(p_description), ''),

      objective = nullif(btrim(p_objective), ''),

      classification_key = p_classification_key,

      color_key = p_color_key,

      order_index = p_order_index,

      updated_at = now()

    WHERE id = p_id AND version_id = p_version_id

    RETURNING * INTO saved_dimension;

    IF NOT FOUND THEN

      RAISE EXCEPTION 'Dimension not found in current version' USING ERRCODE = 'P0002';

    END IF;

  END IF;



  DELETE FROM public.dimension_links

  WHERE dimension_id = saved_dimension.id

    AND item_type = 'indicator'

    AND NOT (item_id = ANY(coalesce(p_indicator_ids, '{}'::uuid[])));

  DELETE FROM public.dimension_links

  WHERE dimension_id = saved_dimension.id

    AND item_type = 'action_plan'

    AND NOT (item_id = ANY(coalesce(p_plan_ids, '{}'::uuid[])));



  FOR item_id IN SELECT DISTINCT unnest(coalesce(p_indicator_ids, '{}'::uuid[])) LOOP

    SELECT process_id INTO linked_process_id FROM public.indicators WHERE id = item_id;

    IF linked_process_id IS NULL THEN

      RAISE EXCEPTION 'Indicator without process: %', item_id USING ERRCODE = '23503';

    END IF;

    INSERT INTO public.dimension_links (dimension_id, item_type, item_id, process_id)

    VALUES (saved_dimension.id, 'indicator', item_id, linked_process_id)

    ON CONFLICT (dimension_id, item_type, item_id)

    DO UPDATE SET process_id = excluded.process_id;

  END LOOP;



  FOR item_id IN SELECT DISTINCT unnest(coalesce(p_plan_ids, '{}'::uuid[])) LOOP

    SELECT ticket.process_id INTO linked_process_id

    FROM public.action_plans AS plan

    JOIN public.tickets AS ticket ON ticket.id = plan.ticket_id

    WHERE plan.id = item_id;

    IF linked_process_id IS NULL THEN

      RAISE EXCEPTION 'Action plan without process: %', item_id USING ERRCODE = '23503';

    END IF;

    INSERT INTO public.dimension_links (dimension_id, item_type, item_id, process_id)

    VALUES (saved_dimension.id, 'action_plan', item_id, linked_process_id)

    ON CONFLICT (dimension_id, item_type, item_id)

    DO UPDATE SET process_id = excluded.process_id;

  END LOOP;

  RETURN saved_dimension;

END;

$$;

REVOKE EXECUTE ON FUNCTION public.save_dimension_with_links(

  uuid, uuid, text, text, text, text, text, integer, uuid[], uuid[]

) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_dimension_with_links(

  uuid, uuid, text, text, text, text, text, integer, uuid[], uuid[]

) TO authenticated;

-- Invalidate PostgREST schema cache so the new table/functions are discoverable.
NOTIFY pgrst, 'reload schema';

COMMIT;
