-- A single global switch controls the availability of the application.
-- Only privileged database access (for example, the Supabase SQL editor or
-- service role) may change it; anonymous and signed-in clients may read it.
CREATE TABLE public.system_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  active_maintenance boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (id, active_maintenance) VALUES (true, false);

CREATE FUNCTION public.touch_system_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_system_settings_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER touch_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_system_settings_updated_at();

REVOKE ALL ON public.system_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.system_settings TO anon, authenticated;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_settings_read ON public.system_settings
  FOR SELECT TO anon, authenticated USING (true);

-- Realtime makes an open tab switch screens as soon as the flag changes.
-- The client also polls, so it recovers if the websocket is unavailable.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'system_settings'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
  END IF;
END $$;
