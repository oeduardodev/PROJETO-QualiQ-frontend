BEGIN;
DO $$ BEGIN
  ASSERT (SELECT count(*)=7 FROM public.profiles WHERE establishment_id='00000000-0000-4000-8000-000000000001'
    AND 'education'=ANY(module_access)), 'Existing roles were not granted education';
  ASSERT (SELECT 'education'=ANY(module_access) FROM public.custom_roles WHERE id='50000000-0000-4000-8000-000000000001'),
    'Custom role was not granted education';
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
INSERT INTO public.learning_items(id,kind,title,owner_id) VALUES
  ('20000000-0000-4000-8000-000000000001','training','Safety training','10000000-0000-4000-8000-000000000001');
INSERT INTO public.learning_stages(id,training_id,position,title,resource_kind,resource_url,duration_seconds) VALUES
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,'Video','youtube','https://youtu.be/dQw4w9WgXcQ',10);
INSERT INTO public.learning_quizzes(id,stage_id,title,cue_seconds,passing_score,position) VALUES
  ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Knowledge check',3,70,1);
INSERT INTO public.learning_questions(quiz_id,position,prompt,options,correct_index) VALUES
  ('40000000-0000-4000-8000-000000000001',1,'Which answer is correct?',ARRAY['Correct','Incorrect'],0);
UPDATE public.learning_items SET published=true WHERE id='20000000-0000-4000-8000-000000000001';
RESET ROLE;
UPDATE public.profiles SET module_access='{}' WHERE id='10000000-0000-4000-8000-000000000003';
SET ROLE authenticated;
DO $$ DECLARE user_id uuid; BEGIN
  FOREACH user_id IN ARRAY ARRAY[
    '10000000-0000-4000-8000-000000000003'::uuid,'10000000-0000-4000-8000-000000000004'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,'10000000-0000-4000-8000-000000000006'::uuid,
    '10000000-0000-4000-8000-000000000007'::uuid,'10000000-0000-4000-8000-000000000008'::uuid]
  LOOP
    PERFORM set_config('request.jwt.claim.sub',user_id::text,true);
    ASSERT public.user_has_module_access('education'), 'Role lost education access';
    ASSERT (SELECT count(*)=1 FROM public.learning_items
      WHERE id='20000000-0000-4000-8000-000000000001'), 'Role cannot read published training';
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
END $$;
DO $$ BEGIN
  ASSERT (SELECT count(*)=1 FROM public.learning_items
    WHERE id='20000000-0000-4000-8000-000000000001'), 'Author cannot read their course';
  ASSERT (public.learning_public_questions('40000000-0000-4000-8000-000000000001')->0 ? 'prompt'), 'Question unavailable';
  ASSERT NOT (public.learning_public_questions('40000000-0000-4000-8000-000000000001')->0 ? 'correct_index'), 'Answer leaked';
  BEGIN
    INSERT INTO public.learning_stages(training_id,position,title,resource_kind,resource_url)
      VALUES ('20000000-0000-4000-8000-000000000001',2,'Unexpected','pdf','https://example.org/file.pdf');
    RAISE EXCEPTION 'Published structure changed';
  EXCEPTION WHEN others THEN
    IF SQLERRM='Published structure changed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.learning_complete_stage('30000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Stage advanced without study';
  EXCEPTION WHEN others THEN
    IF SQLERRM='Stage advanced without study' THEN RAISE; END IF;
  END;
END $$;
SELECT public.learning_record_access('30000000-0000-4000-8000-000000000001',0);
RESET ROLE;
UPDATE public.learning_stage_progress SET watched_seconds=3 WHERE stage_id='30000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
  result:=public.learning_submit_quiz('40000000-0000-4000-8000-000000000001',ARRAY[1]);
  ASSERT (result->>'passed')::boolean=false, 'Wrong answer passed';
  ASSERT (SELECT replay_required AND watched_seconds=0 FROM public.learning_stage_progress WHERE stage_id='30000000-0000-4000-8000-000000000001'), 'Replay did not reset progress';
  BEGIN
    PERFORM public.learning_submit_quiz('40000000-0000-4000-8000-000000000001',ARRAY[0]);
    RAISE EXCEPTION 'Retake allowed without replay';
  EXCEPTION WHEN others THEN
    IF SQLERRM='Retake allowed without replay' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
UPDATE public.learning_stage_progress SET watched_seconds=10 WHERE stage_id='30000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
  result:=public.learning_submit_quiz('40000000-0000-4000-8000-000000000001',ARRAY[0]);
  ASSERT (result->>'passed')::boolean, 'Correct answer failed';
  PERFORM public.learning_complete_stage('30000000-0000-4000-8000-000000000001');
  BEGIN
    PERFORM public.learning_sign_attendance('20000000-0000-4000-8000-000000000001','Someone Else');
    RAISE EXCEPTION 'Incorrect signature accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM='Incorrect signature accepted' THEN RAISE; END IF;
  END;
  PERFORM public.learning_sign_attendance('20000000-0000-4000-8000-000000000001','Course Author');
  ASSERT (SELECT count(*)=1 FROM public.learning_attendance
    WHERE item_id='20000000-0000-4000-8000-000000000001'), 'Attendance missing';
END $$;
INSERT INTO public.learning_items(id,kind,title,owner_id) VALUES
  ('20000000-0000-4000-8000-000000000002','track','Safety track','10000000-0000-4000-8000-000000000001');
INSERT INTO public.learning_track_courses(track_id,training_id,position) VALUES
  ('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',1);
UPDATE public.learning_items SET published=true WHERE id='20000000-0000-4000-8000-000000000002';
SELECT public.learning_sign_attendance('20000000-0000-4000-8000-000000000002','Course Author');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
  ASSERT (SELECT count(*)=0 FROM public.learning_items), 'Other tenant read education data';
  BEGIN
    PERFORM public.learning_public_questions('40000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Other tenant read questions';
  EXCEPTION WHEN others THEN
    IF SQLERRM='Other tenant read questions' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.learning_record_access('30000000-0000-4000-8000-000000000001',0);
    RAISE EXCEPTION 'Other tenant accessed stage';
  EXCEPTION WHEN others THEN
    IF SQLERRM='Other tenant accessed stage' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
