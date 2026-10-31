BEGIN;
DO $$ BEGIN
  ASSERT (SELECT count(DISTINCT user_id)=4 FROM public.learning_stage_progress
    WHERE stage_id::text LIKE '72000000-0000-4000-8000-%'),
    'Expected four existing users to participate';
  ASSERT (SELECT count(*)=17 FROM public.learning_stage_progress
    WHERE stage_id::text LIKE '72000000-0000-4000-8000-%'),
    'Expected distinct progress stages';
  ASSERT (SELECT count(*)=15 FROM public.learning_quiz_attempts
    WHERE id::text LIKE '76000000-0000-4000-8000-%'),
    'Expected assessment attempts';
  ASSERT (SELECT count(*)=1 FROM public.learning_quiz_attempts
    WHERE id::text LIKE '76000000-0000-4000-8000-%' AND NOT passed AND score=33),
    'Expected a failed video checkpoint';
  ASSERT (SELECT count(*)=7 FROM public.learning_attendance
    WHERE item_id::text LIKE '71000000-0000-4000-8000-%'),
    'Expected course and track signatures';
  ASSERT (SELECT count(*)=3 FROM public.learning_attendance
    WHERE item_id='71000000-0000-4000-8000-000000000001'),
    'Incident training should have three completions';
  ASSERT (SELECT count(*)=1 FROM public.learning_attendance
    WHERE item_id='71000000-0000-4000-8000-000000000004'),
    'Track should have one completion';
  ASSERT (SELECT sum(access_seconds)>6000 FROM public.learning_stage_progress
    WHERE stage_id::text LIKE '72000000-0000-4000-8000-%'),
    'Access duration is missing';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.learning_attendance attendance
    JOIN public.learning_items item ON item.id=attendance.item_id
    WHERE item.id::text LIKE '71000000-0000-4000-8000-%' AND item.kind='training'
      AND EXISTS (SELECT 1 FROM public.learning_stages stage
        WHERE stage.training_id=item.id AND NOT EXISTS (
          SELECT 1 FROM public.learning_stage_progress progress
          WHERE progress.stage_id=stage.id AND progress.user_id=attendance.user_id
            AND progress.completed_at IS NOT NULL))),
    'A training was signed without completing its stages';
  ASSERT (SELECT count(*)=1 FROM public.learning_stage_progress
    WHERE stage_id='72000000-0000-4000-8000-000000000003'
      AND replay_required AND watched_seconds=0 AND completed_at IS NULL),
    'Failed video must require replay';
  ASSERT NOT EXISTS (SELECT 1 FROM public.learning_stage_progress
    WHERE establishment_id='00000000-0000-4000-8000-000000000002'),
    'Progress leaked into another establishment';
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
  ASSERT (SELECT count(*)=17 FROM public.learning_stage_progress
    WHERE stage_id::text LIKE '72000000-0000-4000-8000-%'),
    'Training owner cannot view participant progress';
  ASSERT (SELECT count(*)=7 FROM public.learning_attendance
    WHERE item_id::text LIKE '71000000-0000-4000-8000-%'),
    'Training owner cannot view attendance';
END $$;
ROLLBACK;
