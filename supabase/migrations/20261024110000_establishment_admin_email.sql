-- The establishment contact address is the address used to invite and identify
-- its initial administrator. Rename it to reflect that responsibility.
ALTER TABLE public.establishments RENAME COLUMN contact_email TO admin_email;

ALTER TABLE public.establishments ADD CONSTRAINT establishments_admin_email_check
CHECK (admin_email IS NULL OR admin_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') NOT VALID;
