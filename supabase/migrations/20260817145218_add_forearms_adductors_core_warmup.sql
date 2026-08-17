insert into public.exercises (
  id, name, english_name, primary_muscles, secondary_muscles, equipment,
  required_equipment, movement_pattern, roles, exercise_types, workout_roles,
  min_experience, technical_complexity, systemic_fatigue, local_fatigue,
  grip_fatigue, cardio_demand, default_sets, default_reps, default_rest,
  instructions, description, category, metcon_safe, warmup_relevant,
  substitutions, stability_profile, axial_load, unilateral, active
) values
  ('adductor_machine', 'Adductor machine', 'Hip Adduction Machine', array['adductors'], array[]::text[], 'machine', array['machines'], 'hip_adduction', array['isolation','hypertrophy'], array['isolation'], array['hypertrophy'], 'beginner', 1, 1, 2, 1, 1, 3, '12-20', 60, 'Siediti con bacino stabile, chiudi le gambe contro i cuscinetti e ritorna lentamente senza rimbalzi.', 'Isolamento controllato degli adduttori della coscia.', 'machine', false, false, array['copenhagen_plank'], 'guided', 0, false, true),
  ('copenhagen_plank', 'Copenhagen plank', 'Copenhagen Plank', array['adductors'], array['core'], 'bodyweight', array[]::text[], 'hip_adduction', array['isolation','hypertrophy'], array['isolation'], array['hypertrophy'], 'intermediate', 2, 1, 2, 1, 1, 3, '20-30 sec per lato', 60, 'Appoggia la gamba superiore su una panca, solleva il bacino e mantieni il corpo allineato contraendo interno coscia e addome.', 'Tenuta isometrica per adduttori e stabilità del bacino.', 'bodyweight', false, false, array['adductor_machine'], 'free', 0, true, true),
  ('wrist_curl', 'Wrist curl con manubri', 'Dumbbell Wrist Curl', array['forearms'], array[]::text[], 'dumbbell', array['dumbbells'], 'wrist_flexion', array['isolation','hypertrophy'], array['isolation'], array['hypertrophy'], 'beginner', 1, 1, 2, 2, 1, 3, '12-20', 45, 'Appoggia gli avambracci, lascia muovere solo i polsi e flettili controllando completamente la discesa.', 'Flessione del polso per gli avambracci.', 'dumbbell', false, false, array['reverse_wrist_curl'], 'supported', 0, false, true),
  ('reverse_wrist_curl', 'Wrist curl inverso con manubri', 'Reverse Dumbbell Wrist Curl', array['forearms'], array[]::text[], 'dumbbell', array['dumbbells'], 'wrist_extension', array['isolation','hypertrophy'], array['isolation'], array['hypertrophy'], 'beginner', 1, 1, 2, 2, 1, 3, '12-20', 45, 'Appoggia gli avambracci con palmi verso il basso, estendi i polsi senza sollevare i gomiti e ritorna lentamente.', 'Estensione del polso per gli avambracci.', 'dumbbell', false, false, array['wrist_curl'], 'supported', 0, false, true),
  ('wu_bird_dog', 'Bird dog', 'Bird Dog', array['core'], array['glutes'], 'bodyweight', array[]::text[], 'core', array['warmup','core'], array['mobility'], array['warmup'], 'beginner', 1, 1, 1, 1, 1, 1, '8 per lato', 0, 'In quadrupedia estendi lentamente braccio e gamba opposti mantenendo bacino e colonna immobili, poi alterna.', 'Attivazione del core e controllo del bacino nel riscaldamento.', 'mobility', false, true, array['wu_dead_bug'], 'free', 0, true, true)
on conflict (id) do update set
  name = excluded.name, english_name = excluded.english_name,
  primary_muscles = excluded.primary_muscles, secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment, required_equipment = excluded.required_equipment,
  movement_pattern = excluded.movement_pattern, roles = excluded.roles,
  exercise_types = excluded.exercise_types, workout_roles = excluded.workout_roles,
  instructions = excluded.instructions, description = excluded.description,
  substitutions = excluded.substitutions, warmup_relevant = excluded.warmup_relevant,
  active = true;
