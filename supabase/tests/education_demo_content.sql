BEGIN;
DO $$ BEGIN
  ASSERT (SELECT count(*)=4 FROM public.learning_items WHERE id::text LIKE '71000000-%' AND published),
    'Expected three published trainings and one track';
  ASSERT (SELECT count(*)=7 FROM public.learning_stages WHERE id::text LIKE '72000000-%'),
    'Demo stages missing';
  ASSERT (SELECT count(*)=7 FROM public.learning_quizzes WHERE id::text LIKE '73000000-%'),
    'Demo quizzes missing';
  ASSERT (SELECT count(*)=10 FROM public.learning_questions WHERE id::text LIKE '74000000-%'),
    'Demo questions missing';
  ASSERT (SELECT count(*)=3 FROM public.learning_track_courses
    WHERE track_id='71000000-0000-4000-8000-000000000004'), 'Track order missing';
  ASSERT (SELECT count(DISTINCT correct_index)>1 FROM public.learning_questions
    WHERE id::text LIKE '74000000-%'), 'All answers use the same position';
  ASSERT (SELECT action_plan_id='60000000-0000-4000-8000-000000000001' FROM public.learning_items
    WHERE id='71000000-0000-4000-8000-000000000004'), 'Existing action plan was not linked';
  ASSERT (SELECT count(*)=0 FROM public.learning_items WHERE establishment_id='00000000-0000-4000-8000-000000000002'),
    'Seed leaked into another establishment';
END $$;
ROLLBACK;
