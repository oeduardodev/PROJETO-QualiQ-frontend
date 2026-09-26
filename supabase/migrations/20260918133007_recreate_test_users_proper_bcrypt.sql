/*
# Recreate test auth users with GoTrue-compatible password hashes

## Problem
Passwords were hashed with PostgreSQL's `crypt()` using `gen_salt('bf')`, which uses
a different bcrypt cost/variant than GoTrue (Supabase Auth) expects. GoTrue uses the
standard bcrypt format: `$2a$<cost>$<22-char-salt><31-char-hash>`.

## Solution
Delete the existing test users and recreate them with a known-good bcrypt hash
generated for the standard bcrypt format. The hash below is for "admin123" using
bcrypt cost 10, which is what GoTrue uses by default.

We use a PL/pgSQL block to generate proper bcrypt hashes via crypt() with the 'bf'
algorithm and cost parameter 10, matching GoTrue's format.
*/

-- Delete existing test users (CASCADE will clean up profiles via FK)
DELETE FROM profiles WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003'
);

DELETE FROM auth.users WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003'
);

-- Recreate with proper bcrypt cost 10 (matching GoTrue default)
-- crypt() with gen_salt('bf', 10) produces $2a$10$... format which GoTrue can verify
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data, instance_id)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin@sgq.com',
  crypt('admin123', gen_salt('bf', 10)),
  now(), now(), now(),
  'authenticated', 'authenticated',
  '{"role":"Admin","provider":"email"}'::jsonb,
  '{"name":"Administrador do SGQ"}'::jsonb,
  '00000000-0000-0000-0000-000000000000'
);

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data, instance_id)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'gestor@sgq.com',
  crypt('gestor123', gen_salt('bf', 10)),
  now(), now(), now(),
  'authenticated', 'authenticated',
  '{"role":"Gestor","provider":"email"}'::jsonb,
  '{"name":"Gestor Finalístico"}'::jsonb,
  '00000000-0000-0000-0000-000000000000'
);

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data, instance_id)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'operador@sgq.com',
  crypt('operador123', gen_salt('bf', 10)),
  now(), now(), now(),
  'authenticated', 'authenticated',
  '{"role":"Operador","provider":"email"}'::jsonb,
  '{"name":"Operador de Produção"}'::jsonb,
  '00000000-0000-0000-0000-000000000000'
);

-- Recreate profiles
INSERT INTO profiles (id, name, role, category_id)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Administrador do SGQ',
  'Admin'::user_role,
  NULL
);

INSERT INTO profiles (id, name, role, category_id)
SELECT
  'a0000000-0000-0000-0000-000000000002',
  'Gestor Finalístico',
  'Gestor'::user_role,
  c.id
FROM value_chain_categories c
WHERE c.name = 'Finalístico';

INSERT INTO profiles (id, name, role, category_id)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'Operador de Produção',
  'Operador'::user_role,
  NULL
);
