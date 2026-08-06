-- Phase 2: completa il catalogo senza interrompere i client della prima versione.
-- I nuovi campi vengono popolati prima di diventare NOT NULL.

alter table public.exercises
  add column if not exists english_name text,
  add column if not exists category text,
  add column if not exists exercise_types text[],
  add column if not exists workout_roles text[],
  add column if not exists metcon_safe boolean,
  add column if not exists warmup_relevant boolean,
  add column if not exists description text,
  add column if not exists substitutions text[];

update public.exercises
set
  english_name = coalesce(nullif(btrim(english_name), ''), name),
  category = coalesce(category, case
    when roles @> array['warmup']::text[] then 'mobility'
    when roles @> array['conditioning']::text[] and equipment = 'bodyweight' then 'conditioning'
    else equipment
  end),
  exercise_types = coalesce(exercise_types, array_remove(array[
    case when roles @> array['compound']::text[] then 'compound' end,
    case when roles && array['isolation', 'core']::text[] then 'isolation' end,
    case when roles && array['conditioning', 'cardio']::text[] then 'conditioning' end,
    case when roles @> array['warmup']::text[] then 'mobility' end
  ], null)),
  workout_roles = coalesce(workout_roles, case
    when cardinality(array_remove(array[
      case when roles @> array['warmup']::text[] then 'warmup' end,
      case when roles @> array['strength']::text[] then 'strength' end,
      case when roles @> array['hypertrophy']::text[] then 'hypertrophy' end,
      case when roles && array['conditioning', 'cardio']::text[] then 'metcon' end
    ], null)) = 0 then array['hypertrophy']::text[]
    else array_remove(array[
      case when roles @> array['warmup']::text[] then 'warmup' end,
      case when roles @> array['strength']::text[] then 'strength' end,
      case when roles @> array['hypertrophy']::text[] then 'hypertrophy' end,
      case when roles && array['conditioning', 'cardio']::text[] then 'metcon' end
    ], null)
  end),
  metcon_safe = coalesce(
    metcon_safe,
    roles && array['conditioning', 'cardio']::text[] and technical_complexity <= 2
  ),
  warmup_relevant = coalesce(warmup_relevant, roles @> array['warmup']::text[]),
  description = coalesce(nullif(btrim(description), ''), nullif(btrim(instructions), ''), name),
  substitutions = coalesce(substitutions, '{}'::text[]);

alter table public.exercises
  alter column english_name set not null,
  alter column category set not null,
  alter column exercise_types set not null,
  alter column workout_roles set not null,
  alter column metcon_safe set not null,
  alter column warmup_relevant set not null,
  alter column description set not null,
  alter column substitutions set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'exercises_category_valid'
      and conrelid = 'public.exercises'::regclass
  ) then
    alter table public.exercises add constraint exercises_category_valid check (
      category = any (array[
        'barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight',
        'conditioning', 'cardio', 'mobility', 'olympic', 'gymnastics'
      ])
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'exercises_fatigue_scale_valid'
      and conrelid = 'public.exercises'::regclass
  ) then
    alter table public.exercises add constraint exercises_fatigue_scale_valid check (
      technical_complexity between 1 and 3 and
      systemic_fatigue between 1 and 3 and
      local_fatigue between 1 and 3 and
      grip_fatigue between 1 and 3 and
      cardio_demand between 1 and 3
    );
  end if;
end $$;

alter table public.exercises enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exercises'
      and policyname = 'Authenticated users can read active exercises'
  ) then
    create policy "Authenticated users can read active exercises"
      on public.exercises for select
      to authenticated
      using (active = true);
  end if;
end $$;

grant usage on schema public to authenticated;
grant select on table public.exercises to authenticated;

create index if not exists exercises_active_equipment_idx
  on public.exercises (equipment)
  where active = true;
