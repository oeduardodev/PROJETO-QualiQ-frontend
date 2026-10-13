-- Risk categories are maintained in Supabase rather than in the frontend.
CREATE TABLE public.risk_types (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX risk_types_single_default_idx
  ON public.risk_types (is_default)
  WHERE is_default;

INSERT INTO public.risk_types (key, label, order_index, is_default) VALUES
  ('Operacional', 'Operacional', 10, true),
  ('Estratégico', 'Estratégico', 20, false),
  ('Financeiro', 'Financeiro', 30, false),
  ('Compliance', 'Compliance', 40, false);

ALTER TABLE public.risks
  DROP CONSTRAINT IF EXISTS risks_risk_type_check;

ALTER TABLE public.risks
  ADD CONSTRAINT risks_risk_type_fkey
    FOREIGN KEY (risk_type) REFERENCES public.risk_types (key)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.risk_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY risk_types_read ON public.risk_types
  FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);

GRANT SELECT ON public.risk_types TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.risk_types FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
