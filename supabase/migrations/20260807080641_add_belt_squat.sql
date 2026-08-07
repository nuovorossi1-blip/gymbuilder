insert into public.exercises (
  id, name, english_name, primary_muscles, secondary_muscles, equipment,
  required_equipment, movement_pattern, roles, exercise_types, workout_roles,
  min_experience, technical_complexity, systemic_fatigue, local_fatigue,
  grip_fatigue, cardio_demand, default_sets, default_reps, default_rest,
  instructions, description, category, metcon_safe, warmup_relevant,
  substitutions, active
) values (
  'belt_squat', 'Belt squat', 'Belt squat', array['quads'],
  array['glutes', 'hamstrings'], 'machine', array['machines'], 'squat',
  array['compound', 'hypertrophy'], array['compound'], array['hypertrophy'],
  'beginner', 1, 2, 3, 1, 1, 4, '8-12', 120,
  'Fissa la cintura al carico, mantieni il busto stabile e scendi controllando le ginocchia prima di risalire spingendo il pavimento.',
  'Squat guidato dalla cintura che carica soprattutto le gambe riducendo il carico assiale sulla schiena.',
  'machine', false, false, array['leg_press', 'hack_squat', 'squat'], true
)
on conflict (id) do update set
  name = excluded.name,
  english_name = excluded.english_name,
  primary_muscles = excluded.primary_muscles,
  secondary_muscles = excluded.secondary_muscles,
  required_equipment = excluded.required_equipment,
  instructions = excluded.instructions,
  description = excluded.description,
  substitutions = excluded.substitutions,
  active = true;
