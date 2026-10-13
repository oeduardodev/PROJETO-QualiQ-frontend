-- Severity options shared by tickets, notification types, and classifications.
CREATE TABLE public.notification_severities (
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

CREATE UNIQUE INDEX notification_severities_single_default_idx
  ON public.notification_severities (is_default)
  WHERE is_default;

INSERT INTO public.notification_severities (
  key, label, order_index, is_default, badge_background, badge_foreground
) VALUES
  ('baixa', 'Baixa', 10, false, '#f1f5f9', '#475569'),
  ('media', 'Média', 20, true, '#fef3c7', '#b45309'),
  ('alta', 'Alta', 30, false, '#ffedd5', '#c2410c'),
  ('critica', 'Crítica', 40, false, '#ffe4e6', '#be123c');

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_severity_check;
ALTER TABLE public.notification_types
  DROP CONSTRAINT IF EXISTS notification_types_default_severity_check;
ALTER TABLE public.notification_classifications
  DROP CONSTRAINT IF EXISTS notification_classifications_default_severity_check;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_severity_fkey
    FOREIGN KEY (severity) REFERENCES public.notification_severities (key)
    ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.notification_types
  ADD CONSTRAINT notification_types_default_severity_fkey
    FOREIGN KEY (default_severity) REFERENCES public.notification_severities (key)
    ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.notification_classifications
  ADD CONSTRAINT notification_classifications_default_severity_fkey
    FOREIGN KEY (default_severity) REFERENCES public.notification_severities (key)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.notification_severities ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_severities_read ON public.notification_severities
  FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);

GRANT SELECT ON public.notification_severities TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.notification_severities
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
