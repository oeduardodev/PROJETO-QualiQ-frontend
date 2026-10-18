-- Retrying an approval must be safe. A prior approval for the same document edition
-- remains recorded, and the status is recalculated from all designated approvers.
CREATE OR REPLACE FUNCTION public.transition_operation_document(
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_action text,
  p_reason text
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  d public.documents;
  previous_status public.document_status;
  target public.document_status;
  is_admin boolean:=coalesce(lower(public.get_user_role()::text)='admin',false);
BEGIN
  IF auth.uid() IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN
    RAISE EXCEPTION 'Usuário e justificativa obrigatórios';
  END IF;
  SELECT * INTO d FROM public.documents WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR d.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Documento alterado. Recarregue a página';
  END IF;
  target:=d.status;
  previous_status:=d.status;
  CASE p_action
    WHEN 'submit' THEN
      IF d.status NOT IN ('rascunho','em_revisao') OR NOT(is_admin OR d.owner_id=auth.uid()) THEN
        RAISE EXCEPTION 'Envio não permitido';
      END IF;
      IF d.owner_id IS NULL OR d.step_id IS NULL OR cardinality(d.approver_ids)=0
        OR nullif(d.content_html,'') IS NULL OR d.content_synced_version IS DISTINCT FROM d.version THEN
        RAISE EXCEPTION 'Complete os responsáveis, a etapa e sincronize o conteúdo do Google Docs antes de enviar';
      END IF;
      target:='em_validacao';
    WHEN 'approve','reject' THEN
      IF d.status<>'em_validacao' OR NOT(auth.uid()=ANY(d.approver_ids)) THEN
        RAISE EXCEPTION 'Somente aprovadores designados podem decidir';
      END IF;
      INSERT INTO public.document_decisions(document_id,version,approver_id,approved,comment)
      VALUES(d.id,d.version,auth.uid(),p_action='approve',btrim(p_reason))
      ON CONFLICT(document_id,version,approver_id) DO NOTHING;
      IF p_action='reject' THEN
        target:='em_revisao';
      ELSIF NOT EXISTS(
        SELECT 1 FROM unnest(d.approver_ids) a
        WHERE NOT EXISTS(
          SELECT 1 FROM public.document_decisions
          WHERE document_id=d.id AND version=d.version AND approver_id=a AND approved
        )
      ) THEN
        target:='aprovado';
      END IF;
    WHEN 'publish' THEN
      IF NOT is_admin OR d.status<>'aprovado' THEN RAISE EXCEPTION 'Publicação não permitida'; END IF;
      target:='publicado';
    WHEN 'revise' THEN
      IF NOT is_admin OR d.status NOT IN ('publicado','aprovado','em_validacao') THEN
        RAISE EXCEPTION 'Revisão não permitida';
      END IF;
      target:='em_revisao';
    WHEN 'deactivate' THEN
      IF NOT is_admin OR d.status='obsoleto' THEN RAISE EXCEPTION 'Inativação não permitida'; END IF;
      target:='obsoleto';
    ELSE
      RAISE EXCEPTION 'Ação inválida';
  END CASE;

  IF p_action='submit' THEN
    INSERT INTO public.document_versions(document_id,version,snapshot,recorded_by,justification)
    VALUES(d.id,d.version,to_jsonb(d),auth.uid(),btrim(p_reason))
    ON CONFLICT(document_id,version) DO NOTHING;
  END IF;
  UPDATE public.documents SET status=target,
    version=version+CASE WHEN p_action IN ('revise','reject') THEN 1 ELSE 0 END,
    updated_at=clock_timestamp()
  WHERE id=d.id RETURNING * INTO d;
  INSERT INTO public.document_workflows(document_id,from_status,to_status,changed_by,notes,version)
  VALUES(d.id,previous_status,target,auth.uid(),p_action||': '||btrim(p_reason),d.version);
  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_operation_document(uuid,timestamptz,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_operation_document(uuid,timestamptz,text,text) TO authenticated;
