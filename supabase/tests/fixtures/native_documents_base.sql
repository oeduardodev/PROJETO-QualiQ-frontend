-- Minimal pre-migration contract for the isolated PostgreSQL regression test.
-- Never execute this fixture against an application database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text);
CREATE FUNCTION public.get_user_role() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT role FROM public.profiles WHERE id=auth.uid() $$;
CREATE TYPE public.document_status AS ENUM('rascunho','em_revisao','em_validacao','aprovado','publicado','obsoleto');
CREATE TABLE public.document_types(id uuid PRIMARY KEY,active boolean DEFAULT true,print_allowed boolean DEFAULT false);
CREATE TABLE public.sipoc_nodes(id uuid PRIMARY KEY,process_id uuid,node_type text);
CREATE TABLE public.documents(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,type_id uuid,process_id uuid,
  step_id uuid,owner_id uuid,approver_ids uuid[] NOT NULL DEFAULT '{}',drive_link text,
  status public.document_status NOT NULL DEFAULT 'rascunho',print_allowed boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,content_html text,content_pdf_path text,content_synced_version integer,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.document_versions(id uuid DEFAULT gen_random_uuid(),document_id uuid,version integer,snapshot jsonb,recorded_by uuid,justification text,UNIQUE(document_id,version));
CREATE TABLE public.document_workflows(document_id uuid,from_status public.document_status,to_status public.document_status,changed_by uuid,notes text,version integer);
CREATE TABLE public.document_decisions(document_id uuid,version integer,approver_id uuid,approved boolean,comment text,UNIQUE(document_id,version,approver_id));
CREATE TABLE public.controlled_copies(document_id uuid,status text);
CREATE TABLE storage.objects(bucket_id text,name text,PRIMARY KEY(bucket_id,name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated;
GRANT SELECT ON public.documents TO authenticated;
GRANT SELECT,INSERT ON storage.objects TO authenticated;
CREATE FUNCTION public.sync_operation_document(uuid,timestamptz,uuid,text,text) RETURNS public.documents LANGUAGE sql AS $$ SELECT * FROM public.documents LIMIT 1 $$;
CREATE FUNCTION public.transition_operation_document(uuid,timestamptz,text,text) RETURNS public.documents LANGUAGE sql AS $$ SELECT * FROM public.documents LIMIT 1 $$;
INSERT INTO public.profiles VALUES
('00000000-0000-0000-0000-000000000001','Admin'),
('00000000-0000-0000-0000-000000000002','Usuário'),
('00000000-0000-0000-0000-000000000003','Usuário'),
('00000000-0000-0000-0000-000000000004','Usuário');
INSERT INTO public.document_types(id) VALUES('10000000-0000-0000-0000-000000000001');
INSERT INTO public.sipoc_nodes VALUES('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','P');
INSERT INTO public.documents(id,title,drive_link,content_html,content_pdf_path) VALUES
('40000000-0000-0000-0000-000000000001','Legado HTML','https://docs.google.com/document/d/example/edit','<h1>Original</h1>','old/original.pdf'),
('40000000-0000-0000-0000-000000000002','Legado link','https://docs.google.com/document/d/pending/edit',NULL,NULL);
