-- Helpdesk category and priority options are managed in Supabase.
CREATE TABLE IF NOT EXISTS public.helpdesk_categories (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS helpdesk_categories_single_default_idx
  ON public.helpdesk_categories (is_default)
  WHERE is_default;

INSERT INTO public.helpdesk_categories (key, label, order_index, is_default) VALUES
  ('ti', 'TI', 10, true),
  ('manutencao', 'Manutenção', 20, false),
  ('almoxarifado', 'Almoxarifado', 30, false)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.helpdesk_priorities (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  badge_background text NOT NULL DEFAULT '#f1f5f9'
    CHECK (badge_background ~ '^#[0-9A-Fa-f]{6}$'),
  badge_foreground text NOT NULL DEFAULT '#475569'
    CHECK (badge_foreground ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS helpdesk_priorities_single_default_idx
  ON public.helpdesk_priorities (is_default)
  WHERE is_default;

INSERT INTO public.helpdesk_priorities (
  key, label, order_index, is_default, badge_background, badge_foreground
) VALUES
  ('baixa', 'Baixa', 10, false, '#f1f5f9', '#475569'),
  ('media', 'Média', 20, true, '#fef3c7', '#b45309'),
  ('alta', 'Alta', 30, false, '#ffedd5', '#c2410c'),
  ('urgente', 'Urgente', 40, false, '#ffe4e6', '#be123c')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.helpdesk_tickets
  DROP CONSTRAINT IF EXISTS helpdesk_tickets_category_check,
  DROP CONSTRAINT IF EXISTS helpdesk_tickets_priority_check,
  DROP CONSTRAINT IF EXISTS helpdesk_tickets_category_fkey,
  DROP CONSTRAINT IF EXISTS helpdesk_tickets_priority_fkey;

ALTER TABLE public.helpdesk_tickets
  ADD CONSTRAINT helpdesk_tickets_category_fkey
    FOREIGN KEY (category) REFERENCES public.helpdesk_categories (key)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT helpdesk_tickets_priority_fkey
    FOREIGN KEY (priority) REFERENCES public.helpdesk_priorities (key)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.helpdesk_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY helpdesk_categories_read ON public.helpdesk_categories
  FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);

CREATE POLICY helpdesk_priorities_read ON public.helpdesk_priorities
  FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);

GRANT SELECT ON public.helpdesk_categories, public.helpdesk_priorities TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.helpdesk_categories, public.helpdesk_priorities
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
