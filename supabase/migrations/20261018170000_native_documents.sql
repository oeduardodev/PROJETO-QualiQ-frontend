-- Native editor: preserve legacy links, HTML, PDF paths and immutable version snapshots.
BEGIN;
ALTER TABLE public.documents
  ADD COLUMN content_json jsonb,
  ADD COLUMN content_revision integer NOT NULL DEFAULT 0 CHECK(content_revision>=0),
  ADD COLUMN content_schema_version integer NOT NULL DEFAULT 1 CHECK(content_schema_version=1),
  ADD COLUMN content_origin text NOT NULL DEFAULT 'native' CHECK(content_origin IN ('native','legacy_html','legacy_pending')),
  ADD COLUMN deleted_at timestamptz;
UPDATE public.documents SET content_origin=CASE
  WHEN nullif(btrim(content_html),'') IS NOT NULL THEN 'legacy_html'
  WHEN nullif(btrim(drive_link),'') IS NOT NULL THEN 'legacy_pending'
  ELSE 'native' END;
-- Archive the exact pre-conversion body even when the current edition has not been submitted.
CREATE TABLE public.document_legacy_archive (
  document_id uuid PRIMARY KEY REFERENCES public.documents(id),
  snapshot jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.document_legacy_archive(document_id,snapshot)
SELECT id,to_jsonb(d) FROM public.documents d;
ALTER TABLE public.document_legacy_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy_archive_admin ON public.document_legacy_archive FOR SELECT TO authenticated
USING(lower(public.get_user_role()::text)='admin');
GRANT SELECT ON public.document_legacy_archive TO authenticated;
REVOKE ALL ON public.document_legacy_archive FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.document_legacy_archive FROM authenticated;
DROP FUNCTION public.sync_operation_document(uuid,timestamptz,uuid,text,text);

CREATE FUNCTION public.validate_native_document(p_json jsonb,p_html text) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE n jsonb; m jsonb; depth integer; count_nodes integer:=0;
BEGIN
  IF p_json IS NULL OR p_json->>'type' IS DISTINCT FROM 'doc' OR jsonb_typeof(p_json->'content') IS DISTINCT FROM 'array'
    OR octet_length(p_json::text)>8388608 OR p_html IS NULL OR octet_length(p_html)>8388608 THEN
    RAISE EXCEPTION 'Conteúdo inválido ou acima de 8 MB';
  END IF;
  FOR n,depth IN WITH RECURSIVE tree(node,level) AS (
    SELECT p_json,0 UNION ALL
    SELECT child.value,tree.level+1 FROM tree CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(tree.node->'content')='array' THEN tree.node->'content' ELSE '[]'::jsonb END) child
      WHERE tree.level<41
  ) SELECT node,level FROM tree LOOP
    count_nodes:=count_nodes+1;
    IF depth>40 OR count_nodes>50000 OR n->>'type' IS NULL OR n->>'type' NOT IN
      ('doc','paragraph','heading','text','hardBreak','horizontalRule','blockquote','codeBlock','bulletList','orderedList','listItem','table','tableRow','tableHeader','tableCell','image','pageBreak')
      OR (n ? 'content' AND jsonb_typeof(n->'content') IS DISTINCT FROM 'array') THEN
      RAISE EXCEPTION 'Estrutura de documento inválida';
    END IF;
    IF n->>'type'='image' AND coalesce(n->'attrs'->>'src','') !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/=[:space:]]+$' THEN
      RAISE EXCEPTION 'Imagens devem ser PNG/JPEG incorporados';
    END IF;
    IF n ? 'marks' THEN
      IF jsonb_typeof(n->'marks') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Formatação inválida'; END IF;
      FOR m IN SELECT value FROM jsonb_array_elements(n->'marks') LOOP
        IF m->>'type' IS NULL OR m->>'type' NOT IN ('bold','italic','underline','strike','code','link','textStyle')
          OR (m->>'type'='link' AND coalesce(m->'attrs'->>'href','') !~* '^(https?://|mailto:)') THEN
          RAISE EXCEPTION 'Formatação ou link inválido';
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_native_document(jsonb,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.save_operation_document(p_id uuid,p_expected_updated_at timestamptz,p_payload jsonb,p_reason text)
RETURNS public.documents LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.documents; saved public.documents; owner uuid; step uuid; process uuid; typ uuid; approvers uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  IF p_id IS NULL THEN
    IF lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Somente administradores podem criar documentos'; END IF;
  ELSE
    SELECT * INTO d FROM public.documents WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR d.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Documento alterado. Recarregue a página'; END IF;
    IF lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' AND d.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
    IF d.deleted_at IS NOT NULL OR d.status NOT IN ('rascunho','em_revisao') THEN RAISE EXCEPTION 'Inicie uma revisão antes de editar'; END IF;
  END IF;
  owner:=(p_payload->>'owner_id')::uuid; step:=(p_payload->>'step_id')::uuid;
  process:=(p_payload->>'process_id')::uuid; typ:=(p_payload->>'type_id')::uuid;
  SELECT array_agg(DISTINCT value::uuid) INTO approvers FROM jsonb_array_elements_text(p_payload->'approver_ids');
  IF nullif(btrim(p_payload->>'title'),'') IS NULL OR owner IS NULL OR process IS NULL OR typ IS NULL
    OR step IS NULL OR coalesce(cardinality(approvers),0)=0 THEN RAISE EXCEPTION 'Informe título, tipo, processo, etapa, responsável e aprovadores'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=owner)
    OR EXISTS(SELECT 1 FROM unnest(approvers) a WHERE NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=a))
    OR NOT EXISTS(SELECT 1 FROM public.sipoc_nodes WHERE id=step AND process_id=process AND node_type='P')
    OR NOT EXISTS(SELECT 1 FROM public.document_types WHERE id=typ AND active) THEN RAISE EXCEPTION 'Vínculos inválidos'; END IF;
  IF p_id IS NOT NULL AND (d.process_id IS DISTINCT FROM process OR d.type_id IS DISTINCT FROM typ) THEN
    RAISE EXCEPTION 'Processo e tipo não podem alterar a identidade de um documento existente';
  END IF;
  IF p_payload ? 'content_json' THEN
    PERFORM public.validate_native_document(p_payload->'content_json',p_payload->>'content_html');
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.documents(title,type_id,process_id,step_id,owner_id,approver_ids,drive_link,status,print_allowed)
    SELECT btrim(p_payload->>'title'),typ,process,step,owner,approvers,NULL,'rascunho',print_allowed FROM public.document_types WHERE id=typ
    RETURNING * INTO saved;
  ELSE
    UPDATE public.documents SET title=btrim(p_payload->>'title'),step_id=step,owner_id=owner,approver_ids=approvers,
      updated_at=clock_timestamp()
    WHERE id=p_id RETURNING * INTO saved;
  END IF;
  IF p_payload ? 'content_json' THEN
    UPDATE public.documents SET content_json=p_payload->'content_json',content_html=p_payload->>'content_html',
      content_schema_version=1,content_revision=content_revision+1,content_origin='native',content_pdf_path=NULL,content_synced_version=NULL
    WHERE id=saved.id RETURNING * INTO saved;
  END IF;
  INSERT INTO public.document_workflows(document_id,from_status,to_status,changed_by,notes,version)
  VALUES(saved.id,d.status,saved.status,auth.uid(),btrim(p_reason),saved.version);
  RETURN saved;
END $$;

CREATE FUNCTION public.save_document_content(p_id uuid,p_expected_updated_at timestamptz,p_json jsonb,p_html text,p_reason text)
RETURNS public.documents LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.documents;
BEGIN
  IF auth.uid() IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Usuário e justificativa obrigatórios'; END IF;
  SELECT * INTO d FROM public.documents WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR d.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Documento alterado. Recarregue a página'; END IF;
  IF d.deleted_at IS NOT NULL OR d.status NOT IN ('rascunho','em_revisao') OR
    (lower(public.get_user_role()::text) IS DISTINCT FROM 'admin' AND d.owner_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Edição não permitida';
  END IF;
  PERFORM public.validate_native_document(p_json,p_html);
  UPDATE public.documents SET content_json=p_json,content_html=p_html,content_origin='native',content_revision=content_revision+1,
    content_pdf_path=NULL,content_synced_version=NULL,updated_at=clock_timestamp()
  WHERE id=p_id RETURNING * INTO d;
  INSERT INTO public.document_workflows(document_id,from_status,to_status,changed_by,notes,version)
  VALUES(d.id,d.status,d.status,auth.uid(),'Edição nativa: '||btrim(p_reason),d.version);
  RETURN d;
END $$;

DROP FUNCTION public.transition_operation_document(uuid,timestamptz,text,text);
CREATE OR REPLACE FUNCTION public.transition_operation_document(
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_action text,
  p_reason text,
  p_pdf_path text DEFAULT NULL
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
  IF d.deleted_at IS NOT NULL AND p_action <> 'restore' THEN RAISE EXCEPTION 'Documento excluído'; END IF;
  target:=d.status;
  previous_status:=d.status;
  CASE p_action
    WHEN 'submit' THEN
      IF d.status NOT IN ('rascunho','em_revisao') OR NOT(is_admin OR d.owner_id=auth.uid()) THEN
        RAISE EXCEPTION 'Envio não permitido';
      END IF;
      IF d.owner_id IS NULL OR d.step_id IS NULL OR cardinality(d.approver_ids)=0
        OR d.content_origin <> 'native' OR d.content_json IS NULL
        OR NOT jsonb_path_exists(d.content_json, '$.** ? (@.type == "image" || (@.type == "text" && @.text != ""))') THEN
        RAISE EXCEPTION 'Complete os responsáveis, a etapa e o conteúdo nativo antes de enviar';
      END IF;
      IF p_pdf_path IS NULL OR p_pdf_path NOT LIKE auth.uid()::text||'/'||d.id::text||'/'||d.version::text||'/'||d.content_revision::text||'/%'
        OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='document-versions' AND name=p_pdf_path) THEN
        RAISE EXCEPTION 'Gere o PDF desta versão antes de enviar';
      END IF;
      UPDATE public.documents SET content_pdf_path=p_pdf_path,content_synced_version=d.version WHERE id=d.id RETURNING * INTO d;
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
    WHEN 'delete' THEN
      IF NOT is_admin OR d.status NOT IN ('rascunho','obsoleto') THEN
        RAISE EXCEPTION 'Somente rascunhos e documentos inativos podem ser excluídos pelo Admin';
      END IF;
      IF EXISTS(SELECT 1 FROM public.controlled_copies WHERE document_id=d.id AND status IN ('solicitada','aprovada','entregue')) THEN
        RAISE EXCEPTION 'Conclua as cópias controladas antes de excluir';
      END IF;
      UPDATE public.documents SET deleted_at=clock_timestamp() WHERE id=d.id;
    WHEN 'restore' THEN
      IF NOT is_admin OR d.deleted_at IS NULL THEN RAISE EXCEPTION 'Restauração não permitida'; END IF;
      UPDATE public.documents SET deleted_at=NULL WHERE id=d.id;
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


-- Only the Edge Function service role uploads trusted snapshots. No client Storage writes.
-- A PDF path is bound to the content revision as well as the workflow edition.
REVOKE ALL ON FUNCTION public.save_document_content(uuid,timestamptz,jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_document_content(uuid,timestamptz,jsonb,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.transition_operation_document(uuid,timestamptz,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_operation_document(uuid,timestamptz,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.save_operation_document(uuid,timestamptz,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_operation_document(uuid,timestamptz,jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
