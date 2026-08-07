-- I test hanno mostrato che a corpo libero uscivano sessioni da 1-2 esercizi:
-- mancavano isolamento per petto, spalle e tricipiti senza attrezzi.
insert into public.exercises
(id,name,primary_muscles,secondary_muscles,equipment,movement_pattern,roles,min_experience,
 technical_complexity,systemic_fatigue,local_fatigue,grip_fatigue,cardio_demand,
 default_sets,default_reps,default_rest) values

('piegamenti_larghi','Piegamenti a presa larga','{chest}','{front_delts}','bodyweight','horizontal_push','{isolation,hypertrophy}','beginner',1,2,2,1,2,3,'12-20',75),
('piegamenti_rialzati','Piegamenti con piedi rialzati','{chest}','{front_delts,triceps}','bodyweight','horizontal_push','{compound,hypertrophy}','intermediate',2,2,3,1,2,3,'8-15',90),
('pike_push_up','Piegamenti a V','{front_delts}','{triceps}','bodyweight','vertical_push','{compound,hypertrophy}','intermediate',2,2,3,1,2,3,'8-12',90),
('pike_push_up_facile','Piegamenti a V con ginocchia a terra','{front_delts}','{triceps}','bodyweight','vertical_push','{compound,hypertrophy}','beginner',1,2,2,1,2,3,'10-15',75),
('alzate_laterali_elastico','Alzate laterali con elastico','{lateral_delts}','{}','bodyweight','lateral_raise','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'15-20',60),
('piegamenti_diamante','Piegamenti a diamante','{triceps}','{chest}','bodyweight','elbow_extension','{isolation,hypertrophy}','beginner',1,2,2,1,2,3,'10-15',75),
('rematore_australiano','Rematore australiano','{back}','{biceps,rear_delts}','bodyweight','horizontal_pull','{compound,hypertrophy}','beginner',1,2,2,2,1,3,'10-15',90),
('trazioni_supine','Trazioni a presa supina','{biceps}','{back}','bodyweight','vertical_pull','{isolation,hypertrophy}','intermediate',2,2,3,3,1,3,'6-10',90),
('curl_elastico','Curl con elastico','{biceps}','{}','bodyweight','elbow_flexion','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'15-20',60),
('superman','Superman','{back}','{glutes}','bodyweight','hinge','{isolation}','beginner',1,1,2,1,1,3,'12-15',45),
('reverse_fly_elastico','Aperture posteriori con elastico','{rear_delts}','{}','bodyweight','rear_delt','{isolation,hypertrophy}','beginner',1,1,1,1,1,3,'15-20',60),
('affondi_libero','Affondi a corpo libero','{quads}','{glutes}','bodyweight','lunge','{compound,conditioning}','beginner',1,2,2,1,2,3,'12-20',60),
('nordic_curl','Nordic curl assistito','{hamstrings}','{glutes}','bodyweight','knee_flexion','{isolation,hypertrophy}','intermediate',2,2,3,1,1,3,'6-10',90),
('good_morning_libero','Good morning a corpo libero','{hamstrings}','{glutes,back}','bodyweight','hinge','{compound,hypertrophy}','beginner',1,1,2,1,1,3,'15-20',60),
('calf_libero','Calf a corpo libero','{calves}','{}','bodyweight','jump','{isolation,hypertrophy}','beginner',1,1,2,1,1,4,'20-25',45),
('hollow_hold','Hollow hold','{core}','{}','bodyweight','core','{isolation,core}','beginner',1,1,2,1,1,3,'20-40 sec',60)

on conflict (id) do nothing;;
