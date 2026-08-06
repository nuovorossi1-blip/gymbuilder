-- Allinea il contratto Profile del client allo schema storico GymBuilder:
-- la chiave proprietario è user_id, non id.
alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists display_name text,
  add column if not exists weight_kg numeric,
  add column if not exists height_cm integer,
  add column if not exists age integer,
  add column if not exists sex text not null default 'unspecified';

-- Se una versione precedente usava id come PK, conserva e riallinea i dati.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
  ) then
    execute 'update public.profiles set user_id = id::text::uuid where user_id is null';
  end if;
end $$;

create unique index if not exists profiles_user_id_key on public.profiles(user_id);

alter table public.profiles enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
