/*
# Fix test auth users — set required fields for Supabase Auth login

The test users inserted previously had NULL `aud` and `role` fields, which
causes Supabase Auth to reject login with "Invalid login credentials".
This migration sets `aud = 'authenticated'` and `role = 'authenticated'`
on all three test users, which is what `supabase.auth.signInWithPassword()` checks.
*/

UPDATE auth.users
SET aud = 'authenticated',
    role = 'authenticated'
WHERE email IN ('admin@sgq.com', 'gestor@sgq.com', 'operador@sgq.com');
