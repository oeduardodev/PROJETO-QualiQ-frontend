-- Risk and SLA status options are also maintained in Supabase.
CREATE TABLE public.risk_statuses (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  is_treated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX risk_statuses_single_default_idx ON public.risk_statuses (is_default) WHERE is_default;
INSERT INTO public.risk_statuses (key, label, order_index, is_default, is_treated) VALUES
  ('identificado', 'Identificado', 10, true, false),
  ('em_analise', 'Em análise', 20, false, false),
  ('tratado', 'Tratado', 30, false, true),
  ('monitorado', 'Monitorado', 40, false, false);
ALTER TABLE public.risks DROP CONSTRAINT IF EXISTS risks_status_check;
ALTER TABLE public.risks ADD CONSTRAINT risks_status_fkey FOREIGN KEY (status)
  REFERENCES public.risk_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TABLE public.sla_statuses (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  badge_background text NOT NULL DEFAULT '#f1f5f9' CHECK (badge_background ~ '^#[0-9A-Fa-f]{6}$'),
  badge_foreground text NOT NULL DEFAULT '#475569' CHECK (badge_foreground ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sla_statuses_single_default_idx ON public.sla_statuses (is_default) WHERE is_default;
INSERT INTO public.sla_statuses (key, label, order_index, is_default, badge_background, badge_foreground) VALUES
  ('Ativo', 'Ativo', 10, true, '#ecfdf5', '#047857'),
  ('Em Revisão', 'Em Revisão', 20, false, '#fffbeb', '#b45309'),
  ('Inativo', 'Inativo', 30, false, '#f1f5f9', '#475569');
ALTER TABLE public.slas DROP CONSTRAINT IF EXISTS slas_status_check;
ALTER TABLE public.slas ADD CONSTRAINT slas_status_fkey FOREIGN KEY (status)
  REFERENCES public.sla_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.risk_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_statuses_read ON public.risk_statuses FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
CREATE POLICY sla_statuses_read ON public.sla_statuses FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
GRANT SELECT ON public.risk_statuses, public.sla_statuses TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.risk_statuses, public.sla_statuses FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
