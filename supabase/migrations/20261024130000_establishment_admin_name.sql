-- The name of the initial administrator is now captured in the establishment
-- registration (next to admin_email) and used when sending the invite.
ALTER TABLE public.establishments ADD COLUMN admin_name text;

ALTER TABLE public.establishments ADD CONSTRAINT establishments_admin_name_length_check
CHECK (admin_name IS NULL OR char_length(admin_name) <= 200) NOT VALID;
