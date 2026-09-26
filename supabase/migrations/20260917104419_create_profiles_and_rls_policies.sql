/*
# Create profiles table and role-based RLS policies

## Overview
This migration implements authentication and role-based access control (RBAC) for the QMS.
It creates a `profiles` table linked to `auth.users`, defines a `user_role` enum
('Admin', 'Gestor', 'Operador'), adds a `created_by` column to `tickets` for
ownership tracking, and replaces all existing open RLS policies with role-based ones.

## 1. New Types
- `user_role` enum: 'Admin', 'Gestor', 'Operador'

## 2. New Tables
- `profiles`
  - `id` (uuid, PK, references auth.users ON DELETE CASCADE)
  - `name` (text, not null)
  - `role` (user_role, not null, default 'Operador')
  - `category_id` (uuid, nullable, FK -> value_chain_categories — used by Gestor to scope their area)

## 3. Modified Tables
- `tickets`: added `created_by` (uuid, nullable, references auth.users ON DELETE SET NULL)
  - Used to track which user created a ticket (for Operador: can only see their own tickets)

## 4. Security — RLS Policy Rules
All tables now enforce role-based access:

### Admin (role = 'Admin')
- Full CRUD on ALL tables.

### Gestor (role = 'Gestor')
- READ all tables.
- CREATE / UPDATE / DELETE only on processes, indicators, action_plans, and tickets
  where the process belongs to their category_id (their area).
- Can update/delete tickets whose process belongs to their category.

### Operador (role = 'Operador')
- READ processes and sipoc_nodes (all).
- READ tickets created by themselves only.
- CREATE tickets (created_by auto-set to auth.uid()).
- UPDATE / DELETE tickets created by themselves.
- NO access to indicators, indicator_history, action_plans, value_chain_categories.

## 5. Helper Function
- `get_user_role()` — returns the current user's role from profiles, or NULL if not authenticated.

## 6. Test Users
- 3 auth users created via `auth.users` inserts (Admin, Gestor, Operador) with
  corresponding profile rows. Passwords are set via `crypt()` for Supabase auth.
*/

-- =============================================================
-- 1. Create user_role enum
-- =============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('Admin', 'Gestor', 'Operador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================
-- 2. Create profiles table
-- =============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role user_role NOT NULL DEFAULT 'Operador',
  category_id uuid REFERENCES value_chain_categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own profile; Admin can read all
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Admin')
  );

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =============================================================
-- 3. Add created_by to tickets
-- =============================================================
DO $$ BEGIN
  ALTER TABLE tickets ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- =============================================================
-- 4. Helper function: get_user_role()
-- =============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Helper: get user's category_id (for Gestor)
CREATE OR REPLACE FUNCTION get_user_category_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT category_id FROM profiles WHERE id = auth.uid();
$$;

-- =============================================================
-- 5. Drop ALL existing open policies on all tables
-- =============================================================

-- value_chain_categories
DROP POLICY IF EXISTS "anon_select_categories" ON value_chain_categories;
DROP POLICY IF EXISTS "anon_insert_categories" ON value_chain_categories;
DROP POLICY IF EXISTS "anon_update_categories" ON value_chain_categories;
DROP POLICY IF EXISTS "anon_delete_categories" ON value_chain_categories;

-- processes
DROP POLICY IF EXISTS "anon_select_processes" ON processes;
DROP POLICY IF EXISTS "anon_insert_processes" ON processes;
DROP POLICY IF EXISTS "anon_update_processes" ON processes;
DROP POLICY IF EXISTS "anon_delete_processes" ON processes;

-- sipoc_nodes
DROP POLICY IF EXISTS "anon_select_sipoc" ON sipoc_nodes;
DROP POLICY IF EXISTS "anon_insert_sipoc" ON sipoc_nodes;
DROP POLICY IF EXISTS "anon_update_sipoc" ON sipoc_nodes;
DROP POLICY IF EXISTS "anon_delete_sipoc" ON sipoc_nodes;

-- tickets
DROP POLICY IF EXISTS "anon_select_tickets" ON tickets;
DROP POLICY IF EXISTS "anon_insert_tickets" ON tickets;
DROP POLICY IF EXISTS "anon_update_tickets" ON tickets;
DROP POLICY IF EXISTS "anon_delete_tickets" ON tickets;

-- action_plans
DROP POLICY IF EXISTS "anon_select_action_plans" ON action_plans;
DROP POLICY IF EXISTS "anon_insert_action_plans" ON action_plans;
DROP POLICY IF EXISTS "anon_update_action_plans" ON action_plans;
DROP POLICY IF EXISTS "anon_delete_action_plans" ON action_plans;

-- indicators
DROP POLICY IF EXISTS "anon_select_indicators" ON indicators;
DROP POLICY IF EXISTS "anon_insert_indicators" ON indicators;
DROP POLICY IF EXISTS "anon_update_indicators" ON indicators;
DROP POLICY IF EXISTS "anon_delete_indicators" ON indicators;

-- indicator_history
DROP POLICY IF EXISTS "anon_select_indicator_history" ON indicator_history;
DROP POLICY IF EXISTS "anon_insert_indicator_history" ON indicator_history;
DROP POLICY IF EXISTS "anon_update_indicator_history" ON indicator_history;
DROP POLICY IF EXISTS "anon_delete_indicator_history" ON indicator_history;

-- =============================================================
-- 6. New RLS policies — value_chain_categories
-- Admin: full CRUD. Gestor: read only. Operador: no access.
-- =============================================================
CREATE POLICY "select_categories_admin_gestor" ON value_chain_categories FOR SELECT
  TO authenticated USING (
    get_user_role() IN ('Admin', 'Gestor')
  );

CREATE POLICY "insert_categories_admin" ON value_chain_categories FOR INSERT
  TO authenticated WITH CHECK (get_user_role() = 'Admin');

CREATE POLICY "update_categories_admin" ON value_chain_categories FOR UPDATE
  TO authenticated USING (get_user_role() = 'Admin') WITH CHECK (get_user_role() = 'Admin');

CREATE POLICY "delete_categories_admin" ON value_chain_categories FOR DELETE
  TO authenticated USING (get_user_role() = 'Admin');

-- =============================================================
-- 7. New RLS policies — processes
-- Admin: full CRUD. Gestor: read all, write only in their category. Operador: read only.
-- =============================================================
CREATE POLICY "select_processes_all_roles" ON processes FOR SELECT
  TO authenticated USING (get_user_role() IN ('Admin', 'Gestor', 'Operador'));

CREATE POLICY "insert_processes_admin_gestor" ON processes FOR INSERT
  TO authenticated WITH CHECK (
    get_user_role() = 'Admin'
    OR (get_user_role() = 'Gestor' AND category_id = get_user_category_id())
  );

CREATE POLICY "update_processes_admin_gestor" ON processes FOR UPDATE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (get_user_role() = 'Gestor' AND category_id = get_user_category_id())
  ) WITH CHECK (
    get_user_role() = 'Admin'
    OR (get_user_role() = 'Gestor' AND category_id = get_user_category_id())
  );

CREATE POLICY "delete_processes_admin_gestor" ON processes FOR DELETE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (get_user_role() = 'Gestor' AND category_id = get_user_category_id())
  );

-- =============================================================
-- 8. New RLS policies — sipoc_nodes
-- Admin: full CRUD. Gestor: read all, write only for nodes in their category's processes. Operador: read only.
-- =============================================================
CREATE POLICY "select_sipoc_all_roles" ON sipoc_nodes FOR SELECT
  TO authenticated USING (
    get_user_role() IN ('Admin', 'Gestor', 'Operador')
  );

CREATE POLICY "insert_sipoc_admin_gestor" ON sipoc_nodes FOR INSERT
  TO authenticated WITH CHECK (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = sipoc_nodes.process_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "update_sipoc_admin_gestor" ON sipoc_nodes FOR UPDATE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = sipoc_nodes.process_id
        AND p.category_id = get_user_category_id()
      )
    )
  ) WITH CHECK (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = sipoc_nodes.process_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "delete_sipoc_admin_gestor" ON sipoc_nodes FOR DELETE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = sipoc_nodes.process_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

-- =============================================================
-- 9. New RLS policies — tickets
-- Admin: full CRUD. Gestor: full CRUD on tickets in their category's processes. Operador: create + read/update/delete own.
-- =============================================================
CREATE POLICY "select_tickets_role_based" ON tickets FOR SELECT
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = tickets.process_id
        AND p.category_id = get_user_category_id()
      )
    )
    OR (
      get_user_role() = 'Operador'
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "insert_tickets_role_based" ON tickets FOR INSERT
  TO authenticated WITH CHECK (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = tickets.process_id
        AND p.category_id = get_user_category_id()
      )
    )
    OR get_user_role() = 'Operador'
  );

CREATE POLICY "update_tickets_role_based" ON tickets FOR UPDATE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = tickets.process_id
        AND p.category_id = get_user_category_id()
      )
    )
    OR (
      get_user_role() = 'Operador'
      AND created_by = auth.uid()
    )
  ) WITH CHECK (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = tickets.process_id
        AND p.category_id = get_user_category_id()
      )
    )
    OR (
      get_user_role() = 'Operador'
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "delete_tickets_role_based" ON tickets FOR DELETE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = tickets.process_id
        AND p.category_id = get_user_category_id()
      )
    )
    OR (
      get_user_role() = 'Operador'
      AND created_by = auth.uid()
    )
  );

-- =============================================================
-- 10. New RLS policies — action_plans
-- Admin: full CRUD. Gestor: full CRUD on plans linked to tickets in their category. Operador: no access.
-- =============================================================
CREATE POLICY "select_action_plans_admin_gestor" ON action_plans FOR SELECT
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM tickets t
        JOIN processes p ON p.id = t.process_id
        WHERE t.id = action_plans.ticket_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "insert_action_plans_admin_gestor" ON action_plans FOR INSERT
  TO authenticated WITH CHECK (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM tickets t
        JOIN processes p ON p.id = t.process_id
        WHERE t.id = action_plans.ticket_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "update_action_plans_admin_gestor" ON action_plans FOR UPDATE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM tickets t
        JOIN processes p ON p.id = t.process_id
        WHERE t.id = action_plans.ticket_id
        AND p.category_id = get_user_category_id()
      )
    )
  ) WITH CHECK (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM tickets t
        JOIN processes p ON p.id = t.process_id
        WHERE t.id = action_plans.ticket_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "delete_action_plans_admin_gestor" ON action_plans FOR DELETE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM tickets t
        JOIN processes p ON p.id = t.process_id
        WHERE t.id = action_plans.ticket_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

-- =============================================================
-- 11. New RLS policies — indicators
-- Admin: full CRUD. Gestor: full CRUD on indicators in their category. Operador: no access.
-- =============================================================
CREATE POLICY "select_indicators_admin_gestor" ON indicators FOR SELECT
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = indicators.process_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "insert_indicators_admin_gestor" ON indicators FOR INSERT
  TO authenticated WITH CHECK (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = indicators.process_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "update_indicators_admin_gestor" ON indicators FOR UPDATE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = indicators.process_id
        AND p.category_id = get_user_category_id()
      )
    )
  ) WITH CHECK (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = indicators.process_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "delete_indicators_admin_gestor" ON indicators FOR DELETE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM processes p
        WHERE p.id = indicators.process_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

-- =============================================================
-- 12. New RLS policies — indicator_history
-- Admin: full CRUD. Gestor: full CRUD on history for indicators in their category. Operador: no access.
-- =============================================================
CREATE POLICY "select_indicator_history_admin_gestor" ON indicator_history FOR SELECT
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM indicators i
        JOIN processes p ON p.id = i.process_id
        WHERE i.id = indicator_history.indicator_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "insert_indicator_history_admin_gestor" ON indicator_history FOR INSERT
  TO authenticated WITH CHECK (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM indicators i
        JOIN processes p ON p.id = i.process_id
        WHERE i.id = indicator_history.indicator_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "update_indicator_history_admin_gestor" ON indicator_history FOR UPDATE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM indicators i
        JOIN processes p ON p.id = i.process_id
        WHERE i.id = indicator_history.indicator_id
        AND p.category_id = get_user_category_id()
      )
    )
  ) WITH CHECK (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM indicators i
        JOIN processes p ON p.id = i.process_id
        WHERE i.id = indicator_history.indicator_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

CREATE POLICY "delete_indicator_history_admin_gestor" ON indicator_history FOR DELETE
  TO authenticated USING (
    get_user_role() = 'Admin'
    OR (
      get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM indicators i
        JOIN processes p ON p.id = i.process_id
        WHERE i.id = indicator_history.indicator_id
        AND p.category_id = get_user_category_id()
      )
    )
  );

-- =============================================================
-- 13. Set created_by default on tickets to auth.uid()
-- =============================================================
ALTER TABLE tickets ALTER COLUMN created_by SET DEFAULT auth.uid();

-- =============================================================
-- 14. Create test users in auth.users and profiles
-- =============================================================
-- Admin user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin@sgq.com',
  crypt('admin123', gen_salt('bf')),
  now(), now(), now(),
  '{"role":"Admin"}'::jsonb,
  '{"name":"Administrador do SGQ"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Gestor user (category: Finalístico = green)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'gestor@sgq.com',
  crypt('gestor123', gen_salt('bf')),
  now(), now(), now(),
  '{"role":"Gestor"}'::jsonb,
  '{"name":"Gestor Finalístico"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Operador user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'operador@sgq.com',
  crypt('operador123', gen_salt('bf')),
  now(), now(), now(),
  '{"role":"Operador"}'::jsonb,
  '{"name":"Operador de Produção"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Insert profiles (link Gestor to the "Finalístico" category)
INSERT INTO profiles (id, name, role, category_id)
SELECT 'a0000000-0000-0000-0000-000000000001', 'Administrador do SGQ', 'Admin'::user_role, NULL
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000001');

INSERT INTO profiles (id, name, role, category_id)
SELECT 'a0000000-0000-0000-0000-000000000002', 'Gestor Finalístico', 'Gestor'::user_role, c.id
FROM value_chain_categories c
WHERE c.name = 'Finalístico'
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000002');

INSERT INTO profiles (id, name, role, category_id)
SELECT 'a0000000-0000-0000-0000-000000000003', 'Operador de Produção', 'Operador'::user_role, NULL
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000003');
