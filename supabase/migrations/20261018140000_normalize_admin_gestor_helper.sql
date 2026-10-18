-- Role enum values are stored in lowercase. Normalize the helper so every
-- endpoint and RLS policy that relies on it recognizes admins and managers.
CREATE OR REPLACE FUNCTION public.is_admin_or_gestor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND lower(coalesce(role::text, '')) IN ('admin', 'gestor')
  );
$$;

NOTIFY pgrst, 'reload schema';
