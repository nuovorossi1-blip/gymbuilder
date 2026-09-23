-- Blocco 3 (23/09): diario peso/girovita e piano a scala accettato (mini cut / mini surplus).
create table if not exists public.body_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(5,1) not null check (weight_kg between 30 and 300),
  waist_cm numeric(5,1) check (waist_cm is null or waist_cm between 40 and 200),
  feels_flat boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists body_log_user_created on public.body_log (user_id, created_at desc);
alter table public.body_log enable row level security;
create policy "body_log select own" on public.body_log for select using ((select auth.uid()) = user_id);
create policy "body_log insert own" on public.body_log for insert with check ((select auth.uid()) = user_id);
create policy "body_log delete own" on public.body_log for delete using ((select auth.uid()) = user_id);

alter table public.profiles add column if not exists ladder_plan jsonb;
