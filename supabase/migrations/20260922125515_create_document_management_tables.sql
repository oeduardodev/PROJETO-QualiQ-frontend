/*
# GED — Gestão Eletrônica de Documentos (ISO 9001)

Creates the document management module with 4 new tables, enums, and RLS policies.

## New Tables

1. **document_types** — Categories of documents (Política, Manual, POP, Registro) with hierarchy levels (1-4 pyramid) and SLA configuration.
2. **documents** — The actual controlled documents linked to processes and types.
3. **document_workflows** — History trail of status changes with SLA tracking.
4. **controlled_copies** — Print copy control (requested → delivered → collected).

## Security (RLS)
- App has sign-in. Policies scoped to `authenticated`.
- All authenticated users can SELECT all rows.
- Only Admin and Gestor roles can INSERT/UPDATE/DELETE (via is_admin_or_gestor helper).
- controlled_copies: any authenticated user can INSERT (request a print); only admin/gestor can UPDATE/DELETE.
*/

-- Enums
DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('rascunho', 'em_revisao', 'aprovacao', 'publicado', 'obsoleto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE copy_status AS ENUM ('solicitada', 'entregue', 'recolhida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: check if current user is Admin or Gestor
CREATE OR REPLACE FUNCTION public.is_admin_or_gestor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND lower(coalesce(role::text, '')) IN ('admin', 'gestor')
  );
$$;

-- document_types
CREATE TABLE IF NOT EXISTS public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hierarchy_level int NOT NULL DEFAULT 2 CHECK (hierarchy_level BETWEEN 1 AND 4),
  sla_review_days int NOT NULL DEFAULT 365,
  sla_approval_days int NOT NULL DEFAULT 30,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_document_types" ON public.document_types;
CREATE POLICY "select_document_types" ON public.document_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_document_types" ON public.document_types;
CREATE POLICY "insert_document_types" ON public.document_types FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_document_types" ON public.document_types;
CREATE POLICY "update_document_types" ON public.document_types FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_document_types" ON public.document_types;
CREATE POLICY "delete_document_types" ON public.document_types FOR DELETE TO authenticated USING (public.is_admin_or_gestor());

-- documents
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type_id uuid REFERENCES public.document_types(id) ON DELETE SET NULL,
  process_id uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  drive_link text,
  status document_status NOT NULL DEFAULT 'rascunho',
  owner_id uuid DEFAULT auth.uid(),
  print_allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_documents" ON public.documents;
CREATE POLICY "select_documents" ON public.documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_documents" ON public.documents;
CREATE POLICY "insert_documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_documents" ON public.documents;
CREATE POLICY "update_documents" ON public.documents FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_documents" ON public.documents;
CREATE POLICY "delete_documents" ON public.documents FOR DELETE TO authenticated USING (public.is_admin_or_gestor());

-- document_workflows
CREATE TABLE IF NOT EXISTS public.document_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  from_status document_status,
  to_status document_status NOT NULL,
  changed_by uuid DEFAULT auth.uid(),
  changed_at timestamptz DEFAULT now(),
  sla_deadline date,
  notes text
);
ALTER TABLE public.document_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_document_workflows" ON public.document_workflows;
CREATE POLICY "select_document_workflows" ON public.document_workflows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_document_workflows" ON public.document_workflows;
CREATE POLICY "insert_document_workflows" ON public.document_workflows FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_document_workflows" ON public.document_workflows;
CREATE POLICY "update_document_workflows" ON public.document_workflows FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_document_workflows" ON public.document_workflows;
CREATE POLICY "delete_document_workflows" ON public.document_workflows FOR DELETE TO authenticated USING (public.is_admin_or_gestor());

-- controlled_copies
CREATE TABLE IF NOT EXISTS public.controlled_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid(),
  request_date timestamptz DEFAULT now(),
  delivery_date timestamptz,
  return_date timestamptz,
  status copy_status NOT NULL DEFAULT 'solicitada',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.controlled_copies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_controlled_copies" ON public.controlled_copies;
CREATE POLICY "select_controlled_copies" ON public.controlled_copies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_controlled_copies" ON public.controlled_copies;
CREATE POLICY "insert_controlled_copies" ON public.controlled_copies FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_controlled_copies" ON public.controlled_copies;
CREATE POLICY "update_controlled_copies" ON public.controlled_copies FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_controlled_copies" ON public.controlled_copies;
CREATE POLICY "delete_controlled_copies" ON public.controlled_copies FOR DELETE TO authenticated USING (public.is_admin_or_gestor());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_type_id ON public.documents(type_id);
CREATE INDEX IF NOT EXISTS idx_documents_process_id ON public.documents(process_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_document_workflows_document_id ON public.document_workflows(document_id);
CREATE INDEX IF NOT EXISTS idx_controlled_copies_document_id ON public.controlled_copies(document_id);

REVOKE EXECUTE ON FUNCTION public.is_admin_or_gestor() FROM anon;
