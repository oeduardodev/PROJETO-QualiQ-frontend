-- Status labels, board order, terminal state and next transition live in Supabase.
CREATE TABLE public.ticket_statuses (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_initial boolean NOT NULL DEFAULT false,
  is_terminal boolean NOT NULL DEFAULT false,
  next_status_key text REFERENCES public.ticket_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT,
  header_background text NOT NULL DEFAULT '#f1f5f9' CHECK (header_background ~ '^#[0-9A-Fa-f]{6}$'),
  header_foreground text NOT NULL DEFAULT '#475569' CHECK (header_foreground ~ '^#[0-9A-Fa-f]{6}$'),
  header_border text NOT NULL DEFAULT '#cbd5e1' CHECK (header_border ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_statuses_next_not_self CHECK (next_status_key IS DISTINCT FROM key),
  CONSTRAINT ticket_statuses_terminal_no_next CHECK (NOT is_terminal OR next_status_key IS NULL)
);
CREATE UNIQUE INDEX ticket_statuses_single_initial_idx ON public.ticket_statuses (is_initial) WHERE is_initial;
INSERT INTO public.ticket_statuses (key, label, order_index, is_initial, is_terminal, header_background, header_foreground, header_border) VALUES
  ('aberto', 'Aberto', 10, true, false, '#eff6ff', '#2563eb', '#bfdbfe'),
  ('analise', 'Em Análise', 20, false, false, '#fffbeb', '#d97706', '#fde68a'),
  ('plano', 'Plano de Ação', 30, false, false, '#f5f3ff', '#7c3aed', '#ddd6fe'),
  ('concluido', 'Concluído', 40, false, true, '#ecfdf5', '#059669', '#a7f3d0');
UPDATE public.ticket_statuses SET next_status_key = CASE key
  WHEN 'aberto' THEN 'analise' WHEN 'analise' THEN 'plano' WHEN 'plano' THEN 'concluido' END;

CREATE TABLE public.helpdesk_statuses (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_initial boolean NOT NULL DEFAULT false,
  is_terminal boolean NOT NULL DEFAULT false,
  next_status_key text REFERENCES public.helpdesk_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT,
  header_background text NOT NULL DEFAULT '#f1f5f9' CHECK (header_background ~ '^#[0-9A-Fa-f]{6}$'),
  header_foreground text NOT NULL DEFAULT '#475569' CHECK (header_foreground ~ '^#[0-9A-Fa-f]{6}$'),
  header_border text NOT NULL DEFAULT '#cbd5e1' CHECK (header_border ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT helpdesk_statuses_next_not_self CHECK (next_status_key IS DISTINCT FROM key),
  CONSTRAINT helpdesk_statuses_terminal_no_next CHECK (NOT is_terminal OR next_status_key IS NULL)
);
CREATE UNIQUE INDEX helpdesk_statuses_single_initial_idx ON public.helpdesk_statuses (is_initial) WHERE is_initial;
INSERT INTO public.helpdesk_statuses (key, label, order_index, is_initial, is_terminal, header_background, header_foreground, header_border) VALUES
  ('aberto', 'Aberto', 10, true, false, '#eff6ff', '#2563eb', '#bfdbfe'),
  ('em_andamento', 'Em Andamento', 20, false, false, '#fffbeb', '#d97706', '#fde68a'),
  ('resolvido', 'Resolvido', 30, false, false, '#ecfdf5', '#059669', '#a7f3d0'),
  ('fechado', 'Fechado', 40, false, true, '#f1f5f9', '#475569', '#cbd5e1');
UPDATE public.helpdesk_statuses SET next_status_key = CASE key
  WHEN 'aberto' THEN 'em_andamento' WHEN 'em_andamento' THEN 'resolvido' WHEN 'resolvido' THEN 'fechado' END;

CREATE TABLE public.action_plan_statuses (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_initial boolean NOT NULL DEFAULT false,
  is_terminal boolean NOT NULL DEFAULT false,
  next_status_key text REFERENCES public.action_plan_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT,
  header_background text NOT NULL DEFAULT '#f1f5f9' CHECK (header_background ~ '^#[0-9A-Fa-f]{6}$'),
  header_foreground text NOT NULL DEFAULT '#475569' CHECK (header_foreground ~ '^#[0-9A-Fa-f]{6}$'),
  header_border text NOT NULL DEFAULT '#cbd5e1' CHECK (header_border ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_plan_statuses_next_not_self CHECK (next_status_key IS DISTINCT FROM key),
  CONSTRAINT action_plan_statuses_terminal_no_next CHECK (NOT is_terminal OR next_status_key IS NULL)
);
CREATE UNIQUE INDEX action_plan_statuses_single_initial_idx ON public.action_plan_statuses (is_initial) WHERE is_initial;
INSERT INTO public.action_plan_statuses (key, label, order_index, is_initial, is_terminal, header_background, header_foreground, header_border) VALUES
  ('pendente', 'Pendente', 10, true, false, '#f1f5f9', '#475569', '#cbd5e1'),
  ('andamento', 'Em Andamento', 20, false, false, '#eff6ff', '#2563eb', '#bfdbfe'),
  ('atrasado', 'Atrasado', 30, false, false, '#fff1f2', '#e11d48', '#fecdd3'),
  ('concluido', 'Concluído', 40, false, true, '#ecfdf5', '#059669', '#a7f3d0');
UPDATE public.action_plan_statuses SET next_status_key = CASE key
  WHEN 'pendente' THEN 'andamento' WHEN 'andamento' THEN 'concluido' WHEN 'atrasado' THEN 'andamento' END;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_fkey FOREIGN KEY (status)
  REFERENCES public.ticket_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.helpdesk_tickets DROP CONSTRAINT IF EXISTS helpdesk_tickets_status_check;
ALTER TABLE public.helpdesk_tickets ADD CONSTRAINT helpdesk_tickets_status_fkey FOREIGN KEY (status)
  REFERENCES public.helpdesk_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.action_plans DROP CONSTRAINT IF EXISTS action_plans_status_check;
ALTER TABLE public.action_plans ADD CONSTRAINT action_plans_status_fkey FOREIGN KEY (status)
  REFERENCES public.action_plan_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.ticket_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_plan_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY ticket_statuses_read ON public.ticket_statuses FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
CREATE POLICY helpdesk_statuses_read ON public.helpdesk_statuses FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
CREATE POLICY action_plan_statuses_read ON public.action_plan_statuses FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
GRANT SELECT ON public.ticket_statuses, public.helpdesk_statuses, public.action_plan_statuses TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ticket_statuses, public.helpdesk_statuses, public.action_plan_statuses FROM PUBLIC, anon, authenticated;

-- A terminal notification still requires its configured root-cause analysis.
CREATE FUNCTION public.enforce_ticket_terminal_analysis() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_analysis_tool text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ticket_statuses s WHERE s.key = NEW.status AND s.is_terminal)
     AND NOT NEW.analysis_completed THEN
    SELECT analysis_tool INTO v_analysis_tool FROM public.notification_types WHERE id = NEW.notification_type_id;
    IF v_analysis_tool IS NOT NULL AND v_analysis_tool <> 'Nenhuma' THEN
      RAISE EXCEPTION 'Conclua a análise de causa antes de finalizar a notificação.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_ticket_terminal_analysis_trigger
  BEFORE INSERT OR UPDATE OF status, analysis_completed, notification_type_id ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_terminal_analysis();

NOTIFY pgrst, 'reload schema';
