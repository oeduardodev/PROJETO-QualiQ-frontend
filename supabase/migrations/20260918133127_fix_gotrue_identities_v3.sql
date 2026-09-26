/*
# Fix GoTrue auth — add identity records and fix instance_id

## Problem
GoTrue (Supabase Auth) requires entries in `auth.identities` for each user.
Without them, login returns 500 "unexpected_failure". The `email` column in
auth.identities is a generated column, so we must not insert into it.
*/

-- Fix instance_id on test users
DO $$
DECLARE
  v_instance_id uuid;
BEGIN
  BEGIN
    SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END;

  IF v_instance_id IS NULL OR v_instance_id = '00000000-0000-0000-0000-000000000000' THEN
    BEGIN
      SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_instance_id := '00000000-0000-0000-0000-000000000000';
    END;
  END IF;

  UPDATE auth.users SET instance_id = v_instance_id
  WHERE id IN (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003'
  );
END $$;

-- Add identity records (email column is generated, don't insert into it)
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.email,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  now()
FROM auth.users u
WHERE u.id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003'
)
AND NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
)
ON CONFLICT DO NOTHING;
