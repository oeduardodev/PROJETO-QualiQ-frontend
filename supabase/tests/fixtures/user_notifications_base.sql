CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE PUBLICATION supabase_realtime;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  establishment_id uuid,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.operation_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  route text NOT NULL,
  record_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
ALTER TABLE public.operation_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbox_read ON public.operation_inbox FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND establishment_id =
    (SELECT establishment_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY inbox_update ON public.operation_inbox FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, UPDATE(read_at) ON public.operation_inbox TO authenticated;

CREATE TABLE public.action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL,
  title text NOT NULL, owner_id uuid, controller_id uuid,
  participant_ids uuid[] NOT NULL DEFAULT '{}', review_state text NOT NULL DEFAULT 'none'
);
CREATE TABLE public.action_plan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL,
  plan_id uuid NOT NULL, action text NOT NULL, justification text NOT NULL,
  before_data jsonb, after_data jsonb NOT NULL, changed_by uuid
);
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL,
  title text NOT NULL, owner_id uuid, approver_ids uuid[] NOT NULL DEFAULT '{}'
);
CREATE TABLE public.processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL,
  title text NOT NULL, owner_id uuid, participant_ids uuid[] NOT NULL DEFAULT '{}'
);
CREATE TABLE public.risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL,
  title text NOT NULL, owner_id uuid
);
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL,
  title text NOT NULL, assigned_to uuid
);
CREATE TABLE public.helpdesk_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL,
  title text NOT NULL, assigned_to text
);
GRANT SELECT, INSERT, UPDATE ON public.action_plans, public.documents,
  public.processes, public.risks, public.tickets, public.helpdesk_tickets TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
