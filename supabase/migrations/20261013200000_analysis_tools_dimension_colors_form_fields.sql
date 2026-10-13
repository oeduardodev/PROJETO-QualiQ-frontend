-- Configurable options previously duplicated as literal TypeScript unions.
CREATE TABLE public.analysis_tools (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  render_kind text NOT NULL DEFAULT 'generic',
  requires_completion boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX analysis_tools_single_default_idx ON public.analysis_tools (is_default) WHERE is_default;
INSERT INTO public.analysis_tools (key, label, render_kind, requires_completion, order_index, is_default) VALUES
  ('Ishikawa', 'Ishikawa', 'ishikawa', true, 10, false),
  ('5 Porquês', '5 Porquês', 'five_whys', true, 20, false),
  ('Nenhuma', 'Nenhuma', 'none', false, 30, true);

ALTER TABLE public.notification_classifications
  DROP CONSTRAINT IF EXISTS notification_classifications_analysis_tool_check;
ALTER TABLE public.notification_types
  DROP CONSTRAINT IF EXISTS notification_types_analysis_tool_check;
ALTER TABLE public.notification_classifications
  ADD CONSTRAINT notification_classifications_analysis_tool_fkey
  FOREIGN KEY (analysis_tool) REFERENCES public.analysis_tools(key) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.notification_types
  ADD CONSTRAINT notification_types_analysis_tool_fkey
  FOREIGN KEY (analysis_tool) REFERENCES public.analysis_tools(key) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE FUNCTION public.set_configured_analysis_tool_default() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.analysis_tool IS NULL THEN
    SELECT key INTO NEW.analysis_tool
    FROM public.analysis_tools
    WHERE is_active
    ORDER BY is_default DESC, order_index, key
    LIMIT 1;
    IF NEW.analysis_tool IS NULL THEN
      RAISE EXCEPTION 'No active analysis tool configured' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_configured_analysis_tool_default() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.notification_classifications ALTER COLUMN analysis_tool DROP DEFAULT;
ALTER TABLE public.notification_types ALTER COLUMN analysis_tool DROP DEFAULT;
CREATE TRIGGER a_set_classification_analysis_tool_default
  BEFORE INSERT ON public.notification_classifications
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_analysis_tool_default();
CREATE TRIGGER a_set_type_analysis_tool_default
  BEFORE INSERT ON public.notification_types
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_analysis_tool_default();

CREATE OR REPLACE FUNCTION public.enforce_ticket_terminal_analysis() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_requires_completion boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ticket_statuses s WHERE s.key = NEW.status AND s.is_terminal)
     AND NOT NEW.analysis_completed THEN
    SELECT a.requires_completion INTO v_requires_completion
    FROM public.notification_types t
    JOIN public.analysis_tools a ON a.key = t.analysis_tool
    WHERE t.id = NEW.notification_type_id;
    IF coalesce(v_requires_completion, false) THEN
      RAISE EXCEPTION 'Conclua a análise de causa antes de finalizar a notificação.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.dimension_colors (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  background_color text NOT NULL CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  foreground_color text NOT NULL CHECK (foreground_color ~ '^#[0-9A-Fa-f]{6}$'),
  line_color text NOT NULL CHECK (line_color ~ '^#[0-9A-Fa-f]{6}$'),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX dimension_colors_single_default_idx ON public.dimension_colors (is_default) WHERE is_default;
INSERT INTO public.dimension_colors (key, label, background_color, foreground_color, line_color, order_index, is_default) VALUES
  ('blue', 'Azul', '#eff6ff', '#1d4ed8', '#2563eb', 10, true),
  ('green', 'Verde', '#ecfdf5', '#047857', '#059669', 20, false),
  ('orange', 'Laranja', '#fff7ed', '#c2410c', '#ea580c', 30, false),
  ('amber', 'Âmbar', '#fffbeb', '#b45309', '#d97706', 40, false),
  ('rose', 'Rosa', '#fff1f2', '#be123c', '#e11d48', 50, false),
  ('violet', 'Violeta', '#f5f3ff', '#6d28d9', '#7c3aed', 60, false);
INSERT INTO public.dimension_colors (key, label, background_color, foreground_color, line_color, order_index)
SELECT DISTINCT color_key, color_key, '#f1f5f9', '#475569', '#64748b', 1000
FROM public.dimensions
WHERE btrim(color_key) <> ''
ON CONFLICT (key) DO NOTHING;
UPDATE public.dimensions SET color_key = 'blue' WHERE btrim(color_key) = '';
ALTER TABLE public.dimensions
  ADD CONSTRAINT dimensions_color_key_fkey
  FOREIGN KEY (color_key) REFERENCES public.dimension_colors(key) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE FUNCTION public.set_configured_dimension_color_default() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.color_key IS NULL THEN
    SELECT key INTO NEW.color_key FROM public.dimension_colors
    WHERE is_active ORDER BY is_default DESC, order_index, key LIMIT 1;
    IF NEW.color_key IS NULL THEN
      RAISE EXCEPTION 'No active dimension color configured' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_configured_dimension_color_default() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.dimensions ALTER COLUMN color_key DROP DEFAULT;
CREATE TRIGGER a_set_dimension_color_default BEFORE INSERT ON public.dimensions
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_dimension_color_default();

-- JSON form schemas carry this key; the UI supports these field renderers.
CREATE TABLE public.form_field_types (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.form_field_types (key, label, order_index) VALUES
  ('text', 'Texto', 10), ('number', 'Número', 20), ('date', 'Data', 30), ('select', 'Seleção', 40);

ALTER TABLE public.analysis_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dimension_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_field_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY analysis_tools_read ON public.analysis_tools FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
CREATE POLICY dimension_colors_read ON public.dimension_colors FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
CREATE POLICY form_field_types_read ON public.form_field_types FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
GRANT SELECT ON public.analysis_tools, public.dimension_colors, public.form_field_types TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.analysis_tools, public.dimension_colors, public.form_field_types FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
