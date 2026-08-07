insert into public.exercises
(id,name,primary_muscles,secondary_muscles,equipment,movement_pattern,roles,min_experience,
 technical_complexity,systemic_fatigue,local_fatigue,grip_fatigue,cardio_demand,
 default_sets,default_reps,default_rest) values

-- PETTO
('panca_piana','Panca piana con bilanciere','{chest}','{triceps,front_delts}','barbell','horizontal_push','{compound,strength,hypertrophy}','intermediate',2,3,3,2,1,4,'6-8',150),
('panca_inclinata_bil','Panca inclinata con bilanciere','{chest}','{front_delts,triceps}','barbell','horizontal_push','{compound,hypertrophy}','intermediate',2,3,3,2,1,4,'8-10',120),
('panca_inclinata_man','Panca inclinata con manubri','{chest}','{front_delts,triceps}','dumbbell','horizontal_push','{compound,hypertrophy}','beginner',2,2,3,2,1,3,'8-12',105),
('chest_press','Chest press alla macchina','{chest}','{triceps,front_delts}','machine','horizontal_push','{compound,hypertrophy}','beginner',1,2,3,1,1,3,'8-12',90),
('croci_cavi','Croci ai cavi','{chest}','{}','cable','horizontal_push','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'12-15',75),
('piegamenti','Piegamenti sulle braccia','{chest}','{triceps,core}','bodyweight','horizontal_push','{compound,hypertrophy}','beginner',1,2,2,1,2,3,'10-20',75),

-- DORSO
('stacco','Stacco da terra','{back,hamstrings}','{glutes,core}','barbell','hinge','{compound,strength}','advanced',3,3,3,3,2,4,'4-6',180),
('rematore_bil','Rematore con bilanciere','{back}','{biceps,rear_delts}','barbell','horizontal_pull','{compound,strength,hypertrophy}','intermediate',2,3,3,3,1,4,'8-10',120),
('trazioni','Trazioni alla sbarra','{back}','{biceps,rear_delts}','bodyweight','vertical_pull','{compound,hypertrophy}','intermediate',2,2,3,3,1,4,'6-12',120),
('lat_machine','Lat machine','{back}','{biceps}','machine','vertical_pull','{compound,hypertrophy}','beginner',1,2,3,2,1,4,'10-12',90),
('pulley','Pulley basso','{back}','{biceps,rear_delts}','cable','horizontal_pull','{compound,hypertrophy}','beginner',1,2,2,2,1,3,'10-12',90),
('rematore_man','Rematore con manubrio','{back}','{biceps}','dumbbell','horizontal_pull','{compound,hypertrophy}','beginner',1,2,2,3,1,3,'10-12',90),
('pullover_cavo','Pullover ai cavi','{back}','{}','cable','vertical_pull','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'12-15',75),

-- SPALLE
('military_press','Lento avanti con bilanciere','{front_delts}','{triceps,core}','barbell','vertical_push','{compound,strength,hypertrophy}','intermediate',2,3,3,2,1,4,'6-8',150),
('shoulder_press_man','Shoulder press con manubri','{front_delts}','{triceps}','dumbbell','vertical_push','{compound,hypertrophy}','beginner',2,2,3,2,1,3,'8-12',105),
('shoulder_press_mac','Shoulder press alla macchina','{front_delts}','{triceps}','machine','vertical_push','{compound,hypertrophy}','beginner',1,2,3,1,1,3,'8-12',90),
('alzate_laterali','Alzate laterali','{lateral_delts}','{}','dumbbell','lateral_raise','{isolation,hypertrophy}','beginner',1,1,2,1,1,4,'12-15',60),
('alzate_laterali_cavo','Alzate laterali ai cavi','{lateral_delts}','{}','cable','lateral_raise','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'12-20',60),
('alzate_90','Alzate a 90 gradi','{rear_delts}','{}','dumbbell','rear_delt','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'12-20',60),
('reverse_pec_deck','Reverse pec deck','{rear_delts}','{}','machine','rear_delt','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'15-20',60),
('face_pull','Face pull','{rear_delts}','{back}','cable','rear_delt','{isolation,hypertrophy}','beginner',1,1,1,1,1,3,'15-20',60),

-- BICIPITI
('curl_bilanciere','Curl con bilanciere','{biceps}','{}','barbell','elbow_flexion','{isolation,hypertrophy}','beginner',1,1,2,2,1,3,'8-12',75),
('curl_manubri','Curl con manubri','{biceps}','{}','dumbbell','elbow_flexion','{isolation,hypertrophy}','beginner',1,1,2,2,1,3,'10-12',75),
('curl_martello','Curl a martello','{biceps}','{}','dumbbell','elbow_flexion','{isolation,hypertrophy}','beginner',1,1,2,2,1,3,'10-12',75),
('curl_cavo','Curl ai cavi','{biceps}','{}','cable','elbow_flexion','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'12-15',60),
('curl_panca_scott','Curl su panca Scott','{biceps}','{}','machine','elbow_flexion','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'10-15',75),

-- TRICIPITI
('french_press','French press','{triceps}','{}','barbell','elbow_extension','{isolation,hypertrophy}','intermediate',2,1,2,1,1,3,'8-12',75),
('pushdown','Pushdown ai cavi','{triceps}','{}','cable','elbow_extension','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'12-15',60),
('estensioni_sopra_testa','Estensioni sopra la testa','{triceps}','{}','cable','elbow_extension','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'12-15',60),
('dip_panca','Dip fra due panche','{triceps}','{chest}','bodyweight','elbow_extension','{compound,hypertrophy}','beginner',1,2,2,1,1,3,'10-15',75),
('dip_parallele','Dip alle parallele','{triceps}','{chest,front_delts}','bodyweight','horizontal_push','{compound,hypertrophy}','intermediate',2,2,3,2,1,3,'8-12',105),

-- QUADRICIPITI
('squat','Squat con bilanciere','{quads}','{glutes,core,hamstrings}','barbell','squat','{compound,strength,hypertrophy}','intermediate',3,3,3,2,2,4,'6-8',180),
('front_squat','Front squat','{quads}','{core,glutes}','barbell','squat','{compound,strength}','advanced',3,3,3,2,2,4,'5-8',180),
('leg_press','Leg press','{quads}','{glutes,hamstrings}','machine','squat','{compound,hypertrophy}','beginner',1,2,3,1,1,4,'10-15',120),
('affondi_man','Affondi con manubri','{quads}','{glutes,hamstrings}','dumbbell','lunge','{compound,hypertrophy}','beginner',2,3,3,2,2,3,'10-12',105),
('hack_squat','Hack squat','{quads}','{glutes}','machine','squat','{compound,hypertrophy}','beginner',1,3,3,1,1,4,'8-12',120),
('leg_extension','Leg extension','{quads}','{}','machine','knee_flexion','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'12-15',75),
('bulgarian_split','Affondo bulgaro','{quads}','{glutes}','dumbbell','lunge','{compound,hypertrophy}','intermediate',2,3,3,2,2,3,'8-12',105),
('goblet_squat','Goblet squat','{quads}','{glutes,core}','dumbbell','squat','{compound,hypertrophy}','beginner',1,2,3,2,2,3,'10-15',90),
('squat_libero','Squat a corpo libero','{quads}','{glutes}','bodyweight','squat','{compound,conditioning}','beginner',1,1,2,1,2,3,'15-25',60),

-- FEMORALI E GLUTEI
('stacco_rumeno','Stacco rumeno','{hamstrings}','{glutes,back}','barbell','hinge','{compound,strength,hypertrophy}','intermediate',2,3,3,3,1,4,'8-10',120),
('stacco_rumeno_man','Stacco rumeno con manubri','{hamstrings}','{glutes}','dumbbell','hinge','{compound,hypertrophy}','beginner',2,2,3,2,1,3,'10-12',105),
('leg_curl','Leg curl','{hamstrings}','{}','machine','knee_flexion','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'12-15',75),
('hip_thrust','Hip thrust','{glutes}','{hamstrings}','barbell','hinge','{compound,hypertrophy}','beginner',2,2,3,1,1,4,'8-12',105),
('glute_bridge','Ponte per glutei','{glutes}','{hamstrings}','bodyweight','hinge','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'15-20',60),
('abduzioni_macchina','Abduzioni alla macchina','{glutes}','{}','machine','hinge','{isolation,hypertrophy}','beginner',1,1,2,1,1,3,'15-20',60),

-- POLPACCI
('calf_in_piedi','Calf in piedi','{calves}','{}','machine','jump','{isolation,hypertrophy}','beginner',1,1,2,1,1,4,'12-15',60),
('calf_seduto','Calf da seduto','{calves}','{}','machine','jump','{isolation,hypertrophy}','beginner',1,1,2,1,1,4,'15-20',60),
('calf_manubri','Calf con manubri','{calves}','{}','dumbbell','jump','{isolation,hypertrophy}','beginner',1,1,2,2,1,4,'15-20',60),

-- CORE
('plank','Plank','{core}','{}','bodyweight','core','{isolation,core}','beginner',1,1,2,1,1,3,'30-60 sec',60),
('crunch_cavo','Crunch ai cavi','{core}','{}','cable','core','{isolation,core,hypertrophy}','beginner',1,1,2,1,1,3,'15-20',60),
('leg_raise','Sollevamento gambe alla sbarra','{core}','{}','bodyweight','core','{isolation,core}','intermediate',2,1,2,3,1,3,'10-15',60),
('russian_twist','Russian twist','{core}','{}','bodyweight','core','{isolation,core,conditioning}','beginner',1,1,2,1,2,3,'20-30',45),

-- RISCALDAMENTO (sez. 11)
('wu_bike','Cyclette leggera','{}','{}','cardio','bike','{warmup,cardio}','beginner',1,1,1,1,2,1,'5 min',0),
('wu_camminata','Camminata veloce sul tapis roulant','{}','{}','cardio','run','{warmup,cardio}','beginner',1,1,1,1,2,1,'5 min',0),
('wu_salto_corda','Saltelli con la corda','{}','{}','bodyweight','jump','{warmup,cardio,conditioning}','beginner',1,1,1,1,3,1,'3 min',0),
('wu_circonduzioni','Circonduzioni delle spalle','{}','{}','bodyweight','lateral_raise','{warmup}','beginner',1,1,1,1,1,2,'15 per lato',0),
('wu_band_pull','Pull apart con elastico','{rear_delts}','{}','bodyweight','rear_delt','{warmup}','beginner',1,1,1,1,1,2,'20',0),
('wu_rotazioni_anca','Rotazioni delle anche','{}','{}','bodyweight','squat','{warmup}','beginner',1,1,1,1,1,2,'10 per lato',0),
('wu_squat_vuoto','Squat a corpo libero lento','{quads}','{}','bodyweight','squat','{warmup}','beginner',1,1,1,1,1,2,'12',0),
('wu_dead_bug','Dead bug','{core}','{}','bodyweight','core','{warmup,core}','beginner',1,1,1,1,1,2,'10 per lato',0),
('wu_scapole','Retrazioni scapolari alla sbarra','{back}','{}','bodyweight','vertical_pull','{warmup}','beginner',1,1,1,2,1,2,'10',0),
('wu_serie_leggera','Serie leggera del primo esercizio','{}','{}','bodyweight','squat','{warmup}','beginner',1,1,1,1,1,2,'12 al 50%',0)

on conflict (id) do nothing;;
