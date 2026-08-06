alter table public.exercises
  add column if not exists required_equipment text[];

update public.exercises
set required_equipment = case
  when id = 'row_erg' or movement_pattern = 'row' then array['row_erg']::text[]
  when movement_pattern = 'bike' then array['assault_bike']::text[]
  when movement_pattern = 'run' then array['treadmill']::text[]
  when id = 'wu_salto_corda' then array['jump_rope']::text[]
  when id like '%trazioni%' or id = 'wu_scapole' then array['pullup_bar']::text[]
  when id = 'dip_parallele' then array['parallel_bars']::text[]
  when id = 'box_step_up' then array['box']::text[]
  when id like '%elastico%' or id = 'wu_band_pull' then array['resistance_bands']::text[]
  when equipment = 'barbell' then array['barbell']::text[]
  when equipment = 'dumbbell' then array['dumbbells']::text[]
  when equipment = 'machine' then array['machines']::text[]
  when equipment = 'cable' then array['cable']::text[]
  when equipment = 'kettlebell' then array['kettlebells']::text[]
  else '{}'::text[]
end
where required_equipment is null;

alter table public.exercises
  alter column required_equipment set not null;

alter table public.user_settings
  add column if not exists available_equipment text[];

grant select on table public.exercises to authenticated;
grant select, insert, update on table public.user_settings to authenticated;
