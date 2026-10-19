-- Run after fixtures/native_documents_base.sql and the native-documents migration,
-- using scripts/test-native-documents-db.mjs in a temporary cluster.
BEGIN;
DO $$
DECLARE d public.documents; old_token timestamptz; source jsonb; pdf_path text; preserved_snapshot jsonb; failed boolean;
BEGIN
  ASSERT (SELECT content_origin='legacy_html' AND content_html='<h1>Original</h1>' AND content_pdf_path='old/original.pdf' FROM public.documents WHERE id='40000000-0000-0000-0000-000000000001'), 'Legacy HTML/PDF was not preserved';
  ASSERT (SELECT content_origin='legacy_pending' FROM public.documents WHERE id='40000000-0000-0000-0000-000000000002'), 'Missing legacy content was not flagged';
  ASSERT (SELECT count(*)=2 FROM public.document_legacy_archive), 'Migration archive missing';
  ASSERT NOT has_function_privilege('anon','public.save_operation_document(uuid,timestamptz,jsonb,text)','EXECUTE'), 'Anonymous save allowed';
  ASSERT NOT has_function_privilege('anon','public.save_document_content(uuid,timestamptz,jsonb,text,text)','EXECUTE'), 'Anonymous content save allowed';
  ASSERT to_regprocedure('public.sync_operation_document(uuid,timestamptz,uuid,text,text)') IS NULL, 'Google sync still callable';
  source:='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Conteúdo aprovado"}]}]}';
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  SELECT * INTO d FROM public.save_operation_document(NULL,NULL,jsonb_build_object(
    'title','Documento nativo','type_id','10000000-0000-0000-0000-000000000001',
    'process_id','30000000-0000-0000-0000-000000000001','step_id','20000000-0000-0000-0000-000000000001',
    'owner_id','00000000-0000-0000-0000-000000000002','approver_ids',jsonb_build_array('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004'),
    'content_json',source,'content_html','<p>Conteúdo aprovado</p>'),'Criação');
  ASSERT d.content_json=source AND d.content_revision=1 AND d.drive_link IS NULL, 'Creation did not save native body';
  old_token:=d.updated_at;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  failed:=false;
  BEGIN PERFORM public.save_document_content(d.id,d.updated_at,source,'<p>Alteração</p>','Tentativa');
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  ASSERT failed,'Non-owner was able to edit';
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  SELECT * INTO d FROM public.save_document_content(d.id,d.updated_at,source,'<p>Conteúdo aprovado</p>','Revisão');
  ASSERT d.content_revision=2 AND d.content_pdf_path IS NULL,'Autosave did not invalidate PDF';
  failed:=false;
  BEGIN PERFORM public.save_document_content(d.id,old_token,source,'<p>Obsoleto</p>','Aba antiga');
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  ASSERT failed,'Stale tab overwrote content';
  failed:=false;
  BEGIN PERFORM public.save_document_content(d.id,d.updated_at,'{"type":"doc","content":[{"type":"image","attrs":{"src":"https://external.invalid/image.png"}}]}','<p>Imagem</p>','Imagem');
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  ASSERT failed,'External image was accepted';
  failed:=false;
  BEGIN PERFORM public.transition_operation_document(d.id,d.updated_at,'submit','Validar');
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  ASSERT failed,'Submission without trusted PDF succeeded';
  -- Service-role storage operation is represented by this superuser insertion.
  pdf_path:=auth.uid()::text||'/'||d.id::text||'/1/1/stale.pdf';
  INSERT INTO storage.objects VALUES('document-versions',pdf_path);
  failed:=false;
  BEGIN PERFORM public.transition_operation_document(d.id,d.updated_at,'submit','Validar',pdf_path);
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  ASSERT failed,'PDF from an older content revision was accepted';
  pdf_path:=auth.uid()::text||'/'||d.id::text||'/1/2/current.pdf';
  INSERT INTO storage.objects VALUES('document-versions',pdf_path);
  SELECT * INTO d FROM public.transition_operation_document(d.id,d.updated_at,'submit','Validar',pdf_path);
  ASSERT d.status='em_validacao','Submission failed';
  SELECT v.snapshot INTO preserved_snapshot FROM public.document_versions v WHERE document_id=d.id AND version=1;
  ASSERT preserved_snapshot->'content_json'=source AND preserved_snapshot->>'content_pdf_path'=pdf_path,'Snapshot body/PDF mismatch';
  failed:=false;
  BEGIN PERFORM public.save_document_content(d.id,d.updated_at,source,'<p>Mudança</p>','Mudar durante aprovação');
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  ASSERT failed,'Content changed during approval';
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  SELECT * INTO d FROM public.transition_operation_document(d.id,d.updated_at,'approve','De acordo');
  ASSERT d.status='em_validacao','Published before all approvers';
  SELECT * INTO d FROM public.transition_operation_document(d.id,d.updated_at,'approve','Repetição segura');
  ASSERT (SELECT count(*)=1 FROM public.document_decisions WHERE document_id=d.id),'Approval retry duplicated a decision';
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
  SELECT * INTO d FROM public.transition_operation_document(d.id,d.updated_at,'approve','De acordo');
  ASSERT d.status='aprovado','All approvals not recognized';
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  SELECT * INTO d FROM public.transition_operation_document(d.id,d.updated_at,'publish','Publicação');
  failed:=false;
  BEGIN PERFORM public.transition_operation_document(d.id,d.updated_at,'delete','Excluir publicado');
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  ASSERT failed,'Published document was deleted';
  SELECT * INTO d FROM public.transition_operation_document(d.id,d.updated_at,'deactivate','Substituído');
  INSERT INTO public.controlled_copies VALUES(d.id,'entregue');
  failed:=false;
  BEGIN PERFORM public.transition_operation_document(d.id,d.updated_at,'delete','Excluir');
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  ASSERT failed,'Document with an outstanding copy was deleted';
  UPDATE public.controlled_copies SET status='recolhida' WHERE document_id=d.id;
  SELECT * INTO d FROM public.transition_operation_document(d.id,d.updated_at,'delete','Excluir');
  ASSERT d.deleted_at IS NOT NULL,'Soft deletion failed';
  SELECT * INTO d FROM public.transition_operation_document(d.id,d.updated_at,'restore','Restaurar');
  ASSERT d.deleted_at IS NULL AND d.status='obsoleto','Restoration failed';
  ASSERT (SELECT v.snapshot=preserved_snapshot FROM public.document_versions v WHERE document_id=d.id AND version=1),'Immutable snapshot changed';
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE failed boolean:=false; BEGIN
  BEGIN UPDATE public.documents SET title='Bypass'; EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
  ASSERT failed,'Direct document write allowed';
  failed:=false;
  BEGIN INSERT INTO storage.objects VALUES('document-versions','forged.pdf'); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
  ASSERT failed,'Client uploaded a forged approval PDF';
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Native document migration, access, concurrency, snapshots and workflow: PASS' AS result;
