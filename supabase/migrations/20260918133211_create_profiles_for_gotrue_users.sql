/*
# Create profile rows for GoTrue-created test users

## What
The test users were created via GoTrue's signUp endpoint (proper password hashing).
Now we need to insert their profile rows with the correct roles and category link.
*/

-- Admin profile
INSERT INTO profiles (id, name, role, category_id)
SELECT
  au.id,
  'Administrador do SGQ',
  'Admin'::user_role,
  NULL
FROM auth.users au
WHERE au.email = 'admin@sgq.com'
ON CONFLICT (id) DO NOTHING;

-- Gestor profile (linked to "Finalístico" category)
INSERT INTO profiles (id, name, role, category_id)
SELECT
  au.id,
  'Gestor Finalístico',
  'Gestor'::user_role,
  c.id
FROM auth.users au
CROSS JOIN value_chain_categories c
WHERE au.email = 'gestor@sgq.com'
  AND c.name = 'Finalístico'
ON CONFLICT (id) DO NOTHING;

-- Operador profile
INSERT INTO profiles (id, name, role, category_id)
SELECT
  au.id,
  'Operador de Produção',
  'Operador'::user_role,
  NULL
FROM auth.users au
WHERE au.email = 'operador@sgq.com'
ON CONFLICT (id) DO NOTHING;
