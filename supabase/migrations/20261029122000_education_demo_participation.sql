-- Simulated participation for the homologation courses. Existing tenant users are reused;
-- no authentication accounts are created and no pre-existing learning activity is changed.
DO $$
DECLARE
  v_tenant uuid := '00000000-0000-4000-8000-000000000001';
  v_owner uuid;
  v_users uuid[];
BEGIN
  SELECT owner_id INTO v_owner FROM public.learning_items
  WHERE id='71000000-0000-4000-8000-000000000001'
    AND establishment_id=v_tenant AND published;
  IF v_owner IS NULL THEN
    RAISE NOTICE 'Treinamentos de demonstração não encontrados; participações ignoradas';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.learning_quiz_attempts
    WHERE id='76000000-0000-4000-8000-000001000001') THEN
    RAISE NOTICE 'Participações de demonstração já inseridas';
    RETURN;
  END IF;

  SELECT array_agg(id ORDER BY position) INTO v_users FROM (
    SELECT id, row_number() OVER (
      ORDER BY CASE WHEN id=v_owner THEN 1 ELSE 0 END, created_at, id
    ) AS position
    FROM public.profiles p
    WHERE establishment_id=v_tenant AND is_active AND role<>'implantacao'
      AND NOT EXISTS (SELECT 1 FROM public.learning_stage_progress progress
        JOIN public.learning_stages stage ON stage.id=progress.stage_id
        WHERE progress.user_id=p.id AND stage.id::text LIKE '72000000-0000-4000-8000-%')
      AND NOT EXISTS (SELECT 1 FROM public.learning_attendance attendance
        WHERE attendance.user_id=p.id AND attendance.item_id::text LIKE '71000000-0000-4000-8000-%')
    ORDER BY CASE WHEN id=v_owner THEN 1 ELSE 0 END, created_at, id
    LIMIT 4
  ) candidates;
  IF cardinality(coalesce(v_users,'{}'::uuid[]))=0 THEN
    RAISE NOTICE 'Nenhum usuário disponível para a simulação de participações';
    RETURN;
  END IF;

  WITH participants AS (
    SELECT user_id, ordinal::integer AS participant_no
    FROM unnest(v_users) WITH ORDINALITY AS selected(user_id,ordinal)
  ), planned AS (
    SELECT participants.user_id, participants.participant_no,
      stage.id AS stage_id, stage.establishment_id, stage.duration_seconds,
      right(stage.id::text,12)::integer AS stage_no,
      (participants.participant_no=1
        OR (participants.participant_no=2 AND right(stage.id::text,12)::integer<=2)
        OR (participants.participant_no=4 AND right(stage.id::text,12)::integer<=5)) AS done
    FROM participants CROSS JOIN public.learning_stages stage
    WHERE stage.establishment_id=v_tenant
      AND stage.id::text LIKE '72000000-0000-4000-8000-%'
      AND (participants.participant_no=1
        OR (participants.participant_no=2 AND right(stage.id::text,12)::integer<=3)
        OR (participants.participant_no=3 AND right(stage.id::text,12)::integer=1)
        OR (participants.participant_no=4 AND right(stage.id::text,12)::integer<=6))
  )
  INSERT INTO public.learning_stage_progress
    (establishment_id,stage_id,user_id,watched_seconds,access_seconds,quiz_passes,
      replay_required,completed_at,last_access_at)
  SELECT establishment_id,stage_id,user_id,
    CASE WHEN stage_no=3 AND done THEN duration_seconds ELSE 0 END,
    CASE WHEN participant_no=3 THEN 95
      WHEN participant_no=2 AND stage_no=3 THEN 230
      WHEN participant_no=4 AND stage_no=6 THEN 110
      ELSE 360+stage_no*35+participant_no*27 END,
    CASE WHEN done THEN ARRAY(SELECT quiz.id FROM public.learning_quizzes quiz
      WHERE quiz.stage_id=planned.stage_id ORDER BY quiz.position)
      ELSE '{}'::uuid[] END,
    participant_no=2 AND stage_no=3,
    CASE WHEN done THEN now()-interval '4 days'
      +(stage_no+participant_no)*interval '1 hour' ELSE NULL END,
    now()-interval '2 days'+(stage_no+participant_no)*interval '1 hour'
  FROM planned
  ON CONFLICT (stage_id,user_id) DO NOTHING;

  WITH participants AS (
    SELECT user_id, ordinal::integer AS participant_no
    FROM unnest(v_users) WITH ORDINALITY AS selected(user_id,ordinal)
  )
  INSERT INTO public.learning_quiz_attempts
    (id,establishment_id,quiz_id,user_id,score,passed,attempted_at)
  SELECT ('76000000-0000-4000-8000-'
      ||lpad(right(stage.id::text,12)::integer::text,6,'0')
      ||lpad(participants.participant_no::text,6,'0'))::uuid,
    v_tenant,quiz.id,progress.user_id,
    CASE WHEN progress.replay_required THEN 33 ELSE 100 END,
    NOT progress.replay_required,
    coalesce(progress.completed_at,now()-interval '2 days')-interval '10 minutes'
  FROM participants
  JOIN public.learning_stage_progress progress ON progress.user_id=participants.user_id
  JOIN public.learning_stages stage ON stage.id=progress.stage_id
  JOIN public.learning_quizzes quiz ON quiz.stage_id=stage.id
  WHERE stage.id::text LIKE '72000000-0000-4000-8000-%'
    AND (quiz.id=ANY(progress.quiz_passes) OR progress.replay_required)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.learning_attendance
    (establishment_id,item_id,user_id,signed_name,signed_at)
  SELECT v_tenant,item.id,progress.user_id,profile.name,
    max(progress.completed_at)+interval '5 minutes'
  FROM public.learning_items item
  JOIN public.learning_stages stage ON stage.training_id=item.id
  JOIN public.learning_stage_progress progress ON progress.stage_id=stage.id
  JOIN public.profiles profile ON profile.id=progress.user_id
  WHERE item.establishment_id=v_tenant AND item.kind='training'
    AND item.id::text LIKE '71000000-0000-4000-8000-%'
    AND progress.user_id=ANY(v_users)
  GROUP BY item.id,progress.user_id,profile.name
  HAVING count(*)=(SELECT count(*) FROM public.learning_stages
    WHERE training_id=item.id)
    AND bool_and(progress.completed_at IS NOT NULL)
  ON CONFLICT (item_id,user_id) DO NOTHING;

  INSERT INTO public.learning_attendance
    (establishment_id,item_id,user_id,signed_name,signed_at)
  SELECT v_tenant,track.id,profile.id,profile.name,
    max(attendance.signed_at)+interval '5 minutes'
  FROM public.learning_items track
  JOIN public.learning_track_courses course ON course.track_id=track.id
  JOIN public.learning_attendance attendance ON attendance.item_id=course.training_id
  JOIN public.profiles profile ON profile.id=attendance.user_id
  WHERE track.id='71000000-0000-4000-8000-000000000004'
    AND profile.id=ANY(v_users)
  GROUP BY track.id,profile.id,profile.name
  HAVING count(*)=(SELECT count(*) FROM public.learning_track_courses
    WHERE track_id=track.id)
  ON CONFLICT (item_id,user_id) DO NOTHING;
END $$;
