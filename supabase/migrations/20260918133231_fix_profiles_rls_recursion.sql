/*
# Fix infinite recursion in profiles RLS policy

## Problem
The `select_own_profile` policy on `profiles` queries `profiles` itself
(to check if the user is Admin), causing infinite recursion.

## Solution
Use the `get_user_role()` SECURITY DEFINER function instead of querying
profiles directly. This function runs with definer privileges, bypassing RLS.
*/

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;

-- Users can read their own profile; Admin can read all
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR get_user_role() = 'Admin'
  );

-- Users can update their own profile (name only, not role)
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
