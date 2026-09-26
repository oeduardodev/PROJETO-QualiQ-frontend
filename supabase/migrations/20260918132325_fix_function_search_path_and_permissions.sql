/*
# Fix security advisor warnings on helper functions

## Changes
1. Alter `get_user_role()`, `get_user_category_id()`, and `update_updated_at()` to set `search_path = public`.
2. Revoke EXECUTE from `anon` role on `get_user_role()` and `get_user_category_id()` so unauthenticated users cannot call them via the REST API.
3. Grant EXECUTE to `authenticated` only.
*/

-- Fix search_path on all three functions
ALTER FUNCTION get_user_role() SET search_path = public;
ALTER FUNCTION get_user_category_id() SET search_path = public;
ALTER FUNCTION update_updated_at() SET search_path = public;

-- Revoke EXECUTE from anon on security helper functions
REVOKE EXECUTE ON FUNCTION get_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION get_user_category_id() FROM anon;

-- Grant EXECUTE to authenticated (needed for RLS policy evaluation)
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_category_id() TO authenticated;
