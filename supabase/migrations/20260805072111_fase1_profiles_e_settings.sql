-- GymBuilder - Fase 1: profilo utente e impostazioni di allenamento

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  experience text not null default 'beginner'
    check (experience in ('beginner','intermediate','advanced')),
  primary_goal text not null default 'hypertrophy'
    check (primary_goal in ('hypertrophy','strength','conditioning','mixed')),
  training_frequency smallint not null default 3
    check (training_frequency between 1 and 7),
  default_duration smallint not null default 60
    check (default_duration between 15 and 180),
  equipment text not null default 'full_gym'
    check (equipment in ('full_gym','barbell','dumbbells','machines',
                         'barbell_dumbbells','barbell_machines','dumbbells_machines',
                         'home_gym','bodyweight')),
  priority_muscles text[] not null default '{}',
  excluded_exercises text[] not null default '{}',
  favorite_exercises text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;

-- Ogni utente vede e modifica soltanto i propri dati (specifica sez. 55)
create policy "profilo proprio: lettura"   on public.profiles
  for select using ((select auth.uid()) = id);
create policy "profilo proprio: modifica"  on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profilo proprio: creazione" on public.profiles
  for insert with check ((select auth.uid()) = id);

create policy "impostazioni proprie: lettura"   on public.user_settings
  for select using ((select auth.uid()) = user_id);
create policy "impostazioni proprie: modifica"  on public.user_settings
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "impostazioni proprie: creazione" on public.user_settings
  for insert with check ((select auth.uid()) = user_id);

-- Alla registrazione crea automaticamente profilo e impostazioni di default
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automatico
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();;
