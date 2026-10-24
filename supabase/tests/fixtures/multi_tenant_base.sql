-- Disposable PostgreSQL-only fixture for the multi-tenant migrations.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT string_to_array($1,'/') $$;
CREATE TYPE public.user_role AS ENUM ('admin','gestor','operador','analista','auditor','visualizador');
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean);
CREATE TABLE storage.objects(bucket_id text,name text,PRIMARY KEY(bucket_id,name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
INSERT INTO storage.buckets VALUES ('profile-avatars',true),('action-evidence',false);
CREATE TABLE public.profiles(
  id uuid PRIMARY KEY REFERENCES auth.users(id),name text NOT NULL,
  role public.user_role NOT NULL,custom_role_id uuid,category_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  module_access text[] NOT NULL DEFAULT '{}',edit_access text[] NOT NULL DEFAULT '{}',
  registration_code text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY basic_read ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE TABLE public.custom_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text);
CREATE UNIQUE INDEX custom_roles_name_unique ON public.custom_roles(lower(btrim(name)));
CREATE TABLE public.module_code_counters(process_code text,module_code text,
  last_number bigint,PRIMARY KEY(process_code,module_code));
CREATE TABLE public.processes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text,participant_ids uuid[] DEFAULT '{}');
CREATE UNIQUE INDEX processes_code_unique ON public.processes(code);
CREATE TABLE public.risk_statuses(key text PRIMARY KEY,is_default boolean DEFAULT false,label text);
CREATE UNIQUE INDEX risk_statuses_single_default_idx ON public.risk_statuses(is_default) WHERE is_default;
INSERT INTO public.risk_statuses VALUES('identified',true,'Identified'),('closed',false,'Closed');
CREATE TABLE public.indicator_statuses(key text PRIMARY KEY,
  min_goal_ratio numeric UNIQUE,is_default boolean DEFAULT false);
INSERT INTO public.indicator_statuses VALUES('good',1,true),('bad',0.5,false);
CREATE TABLE public.risk_matrix_classifications(min_score integer PRIMARY KEY,
  max_score integer,label text,background_color text,text_color text);
INSERT INTO public.risk_matrix_classifications VALUES(1,25,'Default','#ffffff','#000000');
CREATE TABLE public.risks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text REFERENCES public.risk_statuses(key),risk_score integer,risk_level text);
CREATE TABLE public.action_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid,
  controller_id uuid,participant_ids uuid[] DEFAULT '{}',code text);
CREATE UNIQUE INDEX action_plans_code_unique ON public.action_plans(code) WHERE code IS NOT NULL;
CREATE TABLE public.notification_classifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.notification_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),classification_id uuid,
  active boolean, name text, risk_id uuid,sla_id uuid);
CREATE TABLE public.public_notification_links(token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid,process_id uuid,active boolean,expires_at timestamptz,submissions int,max_submissions int);
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),process_id uuid REFERENCES public.processes(id),
  title text,description text,code text);
CREATE UNIQUE INDEX tickets_code_unique ON public.tickets(code) WHERE code IS NOT NULL;
CREATE TABLE public.ticket_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid REFERENCES public.tickets(id));
CREATE TABLE public.document_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),acronym text);
CREATE UNIQUE INDEX document_types_acronym_unique ON public.document_types(acronym);
CREATE TABLE public.document_levels(level integer PRIMARY KEY,name text);
INSERT INTO public.document_levels VALUES(1,'Strategic');
CREATE TABLE public.indicator_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_by uuid);
CREATE TABLE public.indicator_result_analyses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_by uuid);
CREATE TABLE public.indicator_definition_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),changed_by uuid);
CREATE FUNCTION public.is_admin_or_gestor() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('admin','gestor')) $$;
CREATE FUNCTION public.validate_notification_answers(jsonb,jsonb) RETURNS void LANGUAGE plpgsql AS $$ BEGIN END $$;
CREATE POLICY evidence_read ON storage.objects FOR SELECT TO authenticated USING (true);
CREATE POLICY evidence_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);
INSERT INTO auth.users VALUES
  ('10000000-0000-4000-8000-000000000001','homol@example.test'),
  ('10000000-0000-4000-8000-000000000002','new@example.test');
INSERT INTO auth.users VALUES ('10000000-0000-4000-8000-000000000003','deployment@example.test');
INSERT INTO public.profiles(id,name,role,is_active,module_access,edit_access)
VALUES ('10000000-0000-4000-8000-000000000001','Homol Admin','admin',true,
  ARRAY['dashboard','indicators','risks','documents'],
  ARRAY['dashboard','riscos/gerenciamento','documentos/hierarquia']);
INSERT INTO public.processes(id,code) VALUES ('20000000-0000-4000-8000-000000000001','AAA-001');
INSERT INTO public.tickets(id,process_id,title) VALUES
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Existing');
GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.processes,public.tickets,public.risks TO authenticated;
GRANT SELECT ON public.document_levels,public.risk_matrix_classifications TO authenticated;
SET check_function_bodies=off;
