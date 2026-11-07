ALTER TABLE public.profiles
  ADD COLUMN theme_preference text NOT NULL DEFAULT 'light'
  CONSTRAINT profiles_theme_preference_check CHECK (theme_preference IN ('light', 'dark'));
