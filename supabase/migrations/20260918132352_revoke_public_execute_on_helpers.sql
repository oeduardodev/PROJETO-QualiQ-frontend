/*
# Revoke PUBLIC execute on security helper functions

The default PostgreSQL grant gives PUBLIC (all roles) EXECUTE on functions.
Revoke that so only authenticated can call get_user_role() and get_user_category_id().
*/

REVOKE EXECUTE ON FUNCTION get_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_category_id() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_category_id() TO authenticated;
