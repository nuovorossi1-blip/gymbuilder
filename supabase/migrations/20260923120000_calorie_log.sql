-- La scala (23/09, blocco 2): normocalorica dichiarata e storico delle calorie.
alter table public.profiles
  add column if not exists maintenance_kcal integer check (maintenance_kcal is null or maintenance_kcal between 1000 and 7000);

create table if not exists public.calorie_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kcal integer not null check (kcal between 800 and 8000),
  maintenance_kcal integer,
  step integer not null check (step between -500 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists calorie_log_user_created on public.calorie_log (user_id, created_at desc);
alter table public.calorie_log enable row level security;
create policy "calorie_log select own" on public.calorie_log for select using ((select auth.uid()) = user_id);
create policy "calorie_log insert own" on public.calorie_log for insert with check ((select auth.uid()) = user_id);
create policy "calorie_log delete own" on public.calorie_log for delete using ((select auth.uid()) = user_id);
