-- Minimal PostgreSQL fixture for validating the education migration without Supabase services.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TYPE public.user_role AS ENUM ('admin','gestor','operador','analista','auditor','visualizador','implantacao');
CREATE TABLE public.establishments(id uuid PRIMARY KEY,status text NOT NULL DEFAULT 'active');
CREATE TABLE public.module_catalog(id text PRIMARY KEY,implemented boolean NOT NULL);
CREATE TABLE public.establishment_modules(establishment_id uuid REFERENCES public.establishments(id),module_id text REFERENCES public.module_catalog(id),enabled boolean,PRIMARY KEY(establishment_id,module_id));
CREATE TABLE public.profiles(id uuid PRIMARY KEY,establishment_id uuid REFERENCES public.establishments(id),name text NOT NULL,role public.user_role NOT NULL,custom_role_id uuid,is_active boolean NOT NULL DEFAULT true,module_access text[] NOT NULL DEFAULT '{}',edit_access text[] NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX profiles_tenant_id_uidx ON public.profiles(establishment_id,id);
CREATE TABLE public.custom_roles(id uuid PRIMARY KEY,module_access text[] NOT NULL DEFAULT '{}');
CREATE TABLE public.action_plans(id uuid PRIMARY KEY,establishment_id uuid REFERENCES public.establishments(id),title text,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX action_plans_tenant_id_uidx ON public.action_plans(establishment_id,id);
INSERT INTO public.establishments(id) VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO public.module_catalog(id,implemented) VALUES ('education',false);
INSERT INTO public.action_plans(id,establishment_id,title) VALUES
  ('60000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Capacitação sobre melhoria contínua');
INSERT INTO public.custom_roles(id,module_access) VALUES ('50000000-0000-4000-8000-000000000001','{}');
INSERT INTO public.profiles(id,establishment_id,name,role,module_access,edit_access) VALUES
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Course Author','admin',ARRAY['education'],ARRAY['educacao/gerenciamento']),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','Other Tenant','admin',ARRAY['education'],ARRAY['educacao/gerenciamento']),
  ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Viewer','visualizador','{}','{}'),
  ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','Manager','gestor','{}','{}'),
  ('10000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','Operator','operador','{}','{}'),
  ('10000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','Analyst','analista','{}','{}'),
  ('10000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','Auditor','auditor','{}','{}'),
  ('10000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','Custom role','admin','{}','{}');
UPDATE public.profiles SET custom_role_id='50000000-0000-4000-8000-000000000001'
WHERE id='10000000-0000-4000-8000-000000000008';
CREATE FUNCTION public.current_establishment_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT establishment_id FROM public.profiles WHERE id=auth.uid() AND is_active $$;
CREATE FUNCTION public.establishment_has_module(p_module text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.module_catalog c JOIN public.establishment_modules m ON m.module_id=c.id
    WHERE c.id=p_module AND c.implemented AND m.enabled AND m.establishment_id=public.current_establishment_id()) $$;
CREATE FUNCTION public.user_has_module_access(p_module text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND p_module=ANY(module_access) AND is_active
    AND public.establishment_has_module(p_module)) $$;
CREATE FUNCTION public.user_can_edit(p_page text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND p_page=ANY(edit_access) AND is_active) $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated;
