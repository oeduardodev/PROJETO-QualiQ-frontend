-- Options for statuses on preventive actions and contingency plans.
CREATE TABLE public.risk_preventive_action_statuses (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX risk_preventive_action_statuses_single_default_idx
  ON public.risk_preventive_action_statuses (is_default) WHERE is_default;
INSERT INTO public.risk_preventive_action_statuses (key, label, order_index, is_default) VALUES
  ('pendente', 'Pendente', 10, true),
  ('em_andamento', 'Em Andamento', 20, false),
  ('concluida', 'Concluída', 30, false);
ALTER TABLE public.risk_preventive_actions DROP CONSTRAINT IF EXISTS risk_preventive_actions_status_check;
ALTER TABLE public.risk_preventive_actions ADD CONSTRAINT risk_preventive_actions_status_fkey FOREIGN KEY (status)
  REFERENCES public.risk_preventive_action_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TABLE public.risk_contingency_plan_statuses (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX risk_contingency_plan_statuses_single_default_idx
  ON public.risk_contingency_plan_statuses (is_default) WHERE is_default;
INSERT INTO public.risk_contingency_plan_statuses (key, label, order_index, is_default) VALUES
  ('ativo', 'Ativo', 10, true),
  ('inativo', 'Inativo', 20, false);
ALTER TABLE public.risk_contingency_plans DROP CONSTRAINT IF EXISTS risk_contingency_plans_status_check;
ALTER TABLE public.risk_contingency_plans ADD CONSTRAINT risk_contingency_plans_status_fkey FOREIGN KEY (status)
  REFERENCES public.risk_contingency_plan_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.risk_preventive_action_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_contingency_plan_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_preventive_action_statuses_read ON public.risk_preventive_action_statuses
  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
CREATE POLICY risk_contingency_plan_statuses_read ON public.risk_contingency_plan_statuses
  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
GRANT SELECT ON public.risk_preventive_action_statuses, public.risk_contingency_plan_statuses TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.risk_preventive_action_statuses, public.risk_contingency_plan_statuses
  FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
