-- The legacy auth trigger created an operational profile for every public
-- signup, without knowing its establishment. Privileged invitation flows now
-- create the tenant-bound profile after validating the inviting actor.
DROP TRIGGER IF EXISTS on_orbis_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_orbis_user();
