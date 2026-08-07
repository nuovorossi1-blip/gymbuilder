insert into exercises (
  id, name, primary_muscles, secondary_muscles, equipment, movement_pattern, roles,
  min_experience, technical_complexity, systemic_fatigue, local_fatigue, grip_fatigue,
  cardio_demand, default_sets, default_reps, default_rest, active, instructions
) values
(
  'burpee', 'Burpee', array['chest','quads','core'], array['triceps','front_delts','glutes'],
  'bodyweight', 'burpee', array['compound','conditioning'],
  'beginner', 2, 3, 2, 1, 3, 3, '10-15', 45, true,
  'Scendi a terra in piegamento, spingi, salta i piedi verso le mani e balza in alto.'
),
(
  'mountain_climber', 'Mountain climber', array['core'], array['quads','front_delts'],
  'bodyweight', 'core', array['isolation','core','conditioning'],
  'beginner', 1, 2, 2, 1, 3, 3, '30-40', 30, true,
  'In posizione di plank alto, porta un ginocchio al petto alla volta a ritmo sostenuto.'
),
(
  'kb_swing', 'Swing con kettlebell', array['glutes','hamstrings'], array['core','back'],
  'kettlebell', 'hinge', array['compound','conditioning'],
  'intermediate', 2, 3, 2, 2, 3, 3, '15-20', 60, true,
  'Spingi i fianchi indietro e poi in avanti con forza per far oscillare il kettlebell fino all''altezza degli occhi.'
),
(
  'kb_thruster', 'Thruster con kettlebell', array['quads','front_delts'], array['glutes','triceps','core'],
  'kettlebell', 'squat', array['compound','conditioning'],
  'intermediate', 2, 3, 2, 2, 3, 3, '10-15', 60, true,
  'Scendi in squat con il kettlebell al petto e usa lo slancio della risalita per spingerlo sopra la testa.'
),
(
  'db_thruster', 'Thruster con manubri', array['quads','front_delts'], array['glutes','triceps','core'],
  'dumbbell', 'squat', array['compound','conditioning'],
  'beginner', 2, 3, 2, 1, 3, 3, '10-15', 60, true,
  'Scendi in squat con un manubrio per mano alle spalle e usa lo slancio della risalita per spingerli sopra la testa.'
),
(
  'box_step_up', 'Step-up su rialzo', array['quads','glutes'], array['hamstrings','core'],
  'bodyweight', 'lunge', array['compound','conditioning'],
  'beginner', 1, 2, 2, 1, 2, 3, '10-15 per gamba', 45, true,
  'Sali su un rialzo stabile con una gamba spingendo sul tallone, poi scendi controllato e cambia gamba.'
),
(
  'row_erg', 'Vogatore', array['back'], array['hamstrings','biceps','core'],
  'cardio', 'row', array['conditioning','cardio'],
  'beginner', 2, 2, 1, 1, 3, 1, '2 min', 0, true,
  'Spingi con le gambe, poi tira con schiena e braccia mantenendo il busto stabile, nell''ordine inverso al ritorno.'
),
(
  'sit_up', 'Sit-up', array['core'], array[]::text[],
  'bodyweight', 'core', array['isolation','core','conditioning'],
  'beginner', 1, 1, 2, 1, 1, 3, '15-25', 30, true,
  'Da sdraiato con ginocchia piegate, sali portando il busto verso le ginocchia e torna giù controllato.'
);;
