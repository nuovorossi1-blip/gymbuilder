-- Espansione CrossFit: movimenti funzionali beginner/intermediate e advanced.
-- `intermediate` resta un dato interno; nella UI è compreso in Principiante.
with crossfit_catalog as (
  select * from jsonb_to_recordset($catalog$
  [
    {"id":"running","name":"Corsa","en":"Running","p":["quads"],"s":["hamstrings","glutes","core"],"eq":"cardio","req":["treadmill"],"pat":"run","exp":"beginner","tech":1,"sys":2,"grip":1,"cardio":3},
    {"id":"jump_rope","name":"Saltare la corda","en":"Jump Rope","p":["calves"],"s":["quads","core"],"eq":"bodyweight","req":["jump_rope"],"pat":"jump","exp":"beginner","tech":1,"sys":2,"grip":1,"cardio":3},
    {"id":"jumping_jack","name":"Jumping jack","en":"Jumping Jack","p":["calves"],"s":["quads","front_delts"],"eq":"bodyweight","req":[],"pat":"jump","exp":"beginner","tech":1,"sys":1,"grip":1,"cardio":2},
    {"id":"farmers_walk","name":"Camminata con pesi","en":"Farmer's Walk","p":["core"],"s":["back","quads"],"eq":"dumbbell","req":["dumbbells"],"pat":"carry","exp":"beginner","tech":1,"sys":2,"grip":3,"cardio":2},
    {"id":"wall_ball","name":"Wall ball","en":"Wall Ball","p":["quads","front_delts"],"s":["glutes","triceps","core"],"eq":"bodyweight","req":[],"pat":"squat","exp":"beginner","tech":2,"sys":3,"grip":1,"cardio":3},
    {"id":"turkish_get_up","name":"Turkish get-up","en":"Turkish Get-Up","p":["core","front_delts"],"s":["glutes","triceps"],"eq":"kettlebell","req":["kettlebells"],"pat":"core","exp":"intermediate","tech":3,"sys":2,"grip":2,"cardio":1},
    {"id":"pullup_assisted","name":"Trazioni assistite","en":"Assisted Pull-Up","p":["back"],"s":["biceps","rear_delts"],"eq":"bodyweight","req":["pullup_bar","resistance_bands"],"pat":"vertical_pull","exp":"beginner","tech":1,"sys":2,"grip":2,"cardio":1},
    {"id":"jumping_pullup","name":"Trazioni jumping","en":"Jumping Pull-Up","p":["back"],"s":["biceps","quads"],"eq":"bodyweight","req":["pullup_bar","box"],"pat":"vertical_pull","exp":"beginner","tech":2,"sys":2,"grip":2,"cardio":2},
    {"id":"dip_assisted","name":"Dip assistiti","en":"Assisted Dip","p":["triceps"],"s":["chest","front_delts"],"eq":"bodyweight","req":["parallel_bars","resistance_bands"],"pat":"vertical_push","exp":"beginner","tech":1,"sys":2,"grip":1,"cardio":1},
    {"id":"hollow_hold","name":"Hollow hold","en":"Hollow Hold","p":["core"],"s":[],"eq":"bodyweight","req":[],"pat":"core","exp":"beginner","tech":1,"sys":1,"grip":1,"cardio":1},
    {"id":"double_under","name":"Double under","en":"Double Under","p":["calves"],"s":["quads","core"],"eq":"bodyweight","req":["jump_rope"],"pat":"jump","exp":"advanced","tech":3,"sys":2,"grip":1,"cardio":3},
    {"id":"assault_bike","name":"Assault bike","en":"Assault Bike","p":["quads"],"s":["hamstrings","front_delts"],"eq":"cardio","req":["assault_bike"],"pat":"bike","exp":"advanced","tech":1,"sys":3,"grip":1,"cardio":3},
    {"id":"ski_erg","name":"SkiErg","en":"SkiErg","p":["back"],"s":["triceps","core"],"eq":"cardio","req":["ski_erg"],"pat":"row","exp":"advanced","tech":2,"sys":3,"grip":2,"cardio":3},
    {"id":"burpee_over_bar","name":"Burpee oltre il bilanciere","en":"Burpee Over Bar","p":["chest","quads"],"s":["triceps","core"],"eq":"bodyweight","req":["barbell"],"pat":"burpee","exp":"advanced","tech":2,"sys":3,"grip":1,"cardio":3},
    {"id":"box_jump_over","name":"Box jump over","en":"Box Jump Over","p":["quads"],"s":["glutes","calves"],"eq":"bodyweight","req":["box"],"pat":"jump","exp":"advanced","tech":3,"sys":3,"grip":1,"cardio":3},
    {"id":"power_clean","name":"Power clean","en":"Power Clean","p":["quads","back"],"s":["glutes","hamstrings","core"],"eq":"barbell","req":["barbell"],"pat":"hinge","exp":"advanced","tech":3,"sys":3,"grip":3,"cardio":2},
    {"id":"clean_jerk","name":"Clean & jerk","en":"Clean & Jerk","p":["quads","front_delts"],"s":["back","glutes","triceps","core"],"eq":"barbell","req":["barbell"],"pat":"vertical_push","exp":"advanced","tech":3,"sys":3,"grip":3,"cardio":2},
    {"id":"power_snatch","name":"Power snatch","en":"Power Snatch","p":["back","front_delts"],"s":["quads","glutes","core"],"eq":"barbell","req":["barbell"],"pat":"hinge","exp":"advanced","tech":3,"sys":3,"grip":3,"cardio":2},
    {"id":"overhead_squat","name":"Overhead squat","en":"Overhead Squat","p":["quads","front_delts"],"s":["glutes","core"],"eq":"barbell","req":["barbell"],"pat":"squat","exp":"advanced","tech":3,"sys":3,"grip":2,"cardio":2},
    {"id":"push_jerk","name":"Push jerk","en":"Push Jerk","p":["front_delts"],"s":["quads","triceps","core"],"eq":"barbell","req":["barbell"],"pat":"vertical_push","exp":"advanced","tech":3,"sys":3,"grip":2,"cardio":2},
    {"id":"chest_to_bar","name":"Trazioni petto alla sbarra","en":"Chest-to-Bar Pull-Up","p":["back"],"s":["biceps","rear_delts"],"eq":"bodyweight","req":["pullup_bar"],"pat":"vertical_pull","exp":"advanced","tech":3,"sys":3,"grip":3,"cardio":2},
    {"id":"bar_muscle_up","name":"Muscle-up alla sbarra","en":"Bar Muscle-Up","p":["back","triceps"],"s":["biceps","chest","core"],"eq":"bodyweight","req":["pullup_bar"],"pat":"vertical_pull","exp":"advanced","tech":3,"sys":3,"grip":3,"cardio":2},
    {"id":"toes_to_bar","name":"Toes to bar","en":"Toes-to-Bar","p":["core"],"s":["back"],"eq":"bodyweight","req":["pullup_bar"],"pat":"core","exp":"advanced","tech":3,"sys":2,"grip":3,"cardio":2},
    {"id":"handstand_pushup","name":"Flessioni in verticale","en":"Handstand Push-Up","p":["front_delts"],"s":["triceps","core"],"eq":"bodyweight","req":[],"pat":"vertical_push","exp":"advanced","tech":3,"sys":3,"grip":1,"cardio":2},
    {"id":"pistol_squat","name":"Pistol squat","en":"Pistol Squat","p":["quads"],"s":["glutes","core"],"eq":"bodyweight","req":[],"pat":"squat","exp":"advanced","tech":3,"sys":2,"grip":1,"cardio":2}
  ] $catalog$::jsonb) as x(id text,name text,en text,p text[],s text[],eq text,req text[],pat text,exp text,tech smallint,sys smallint,grip smallint,cardio smallint)
)
insert into public.exercises (
  id,name,english_name,primary_muscles,secondary_muscles,equipment,required_equipment,
  movement_pattern,roles,exercise_types,workout_roles,min_experience,technical_complexity,
  systemic_fatigue,local_fatigue,grip_fatigue,cardio_demand,default_sets,default_reps,
  default_rest,instructions,description,category,metcon_safe,warmup_relevant,
  substitutions,stability_profile,axial_load,unilateral,active
)
select id,name,en,p,s,eq,req,pat,
  case when eq='barbell' then array['compound','strength','conditioning']::text[] else array['compound','conditioning']::text[] end,
  array['compound','conditioning']::text[],array['metcon','skill']::text[],
  exp,tech,sys,2,grip,cardio,3,case when pat in ('run','row','bike') then '1 min' else '8-15' end,45,
  'Mantieni tecnica e controllo; scala carico, ripetizioni o variante al tuo livello.',
  name || ': movimento funzionale per CrossFit Standard.',
  case when eq='cardio' then 'cardio' when eq='barbell' then 'olympic' when eq='bodyweight' then 'gymnastics' else 'conditioning' end,
  tech <= 2,true,array[]::text[],'free',case when eq='barbell' then 2 else 0 end,false,true
from crossfit_catalog
on conflict (id) do update set
  name=excluded.name,english_name=excluded.english_name,primary_muscles=excluded.primary_muscles,
  secondary_muscles=excluded.secondary_muscles,equipment=excluded.equipment,required_equipment=excluded.required_equipment,
  movement_pattern=excluded.movement_pattern,roles=excluded.roles,exercise_types=excluded.exercise_types,
  workout_roles=excluded.workout_roles,min_experience=excluded.min_experience,technical_complexity=excluded.technical_complexity,
  systemic_fatigue=excluded.systemic_fatigue,grip_fatigue=excluded.grip_fatigue,cardio_demand=excluded.cardio_demand,
  category=excluded.category,metcon_safe=excluded.metcon_safe,active=true;
