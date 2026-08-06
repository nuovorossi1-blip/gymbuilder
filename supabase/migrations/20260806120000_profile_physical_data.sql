alter table public.profiles
  add column if not exists weight_kg numeric,
  add column if not exists height_cm integer,
  add column if not exists age integer,
  add column if not exists sex text not null default 'unspecified';

alter table public.profiles drop constraint if exists profiles_weight_range;
alter table public.profiles add constraint profiles_weight_range check (weight_kg is null or weight_kg between 30 and 300);
alter table public.profiles drop constraint if exists profiles_height_range;
alter table public.profiles add constraint profiles_height_range check (height_cm is null or height_cm between 100 and 250);
alter table public.profiles drop constraint if exists profiles_age_range;
alter table public.profiles add constraint profiles_age_range check (age is null or age between 13 and 120);
alter table public.profiles drop constraint if exists profiles_sex_values;
alter table public.profiles add constraint profiles_sex_values check (sex in ('female', 'male', 'other', 'unspecified'));
