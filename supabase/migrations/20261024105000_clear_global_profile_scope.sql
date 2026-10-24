-- Global implantation accounts cannot retain an operational category.
UPDATE public.profiles SET category_id = NULL WHERE role = 'implantacao';

ALTER TABLE public.profiles DROP CONSTRAINT profiles_establishment_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_establishment_role_check
CHECK (
  (role = 'implantacao' AND establishment_id IS NULL
    AND custom_role_id IS NULL AND category_id IS NULL)
  OR (role <> 'implantacao' AND establishment_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.assign_implantation_role(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE previous jsonb;
BEGIN
  IF current_user NOT IN ('postgres','service_role') THEN
    RAISE EXCEPTION 'Privileged database operation required' USING ERRCODE='42501';
  END IF;
  SELECT to_jsonb(p) INTO previous FROM public.profiles p WHERE p.id=p_user;
  UPDATE public.profiles SET role='implantacao', establishment_id=NULL,
    custom_role_id=NULL, category_id=NULL, module_access='{}', edit_access='{}'
  WHERE id=p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  INSERT INTO public.implantation_audit(actor_id,action,before_data,after_data)
  VALUES (auth.uid(),'assign_implantation_role',previous,jsonb_build_object('user_id',p_user));
END $$;
REVOKE ALL ON FUNCTION public.assign_implantation_role(uuid) FROM PUBLIC,anon,authenticated;
